export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma';

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, success: false }, { status: 401 })

  // DB에서 사용자 정보 조회 (totalTripCount 포함)
  const userFromDb = await prisma.user.findUnique({
    where: { id: parseInt(session.userId) },
    select: {
      id: true,
      name: true,
      phone: true,
      totalTripCount: true,
      onboarded: true,
    },
  });

  if (!userFromDb) {
    return NextResponse.json({ ok: false, success: false }, { status: 404 });
  }

  const trips = await prisma.userTrip.findMany({
    where: { userId: userFromDb.id },
    select: {
      id: true,
      destination: true,
      cruiseName: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { startDate: 'desc' },
  });

  const hasTrip = trips.length > 0;

  return NextResponse.json({
    ok: true,
    success: true,
    user: {
      id: userFromDb.id,
      name: userFromDb.name ?? '',
      phone: userFromDb.phone ?? '',
      totalTripCount: userFromDb.totalTripCount,
      hasTrip,
      needOnboarding: !hasTrip,
    },
    trips: trips,
  })
}
