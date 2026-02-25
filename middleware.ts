import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { checkRateLimit, RateLimitPolicies } from '@/lib/rate-limiter';
import { getClientIp } from '@/lib/ip-utils';
import { securityLogger } from '@/lib/logger';
import { protectApiRequest, getCorsHeaders } from '@/lib/security/api-protection';
import { isScraperTool } from '@/lib/security/bot-detection';

// 가이드 앱 공개 경로
const PUBLIC = [
  '/login',
  '/login-test',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/public',
  '/favicon.ico',
  '/assets',
  '/public',
  '/_next',
];

// 가이드 앱 보호 경로 (세션 필요)
const PROTECTED = [
  '/chat', '/chat-test',
  '/translator', '/translator-test',
  '/my-trips',
  '/wallet', '/wallet-test',
  '/map', '/map-test',
  '/checklist', '/checklist-test',
  '/profile', '/profile-test',
  '/memories',       // 여행 다이어리
  '/my-info',        // 내 정보
  '/schedule',       // 여행 일정
  '/chat-bot',       // 챗봇
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 공개 경로는 통과
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next();

  // API 보호: 봇 및 스크래퍼 차단
  if (pathname.startsWith('/api/')) {
    // OPTIONS 요청 (CORS preflight)은 무조건 통과
    if (req.method === 'OPTIONS') {
      const origin = req.headers.get('origin');
      const corsHeaders = getCorsHeaders(origin);
      return NextResponse.json({}, { status: 200, headers: corsHeaders });
    }

    const origin = req.headers.get('origin');
    const host = req.headers.get('host');

    // guide.cruisedot.co.kr 포함 Same-Origin은 무조건 통과
    const isCustomDomain = host && (
      host.includes('cruisedot.co.kr') ||
      host.includes('localhost')
    );
    const isSameOrigin = !origin ||
      (host && origin.includes(host)) ||
      isCustomDomain;

    if (isSameOrigin) {
      const response = NextResponse.next();
      const corsHeaders = getCorsHeaders(origin);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    const userAgent = req.headers.get('user-agent');
    if (!userAgent || userAgent.trim() === '') {
      const response = NextResponse.next();
      const corsHeaders = getCorsHeaders(origin);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    // 스크래퍼 차단
    if (isScraperTool(userAgent)) {
      const corsHeaders = getCorsHeaders(origin);
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403, headers: corsHeaders }
      );
    }

    // API 보호 적용
    const protectionResult = protectApiRequest(req);
    if (protectionResult) {
      const corsHeaders = getCorsHeaders(origin);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        protectionResult.headers.set(key, value);
      });
      return protectionResult;
    }

    // Rate limiting
    const clientIp = getClientIp(req);
    const isAiRequest = pathname.startsWith('/api/chat') ||
      pathname.startsWith('/api/ai/');
    const policy = isAiRequest ? RateLimitPolicies.AI : RateLimitPolicies.API;
    const rateLimitKey = `guide:${clientIp}:${pathname}`;
    const { limited, resetTime } = checkRateLimit(rateLimitKey, policy);

    if (limited) {
      securityLogger.rateLimitExceeded(clientIp, pathname, policy.limit);
      const retryAfter = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : 60;
      const corsHeaders = getCorsHeaders(origin);
      return NextResponse.json(
        { ok: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter), ...corsHeaders } }
      );
    }
  }

  // 보호 경로: 세션 쿠키 없으면 로그인으로
  if (!pathname.startsWith('/api/') && PROTECTED.some(p => pathname.startsWith(p))) {
    const sessionId = req.cookies.get('cg.sid.v2')?.value;
    if (!sessionId) {
      const url = req.nextUrl.clone();
      const isTestPath = pathname.includes('-test');
      url.pathname = isTestPath ? '/login-test' : '/login';
      url.searchParams.set('next', pathname + req.nextUrl.search);
      return NextResponse.redirect(url);
    }

    // 3일 체험 유저는 반드시 -test 경로로만 이동
    const userMode = req.cookies.get('cg.mode')?.value;
    if (userMode === 'test') {
      const testPathMap = [
        { regular: '/chat', test: '/chat-test' },
        { regular: '/translator', test: '/translator-test' },
        { regular: '/wallet', test: '/wallet-test' },
        { regular: '/map', test: '/map-test' },
        { regular: '/checklist', test: '/checklist-test' },
        { regular: '/profile', test: '/profile-test' },
      ];
      const matched = testPathMap.find(({ regular, test }) =>
        (pathname === regular || pathname.startsWith(regular + '/')) &&
        !pathname.startsWith(test)
      );
      if (matched) {
        const url = req.nextUrl.clone();
        url.pathname = matched.test + pathname.slice(matched.regular.length);
        return NextResponse.redirect(url);
      }
    }
  }

  // 보안 헤더
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (pathname.startsWith('/api/')) {
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

export const config = {
  matcher: [
    '/chat/:path*', '/chat-test/:path*',
    '/translator/:path*', '/translator-test/:path*',
    '/my-trips/:path*',
    '/wallet/:path*', '/wallet-test/:path*',
    '/map/:path*', '/map-test/:path*',
    '/checklist/:path*', '/checklist-test/:path*',
    '/profile/:path*', '/profile-test/:path*',
    '/memories/:path*',
    '/my-info/:path*',
    '/schedule/:path*',
    '/chat-bot/:path*',
    '/api/:path*',
    '/login',
    '/login-test',
  ],
};
