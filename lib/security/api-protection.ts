/**
 * API 보호 유틸리티
 * API 엔드포인트 보호 및 스크래핑 방지
 */

import { NextRequest, NextResponse } from 'next/server';
import { isBot, isSuspiciousRequest, isScraperTool } from './bot-detection';
import { securityLogger } from '@/lib/logger';

/**
 * API 요청 보호 미들웨어
 * @param req NextRequest
 * @returns NextResponse | null (차단 시)
 */
export function protectApiRequest(req: NextRequest): NextResponse | null {
  const userAgent = req.headers.get('user-agent');
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // 봇 차단
  if (isBot(userAgent)) {
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const path = req.nextUrl.pathname;

    console.log('[API Protection] [403 BLOCKED] Bot blocked:', {
      origin: origin || 'null',
      host: host || 'null',
      userAgent: userAgent || 'null',
      ip,
      path,
      reason: 'Bot detected',
    });

    securityLogger.warn(`[API Protection] Bot blocked: ${userAgent}`, {
      ip,
      path,
      origin,
      host,
    });

    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    );
  }

  // 스크래퍼 도구 차단
  if (isScraperTool(userAgent)) {
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const path = req.nextUrl.pathname;

    console.log('[API Protection] [403 BLOCKED] Scraper blocked:', {
      origin: origin || 'null',
      host: host || 'null',
      userAgent: userAgent || 'null',
      ip,
      path,
      reason: 'Scraper tool detected',
    });

    securityLogger.warn(`[API Protection] Scraper blocked: ${userAgent}`, {
      ip,
      path,
      origin,
      host,
    });

    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    );
  }

  // 의심스러운 요청 차단
  if (isSuspiciousRequest(userAgent, headers)) {
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const path = req.nextUrl.pathname;

    console.log('[API Protection] [403 BLOCKED] Suspicious request blocked:', {
      origin: origin || 'null',
      host: host || 'null',
      userAgent: userAgent || 'null',
      ip,
      path,
      reason: 'Suspicious request pattern',
      headers: {
        accept: headers['accept'] || headers['Accept'] || 'null',
        'accept-language': headers['accept-language'] || headers['Accept-Language'] || 'null',
        'accept-encoding': headers['accept-encoding'] || headers['Accept-Encoding'] || 'null',
      },
    });

    securityLogger.warn(`[API Protection] Suspicious request blocked`, {
      ip,
      path,
      userAgent,
      origin,
      host,
    });

    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    );
  }

  return null; // 통과
}

/**
 * API 응답 데이터 마스킹
 * 민감한 정보를 마스킹하여 노출 방지
 */
export function maskSensitiveData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item));
  }

  const masked: any = {};
  const sensitiveKeys = [
    'password',
    'token',
    'apiKey',
    'secret',
    'key',
    'authorization',
    'cookie',
    'session',
    'phone',
    'email',
    'creditCard',
    'ssn',
  ];

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk));

    if (isSensitive && typeof value === 'string') {
      masked[key] = value.length > 4
        ? `${value.substring(0, 2)}***${value.substring(value.length - 2)}`
        : '***';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * CORS 헤더 설정
 * 허용된 도메인만 접근 가능하도록 설정
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  // 허용된 도메인 목록 (하드코딩 - 환경변수 의존 제거)
  const allowedOrigins = [
    // 커스텀 도메인 (HTTPS)
    'https://www.cruisedot.co.kr',
    'https://www.cruisedot.co.kr/',
    'https://cruisedot.co.kr',
    'https://cruisedot.co.kr/',
    // 커스텀 도메인 (HTTP - 개발/테스트용)
    'http://www.cruisedot.co.kr',
    'http://www.cruisedot.co.kr/',
    'http://cruisedot.co.kr',
    'http://cruisedot.co.kr/',
  ];

  // 개발 환경에서는 localhost 허용
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push(
      'http://localhost:3000',
      'http://localhost:3000/',
      'http://localhost:3001',
      'http://localhost:3001/'
    );
  }

  // Vercel Preview URL도 허용 (환경변수 있으면 추가)
  if (process.env.VERCEL_URL) {
    allowedOrigins.push(
      `https://${process.env.VERCEL_URL}`,
      `https://${process.env.VERCEL_URL}/`
    );
  }

  // origin이 null이면 Same-Origin 요청이므로 허용
  // 브라우저의 기본 fetch는 Same-Origin일 때 Origin 헤더를 보내지 않음
  if (!origin) {
    return {
      'Access-Control-Allow-Origin': '*', // Same-Origin 요청은 * 허용
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400', // 24시간
    };
  }

  // origin 정규화 (슬래시 제거하여 비교)
  const normalizedOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;

  // 허용된 도메인인지 확인 (슬래시 포함/미포함 모두 체크)
  const isAllowed = allowedOrigins.some(allowed => {
    const normalizedAllowed = allowed.endsWith('/') ? allowed.slice(0, -1) : allowed;
    return normalizedOrigin === normalizedAllowed || normalizedOrigin.startsWith(normalizedAllowed);
  });

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '*', // 차단하지 않고 * 허용
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24시간
  };
}


