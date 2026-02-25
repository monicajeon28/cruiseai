export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { syncApisInBackground } from '@/lib/google-sheets';

// 파트너 권한 확인 (판매원, 대리점장, 관리자)
async function checkPartnerAccess(userId: number, reservationId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  // 관리자는 모든 접근 허용
  if (user?.role === 'admin' || user?.role === 'superadmin') {
    return true;
  }

  // 파트너 프로필 확인
  const profile = await prisma.affiliateProfile.findFirst({
    where: { userId },
    select: { id: true, type: true },
  });

  if (!profile) return false;

  // 예약과 연결된 AffiliateSale 확인
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { affiliateSaleId: true },
  });

  if (!reservation?.affiliateSaleId) return false;

  const sale = await prisma.affiliateSale.findUnique({
    where: { id: reservation.affiliateSaleId },
    select: { affiliateId: true, managerId: true },
  });

  if (!sale) return false;

  // 판매원 본인 또는 대리점장(매니저)
  return sale.affiliateId === profile.id || sale.managerId === profile.id;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { reservationId, korName, roomNumber } = body;

    if (!reservationId) {
      return NextResponse.json({ ok: false, error: 'Reservation ID is required' }, { status: 400 });
    }

    // 파트너 권한 확인
    const hasAccess = await checkPartnerAccess(Number(session.userId), reservationId);
    if (!hasAccess) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    // 예약 존재 여부 확인
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        Trip: { select: { id: true } }
      }
    });

    if (!reservation) {
      return NextResponse.json({ ok: false, error: 'Reservation not found' }, { status: 404 });
    }

    // 새 여행자 생성
    const newTraveler = await prisma.traveler.create({
      data: {
        reservationId,
        korName: korName || '',
        roomNumber: roomNumber || 1,
      },
    });

    // 예약의 총 인원 수 업데이트
    const travelerCount = await prisma.traveler.count({
      where: { reservationId },
    });

    await prisma.reservation.update({
      where: { id: reservationId },
      data: { totalPeople: travelerCount },
    });

    // APIS 스프레드시트 자동 동기화 (재시도 로직 포함)
    const tripId = reservation.Trip?.id;
    if (tripId) {
      syncApisInBackground(tripId);
    }

    return NextResponse.json({
      ok: true,
      traveler: {
        id: newTraveler.id,
        korName: newTraveler.korName,
        roomNumber: newTraveler.roomNumber,
        reservationId: newTraveler.reservationId,
      },
    });
  } catch (error: any) {
    console.error('[Partner Travelers Create] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create traveler' },
      { status: 500 }
    );
  }
}
