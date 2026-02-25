// lib/chat/detect.ts
// 사용자 의도 감지 유틸리티

/**
 * "보여줘" 의도 감지
 */
export function detectShowMeIntent(text: string): boolean {
  const patterns = [
    /보여\s*줘/,
    /보여\s*주세요/,
    /보여\s*주시오/,
    /사진\s*보여/,
    /이미지\s*보여/,
    /어떻게\s*생겼/,
    /어떤\s*곳/,
  ];
  return patterns.some(p => p.test(text));
}

/**
 * "보여줘" 쿼리 추출
 * 예: "후쿠오카 맛집 보여줘" → "후쿠오카 맛집"
 */
export function extractShowMeQuery(text: string): string {
  return text
    .replace(/보여\s*(줘|주세요|주시오)/g, '')
    .replace(/사진/g, '')
    .replace(/이미지/g, '')
    .replace(/어떻게\s*생겼/g, '')
    .replace(/어떤\s*곳/g, '')
    .trim();
}

/**
 * 구글 이미지 검색 URL 생성
 */
export function googleImageSearch(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`;
}


























