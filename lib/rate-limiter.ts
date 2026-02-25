// lib/rate-limiter.ts
// 메모리 기반 Rate Limiter (무차별 대입 공격 방지)

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 5분마다 만료된 항목 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * 요청 제한 확인 및 카운트 증가
   * @param key - 고유 식별자 (IP 주소, 사용자 ID 등)
   * @param limit - 시간 창 내 허용 요청 수
   * @param windowMs - 시간 창 (밀리초)
   * @returns true if rate limit exceeded, false otherwise
   */
  check(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetTime < now) {
      // 새로운 시간 창 시작
      this.store.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return false;
    }

    if (entry.count >= limit) {
      // 제한 초과
      return true;
    }

    // 카운트 증가
    entry.count++;
    return false;
  }

  /**
   * 특정 키의 제한 초기화
   * @param key - 고유 식별자
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * 만료된 항목 정리
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * 정리 타이머 중지 (테스트용)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 통계 정보
   */
  getStats() {
    return {
      totalKeys: this.store.size,
    };
  }
}

// 글로벌 인스턴스 (서버 재시작 시 초기화됨)
const rateLimiter = new RateLimiter();

export default rateLimiter;

/**
 * 헬퍼 함수: IP 주소 기반 Rate Limiting
 */
export function checkRateLimit(
  identifier: string,
  options: {
    limit: number;
    windowMs: number;
  }
): { limited: boolean; resetTime?: number } {
  const limited = rateLimiter.check(identifier, options.limit, options.windowMs);
  
  if (limited) {
    const entry = (rateLimiter as any).store.get(identifier);
    return {
      limited: true,
      resetTime: entry?.resetTime,
    };
  }

  return { limited: false };
}

/**
 * 사전 정의된 Rate Limit 정책
 */
export const RateLimitPolicies = {
  // 로그인: 1분에 5번
  LOGIN: {
    limit: 5,
    windowMs: 60 * 1000, // 1분
  },
  // 일반 API: 1분에 30번
  API: {
    limit: 30,
    windowMs: 60 * 1000,
  },
  // AI 요청: 1분에 10번
  AI: {
    limit: 10,
    windowMs: 60 * 1000,
  },
  // 엄격한 제한: 1분에 3번 (비밀번호 재설정 등)
  STRICT: {
    limit: 3,
    windowMs: 60 * 1000,
  },
};

