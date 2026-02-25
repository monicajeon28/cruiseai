export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * GET: 예산 조회
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const tripIdParam = req.nextUrl.searchParams.get('tripId');
    const tripId = tripIdParam ? parseInt(tripIdParam) : undefined;

    // tripId가 없으면 가장 최근 여행의 예산 반환
    let trip;
    if (tripId) {
      trip = await prisma.userTrip.findFirst({
        where: { id: tripId, userId: user.id },
      });
    } else {
      // 가장 최근 여행 찾기
      trip = await prisma.userTrip.findFirst({
        where: { userId: user.id },
        orderBy: { startDate: 'desc' },
      });
    }

    if (!trip) {
      return NextResponse.json(
        { success: true, budget: null },
        { status: 200 }
      );
    }

    // metadata에서 예산 가져오기
    const metadata = trip as any;
    const budget = metadata?.budget || null;

    return NextResponse.json(
      { success: true, budget, tripId: trip.id },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[API] 예산 조회 오류:', error);
    return NextResponse.json(
      { error: '예산 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * POST/PUT: 예산 저장
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { tripId, budget } = body;

    // 필수 필드 검증
    if (budget === undefined || budget === null) {
      return NextResponse.json(
        { error: '예산 금액이 필요합니다' },
        { status: 400 }
      );
    }

    const budgetNum = parseFloat(String(budget));
    if (isNaN(budgetNum) || budgetNum <= 0) {
      return NextResponse.json(
        { error: '올바른 예산 금액을 입력해주세요' },
        { status: 400 }
      );
    }

    let trip;
    if (tripId) {
      trip = await prisma.userTrip.findFirst({
        where: { id: parseInt(String(tripId)), userId: user.id },
      });
    } else {
      // 가장 최근 여행 찾기
      trip = await prisma.userTrip.findFirst({
        where: { userId: user.id },
        orderBy: { startDate: 'desc' },
      });
    }

    if (!trip) {
      return NextResponse.json(
        { error: '여행을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // metadata에 예산 저장 (Prisma의 Json 타입 사용)
    const currentMetadata = (trip as any).metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      budget: budgetNum,
      budgetUpdatedAt: new Date().toISOString(),
    };

    await prisma.userTrip.update({
      where: { id: trip.id },
      data: {
        metadata: updatedMetadata as any,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(
      { success: true, budget: budgetNum, tripId: trip.id },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[API] 예산 저장 오류:', error);
    return NextResponse.json(
      { error: '예산 저장 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  return POST(req);
}


