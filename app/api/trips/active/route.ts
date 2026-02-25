// ⬇️ 절대법칙: Prisma 사용 API는 반드시 nodejs runtime과 force-dynamic 필요
export const runtime = 'nodejs';        // Edge Runtime 금지 (Prisma 사용)
export const dynamic = 'force-dynamic'; // 동적 데이터는 캐시 X

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

/**
 * GET: 현재 진행 중인 여행 조회
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    // 현재 진행 중인 여행 조회 (UserTrip 사용)
    const activeTrip = await prisma.userTrip.findFirst({
      where: {
        userId: parseInt(session.userId),
        status: { in: ['Upcoming', 'InProgress'] },
      },
      include: {
        Itinerary: {
          orderBy: { date: 'asc' },
        },
        CruiseProduct: {
          select: {
            id: true,
            productCode: true,
            cruiseLine: true,
            shipName: true,
            itineraryPattern: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    if (!activeTrip) {
      return NextResponse.json(
        { data: null },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { data: activeTrip },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] 활성 여행 조회 오류:', error);
    return NextResponse.json(
      { error: '여행 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
