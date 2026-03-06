// lib/rate-limiter.ts
// [WO-SEC-09] Upstash Redis 기반 분산 Rate Limiter (서버리스 환경 대응)
// 이전: 인메모리 Map — Vercel 서버리스에서 인스턴스 간 공유 불가, 브루트포스 방어 무효
// 변경: Upstash Redis 슬라이딩 윈도우 — 전체 인스턴스 공유, 실제 로그인 브루트포스 방어
// 주의: 환경변수 미설정 시 rate limiting 비활성화 (graceful fallback — 서버 다운 방지)

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// 지연 초기화: 모듈 로드 시점에 crash 방지
let _redis: Redis | null | undefined = undefined;
let _loginLimiter: Ratelimit | null = null;
let _apiLimiter: Ratelimit | null = null;
let _aiLimiter: Ratelimit | null = null;
let _ttsLimiter: Ratelimit | null = null;
let _signupLimiter: Ratelimit | null = null;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn('[RateLimiter] UPSTASH_REDIS_REST_URL/TOKEN not set — rate limiting disabled');
    _redis = null;
    return null;
  }
  _redis = new Redis({ url, token });
  return _redis;
}

function getLoginLimiter(): Ratelimit | null {
  if (_loginLimiter) return _loginLimiter;
  const redis = getRedis();
  if (!redis) return null;
  _loginLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '5 m'), analytics: true, prefix: 'rl:login' });
  return _loginLimiter;
}

function getApiLimiter(): Ratelimit | null {
  if (_apiLimiter) return _apiLimiter;
  const redis = getRedis();
  if (!redis) return null;
  _apiLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m'), analytics: true, prefix: 'rl:api' });
  return _apiLimiter;
}

function getAiLimiter(): Ratelimit | null {
  if (_aiLimiter) return _aiLimiter;
  const redis = getRedis();
  if (!redis) return null;
  _aiLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m'), analytics: true, prefix: 'rl:ai' });
  return _aiLimiter;
}

function getTtsLimiter(): Ratelimit | null {
  if (_ttsLimiter) return _ttsLimiter;
  const redis = getRedis();
  if (!redis) return null;
  _ttsLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 m'), analytics: true, prefix: 'rl:tts' });
  return _ttsLimiter;
}

function getSignupLimiter(): Ratelimit | null {
  if (_signupLimiter) return _signupLimiter;
  const redis = getRedis();
  if (!redis) return null;
  _signupLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 h'), analytics: true, prefix: 'rl:signup' });
  return _signupLimiter;
}

/**
 * 사전 정의된 Rate Limit 정책 (기존 호환성 유지)
 */
export const RateLimitPolicies = {
  // 로그인: 5분에 5번
  LOGIN: {
    limit: 5,
    windowMs: 5 * 60 * 1000,
    _type: 'login' as const,
  },
  // 일반 API: 1분에 60번
  API: {
    limit: 60,
    windowMs: 60 * 1000,
    _type: 'api' as const,
  },
  // AI 요청: 1분에 10번
  AI: {
    limit: 10,
    windowMs: 60 * 1000,
    _type: 'ai' as const,
  },
  // TTS: 1분에 20번 (Supertone 과금 API — 번역 후 재생 패턴 고려)
  TTS: {
    limit: 20,
    windowMs: 60 * 1000,
    _type: 'tts' as const,
  },
  // 엄격한 제한: 1시간에 10번 (회원가입 등)
  STRICT: {
    limit: 10,
    windowMs: 60 * 60 * 1000,
    _type: 'signup' as const,
  },
} as const;

type RateLimitType = 'login' | 'api' | 'ai' | 'tts' | 'signup';

function getLimiterByType(type: RateLimitType): Ratelimit | null {
  switch (type) {
    case 'login': return getLoginLimiter();
    case 'ai': return getAiLimiter();
    case 'tts': return getTtsLimiter();
    case 'signup': return getSignupLimiter();
    case 'api':
    default: return getApiLimiter();
  }
}

/**
 * 헬퍼 함수: IP 주소 기반 Rate Limiting (기존 호환 인터페이스 유지)
 * Redis 미설정 시 항상 통과 (서버 다운 방지)
 */
export async function checkRateLimit(
  identifier: string,
  options: { limit: number; windowMs: number; _type?: RateLimitType }
): Promise<{ limited: boolean; resetTime?: number }> {
  const type: RateLimitType = (options as any)._type ?? 'api';
  const limiter = getLimiterByType(type);

  // Redis 미설정이면 rate limiting 비활성화 (graceful fallback)
  if (!limiter) return { limited: false };

  try {
    const { success, reset } = await limiter.limit(identifier);
    if (!success) {
      return { limited: true, resetTime: reset };
    }
    return { limited: false };
  } catch (err) {
    // Redis 연결 오류 시 통과 (서비스 중단 방지)
    console.error('[RateLimiter] Redis error — allowing request:', err instanceof Error ? err.message : String(err));
    return { limited: false };
  }
}

export default { checkRateLimit };
