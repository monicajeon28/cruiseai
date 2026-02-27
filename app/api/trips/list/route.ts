import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

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
      reservationCode: true,
      productId: true,
      CruiseProduct: {
        select: { cruiseLine: true, shipName: true },
      },
      Itinerary: {
        select: { id: true, day: true, location: true, type: true },
        orderBy: { day: 'asc' },
      },
    },
  });

  return NextResponse.json({ ok: true, trips });
}
