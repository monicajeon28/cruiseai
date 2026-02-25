export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

// GET: 사용자 접근 권한 체크 (여행 종료 후 1일 사용 제한)
export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      // 세션이 없으면 허용 (공개 페이지에서 호출될 수 있음)
      return NextResponse.json({ 
        ok: true, 
        allowed: true, 
        status: 'active',
        message: 'No session - public access'
      });
    }

    // 사용자 정보 직접 조회 (isLocked, testModeStartedAt, customerStatus 포함)
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, isLocked: true, testModeStartedAt: true, customerStatus: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    // 계정 잠금 체크
    if (user.isLocked) {
      return NextResponse.json({
        ok: false,
        allowed: false,
        reason: 'locked',
        message: '계정이 잠금되었습니다. 관리자에게 문의하세요.',
      });
    }

    // 3일 체험 만료 체크 (72시간 = 3일)
    // customerStatus: 'test-locked' 상태이거나, testModeStartedAt 기준 72시간 경과 시 만료
    if (user.customerStatus === 'test-locked') {
      return NextResponse.json({
        ok: true,
        allowed: false,
        status: 'expired',
        reason: 'trial_expired',
        message: '3일 체험이 종료되었습니다. 새로운 여행을 등록해 주세요.',
      });
    }

    if (user.testModeStartedAt) {
      const testStartTime = new Date(user.testModeStartedAt);
      const testExpireTime = new Date(testStartTime);
      testExpireTime.setHours(testExpireTime.getHours() + 72); // 72시간 후
      const now = new Date();

      if (now > testExpireTime) {
        // customerStatus도 test-locked로 업데이트 (다음 체크 시 빠르게 처리)
        await prisma.user.update({
          where: { id: user.id },
          data: { customerStatus: 'test-locked' },
        });

        return NextResponse.json({
          ok: true,
          allowed: false,
          status: 'expired',
          reason: 'trial_expired',
          message: '3일 체험이 종료되었습니다. 새로운 여행을 등록해 주세요.',
          testModeStartedAt: user.testModeStartedAt.toISOString(),
          testExpireTime: testExpireTime.toISOString(),
        });
      }
    }

    // 최신 여행 조회
    const latestTrip = await prisma.userTrip.findFirst({
      where: { userId: user.id },
      orderBy: { endDate: 'desc' },
      select: { endDate: true },
    });

    // 여행이 없으면 허용
    if (!latestTrip || !latestTrip.endDate) {
      return NextResponse.json({
        ok: true,
        allowed: true,
        status: 'active',
      });
    }

    const endDate = new Date(latestTrip.endDate);
    const gracePeriodEnd = new Date(endDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 1); // +1일

    const now = new Date();

    // 유예 기간 내이면 허용
    if (now <= gracePeriodEnd) {
      const remainingHours = Math.ceil(
        (gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60)
      );
      return NextResponse.json({
        ok: true,
        allowed: true,
        status: 'grace_period',
        remainingHours,
        endDate: endDate.toISOString(),
        gracePeriodEnd: gracePeriodEnd.toISOString(),
      });
    }

    // 유예 기간 종료
    return NextResponse.json({
      ok: true,
      allowed: false,
      status: 'expired',
      reason: 'grace_period_end',
      message: '여행이 종료되었습니다. 새로운 여행을 등록해 주세요.',
      endDate: endDate.toISOString(),
      gracePeriodEnd: gracePeriodEnd.toISOString(),
    });
  } catch (error) {
    console.error('[User Access Check] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to check access' },
      { status: 500 }
    );
  }
}
