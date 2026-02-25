// lib/shared/index.ts
// 3개 사이트 공통 인프라 배럴 exports
// 사용법: import { getSessionUser } from '@/lib/shared'
//
// 주의: 기존 파일은 이동하지 않고 배럴(barrel) export만 제공합니다.
// 기존 import 경로(예: '@/lib/auth')는 그대로 유지됩니다.

// ============================================================================
// 인증 (Authentication) - 서버 전용
// ============================================================================
export {
  SESSION_COOKIE,
  getSessionUser,
  checkAdminAuth,
  requireAdminAuth,
  checkAdminOrAffiliateAuth,
} from '../auth';

export type {
  SessionUser,
  AdminUser,
  AdminAuthResult,
} from '../auth';

// ============================================================================
// 세션 (Session) - 서버 전용, App Router
// ============================================================================
export {
  getSession,
  getSessionCookie,
  getSessionUserId,
  getSessionAndTrip,
  setSession,
  clearSession,
} from '../session';

// ============================================================================
// 세션 서버 경량버전 - session.ts와 이름 충돌 방지용 alias
// ============================================================================
export {
  getSession as getServerSession,
} from '../session.server';

// ============================================================================
// 데이터베이스 (Database) - Prisma ORM
// ============================================================================
export { default as prisma } from '../prisma';

// ============================================================================
// Redis 캐시 (Redis Cache)
// ============================================================================
export {
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
  createCacheKey,
  closeRedis,
  resetRedisConnection,
} from '../redis';

// ============================================================================
// 인메모리 캐시 (In-Memory Cache)
// ============================================================================
export { inMemoryCache } from '../cache';

// ============================================================================
// 로거 (Logger)
// ============================================================================
export { logger, authLogger, securityLogger } from '../logger';
export { default as winstonLogger } from '../logger-v2';
export { default as loggerWrapper } from '../logger-wrapper';

// ============================================================================
// CSRF 보호
// ============================================================================
export { generateCsrfToken, validateCsrfToken } from '../csrf';
// csrf-client는 'use client' 전용 - 아래에서 직접 import 사용 권장
// import { csrfFetch } from '@/lib/csrf-client'

// ============================================================================
// 이메일 (Email)
// ============================================================================
export {
  escapeHtml,
  sendPasswordResetEmail,
  sendInquiryNotificationEmail,
  sendRefundNotificationEmail,
} from '../email';

// ============================================================================
// API 에러 핸들러
// ============================================================================
export {
  ApiError,
  handleApiError,
  validateRequest,
  requireAuth,
  requireRole,
  successResponse,
  errorResponse,
  withErrorHandler,
} from '../api-error-handler';

// ============================================================================
// 유틸리티
// ============================================================================
export { getClientIp, getClientIpFromRequest } from '../ip-utils';
export {
  normalizePhone,
  formatPhone,
  isValidPhone,
  isValidMobilePhone,
  maskPhoneForLog,
} from '../phone-utils';
export {
  hashPassword,
  verifyPassword,
} from '../crypto';
export { checkRateLimit } from '../rate-limiter';
export { validateEnv } from '../env';
export { initializeApp, isInitialized } from '../init';
