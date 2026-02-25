export const dynamic = 'force-dynamic';

// app/api/expenses/route.ts
// 가계부 지출 API (CRUD) - 레거시 호환성 유지

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * GET: 지출 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const tripIdParam = req.nextUrl.searchParams.get('tripId');
    const tripId = tripIdParam ? parseInt(tripIdParam) : undefined;

    const expenses = await prisma.expense.findMany({
      where: tripId 
        ? { userTripId: tripId, userId: user.id } 
        : { 
            userId: user.id,
          },
      include: { UserTrip: { select: { id: true, cruiseName: true } } },
      orderBy: { date: 'desc' },
    });

    // userTripId를 tripId로 매핑하여 프론트엔드 호환성 유지
    const mappedExpenses = expenses.map((exp: any) => ({
      ...exp,
      tripId: exp.userTripId, // userTripId를 tripId로 매핑
      trip: exp.UserTrip ? {
        id: exp.UserTrip.id,
        cruiseName: exp.UserTrip.cruiseName,
      } : null,
    }));

    return NextResponse.json({ ok: true, data: mappedExpenses }, { status: 200 });
  } catch (error) {
    logger.error('[API] 지출 조회 오류:', error);
    return NextResponse.json(
      { ok: false, error: '지출 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * POST: 지출 추가
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { tripId, day, date, category, amount, currency, amountInKRW, description } = body;

    // 필수 필드 검증
    if (!tripId) {
      return NextResponse.json(
        { ok: false, error: '여행 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const userTripId = parseInt(tripId);
    if (isNaN(userTripId)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 여행 ID입니다' },
        { status: 400 }
      );
    }

    // 여행 소유권 확인 (UserTrip 사용)
    const trip = await prisma.userTrip.findFirst({
      where: {
        id: userTripId,
        userId: user.id,
      },
    });

    if (!trip) {
      return NextResponse.json(
        { ok: false, error: '여행을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 금액 변환
    const amountVal = parseFloat(amount || '0');
    const amountKRWVal = parseFloat(amountInKRW || '0');
    const foreignAmountVal = currency === 'KRW' ? amountKRWVal : amountVal;

    // DB 저장
    const expense = await prisma.expense.create({
      data: {
        userTripId: userTripId,
        userId: user.id,
        date: date ? new Date(date) : new Date(),
        category: category || '기타',
        description: description || '',
        amount: amountVal,
        foreignAmount: foreignAmountVal,
        currency: currency || 'KRW',
        amountKRW: amountKRWVal,
        paymentMethod: body.paymentMethod || 'CASH',
        day: day || 1,
        updatedAt: new Date(),
      },
    });

    // userTripId를 tripId로 매핑하여 프론트엔드 호환성 유지
    const mappedExpense = {
      ...expense,
      tripId: expense.userTripId, // userTripId를 tripId로 매핑
    };

    return NextResponse.json({ ok: true, data: mappedExpense }, { status: 201 });
  } catch (error) {
    logger.error('[API] 지출 추가 오류:', error);
    return NextResponse.json(
      { ok: false, error: '지출 추가 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * PUT: 지출 수정
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { id, tripId, day, date, category, amount, currency, amountInKRW, description } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: '지출 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const userTripId = tripId ? parseInt(tripId) : undefined;

    // 지출 소유권 확인
    const existingExpense = await prisma.expense.findFirst({
      where: {
        id: parseInt(id),
        userId: user.id,
        ...(userTripId ? { userTripId } : {}),
      },
    });

    if (!existingExpense) {
      return NextResponse.json(
        { ok: false, error: '지출을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 금액 변환
    const amountVal = amount !== undefined ? parseFloat(String(amount)) : existingExpense.amount;
    const amountKRWVal = amountInKRW !== undefined ? parseFloat(String(amountInKRW)) : existingExpense.amountKRW;
    const foreignAmountVal = (currency || existingExpense.currency) === 'KRW' ? amountKRWVal : amountVal;

    // DB 업데이트
    const updatedExpense = await prisma.expense.update({
      where: { id: parseInt(id) },
      data: {
        ...(date ? { date: new Date(date) } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(amount !== undefined ? { amount: amountVal } : {}),
        ...(currency !== undefined ? { currency } : {}),
        ...(amountInKRW !== undefined ? { amountKRW: amountKRWVal, foreignAmount: foreignAmountVal } : {}),
        ...(day !== undefined ? { day } : {}),
        ...(body.paymentMethod !== undefined ? { paymentMethod: body.paymentMethod } : {}),
        updatedAt: new Date(),
      },
    });

    // userTripId를 tripId로 매핑하여 프론트엔드 호환성 유지
    const mappedExpense = {
      ...updatedExpense,
      tripId: updatedExpense.userTripId, // userTripId를 tripId로 매핑
    };

    return NextResponse.json({ ok: true, data: mappedExpense }, { status: 200 });
  } catch (error) {
    logger.error('[API] 지출 수정 오류:', error);
    return NextResponse.json(
      { ok: false, error: '지출 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
