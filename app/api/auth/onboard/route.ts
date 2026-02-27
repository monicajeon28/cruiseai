export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'NOT_LOGGED_IN' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { name } = body;
  if (name !== undefined && typeof name !== 'string') {
    return NextResponse.json({ ok: false, error: 'INVALID_NAME' }, { status: 400 });
  }

  // 온보딩 완료 처리 (이름은 선택적으로 업데이트)
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name && name.trim() ? { name: name.trim() } : {}),
        onboarded: true,
      },
    });
  } catch (err: any) {
    console.error('[AUTH ONBOARD] DB 업데이트 실패:', err?.message);
    return NextResponse.json({ ok: false, error: 'ONBOARD_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
