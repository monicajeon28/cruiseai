// 서버 전용 유틸 (App Router)
// named export 로 반드시 내보냅니다!
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const SESSION_COOKIE = 'cg.sid.v2';   // ✅ 새 버전명
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30일

export type SessionPayload = {
  userId: string;
  name: string;
  phone: string;
  password?: string; // Add password as an optional string
  onboarded?: boolean;   // optional 로 변경
  role?: 'USER' | 'ADMIN'; // optional 로 변경
  isAdmin?: boolean;       // optional 로 변경
};

export type Trip = {
  id: string;
  name: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  companion: string;
  userId: number;
};

export async function getSessionCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value || '';
}

export async function getSession(): Promise<SessionPayload | null> {
  const sessionId = await getSessionCookie();
  if (!sessionId) return null;

  try {
    // DB에서 세션 조회
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { User: true },
    });

    if (!session || !session.User) return null;

    // 세션 만료 확인
    if (session.expiresAt && session.expiresAt < new Date()) {
      // 만료된 세션 삭제
      await prisma.session.delete({ where: { id: sessionId } });
      return null;
    }

    // SessionPayload 형식으로 반환
    // role을 대문자로 정규화 (DB에 'admin'으로 저장되어 있어도 'ADMIN'으로 변환)
    const userRole = session.User.role?.toUpperCase() as 'USER' | 'ADMIN' | undefined;
    
    return {
      userId: session.userId.toString(),
      name: session.User.name || '',
      phone: session.User.phone || '',
      onboarded: session.User.onboarded,
      role: userRole || 'USER',
      isAdmin: session.User.role === 'admin' || session.User.role === 'ADMIN',
    };
  } catch (error) {
    console.error('getSession error:', error);
    return null;
  }
}

export async function getSessionUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.userId ?? null;
}

export async function getSessionAndTrip(): Promise<{ user: SessionPayload | null; trip: any | null }> {
  const user = await getSession();
  let trip: any | null = null;
  if (user) {
    trip = await prisma.userTrip.findFirst({
      where: { userId: parseInt(user.userId) },
      orderBy: { createdAt: 'desc' },
    });
  }
  return { user, trip };
}

export function setSession(res: NextResponse, payload: SessionPayload) {
  const value = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  res.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
    domain: process.env.NODE_ENV === 'production' ? '.cruisedot.co.kr' : undefined,
  });
  return res;
}

export function clearSession(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

// Re-export getSessionUser from lib/auth for compatibility
export { getSessionUser } from '@/lib/auth';
