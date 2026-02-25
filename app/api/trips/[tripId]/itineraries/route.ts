export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/trips/[tripId]/itineraries
 * 특정 여행의 일정을 조회합니다.
 * 
 * Query parameters:
 * - date: 조회할 날짜 (ISO string, optional)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { tripId: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const tripId = parseInt(params.tripId);
    if (isNaN(tripId)) {
      return NextResponse.json({ ok: false, error: 'Invalid trip ID' }, { status: 400 });
    }

    // 사용자가 해당 여행의 소유자인지 확인
    const trip = await prisma.userTrip.findFirst({
      where: {
        id: tripId,
        userId: user.id,
      },
    });

    if (!trip) {
      return NextResponse.json({ ok: false, error: 'Trip not found' }, { status: 404 });
    }

    // date 쿼리 파라미터 확인
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');

    let whereClause: any = {
      userTripId: tripId,
    };

    // date 파라미터가 있으면 해당 날짜의 일정만 조회
    if (dateParam) {
      try {
        const targetDate = new Date(dateParam);
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        whereClause.date = {
          gte: startOfDay,
          lte: endOfDay,
        };
      } catch (e) {
        // 날짜 파싱 실패 시 무시하고 전체 조회
        console.warn('[Itineraries API] Invalid date parameter:', dateParam);
      }
    }

    const itineraries = await prisma.itinerary.findMany({
      where: whereClause,
      orderBy: { day: 'asc' },
      select: {
        id: true,
        day: true,
        date: true,
        type: true,
        country: true,
        location: true,
        arrival: true,
        departure: true,
        time: true,
      },
    });

    return NextResponse.json({
      ok: true,
      data: itineraries,
    });
  } catch (error) {
    console.error('[Itineraries API] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
