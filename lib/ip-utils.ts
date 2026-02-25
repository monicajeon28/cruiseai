// lib/ip-utils.ts
// IP 주소 추출 유틸리티

import { NextRequest } from 'next/server';

/**
 * NextRequest에서 클라이언트 IP 주소 추출
 * Proxy/Load Balancer를 고려하여 X-Forwarded-For 헤더 우선 사용
 */
export function getClientIp(request: NextRequest): string {
  // X-Forwarded-For 헤더 확인 (프록시/로드밸런서 뒤에 있을 때)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // X-Forwarded-For는 쉼표로 구분된 IP 목록일 수 있음
    // 첫 번째 IP가 실제 클라이언트 IP
    return forwardedFor.split(',')[0].trim();
  }

  // X-Real-IP 헤더 확인 (Nginx 등에서 사용)
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // CF-Connecting-IP 헤더 확인 (Cloudflare)
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp.trim();
  }

  // request.ip 확인 (Next.js 14+)
  if (request.ip) {
    return request.ip;
  }

  // 기본값: 알 수 없는 IP
  return 'unknown';
}

/**
 * Standard Request 객체에서 IP 주소 추출
 */
export function getClientIpFromRequest(request: Request, headers?: Headers): string {
  const headersToUse = headers || (request.headers as Headers);

  const forwardedFor = headersToUse.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = headersToUse.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  const cfIp = headersToUse.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp.trim();
  }

  return 'unknown';
}

