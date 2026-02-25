import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import { getManagedUserIds } from '../../../_utils';
import { logger } from '@/lib/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } = await requirePartnerContext();
    const { id: userIdStr } = await params;
    const userId = parseInt(userIdStr, 10);
    if (Number.isNaN(userId)) {
      return NextResponse.json({ ok: false, error: 'Invalid user ID' }, { status: 400 });
    }

    const { userIds } = await getManagedUserIds(profile);
    if (!userIds.includes(userId)) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    const reservation = await prisma.reservation.findFirst({
      where: { mainUserId: userId },
      include: {
        Trip: true,
        Traveler: {
          where: {
            OR: [{ userId: null }, { userId: { not: userId } }],
          },
          select: {
            id: true,
            korName: true,
            engSurname: true,
            engGivenName: true,
            userId: true,
            User: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    if (!reservation || !reservation.Trip) {
      return NextResponse.json({ ok: true, hasReservation: false }, { status: 200 });
    }

    const trip = reservation.Trip;

    // Trip 모델은 CruiseProduct와 직접 relation이 없어 별도로 조회한다.
    const productCodeCandidates = trip.productCode
      ? [trip.productCode, trip.productCode.replace(/-TRIP$/i, '')].filter(Boolean)
      : [];

    let product = null;
    for (const code of productCodeCandidates) {
      product = await prisma.cruiseProduct.findUnique({
        where: { productCode: code },
      });
      if (product) break;
    }

    if (!product && trip.shipName) {
      product = await prisma.cruiseProduct.findFirst({
        where: { shipName: trip.shipName },
        orderBy: { startDate: 'desc' },
      });
    }

    // 동행자 정보 정리 (상품 정보와 무관하게 항상 반환)
    const travelers = (reservation.Traveler || []).map((t) => ({
      id: t.id,
      name: t.korName || t.User?.name || `${t.engSurname || ''} ${t.engGivenName || ''}`.trim() || '이름 없음',
      phone: t.User?.phone || null,
      userId: t.userId || t.User?.id || null,
    }));

    // 상품 정보가 없어도 Trip 정보는 반환
    if (!product) {
      // Trip 정보에서 크루즈명 추출 (상품 정보 없이도 가능)
      let cruiseName = trip.shipName || trip.cruiseName || '';
      
      // 날짜 정보 (Trip에서 직접 가져오기)
      const startDate = trip.startDate ? trip.startDate.toISOString().split('T')[0] : '';
      const endDate = trip.endDate ? trip.endDate.toISOString().split('T')[0] : '';
      
      // 목적지 (Trip의 destination 필드 사용, 없으면 빈 문자열)
      const destination = trip.destination ? (typeof trip.destination === 'string' ? trip.destination : JSON.stringify(trip.destination)) : '';

      return NextResponse.json({
        ok: true,
        hasReservation: true,
        hasProduct: false,
        message: '상품 정보가 없습니다. 수동으로 상품을 선택해주세요.',
        user,
        trip: {
          cruiseName,
          startDate,
          endDate,
          companionType: trip.companionType,
          destination,
        },
        travelers,
      });
    }

    // 상품 정보가 있는 경우
    const destination = Array.isArray(product.itineraryPattern)
      ? product.itineraryPattern
          .filter((day: any) => day && day.country && day.country !== 'KR')
          .map((day: any) => day.location || day.country)
          .filter(Boolean)
          .join(', ')
      : (trip.destination ? (typeof trip.destination === 'string' ? trip.destination : JSON.stringify(trip.destination)) : '');

    const cruiseName = product.cruiseLine && product.shipName
      ? `${product.cruiseLine} ${product.shipName.startsWith(product.cruiseLine) ? product.shipName.replace(product.cruiseLine, '').trim() : product.shipName}`.trim()
      : product.cruiseLine || product.shipName || product.packageName || trip.shipName || trip.cruiseName || '';

    return NextResponse.json({
      ok: true,
      hasReservation: true,
      hasProduct: true,
      user,
      product,
      trip: {
        cruiseName,
        startDate: trip.startDate ? trip.startDate.toISOString().split('T')[0] : (product.startDate ? new Date(product.startDate).toISOString().split('T')[0] : ''),
        endDate: trip.endDate ? trip.endDate.toISOString().split('T')[0] : (product.endDate ? new Date(product.endDate).toISOString().split('T')[0] : ''),
        companionType: trip.companionType,
        destination: destination || (trip.destination ? (typeof trip.destination === 'string' ? trip.destination : JSON.stringify(trip.destination)) : ''),
      },
      travelers,
    });
  } catch (error) {
    logger.error('[Partner AssignTrip] trip info error:', error);
    return NextResponse.json(
      { ok: false, error: '여행 정보를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
