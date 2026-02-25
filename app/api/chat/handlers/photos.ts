import type { ChatMessage } from '@/lib/chat-types';
import { searchPhotos, getSubfolders } from '@/lib/photos-search';
import { searchImagesFromDB, getSubfoldersFromDB } from '@/lib/image-cache-search';
import prisma from '@/lib/prisma';

export async function handleShowPhotos(text: string): Promise<ChatMessage[]> {
  // DB 캐시에서 이미지 검색 (더 빠름)
  // DB에 데이터가 없으면 기존 방식(로컬 파일/manifest) 사용
  const useDbCache = await prisma.imageCache.count() > 0;
  const result = useDbCache
    ? await searchImagesFromDB(text)
    : await searchPhotos(text);

  // 크루즈 사진이 없어도 구글 이미지 검색 결과를 표시
  if (!result.items || result.items.length === 0) {
    console.log('[handleShowPhotos] No cruise photos found, showing Google Images');

    return [{
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      role: 'assistant',
      type: 'show-me',
      text: `"${text}" 구글 이미지 검색 결과`,
      googleImageUrl: `https://www.google.com/search?q=${encodeURIComponent(text)}&tbm=isch`,
      cruisePhotos: [], // 크루즈 사진 없음
      subfolders: [],
      categories: [],
      query: text,
      // 구글 이미지 검색만 표시
      googleImagesOnly: true
    }];
  }

  // 하위 폴더 검색 (크루즈 선박명 등) - DB에 데이터 있으면 DB 사용
  const subfolders = useDbCache
    ? await getSubfoldersFromDB(text)
    : await getSubfolders(text);
  console.log('[handleShowPhotos] Subfolders found:', {
    query: text,
    subfoldersCount: subfolders.length,
    subfolders: subfolders.slice(0, 5)
  });

  // 검색된 이미지 URL 수집
  const images = result.items.map(item => item.url);

  return [{
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    role: 'assistant',
    type: 'show-me',
    text: `${text} 사진 (${images.length}장)`,
    googleImageUrl: `https://www.google.com/search?q=${encodeURIComponent(text)}&tbm=isch`,
    cruisePhotos: result.items.map(item => ({
      url: item.url,
      title: item.title,
    })),
    subfolders: subfolders.map(folder => ({
      name: folder.name,
      displayName: folder.displayName,
      icon: folder.icon,
      photoCount: folder.photoCount,
    })),
    categories: [],
    query: text,
    googleImagesOnly: false
  }];
} 