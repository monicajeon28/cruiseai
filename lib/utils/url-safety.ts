/**
 * URL 안전성 검증 유틸리티
 * XSS 공격 방지를 위한 URL 유효성 검사
 */

export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  // 위험한 문자 패턴 검사
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i,
    /on\w+\s*=/i, // onclick=, onerror= 등
    /&#/i, // HTML 엔티티 인코딩
    /%3c/i, // URL 인코딩된 <
  ];

  if (dangerousPatterns.some(pattern => pattern.test(url))) {
    return false;
  }

  try {
    const parsed = new URL(url);

    // 허용된 프로토콜만 허용
    const allowedProtocols = ['http:', 'https:'];
    if (!allowedProtocols.includes(parsed.protocol)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * URL을 안전하게 검증하고 정제
 * @param url 검증할 URL
 * @returns 안전한 경우 URL, 위험한 경우 null
 */
export function sanitizeUrl(url: string): string | null {
  return isSafeUrl(url) ? url : null;
}

/**
 * 여러 URL을 안전하게 필터링
 * @param urls URL 배열
 * @returns 안전한 URL만 포함된 배열
 */
export function filterSafeUrls(urls: string[]): string[] {
  return urls.filter(isSafeUrl);
}
