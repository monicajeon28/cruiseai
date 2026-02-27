// lib/auth.ts
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

export const SESSION_COOKIE = 'cg.sid.v2';

export type SessionUser = {
  id: number;
  name: string | null;
  phone: string | null;
  onboarded: boolean;
  role: string | null;
};

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) return null;

    const sess = await prisma.session.findUnique({
      where: { id: sid },
      select: {
        expiresAt: true,
        User: { select: { id: true, name: true, phone: true, onboarded: true, role: true } }
      },
    });

    if (!sess?.User) return null;

    // 세션 만료 확인
    if (sess.expiresAt && sess.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: sid } }).catch(() => {});
      return null;
    }

    const u = sess.User;
    return { id: u.id, name: u.name, phone: u.phone, onboarded: !!u.onboarded, role: u.role };
  } catch (error: any) {
    console.error('[getSessionUser] Error:', error);
    return null;
  }
});

// ============================================================================
// 관리자 인증 유틸리티 (Admin Auth Utilities)
// 기존 checkAdminAuth 함수들을 대체하는 공통 함수
// ============================================================================

export type AdminUser = {
  id: number;
  name: string | null;
  role: string;
};

export type AdminAuthResult = {
  isAdmin: boolean;
  user: AdminUser | null;
  error?: string;
};

/**
 * 관리자 권한 확인 (공통 함수)
 * - 세션 쿠키에서 사용자 정보 조회
 * - role === 'admin' 확인
 *
 * @returns AdminAuthResult - isAdmin, user, error
 *
 * @example
 * // API 라우트에서 사용
 * const { isAdmin, user, error } = await checkAdminAuth();
 * if (!isAdmin) {
 *   return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
 * }
 */
export async function checkAdminAuth(): Promise<AdminAuthResult> {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid) {
      return { isAdmin: false, user: null, error: 'No session' };
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      select: {
        expiresAt: true,
        User: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    if (!session?.User) {
      return { isAdmin: false, user: null, error: 'Invalid session' };
    }

    // 세션 만료 확인
    if (session.expiresAt && session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: sid } }).catch(() => {});
      return { isAdmin: false, user: null, error: 'Session expired' };
    }

    const user = session.User;

    if (user.role !== 'admin') {
      return { isAdmin: false, user: null, error: 'Not an admin' };
    }

    return {
      isAdmin: true,
      user: { id: user.id, name: user.name, role: user.role },
    };
  } catch (error: any) {
    console.error('[checkAdminAuth] Error:', error);
    return { isAdmin: false, user: null, error: error.message };
  }
}

/**
 * 관리자 권한 필수 확인 (에러 시 throw)
 * - 관리자가 아니면 에러를 throw
 *
 * @returns AdminUser - 인증된 관리자 정보
 * @throws Error - 인증 실패 시
 *
 * @example
 * // API 라우트에서 사용
 * try {
 *   const admin = await requireAdminAuth();
 *   // admin.id, admin.name 사용 가능
 * } catch (error) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 */
export async function requireAdminAuth(): Promise<AdminUser> {
  const { isAdmin, user, error } = await checkAdminAuth();

  if (!isAdmin || !user) {
    throw new Error(error || 'Unauthorized');
  }

  return user;
}

/**
 * 관리자 또는 어필리에이트 권한 확인
 * - role === 'admin' OR role === 'affiliate' 확인
 *
 * @returns AdminAuthResult
 */
export async function checkAdminOrAffiliateAuth(): Promise<AdminAuthResult> {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid) {
      return { isAdmin: false, user: null, error: 'No session' };
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      select: {
        expiresAt: true,
        User: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    if (!session?.User) {
      return { isAdmin: false, user: null, error: 'Invalid session' };
    }

    // 세션 만료 확인
    if (session.expiresAt && session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: sid } }).catch(() => {});
      return { isAdmin: false, user: null, error: 'Session expired' };
    }

    const user = session.User;

    if (user.role !== 'admin' && user.role !== 'affiliate') {
      return { isAdmin: false, user: null, error: 'Not authorized' };
    }

    return {
      isAdmin: true,
      user: { id: user.id, name: user.name, role: user.role },
    };
  } catch (error: any) {
    console.error('[checkAdminOrAffiliateAuth] Error:', error);
    return { isAdmin: false, user: null, error: error.message };
  }
}
