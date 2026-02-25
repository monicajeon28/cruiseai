/**
 * Google Service Account JWT 인증 (googleapis 라이브러리 없이)
 * Vercel 번들링 이슈 완전 회피
 */

import jwt from 'jsonwebtoken';

// 토큰 캐시 (메모리)
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Google Access Token 가져오기 (REST API 직접 호출용)
 * JWT를 직접 생성하여 Google OAuth2 토큰으로 교환
 */
export async function getGoogleAccessToken(scopes?: string[]): Promise<string> {
  // 캐시된 토큰이 있고 아직 유효하면 재사용 (5분 여유)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300000) {
    return cachedToken.token;
  }

  // 환경변수에서 인증 정보 가져오기
  const rawPrivateKey =
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY ||
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
    process.env.GOOGLE_PRIVATE_KEY ||
    process.env.PRIVATE_KEY;

  const clientEmail =
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL ||
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    process.env.GOOGLE_CLIENT_EMAIL ||
    process.env.CLIENT_EMAIL;

  if (!rawPrivateKey || !clientEmail) {
    throw new Error('Google Service Account 환경변수가 설정되지 않았습니다.');
  }

  // Private Key 형식 정규화
  let privateKey = rawPrivateKey.trim();
  if (privateKey.startsWith('"') || privateKey.startsWith("'")) {
    try {
      privateKey = JSON.parse(privateKey);
    } catch {
      privateKey = privateKey.replace(/^["']+|["']+$/g, '');
    }
  }
  privateKey = privateKey.replace(/\\n/g, '\n');

  // JWT 생성
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 3600; // 1시간
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + expiresIn,
    scope: (scopes || [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets'
    ]).join(' '),
  };

  const signedJwt = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

  // Google OAuth2 토큰 교환
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('[getGoogleAccessToken] Token exchange failed:', errorText);
    throw new Error('Google Access Token 교환 실패');
  }

  const tokenData = await tokenResponse.json();

  // 캐시 저장
  cachedToken = {
    token: tokenData.access_token,
    expiresAt: Date.now() + (expiresIn * 1000),
  };

  return tokenData.access_token;
}
