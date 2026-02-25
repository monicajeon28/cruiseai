import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';
import {
  normalizeItineraryPattern,
  extractDestinationsFromItineraryPattern,
  extractVisitedCountriesFromItineraryPattern,
} from '@/lib/utils/itineraryPattern';
import { syncApisSpreadsheet } from '@/lib/google-sheets';
import { getManagedUserIds } from '../../../../../_utils';
import { logger } from '@/lib/logger';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tripId: string }> }
) {
  try {
    const { profile } = await requirePartnerContext();
    const { id, tripId: tripIdStr } = await params;
    const userId = parseInt(id, 10);
    const tripId = parseInt(tripIdStr, 10);

    if (Number.isNaN(userId)) {
      return NextResponse.json({ ok: false, error: 'Invalid user ID' }, { status: 400 });
    }

    const { userIds } = await getManagedUserIds(profile);
    if (!userIds.includes(userId)) {
      return NextResponse.json({ ok: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      productId,
      productCode,
      cruiseName,
      startDate,
      endDate,
      companionType,
      destination,
      itineraryPattern,
    } = body;

    if (!productId || !cruiseName || !startDate || !endDate) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: productId, cruiseName, startDate, endDate' },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        totalTripCount: true,
        onboarded: true,
        mallUserId: true,
        password: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    const product = await prisma.cruiseProduct.findUnique({
      where: { id: parseInt(productId) },
      select: {
        id: true,
        productCode: true,
        cruiseLine: true,
        shipName: true,
        packageName: true,
        nights: true,
        days: true,
        itineraryPattern: true,
      },
    });

    if (!product) {
      return NextResponse.json({ ok: false, error: 'Product not found' }, { status: 404 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json({ ok: false, error: 'Invalid date format' }, { status: 400 });
    }

    if (start > end) {
      return NextResponse.json({ ok: false, error: '여행 시작일은 종료일보다 빨라야 합니다.' }, { status: 400 });
    }

    let destinations: string[] = [];
    if (destination) {
      if (typeof destination === 'string') {
        destinations = destination.split(',').map((d) => d.trim()).filter(Boolean);
      } else if (Array.isArray(destination)) {
        destinations = destination;
      }
    }

    const finalItineraryPattern = itineraryPattern || product.itineraryPattern;
    const normalizedPattern = normalizeItineraryPattern(finalItineraryPattern);

    if (destinations.length === 0) {
      destinations = extractDestinationsFromItineraryPattern(finalItineraryPattern);
    }

    const visitedCountries = extractVisitedCountriesFromItineraryPattern(finalItineraryPattern);

    const nights = product.nights || Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) - 1);
    const days = product.days || Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    let trip;
    const finalProductCode = productCode || product.productCode || `PROD-${product.id}`;

    if (!finalProductCode) {
      return NextResponse.json({ ok: false, error: 'Product code is required' }, { status: 400 });
    }

    if (tripId > 0) {
      const existingTrip = await prisma.userTrip.findFirst({
        where: {
          id: tripId,
          userId,
        },
      });

      if (existingTrip) {
        trip = await prisma.userTrip.update({
          where: { id: tripId },
          data: {
            productId: product.id,
            cruiseName,
            nights,
            days,
            startDate: start,
            endDate: end,
            destination: destinations.length > 0 ? destinations : null,
            companionType: companionType || null,
            status: start > new Date() ? 'Upcoming' : 'InProgress',
            reservationCode: finalProductCode,
            updatedAt: new Date(),
          },
        });

        await prisma.itinerary.deleteMany({ where: { tripId: trip.id } });
      } else {
        trip = await prisma.userTrip.create({
          data: {
            userId,
            productId: product.id,
            cruiseName,
            nights,
            days,
            startDate: start,
            endDate: end,
            destination: destinations.length > 0 ? destinations : null,
            companionType: companionType || null,
            status: start > new Date() ? 'Upcoming' : 'InProgress',
            reservationCode: finalProductCode,
            updatedAt: new Date(),
          },
        });
      }
    } else {
      trip = await prisma.userTrip.create({
        data: {
          userId,
          productId: product.id,
          cruiseName,
          nights,
          days,
          startDate: start,
          endDate: end,
          destination: destinations.length > 0 ? destinations : null,
          companionType: companionType || null,
          status: start > new Date() ? 'Upcoming' : 'InProgress',
          reservationCode: finalProductCode,
          updatedAt: new Date(),
        },
      });
    }

    if (normalizedPattern.length > 0) {
      const now = new Date();
      const itineraries = normalizedPattern.map((pattern: any) => {
        const dayDate = new Date(start);
        dayDate.setDate(dayDate.getDate() + (pattern.day - 1));

        return {
          userTripId: trip.id,
          day: pattern.day,
          date: dayDate,
          type: pattern.type || null,
          location: pattern.location || null,
          country: pattern.country || null,
          currency: pattern.currency || null,
          language: pattern.language || null,
          arrival: pattern.arrival || null,
          departure: pattern.departure || null,
          updatedAt: now,
        };
      });

      await prisma.itinerary.createMany({ data: itineraries });
    }

    const now = new Date();
    for (const [countryCode, countryInfo] of visitedCountries) {
      await prisma.visitedCountry.upsert({
        where: {
          userId_countryCode: {
            userId,
            countryCode,
          },
        },
        update: {
          visitCount: { increment: 1 },
          lastVisited: start,
          updatedAt: now,
        },
        create: {
          userId,
          countryCode,
          countryName: countryInfo.name,
          visitCount: 1,
          lastVisited: start,
          updatedAt: now,
        },
      });
    }

    const isNewTrip = tripId === 0;
    const updateData: any = {
      onboarded: true,
      customerStatus: 'purchase_confirmed',
      lastActiveAt: new Date(),
    };

    if (isNewTrip) {
      updateData.totalTripCount = { increment: 1 };
    }

    updateData.password = '3800';

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    try {
      await prisma.passwordEvent.create({
        data: {
          userId,
          from: targetUser.password || '',
          to: '3800',
          reason: `파트너 여행 배정 (파트너 프로필 ID: ${profile.id}, Trip ID: ${trip.id})`,
        },
      });
    } catch (error) {
      logger.warn('[Partner AssignTrip] PasswordEvent 생성 실패:', error);
    }

    try {
      const apisResult = await syncApisSpreadsheet(trip.id);
      if (!apisResult.ok) {
        logger.warn('[Partner AssignTrip] APIS 생성 실패:', apisResult.error);
      }
    } catch (apisError) {
      logger.error('[Partner AssignTrip] APIS 생성 중 오류:', apisError);
    }

    try {
      if (targetUser.role === 'user' && targetUser.mallUserId) {
        const mallUserIdNum = parseInt(targetUser.mallUserId, 10);
        let linkedMallUserId = Number.isNaN(mallUserIdNum) ? null : mallUserIdNum;

        if (!linkedMallUserId) {
          const mallUser = await prisma.user.findFirst({
            where: {
              phone: targetUser.mallUserId,
              role: 'community',
            },
            select: { id: true },
          });
          if (mallUser) {
            linkedMallUserId = mallUser.id;
          }
        }

        if (linkedMallUserId) {
          await prisma.user.update({
            where: { id: linkedMallUserId },
            data: {
              isLocked: false,
              lockedAt: null,
              lockedReason: null,
              isHibernated: false,
              hibernatedAt: null,
              customerStatus: 'active',
              lastActiveAt: new Date(),
            },
          });
        }
      }
    } catch (error) {
      logger.error('[Partner AssignTrip] linked mall user update failed:', error);
    }

    // 어필리에이트 Lead 자동 생성 (구매고객 전환 시)
    try {
      const userWithProfile = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          phone: true,
        },
      });

      if (userWithProfile && userWithProfile.phone) {
        // 전화번호 정규화 (숫자만 추출)
        const normalizePhone = (phone: string | null | undefined) => {
          if (!phone) return phone;
          return phone.replace(/[^0-9]/g, '');
        };
        const normalizedPhone = normalizePhone(userWithProfile.phone);
        
        // 기존 Lead가 있는지 확인 (정규화된 전화번호로)
        const existingLead = await prisma.affiliateLead.findFirst({
          where: {
            OR: [
              { customerPhone: userWithProfile.phone },
              { customerPhone: normalizedPhone },
            ],
          },
        });

        if (!existingLead) {
          // 파트너 프로필 정보 사용
          let managerId = null;
          let agentId = null;

          if (profile.type === 'BRANCH_MANAGER') {
            managerId = profile.id;
          } else if (profile.type === 'SALES_AGENT') {
            agentId = profile.id;
            // 판매원의 대리점장 찾기
            const relation = await prisma.affiliateRelation.findFirst({
              where: {
                agentId: profile.id,
                status: 'ACTIVE',
              },
              select: { managerId: true },
            });
            if (relation) {
              managerId = relation.managerId;
            }
          }

          // AffiliateLead 생성 (정규화된 전화번호 사용)
          await prisma.affiliateLead.create({
            data: {
              customerName: userWithProfile.name,
              customerPhone: normalizedPhone || userWithProfile.phone,
              status: 'PURCHASED',
              source: 'partner_trip_assignment',
              managerId: managerId,
              agentId: agentId,
              metadata: {
                createdFrom: 'partner_trip_assignment',
                tripId: trip.id,
                assignedAt: new Date().toISOString(),
                assignedBy: profile.id,
                partnerType: profile.type,
              },
              updatedAt: new Date(),
            },
          });
          logger.log(`[Partner AssignTrip] AffiliateLead 자동 생성 완료: userId=${userId}, phone=${normalizedPhone || userWithProfile.phone}`);
        } else {
          // 기존 Lead가 있으면 상태를 PURCHASED로 업데이트
          await prisma.affiliateLead.update({
            where: { id: existingLead.id },
            data: {
              status: 'PURCHASED',
              updatedAt: new Date(),
            },
          });
          logger.log(`[Partner AssignTrip] 기존 AffiliateLead 상태 업데이트: leadId=${existingLead.id}`);
        }
      }
    } catch (error) {
      logger.error('[Partner AssignTrip] AffiliateLead 자동 생성 실패:', error);
      // 에러가 발생해도 여행 배정은 계속 진행
    }

    return NextResponse.json({
      ok: true,
      message: '여행이 배정되었습니다. 크루즈 가이드 지니가 활성화되었습니다.',
      trip: {
        id: trip.id,
        cruiseName: trip.cruiseName,
        startDate: trip.startDate,
        endDate: trip.endDate,
      },
    });
  } catch (error: any) {
    logger.error('POST /api/partner/assign-trip onboarding error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
