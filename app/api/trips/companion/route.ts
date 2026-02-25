export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

const SESSION_COOKIE = 'cg.sid.v2';

/**
 * PATCH /api/trips/companion
 * 동반자 정보만 수정합니다.
 */
export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) {
      return NextResponse.json({ ok: false, message: 'UNAUTHORIZED' }, { status: 401 });
    }

    const sess = await prisma.session.findUnique({
      where: { id: sid },
      select: { userId: true },
    });

    if (!sess?.userId) {
      return NextResponse.json({ ok: false, message: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const { companionType } = body || {};

    if (!companionType) {
      return NextResponse.json(
        { ok: false, message: '동반자 정보가 필요합니다' },
        { status: 400 }
      );
    }

    // 유효한 동반자 타입인지 확인
    const validTypes = ['친구', '커플', '가족', '혼자', 'solo', 'couple', 'family', 'friends', 'group'];
    if (!validTypes.includes(companionType)) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 동반자 타입입니다' },
        { status: 400 }
      );
    }

    // 한국어 타입을 영어로 변환 (DB 저장용)
    const typeMap: Record<string, string> = {
      '친구': 'friends',
      '커플': 'couple',
      '가족': 'family',
      '혼자': 'solo',
    };
    const dbCompanionType = typeMap[companionType] || companionType;

    // 최신 여행 조회 (UserTrip 모델 사용)
    const latestTrip = await prisma.userTrip.findFirst({
      where: { userId: sess.userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (!latestTrip) {
      return NextResponse.json(
        { ok: false, message: '여행 정보를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 동반자 정보만 업데이트
    const updatedTrip = await prisma.userTrip.update({
      where: { id: latestTrip.id },
      data: {
        companionType: dbCompanionType,
        updatedAt: new Date(),
      },
    });

    // 사용자 테이블에도 온보딩 수정 추적 플래그 설정
    await prisma.user.update({
      where: { id: sess.userId },
      data: {
        onboardingUpdatedAt: new Date(),
        onboardingUpdatedByUser: true,
      },
    });

    return NextResponse.json({
      ok: true,
      trip: {
        id: updatedTrip.id,
        companionType: updatedTrip.companionType,
      },
    });
  } catch (error) {
    console.error('PATCH /api/trips/companion error:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
