import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const trips = await prisma.userTrip.findMany({
      where: { userId: user.id },
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        cruiseName: true,
        startDate: true,
        endDate: true,
        nights: true,
        days: true,
        status: true,
        destination: true,
        CruiseProduct: {
          select: { cruiseLine: true, shipName: true },
        },
        Itinerary: {
          select: { location: true },
          orderBy: { day: 'asc' },
        },
      },
    });

    const mapped = trips.map((trip) => {
      // destination (Json?) → string[]
      let destinations: string[] = [];
      const dest = trip.destination;
      if (dest) {
        if (Array.isArray(dest)) {
          destinations = dest as string[];
        } else if (typeof dest === 'string') {
          try {
            const parsed = JSON.parse(dest);
            destinations = Array.isArray(parsed) ? parsed : [dest];
          } catch {
            destinations = [dest];
          }
        }
      }

      return {
        id: trip.id,
        cruiseName: trip.cruiseName,
        nights: trip.nights,
        days: trip.days,
        startDate: trip.startDate?.toISOString() ?? '',
        endDate: trip.endDate?.toISOString() ?? '',
        destinations,
        status: trip.status,
        product: {
          cruiseLine: trip.CruiseProduct?.cruiseLine ?? '',
          shipName: trip.CruiseProduct?.shipName ?? '',
          source: null as string | null,
        },
      };
    });

    return NextResponse.json({ ok: true, trips: mapped });
  } catch (error: unknown) {
    logger.error('[API] trips/list GET error:', error);
    return NextResponse.json({ ok: false, error: '여행 목록 조회 중 오류가 발생했습니다' }, { status: 500 });
  }
}
