// app/api/checklist/route.ts
// 체크리스트 API (CRUD)

// ⬇️ 절대법칙: Prisma 사용 API는 반드시 nodejs runtime과 force-dynamic 필요
export const runtime = 'nodejs';        // Edge Runtime 금지 (Prisma 사용)
export const dynamic = 'force-dynamic'; // 동적 데이터는 캐시 X

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * GET: 체크리스트 항목 조회
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

    const items = await prisma.checklistItem.findMany({
      where: {
        userId: user.id,
        ...(tripId ? { tripId } : {}),
      },
      orderBy: [
        { completed: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json(
      { items },
      { status: 200 }
    );
  } catch (error) {
    // 에러는 항상 로깅
    logger.error('[API] 체크리스트 조회 오류:', error);
    return NextResponse.json(
      { error: '체크리스트 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * POST: 체크리스트 항목 추가
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

    const { text, tripId } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: '항목 내용이 필요합니다' },
        { status: 400 }
      );
    }

    // tripId가 있으면 여행 소유권 확인 (UserTrip 모델 사용)
    if (tripId) {
      const trip = await prisma.userTrip.findFirst({
        where: { id: tripId, userId: user.id },
      });

      if (!trip) {
        return NextResponse.json(
          { error: '여행을 찾을 수 없습니다' },
          { status: 404 }
        );
      }
    }

    const item = await prisma.checklistItem.create({
      data: {
        userId: user.id,
        tripId: tripId || null,
        text,
        completed: false,
        order: 0,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(
      { item },
      { status: 201 }
    );
  } catch (error) {
    // 에러는 항상 로깅
    logger.error('[API] 체크리스트 항목 추가 오류:', error);
    return NextResponse.json(
      { error: '항목 추가 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * PATCH: 체크리스트 항목 업데이트 (토글 및 텍스트 수정)
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const { id, completed, text } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: 'ID가 필요합니다' },
        { status: 400 }
      );
    }

    // id를 숫자로 변환 (문자열로 올 수 있음)
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(numericId)) {
      return NextResponse.json(
        { error: '유효하지 않은 ID입니다' },
        { status: 400 }
      );
    }

    // 항목 소유권 확인
    const item = await prisma.checklistItem.findFirst({
      where: { id: numericId, userId: user.id },
    });

    if (!item) {
      return NextResponse.json(
        { error: '항목을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const updateData: { completed?: boolean; text?: string; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (completed !== undefined) {
      updateData.completed = completed;
    }
    if (text !== undefined) {
      updateData.text = text.trim();
    }

    const updated = await prisma.checklistItem.update({
      where: { id: numericId },
      data: updateData,
    });

    return NextResponse.json(
      { item: updated },
      { status: 200 }
    );
  } catch (error) {
    // 에러는 항상 로깅
    logger.error('[API] 체크리스트 항목 업데이트 오류:', error);
    return NextResponse.json(
      { error: '항목 업데이트 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 체크리스트 항목 삭제
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

    const body = await req.json();
    const id = body.id;

    if (!id) {
      return NextResponse.json(
        { error: 'ID가 필요합니다' },
        { status: 400 }
      );
    }

    // id를 숫자로 변환 (문자열로 올 수 있음)
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(numericId)) {
      return NextResponse.json(
        { error: '유효하지 않은 ID입니다' },
        { status: 400 }
      );
    }

    // 항목 소유권 확인
    const item = await prisma.checklistItem.findFirst({
      where: { id: numericId, userId: user.id },
    });

    if (!item) {
      return NextResponse.json(
        { error: '항목을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    await prisma.checklistItem.delete({
      where: { id: numericId },
    });

    return NextResponse.json(
      { ok: true, message: '항목이 삭제되었습니다' },
      { status: 200 }
    );
  } catch (error) {
    // 에러는 항상 로깅
    logger.error('[API] 체크리스트 항목 삭제 오류:', error);
    return NextResponse.json(
      { error: '항목 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
