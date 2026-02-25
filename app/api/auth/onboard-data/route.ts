export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/auth/onboard-data
 *
 * 신규 구매자 첫 로그인 온보딩 화면에 필요한 APIS 데이터 반환.
 * 어드민이 크루즈몰에서 등록한 UserTrip + Itinerary + Traveler 정보를 자동 조회.
 * 구매자가 별도로 입력하는 데이터 없음.
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NOT_LOGGED_IN' }, { status: 401 });
    }

    // 가장 가까운 여행(진행 중 또는 다가오는) 조회
    const now = new Date();
    const trip = await prisma.userTrip.findFirst({
      where: {
        userId: user.id,
        OR: [
          // 진행 중인 여행
          { startDate: { lte: now }, endDate: { gte: now } },
          // 다가오는 여행 (아직 시작 전)
          { startDate: { gte: now } },
        ],
      },
      orderBy: { startDate: 'asc' },
      include: {
        Itinerary: {
          orderBy: { day: 'asc' },
        },
      },
    });

    // 진행 중/예정 여행 없으면 가장 최근 여행 조회
    const finalTrip =
      trip ??
      (await prisma.userTrip.findFirst({
        where: { userId: user.id },
        orderBy: { startDate: 'desc' },
        include: {
          Itinerary: {
            orderBy: { day: 'asc' },
          },
        },
      }));

    // 예약 + 동행자 정보 (크루즈몰에서 등록된 Traveler 기준)
    const reservation = await prisma.reservation.findFirst({
      where: { mainUserId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        Traveler: {
          orderBy: { roomNumber: 'asc' },
        },
      },
    });

    // 여권 제출 현황
    const passportSubmission = await prisma.passportSubmission.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        PassportSubmissionGuest: {
          orderBy: { groupNumber: 'asc' },
        },
      },
    });

    // 오늘 일정 찾기
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayItinerary = finalTrip?.Itinerary.find((it) => {
      const d = new Date(it.date);
      return d >= todayStart && d <= todayEnd;
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
      },
      trip: finalTrip
        ? {
            id: finalTrip.id,
            cruiseName: finalTrip.cruiseName,
            reservationCode: finalTrip.reservationCode,
            startDate: finalTrip.startDate,
            endDate: finalTrip.endDate,
            nights: finalTrip.nights,
            days: finalTrip.days,
            destination: finalTrip.destination,
            status: finalTrip.status,
            itinerary: finalTrip.Itinerary.map((it) => ({
              id: it.id,
              day: it.day,
              date: it.date,
              type: it.type,
              location: it.location,
              country: it.country,
              arrival: it.arrival,
              departure: it.departure,
              portLat: it.portLat,
              portLng: it.portLng,
              isToday:
                new Date(it.date) >= todayStart && new Date(it.date) <= todayEnd,
            })),
            todayItinerary: todayItinerary
              ? {
                  day: todayItinerary.day,
                  location: todayItinerary.location,
                  country: todayItinerary.country,
                  type: todayItinerary.type,
                }
              : null,
          }
        : null,
      travelers: reservation?.Traveler.map((t) => ({
        roomNumber: t.roomNumber,
        korName: t.korName,
        engName:
          t.engGivenName && t.engSurname
            ? `${t.engGivenName} ${t.engSurname}`
            : null,
        nationality: t.nationality,
        passportExpiryDate: t.expiryDate,
        hasPassport: !!t.passportNo,
      })) ?? [],
      passportStatus: passportSubmission
        ? {
            isSubmitted: passportSubmission.isSubmitted,
            submittedAt: passportSubmission.submittedAt,
            guestCount: passportSubmission.PassportSubmissionGuest.length,
          }
        : null,
    });
  } catch (error) {
    console.error('[onboard-data] Error:', error);
    return NextResponse.json(
      { ok: false, error: '데이터를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
