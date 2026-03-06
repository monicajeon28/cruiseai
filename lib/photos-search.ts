import fs from 'node:fs';
import path from 'node:path';
import { logger } from '@/lib/logger';

// 런타임에만 평가되도록 함수로 변경 (빌드 타임 번들링 방지)
function getPublicRoot() {
  return path.join(process.cwd(), 'public');
}

function getPhotosDir() {
  return path.join(getPublicRoot(), '크루즈정보사진');
}

const EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4']);

function walk(dir: string, acc: string[] = []): string[] {
  let list: fs.Dirent[];
  try {
    list = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const d of list) {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) walk(full, acc);
    else {
      const ext = path.extname(d.name).toLowerCase();
      if (EXTS.has(ext)) acc.push(full);
    }
  }
  return acc;
}

function toItem(fullpath: string) {
  const PUBLIC_ROOT = getPublicRoot();
  const relFromPublic = fullpath.replace(PUBLIC_ROOT, '').replace(/\\/g, '/');
  const url = encodeURI(relFromPublic);
  const basename = path.basename(fullpath, path.extname(fullpath));
  const parts = basename.split(/[_\-\s]+/).filter(Boolean);
  const title = parts.length ? parts[0] : basename;
  const tags = parts.slice(1);
  // 폴더 경로: "크루즈정보사진/코스타세레나/코스타 객실" -> "크루즈정보사진/코스타세레나/코스타 객실"
  const folder = path.dirname(relFromPublic).replace(/^\/+/g, '').replace(/\/크루즈정보사진/, '크루즈정보사진');
  return { url, title, tags, folder };
}

// alias + manifest (캐싱됨 - 한 번만 로드)
let aliasesMap: Record<string, string[]> | null = null;
let manifestItems: { path: string; folder?: string; tags?: string[] }[] | null = null;
let manifestLoaded = false;
let cachedPool: { url: string; title: string; tags: string[]; folder: string }[] | null = null;

// Manifest를 한 번만 로드하는 함수
function loadManifest() {
  if (manifestLoaded) return;

  try {
    const a = path.join(process.cwd(), 'data', 'media-aliases.json');
    if (fs.existsSync(a)) aliasesMap = JSON.parse(fs.readFileSync(a, 'utf8'));
  } catch (e) {}

  try {
    const m = path.join(process.cwd(), 'data', 'image-manifest.json');
    if (fs.existsSync(m)) {
      const raw = JSON.parse(fs.readFileSync(m, 'utf8'));
      manifestItems = Array.isArray(raw.items) ? raw.items : raw;
    }
  } catch (e) {}

  manifestLoaded = true;
}

// Pool을 한 번만 빌드하는 함수 (캐싱)
export function getPhotoPool(): { url: string; title: string; tags: string[]; folder: string }[] {
  if (cachedPool) return cachedPool;

  loadManifest();

  if (manifestItems && manifestItems.length) {
    cachedPool = manifestItems
      .filter((it) => isUnderPhotos(it.path))
      .map((it) => {
        // path에서 폴더 경로 추출: "/크루즈정보사진/코스타세레나/코스타 객실/xxx.jpg"
        // -> "크루즈정보사진/코스타세레나/코스타 객실"
        const dirPath = path.dirname(it.path).replace(/^\/+/g, '');
        return {
          url: encodeURI(it.path),
          title: path.basename(it.path, path.extname(it.path)),
          tags: it.tags ?? [],
          folder: dirPath || (it.folder ?? path.basename(path.dirname(it.path))),
        };
      });
  } else {
    try {
      const PHOTOS_DIR = getPhotosDir();
      // 폴더가 존재하는지 확인
      if (fs.existsSync(PHOTOS_DIR)) {
        const files = walk(PHOTOS_DIR);
        cachedPool = files.map(toItem);
      } else {
        logger.warn('[Photos Search] 크루즈정보사진 폴더가 없습니다:', PHOTOS_DIR);
        cachedPool = [];
      }
    } catch (error) {
      logger.error('[Photos Search] 폴더 접근 오류:', error);
      cachedPool = [];
    }
  }

  return cachedPool;
}

export const norm = (s: string) => (s || '').toString().toLowerCase().normalize('NFKC').trim();
export const squash = (s: string) => norm(s).replace(/\s+/g, '');

function buildAliasIndex(map: Record<string, any>) {
  const idx = new Map<string, string>();
  for (const primary of Object.keys(map)) {
    try {
      const aliases = map[primary];
      idx.set(squash(primary), primary);
      if (Array.isArray(aliases)) {
        for (const a of aliases) if (a) idx.set(squash(a), primary);
      } else if (typeof aliases === 'string') {
        if (aliases) idx.set(squash(aliases), primary);
      } else if (aliases && typeof aliases === 'object') {
        for (const k of Object.keys(aliases)) if (k) idx.set(squash(k), primary);
      }
    } catch (e) {
      logger.warn('[photos] skipping invalid alias entry for', primary, e);
      idx.set(squash(primary), primary);
    }
  }
  return idx;
}

const aliasIndex = aliasesMap ? buildAliasIndex(aliasesMap) : new Map<string, string>();

function expandTerms(q: string): string[] {
  const rawTerms = q.split(/[, ]+/).filter(Boolean);
  const primaries = rawTerms.map((t) => aliasIndex.get(squash(t)) ?? t);
  return Array.from(new Set(primaries.map(squash)));
}

function isUnderPhotos(p: string) {
  return p.startsWith('/크루즈정보사진/') && !p.includes('..');
}

/**
 * 특정 폴더의 하위 폴더 목록을 반환합니다
 * @param folderName 검색할 폴더 이름 (예: "코스타세레나")
 * @returns 하위 폴더 목록 (폴더명, 표시명, 아이콘 포함)
 */
export async function getSubfolders(folderName: string): Promise<Array<{ name: string; displayName: string; icon: string; photoCount: number }>> {
  const pool = getPhotoPool();
  const normalizedFolder = squash(folderName);
  
  // 폴더명에서 마지막 부분만 추출 (예: "크루즈정보사진/코스타세레나" -> "코스타세레나")
  const folderNameParts = folderName.split('/');
  const lastFolderName = folderNameParts[folderNameParts.length - 1];
  const lastFolderNameNorm = squash(lastFolderName);
  
  // 해당 폴더에 속한 모든 사진 찾기 (하위 폴더 포함)
  const folderPhotos = pool.filter(item => {
    const folderPath = item.folder;
    const folderPathNorm = squash(folderPath);
    
    // "크루즈정보사진/코스타세레나" 또는 "코스타세레나" 검색 시
    // "크루즈정보사진/코스타세레나/코스타 객실" 같은 하위 폴더 포함
    const pathParts = folderPath.split('/');
    
    // "크루즈정보사진" 다음 폴더부터 확인
    let searchStartIndex = 0;
    if (pathParts[0] === '크루즈정보사진' && pathParts.length > 1) {
      searchStartIndex = 1;
    }
    
    // 부모 폴더의 인덱스 찾기
    const parentIndex = pathParts.findIndex((p, idx) => idx >= searchStartIndex && squash(p) === lastFolderNameNorm);
    
    if (parentIndex >= 0 && parentIndex < pathParts.length - 1) {
      // 부모 폴더 다음에 하위 폴더가 있음 (부모 폴더 바로 다음이 하위 폴더)
      return true;
    }
    
    return false;
  });
  
  // 하위 폴더 추출 (예: "코스타세레나/코스타 객실")
  const subfolderMap = new Map<string, number>();
  
  folderPhotos.forEach(item => {
    const folderPath = item.folder;
    const pathParts = folderPath.split('/');
    
    // "크루즈정보사진" 다음 폴더부터 확인
    let searchStartIndex = 0;
    if (pathParts[0] === '크루즈정보사진' && pathParts.length > 1) {
      searchStartIndex = 1;
    }
    
    // 부모 폴더의 인덱스 찾기
    const parentIndex = pathParts.findIndex((p, idx) => idx >= searchStartIndex && squash(p) === lastFolderNameNorm);
    
    if (parentIndex >= 0 && parentIndex < pathParts.length - 1) {
      // 부모 폴더 다음에 하위 폴더가 있음
      // 첫 번째 하위 폴더만 추출 (직접 하위 폴더)
      const subfolderPath = pathParts.slice(0, parentIndex + 2).join('/');

      // 중복 제거 및 카운트
      const currentCount = subfolderMap.get(subfolderPath) || 0;
      subfolderMap.set(subfolderPath, currentCount + 1);
    }
  });
  
  logger.log('[getSubfolders] Debug:', {
    folderName,
    lastFolderName,
    folderPhotosCount: folderPhotos.length,
    subfolderMapSize: subfolderMap.size,
    subfolders: Array.from(subfolderMap.entries()).slice(0, 5)
  });
  
  // 폴더명에서 하위 폴더만 추출하여 반환
  const subfolders: Array<{ name: string; displayName: string; icon: string; photoCount: number }> = [];
  const folderIconMap: Record<string, string> = {
    '객실': '🛏️',
    '내부시설': '🏛️',
    '수영장': '🏊',
    '자쿠지': '🛁',
    '엑티비티': '🎯',
    '지도': '🗺️',
    '쉽맵': '🗺️',
    '키즈': '👶',
    '행사': '🎉',
    '외관': '🚢',
    '와이파이': '📶',
    'qna': '❓',
  };
  
  Array.from(subfolderMap.entries()).forEach(([fullPath, count]) => {
    const pathParts = fullPath.split('/');
    const subfolderName = pathParts[pathParts.length - 1];
    
    // 아이콘 찾기
    let icon = '📁';
    for (const [keyword, emoji] of Object.entries(folderIconMap)) {
      if (subfolderName.includes(keyword)) {
        icon = emoji;
        break;
      }
    }
    
    subfolders.push({
      name: fullPath, // 전체 경로 (검색용)
      displayName: subfolderName, // 표시명
      icon,
      photoCount: count,
    });
  });
  
  // 사진 개수 순으로 정렬
  subfolders.sort((a, b) => b.photoCount - a.photoCount);
  
  return subfolders;
}

/**
 * 사진 검색 함수 (최적화됨 - 캐싱 사용)
 * @param query 검색 쿼리
 * @returns { items: Array<{ url: string; title: string; tags: string[] }> }
 */
export async function searchPhotos(query: string): Promise<{
  items: Array<{ url: string; title: string; tags: string[] }>;
}> {
  const q = (query || '').trim();
  if (!q) return { items: [] };

  const terms = expandTerms(q);

  // 캐싱된 pool 사용 (훨씬 빠름!)
  const pool = getPhotoPool();

  // AND 매칭 먼저 시도 (모든 term 포함)
  const scoreItem = (it: (typeof pool)[number]) => {
    let score = 0;
    for (const t of terms) {
      if (squash(it.folder).includes(t)) score += 3;
      if (squash(it.title).includes(t)) score += 2;
      if (it.tags.some((tag) => squash(tag).includes(t))) score += 2;
      if (squash(it.url).includes(t)) score += 1;
    }
    return score;
  };

  let scored: Array<{ score: number; item: (typeof pool)[number] }> = [];
  for (const it of pool) {
    const hay = [it.title, it.folder, it.tags.join(' '), it.url].map(squash).join(' ');
    if (!terms.every((t) => hay.includes(t))) continue;
    scored.push({ score: scoreItem(it), item: it });
  }

  // AND 매칭 결과 없으면 OR 매칭으로 fallback (terms 중 하나라도 포함)
  if (scored.length === 0 && terms.length > 1) {
    for (const it of pool) {
      const hay = [it.title, it.folder, it.tags.join(' '), it.url].map(squash).join(' ');
      if (!terms.some((t) => hay.includes(t))) continue;
      scored.push({ score: scoreItem(it), item: it });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const items = scored.slice(0, 200).map((s) => ({ url: s.item.url, title: s.item.title, tags: s.item.tags }));

  return { items };
}
