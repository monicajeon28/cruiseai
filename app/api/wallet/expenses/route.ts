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
    let tripId = tripIdParam ? parseInt(tripIdParam) : undefined;

    let trip;
    if (tripId) {
      // 특정 tripId 제공 시 소유권 확인
      trip = await prisma.userTrip.findFirst({
        where: { id: tripId, userId: user.id },
      });
    } else {
      // tripId 없으면 현재 활성 여행 자동 선택
      const now = new Date();
      trip = await prisma.userTrip.findFirst({
        where: {
          userId: user.id,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        orderBy: { startDate: 'desc' },
      });
      // 진행 중인 여행 없으면 가장 최근 여행
      if (!trip) {
        trip = await prisma.userTrip.findFirst({
          where: { userId: user.id },
          orderBy: { startDate: 'desc' },
        });
      }
      if (trip) tripId = trip.id;
    }

    if (!trip || !tripId) {
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
 * PUT: 지출 수정
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { id, amount, amountInKRW, description, category, currency, day, date } = body;

    if (!id) {
      return NextResponse.json(
        { error: '지출 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const expenseId = parseInt(String(id));
    if (isNaN(expenseId)) {
      return NextResponse.json(
        { error: '유효하지 않은 지출 ID입니다' },
        { status: 400 }
      );
    }

    // 소유권 확인
    const existing = await prisma.expense.findFirst({
      where: { id: expenseId, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '지출을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const amountVal = amount !== undefined ? parseFloat(String(amount)) : existing.amount;
    const amountKRWVal = amountInKRW !== undefined ? parseFloat(String(amountInKRW)) : existing.amountKRW;
    const currencyVal = currency ?? existing.currency;
    const foreignAmountVal = currencyVal === 'KRW' ? amountKRWVal : amountVal;

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...(amount !== undefined ? { amount: amountVal } : {}),
        ...(amountInKRW !== undefined ? { amountKRW: amountKRWVal, foreignAmount: foreignAmountVal } : {}),
        ...(currency !== undefined ? { currency: currencyVal } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(day !== undefined ? { day } : {}),
        ...(date !== undefined ? { date: new Date(date) } : {}),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(
      { success: true, expense: { ...updated, tripId: updated.userTripId, amountInKRW: updated.amountKRW } },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[API] 지출 수정 오류:', error);
    return NextResponse.json(
      { error: '지출 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 지출 삭제 (?id=123 단건 | ?all=true&tripId=456 현재여행 전체)
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const idParam = req.nextUrl.searchParams.get('id');
    const allParam = req.nextUrl.searchParams.get('all');
    const tripIdParam = req.nextUrl.searchParams.get('tripId');

    if (allParam === 'true') {
      // 특정 여행 또는 현재 사용자 전체 지출 삭제
      const where: { userId: number; userTripId?: number } = { userId: user.id };
      if (tripIdParam) {
        const userTripId = parseInt(tripIdParam);
        if (!isNaN(userTripId)) {
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
          where.userTripId = userTripId;
        }
      }
      const result = await prisma.expense.deleteMany({ where });
      return NextResponse.json(
        { success: true, deletedCount: result.count },
        { status: 200 }
      );
    }

    if (!idParam) {
      return NextResponse.json(
        { error: 'id 파라미터가 필요합니다' },
        { status: 400 }
      );
    }

    const expenseId = parseInt(idParam);
    if (isNaN(expenseId)) {
      return NextResponse.json(
        { error: '유효하지 않은 지출 ID입니다' },
        { status: 400 }
      );
    }

    // 소유권 확인 + 삭제 (원자적 처리, TOCTOU 제거)
    const result = await prisma.expense.deleteMany({
      where: { id: expenseId, userId: user.id },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: '지출을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, deletedId: expenseId },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[API] 지출 삭제 오류:', error);
    return NextResponse.json(
      { error: '지출 삭제 중 오류가 발생했습니다' },
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
