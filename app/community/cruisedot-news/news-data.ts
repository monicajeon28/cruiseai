'use client';

export type CruisedotNewsPost = {
  id: string;
  title: string;
  highlight: string;
  summary: string;
  emoji: string;
  category: string;
  publishedAt: string;
  baseViews: number;
  baseLikes: number;
  baseActiveViewers: number;
  staticPath?: string;
  html?: string;
};

export const normalizeNewsHtml = (rawHtml: string | null | undefined) => {
  const trimmed = (rawHtml ?? '').trim();
  if (!trimmed) {
    return '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8" /></head><body><p>내용이 없습니다.</p></body></html>';
  }

  if (/<!DOCTYPE|<html/i.test(trimmed)) {
    return trimmed;
  }

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8" /></head><body>${trimmed}</body></html>`;
};

export const STATIC_NEWS_POSTS: CruisedotNewsPost[] = [
  {
    id: 'top-05-percent',
    title: '상위 0.5%만 가는 크루즈 여행이 특별한 이유',
    highlight: '대한민국 인구 5천만 명 중 고작 0.5%만 경험했던 크루즈 여행, 왜 이렇게 특별했는지 데이터와 사례로 풀어드립니다.',
    summary: '크루즈 여행이 극소수의 선택이었던 이유와 2024년 이후 급증한 배경을 정리하고, 지금 떠나야 하는 근거를 제시합니다.',
    emoji: '📊',
    category: '현장리포트',
    publishedAt: '2025-01-05',
    baseViews: 82,
    baseLikes: 46,
    baseActiveViewers: 64,
    staticPath: '/cruisedot-news/top-05-percent.html'
  },
  {
    id: 'cruise-myths-truths',
    title: '크루즈 여행에 대한 5가지 오해와 진실',
    highlight: '답답하고 위험하다는 편견부터 가격의 함정까지, 실제 데이터와 비교표로 확인하는 크루즈의 진짜 모습.',
    summary: '많이 듣는 편견 5가지를 신화와 진실로 나누고, 확실한 근거와 비교표로 오해를 해소합니다.',
    emoji: '🧭',
    category: '상품교육',
    publishedAt: '2025-01-08',
    baseViews: 138,
    baseLikes: 79,
    baseActiveViewers: 71,
    staticPath: '/cruisedot-news/cruise-myths-truths.html'
  },
  {
    id: 'domestic-vs-overseas',
    title: '국내 출발 크루즈, 정말 더 편할까? 5가지 진실',
    highlight: '선택지, 이동 시간, 가격, 안전성, 연령대를 전부 비교해 국내 출발의 실제 장단점을 정리했습니다.',
    summary: '국내 출발과 해외 출발을 항목별로 비교하고, 데이터 기반으로 전략적인 선택법을 안내합니다.',
    emoji: '🧳',
    category: '영업전략',
    publishedAt: '2025-01-11',
    baseViews: 164,
    baseLikes: 88,
    baseActiveViewers: 76,
    staticPath: '/cruisedot-news/domestic-vs-overseas.html'
  },
  {
    id: 'five-cruise-experiences',
    title: '크루즈에서만 누릴 수 있는 5가지 특별한 경험',
    highlight: '움직이는 클럽부터 24시간 전담 집사까지, 크루즈에서만 가능한 다섯 가지 경험을 사례와 함께 소개합니다.',
    summary: '육지에서는 누릴 수 없는 크루즈 전용 경험을 다섯 가지 키워드로 정리해 고객에게 상상력을 심어줍니다.',
    emoji: '🎉',
    category: '혜택안내',
    publishedAt: '2025-01-15',
    baseViews: 121,
    baseLikes: 67,
    baseActiveViewers: 69,
    staticPath: '/cruisedot-news/five-cruise-experiences.html'
  },
  {
    id: 'easy-cruise-start',
    title: '크루즈가 궁금하다면? 가장 쉬운 시작법',
    highlight: '크루즈를 처음 고려하는 고객이 바로 상담할 수 있도록, 걱정 포인트와 해결책을 한 눈에 정리했습니다.',
    summary: '가장 많이 묻는 고민을 정리하고 왜 지금 크루즈닷과 상담해야 하는지 근거를 제시합니다.',
    emoji: '🚀',
    category: '본사소식',
    publishedAt: '2025-01-18',
    baseViews: 176,
    baseLikes: 93,
    baseActiveViewers: 83,
    staticPath: '/cruisedot-news/easy-cruise-start.html'
  }
];


