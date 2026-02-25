/**
 * 로깅 유틸리티
 * 프로덕션 환경에서는 console.log/warn을 제거하고, error만 출력
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * 개발 환경에서만 로그 출력
   */
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * 개발 환경에서만 경고 출력
   */
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * 에러는 항상 출력 (프로덕션에서도)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * 디버그 로그 (개발 환경에서만)
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  /**
   * 정보 로그 (개발 환경에서만)
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
};

/**
 * 인증 관련 로거
 */
export const authLogger = {
  loginSuccess: (userId: number, clientIp: string) => {
    if (isDevelopment) {
      console.log('[Auth] Login success:', { userId, clientIp });
    }
  },
  loginFailure: (reason: string, clientIp: string) => {
    if (isDevelopment) {
      console.warn('[Auth] Login failure:', { reason, clientIp });
    }
  },
};

/**
 * 보안 관련 로거
 */
export const securityLogger = {
  rateLimitExceeded: (clientIp: string, endpoint: string, limit: number) => {
    // Rate limit은 보안 이슈이므로 항상 로깅
    console.warn('[Security] Rate limit exceeded:', { clientIp, endpoint, limit });
  },
  suspiciousActivity: (clientIp: string, activity: string) => {
    // 의심스러운 활동은 항상 로깅
    console.warn('[Security] Suspicious activity:', { clientIp, activity });
  },
  botDetected: (clientIp: string, userAgent: string | null, path: string) => {
    // 봇 탐지는 보안 이슈이므로 항상 로깅
    console.warn('[Security] Bot detected:', { clientIp, userAgent, path });
  },
  warn: (message: string, context?: any) => {
    // 경고 메시지는 항상 로깅
    console.warn('[Security]', message, context || '');
  },
};
