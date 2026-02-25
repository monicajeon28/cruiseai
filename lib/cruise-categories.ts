/**
 * 크루즈 사진 카테고리 정의
 * public/크루즈정보사진/ 폴더의 주요 카테고리들
 */

export interface CruiseCategory {
  name: string; // 실제 폴더 이름 (검색에 사용)
  displayName: string; // 사용자에게 표시할 이름
  icon: string; // 이모지 아이콘
  keywords?: string[]; // 검색 키워드
}

export const CRUISE_CATEGORIES: CruiseCategory[] = [
  {
    name: '고객 후기 자료',
    displayName: '고객 후기',
    icon: '💬',
    keywords: ['후기', '리뷰', '경험', '고객'],
  },
  {
    name: '코스타세레나',
    displayName: '코스타 세레나호',
    icon: '🚢',
    keywords: ['코스타', '세레나', '코스타세레나', 'costa', 'serena'],
  },
  {
    name: '로얄 브릴리앙스호',
    displayName: '로얄 브릴리앙스호',
    icon: '⛴️',
    keywords: ['로얄', '브릴리앙스', 'royal', 'brilliance'],
  },
  {
    name: 'MSC벨리시마',
    displayName: 'MSC 벨리시마',
    icon: '🛳️',
    keywords: ['msc', '벨리시마', 'bellissima'],
  },
  {
    name: '오키나와(나하)',
    displayName: '오키나와',
    icon: '🏝️',
    keywords: ['오키나와', '나하', '일본', '오키나와', 'okinawa', 'naha'],
  },
  {
    name: '홍콩',
    displayName: '홍콩',
    icon: '🇭🇰',
    keywords: ['홍콩', 'hongkong', 'hong kong', '카이탁'],
  },
  {
    name: '일본나가사키',
    displayName: '일본 나가사키',
    icon: '🗾',
    keywords: ['나가사키', '일본', 'nagasaki'],
  },
  {
    name: '일본 사세보',
    displayName: '일본 사세보',
    icon: '⛩️',
    keywords: ['사세보', '일본', 'sasebo'],
  },
  {
    name: '대만 기륭(지룽)',
    displayName: '대만 기륭',
    icon: '🇹🇼',
    keywords: ['대만', '기륭', '지룽', 'taiwan', 'keelung'],
  },
  {
    name: '스페인 바르셀로나',
    displayName: '스페인 바르셀로나',
    icon: '🇪🇸',
    keywords: ['스페인', '바르셀로나', 'spain', 'barcelona'],
  },
  {
    name: '그리스 아테네',
    displayName: '그리스 아테네',
    icon: '🇬🇷',
    keywords: ['그리스', '아테네', 'greece', 'athens'],
  },
  {
    name: '이탈리아 로마',
    displayName: '이탈리아 로마',
    icon: '🇮🇹',
    keywords: ['이탈리아', '로마', 'italy', 'rome'],
  },
  {
    name: '일본도쿄',
    displayName: '일본 도쿄',
    icon: '🗼',
    keywords: ['도쿄', '일본', 'tokyo'],
  },
  {
    name: '일본 후쿠오카',
    displayName: '일본 후쿠오카',
    icon: '🍜',
    keywords: ['후쿠오카', '일본', 'fukuoka'],
  },
  {
    name: '싱가포르 머라이언파크',
    displayName: '싱가포르',
    icon: '🦁',
    keywords: ['싱가포르', 'singapore', '머라이언'],
  },
  {
    name: '잠재고객을 위한 기항지',
    displayName: '기항지 관광',
    icon: '🌏',
    keywords: ['기항지', '관광', '여행지', '관광지'],
  },
];

/**
 * 쿼리에 맞는 카테고리들을 찾습니다
 */
export function findRelevantCategories(query: string): CruiseCategory[] {
  const normalizedQuery = query.toLowerCase().trim();

  // 모든 카테고리를 검색하여 매칭되는 것들을 찾습니다
  const matched = CRUISE_CATEGORIES.filter(cat => {
    const nameMatch = cat.name.toLowerCase().includes(normalizedQuery) ||
                      cat.displayName.toLowerCase().includes(normalizedQuery);

    const keywordMatch = cat.keywords?.some(kw =>
      normalizedQuery.includes(kw.toLowerCase()) ||
      kw.toLowerCase().includes(normalizedQuery)
    );

    return nameMatch || keywordMatch;
  });

  // 매칭된 것이 있으면 반환, 없으면 상위 8개 인기 카테고리 반환
  if (matched.length > 0) {
    return matched.slice(0, 8);
  }

  // 기본 추천 카테고리 (인기 있는 순서)
  return CRUISE_CATEGORIES.slice(0, 8);
}
