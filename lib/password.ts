import 'server-only';

/**
 * lib/password.ts
 * 비밀번호 해시 및 검증 공통 유틸리티 (bcryptjs 기반)
 *
 * 시스템 비밀번호 상수:
 *   '3800' = 크루즈가이드AI 구매 고객
 *   '1101' = 72시간 체험판
 *   'qwe1' = 파트너 기본
 *   '0000' = 임시 고객 (전화번호 없음)
 */
import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'crypto';

const BCRYPT_ROUNDS = 10;

export const SYSTEM_PASSWORDS = {
  GUIDE_ACTIVE: '3800',
  TRIAL: '1101',
  PARTNER: 'qwe1',
  TEMP: '0000',
  LOCKED: '8300',
} as const;

export const PARTNER_DEFAULT_PASSWORDS = ['1101', 'qwe1', 'zxc1'] as const;

/** 비밀번호 해시 (항상 DB 저장 전 사용) */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

/**
 * 비밀번호 검증 (Lazy Migration 지원)
 * - bcrypt hash($2b$...)이면 bcrypt.compare
 * - 평문이면 timingSafeEqual 비교 후 재해시 필요 여부 반환
 */
export async function verifyPassword(
  plaintext: string,
  stored: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!stored) return { valid: false, needsRehash: false };

  if (stored.startsWith('$2')) {
    try {
      const valid = await bcrypt.compare(plaintext, stored);
      return { valid, needsRehash: false };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  // 평문 비교 — timingSafeEqual로 타이밍 어택 방어
  const a = Buffer.from(plaintext);
  const b = Buffer.from(stored);
  const valid = a.length === b.length && timingSafeEqual(a, b);
  return { valid, needsRehash: valid };
}

/** 이미 bcrypt 해시인지 확인 */
export function isBcryptHash(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith('$2');
}
