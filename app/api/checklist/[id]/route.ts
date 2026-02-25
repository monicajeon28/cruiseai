export const dynamic = 'force-dynamic';

// app/api/checklist/[id]/route.ts
// 체크리스트 개별 항목 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

/**
 * PUT: 체크리스트 항목 업데이트 (text, completed)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: '유효하지 않은 ID입니다' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { text, completed } = body;

    // 항목 소유권 확인
    const item = await prisma.checklistItem.findFirst({
      where: { id, userId: parseInt(session.userId) },
    });

    if (!item) {
      return NextResponse.json(
        { error: '항목을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 업데이트할 데이터 구성
    const updateData: { text?: string; completed?: boolean } = {};
    if (text !== undefined) {
      updateData.text = text;
    }
    if (completed !== undefined) {
      updateData.completed = completed;
    }

    const updated = await prisma.checklistItem.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(
      { item: updated },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] 체크리스트 항목 업데이트 오류:', error);
    return NextResponse.json(
      { error: '항목 업데이트 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 체크리스트 항목 삭제
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: '유효하지 않은 ID입니다' },
        { status: 400 }
      );
    }

    // 항목 소유권 확인
    const item = await prisma.checklistItem.findFirst({
      where: { id, userId: parseInt(session.userId) },
    });

    if (!item) {
      return NextResponse.json(
        { error: '항목을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    await prisma.checklistItem.delete({
      where: { id },
    });

    return NextResponse.json(
      { ok: true, message: '항목이 삭제되었습니다' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] 체크리스트 항목 삭제 오류:', error);
    return NextResponse.json(
      { error: '항목 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
