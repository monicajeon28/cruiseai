// lib/youtube-video-selector.ts
// 챗봇이 상황에 맞는 YouTube 영상을 선택하는 유틸리티

import * as fs from 'fs';
import * as path from 'path';

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  url: string;
  publishedAt: string;
  keywords?: string[];
}

let videoCache: YouTubeVideo[] | null = null;

// YouTube 영상 데이터 로드
function loadVideos(): YouTubeVideo[] {
  if (videoCache) {
    return videoCache;
  }

  try {
    const filePath = path.join(process.cwd(), 'data', 'youtube-videos.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      videoCache = JSON.parse(data);
      return videoCache || [];
    }
  } catch (error) {
    console.error('[YouTube Video Selector] Failed to load videos:', error);
  }

  return [];
}

// 키워드 매칭 점수 계산
function calculateMatchScore(video: YouTubeVideo, keywords: string[]): number {
  if (!video.keywords || video.keywords.length === 0) {
    return 0;
  }

  let score = 0;
  const videoKeywordsLower = video.keywords.map(k => k.toLowerCase());
  const searchKeywordsLower = keywords.map(k => k.toLowerCase());

  searchKeywordsLower.forEach(keyword => {
    // 정확히 일치하면 높은 점수
    if (videoKeywordsLower.includes(keyword)) {
      score += 10;
    } else {
      // 부분 일치도 점수 부여
      videoKeywordsLower.forEach(vk => {
        if (vk.includes(keyword) || keyword.includes(vk)) {
          score += 3;
        }
      });
    }
  });

  // 제목과 설명에서도 키워드 검색
  const titleLower = video.title.toLowerCase();
  const descLower = video.description.toLowerCase();
  searchKeywordsLower.forEach(keyword => {
    if (titleLower.includes(keyword)) {
      score += 5;
    }
    if (descLower.includes(keyword)) {
      score += 2;
    }
  });

  return score;
}

// 상황에 맞는 영상 선택
export function selectVideos(context: {
  cruiseLine?: string;
  shipName?: string;
  destination?: string;
  category?: string; // '객실', '식사', '공연', '시설', '후기', '가이드', '준비물', '가격' 등
  limit?: number;
}): YouTubeVideo[] {
  const videos = loadVideos();
  if (videos.length === 0) {
    return [];
  }

  const keywords: string[] = [];
  
  // 크루즈 선사 추가
  if (context.cruiseLine) {
    keywords.push(context.cruiseLine);
    // 별칭 매핑
    if (context.cruiseLine.includes('코스타') || context.cruiseLine.includes('COSTA')) {
      keywords.push('코스타', 'COSTA');
    }
    if (context.cruiseLine.includes('MSC')) {
      keywords.push('MSC');
    }
    if (context.cruiseLine.includes('로얄') || context.cruiseLine.includes('ROYAL')) {
      keywords.push('로얄', 'ROYAL', '로얄캐리비안');
    }
  }

  // 선박명 추가
  if (context.shipName) {
    keywords.push(context.shipName);
    // 별칭 매핑
    if (context.shipName.includes('세레나') || context.shipName.includes('Serena')) {
      keywords.push('세레나', 'SERENA');
    }
    if (context.shipName.includes('벨리시마') || context.shipName.includes('Bellissima')) {
      keywords.push('벨리시마', 'BELLISSIMA');
    }
    if (context.shipName.includes('스펙트럼') || context.shipName.includes('Spectrum')) {
      keywords.push('스펙트럼', 'SPECTRUM');
    }
    if (context.shipName.includes('오디세이') || context.shipName.includes('Odyssey')) {
      keywords.push('오디세이', 'ODYSSEY');
    }
  }

  // 목적지 추가
  if (context.destination) {
    keywords.push(context.destination);
  }

  // 카테고리 추가
  if (context.category) {
    keywords.push(context.category);
    // 카테고리 별칭 매핑
    if (context.category === '객실' || context.category === '룸') {
      keywords.push('객실', '룸');
    }
    if (context.category === '식사' || context.category === '음식') {
      keywords.push('식사', '음식', '레스토랑');
    }
    if (context.category === '공연' || context.category === '쇼') {
      keywords.push('공연', '쇼', '뮤지컬');
    }
    if (context.category === '시설') {
      keywords.push('시설', '풀', '수영장');
    }
  }

  // 키워드가 없으면 기본 크루즈 관련 영상 반환
  if (keywords.length === 0) {
    return videos.slice(0, context.limit || 3);
  }

  // 각 영상에 점수 부여
  const scoredVideos = videos.map(video => ({
    video,
    score: calculateMatchScore(video, keywords),
  }));

  // 점수 순으로 정렬하고 상위 N개 선택
  const limit = context.limit || 3;
  return scoredVideos
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.video);
}

// 특정 크루즈 선사에 맞는 영상 선택 (기본값)
export function selectVideosByCruiseLine(cruiseLine: string, limit: number = 3): YouTubeVideo[] {
  return selectVideos({ cruiseLine, limit });
}

// 영상 데이터 새로고침 (스크립트 실행 후 호출)
export function refreshVideoCache(): void {
  videoCache = null;
}

