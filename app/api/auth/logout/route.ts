export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/session';
import prisma from '@/lib/prisma';

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
      } catch (error) {
        console.error('[Logout] Error deleting session from DB:', error);
      }
    }

    // 쿠키 삭제
    cookieStore.delete(SESSION_COOKIE);
    cookieStore.delete('cg.mode');

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Logout] Error:', error);
    // 쿠키는 삭제 시도
    cookieStore.delete(SESSION_COOKIE);
    cookieStore.delete('cg.mode');
    return NextResponse.json({ ok: true }); // 에러가 있어도 로그아웃은 성공 처리
  }
} 
