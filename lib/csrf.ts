// lib/csrf.ts
import { randomBytes } from 'crypto';

/**
 * CSRF 토큰 생성
 * 32바이트의 랜덤 값을 hex 문자열로 반환
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * CSRF 토큰 검증
 * @param sessionToken - 세션에 저장된 토큰
 * @param requestToken - 요청 헤더에서 받은 토큰
 * @returns 토큰이 일치하면 true, 아니면 false
 */
export function validateCsrfToken(sessionToken: string | null | undefined, requestToken: string | null | undefined): boolean {
  if (!sessionToken || !requestToken) {
    return false;
  }
  
  // 타이밍 공격 방지를 위한 상수 시간 비교
  if (sessionToken.length !== requestToken.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < sessionToken.length; i++) {
    result |= sessionToken.charCodeAt(i) ^ requestToken.charCodeAt(i);
  }
  
  return result === 0;
}

