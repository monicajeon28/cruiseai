export const dynamic = 'force-dynamic';

// app/api/user/hibernation/route.ts
// 사용자 동면 상태 조회 및 관리 API

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { reactivateUser } from '@/lib/scheduler/lifecycleManager';

const SESSION_COOKIE = 'cg.sid.v2';

// GET: 동면 상태 조회
export async function GET() {
  try {
    // 세션 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      select: { userId: true },
    });

    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: 'Invalid session' }, { status: 401 });
    }

    // 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: parseInt(session.userId) },
      select: {
        isHibernated: true,
        hibernatedAt: true,
        lastActiveAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    // 마지막 활동으로부터 경과 일수 계산
    let daysSinceActive = null;
    if (user.lastActiveAt) {
      const now = new Date();
      const diff = now.getTime() - new Date(user.lastActiveAt).getTime();
      daysSinceActive = Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    return NextResponse.json({
      ok: true,
      hibernation: {
        isHibernated: user.isHibernated,
        hibernatedAt: user.hibernatedAt,
        lastActiveAt: user.lastActiveAt,
        daysSinceActive,
      },
    });
  } catch (error) {
    console.error('[Hibernation API] GET error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: 재활성화
export async function POST(req: Request) {
  try {
    // 세션 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      select: { userId: true },
    });

    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: 'Invalid session' }, { status: 401 });
    }

    // 재활성화 처리
    const reactivated = await reactivateUser(session.userId);

    return NextResponse.json({
      ok: true,
      reactivated,
      message: reactivated ? 'User reactivated successfully' : 'User was not hibernated',
    });
  } catch (error) {
    console.error('[Hibernation API] POST error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
