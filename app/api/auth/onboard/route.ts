export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * POST /api/auth/onboard
 *
 * 온보딩 완료 처리: User.onboarded = true 설정.
 * 구매자가 APIS 데이터 확인 후 "시작하기" 버튼을 누르면 호출.
 * 별도 입력 데이터 불필요.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'NOT_LOGGED_IN' }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      onboarded: true,
      onboardingUpdatedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
