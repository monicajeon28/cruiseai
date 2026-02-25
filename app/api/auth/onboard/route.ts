export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'NOT_LOGGED_IN' }, { status: 401 });
  }

  const { name } = await req.json();
  if (!name || name.trim() === '') {
    return NextResponse.json({ ok: false, error: 'NAME_REQUIRED' }, { status: 400 });
  }

  // 유저 이름 업데이트 및 온보딩 상태 완료 처리
  await prisma.user.update({
    where: { id: user.id },
    data: { name: name.trim(), onboarded: true },
  });

  return NextResponse.json({ ok: true });
}
