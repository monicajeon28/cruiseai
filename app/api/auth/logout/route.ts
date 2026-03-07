export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/session';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST() {
  const cookieStore = await cookies();
  try {
    // 세션 쿠키 가져오기
    const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

    // 데이터베이스에서 세션 삭제
    if (sessionId) {
      try {
        await prisma.session.delete({
          where: { id: sessionId },
        }).catch(() => {
          // 세션이 이미 삭제되었거나 없는 경우 무시
        });
      } catch {
        logger.error('[Logout] Error deleting session from DB');
      }
    }

    // 쿠키 삭제 — login에서 .cruiseai.co.kr 도메인으로 심은 쿠키이므로 도메인 일치 필수
    const cookieDomain = process.env.NODE_ENV === 'production' ? '.cruiseai.co.kr' : undefined;
    cookieStore.set(SESSION_COOKIE, '', {
      maxAge: 0,
      path: '/',
      domain: cookieDomain,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    cookieStore.set('cg.mode', '', {
      maxAge: 0,
      path: '/',
      domain: cookieDomain,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return NextResponse.json({ ok: true });
  } catch {
    logger.error('[Logout] Error');
    // 쿠키는 삭제 시도
    const cookieDomain = process.env.NODE_ENV === 'production' ? '.cruiseai.co.kr' : undefined;
    cookieStore.set(SESSION_COOKIE, '', {
      maxAge: 0,
      path: '/',
      domain: cookieDomain,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    cookieStore.set('cg.mode', '', {
      maxAge: 0,
      path: '/',
      domain: cookieDomain,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return NextResponse.json({ ok: true }); // 에러가 있어도 로그아웃은 성공 처리
  }
} 
