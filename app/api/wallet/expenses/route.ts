export const dynamic = 'force-dynamic';

// app/api/wallet/expenses/route.ts
// 가계부 지출 API (CRUD)

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
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const tripIdParam = req.nextUrl.searchParams.get('tripId');
    const tripId = tripIdParam ? parseInt(tripIdParam) : undefined;

    if (!tripId) {
      return NextResponse.json(
        { error: '여행 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 여행 소유권 확인
    const trip = await prisma.userTrip.findFirst({
      where: { id: tripId, userId: user.id },
    });

    if (!trip) {
      return NextResponse.json(
        { error: '여행을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const expenses = await prisma.expense.findMany({
      where: { userTripId: tripId },
      orderBy: { date: 'desc' },
    });

    // 응답 형식 변환
    const mappedExpenses = expenses.map(exp => ({
      ...exp,
      tripId: exp.userTripId,
      amountInKRW: exp.amountKRW || exp.krwAmount || 0,
      foreignAmount: exp.foreignAmount || exp.amount || 0,
    }));

    return NextResponse.json(
      { success: true, expenses: mappedExpenses },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[API] 지출 조회 오류:', error);
    return NextResponse.json(
      { error: '지출 조회 중 오류가 발생했습니다' },
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
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { tripId, day, date, category, amount, currency, amountInKRW, description } = body;

    // 필수 필드 검증
    if (!tripId) {
      return NextResponse.json(
        { error: '여행 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const userTripId = parseInt(tripId);
    if (isNaN(userTripId)) {
      return NextResponse.json(
        { error: '유효하지 않은 여행 ID입니다' },
        { status: 400 }
      );
    }

    // 여행 소유권 확인
    const trip = await prisma.userTrip.findFirst({
      where: { id: userTripId, userId: user.id },
    });

    if (!trip) {
      return NextResponse.json(
        { error: '여행을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 금액 변환
    const amountVal = parseFloat(amount || '0');
    const amountKRWVal = parseFloat(amountInKRW || '0');
    const foreignAmountVal = currency === 'KRW' ? amountKRWVal : amountVal;

    // DB 저장 (필수 필드 모두 포함)
    const newExpense = await prisma.expense.create({
      data: {
        userTripId: userTripId,
        userId: user.id,
        date: date ? new Date(date) : new Date(),
        category: category || '기타',
        description: description || '',
        amount: amountVal,
        foreignAmount: foreignAmountVal, // 외화 금액 (필수)
        currency: currency || 'KRW',
        amountKRW: amountKRWVal, // 원화 금액 (필수)
        paymentMethod: body.paymentMethod || 'CASH',
        day: day || 1,
        updatedAt: new Date(),
      },
    });

    // 응답 형식 변환
    const responseExpense = {
      ...newExpense,
      tripId: newExpense.userTripId,
      amountInKRW: newExpense.amountKRW || 0,
    };

    return NextResponse.json(
      { success: true, expense: responseExpense },
      { status: 201 }
    );
  } catch (error) {
    logger.error('[API] 지출 추가 오류:', error);
    return NextResponse.json(
      { error: '지출 추가 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
