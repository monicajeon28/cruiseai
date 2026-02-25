// app/api/chat/history/route.ts
// 채팅 히스토리 저장 및 조회 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

/**
 * GET: 채팅 히스토리 조회
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
    const tripId = tripIdParam ? parseInt(tripIdParam) : null;
    let sessionId = req.nextUrl.searchParams.get('sessionId') || 'default';

    // 사용자의 test 모드 여부 확인
    const userFromDb = await prisma.user.findUnique({
      where: { id: user.id },
      select: { customerStatus: true },
    });
    const isTestMode = userFromDb?.customerStatus === 'test';
    
    // sessionId에 test 모드 여부가 포함되어 있는지 확인하고, 없으면 추가
    // test 모드 사용자는 _test 접미사가 있어야 하고, 일반 사용자는 없어야 함
    const hasTestSuffix = sessionId.endsWith('_test');
    if (isTestMode && !hasTestSuffix) {
      // test 모드 사용자인데 _test 접미사가 없으면 추가
      sessionId = sessionId + '_test';
    } else if (!isTestMode && hasTestSuffix) {
      // 일반 사용자인데 _test 접미사가 있으면 제거
      sessionId = sessionId.replace(/_test$/, '');
    }

    // 가장 최근 히스토리 조회
    const history = await prisma.chatHistory.findFirst({
      where: {
        userId: user.id,
        ...(tripId ? { tripId } : {}),
        sessionId,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!history) {
      return NextResponse.json({
        ok: true,
        messages: [],
      });
    }

    // JSON 메시지 파싱
    const messages = Array.isArray(history.messages) 
      ? history.messages 
      : typeof history.messages === 'object' 
        ? Object.values(history.messages as any)
        : [];

    return NextResponse.json({
      ok: true,
      messages,
      sessionId: history.sessionId,
    });
  } catch (error: any) {
    console.error('[API] 채팅 히스토리 조회 오류:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '히스토리 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * POST: 채팅 히스토리 저장
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

    let { messages, tripId, sessionId = 'default' } = await req.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { ok: false, error: '메시지 배열이 필요합니다' },
        { status: 400 }
      );
    }

    // 사용자의 test 모드 여부 확인
    const userFromDb = await prisma.user.findUnique({
      where: { id: user.id },
      select: { customerStatus: true },
    });
    const isTestMode = userFromDb?.customerStatus === 'test';
    
    // sessionId에 test 모드 여부가 포함되어 있는지 확인하고, 없으면 추가
    // test 모드 사용자는 _test 접미사가 있어야 하고, 일반 사용자는 없어야 함
    const hasTestSuffix = sessionId.endsWith('_test');
    if (isTestMode && !hasTestSuffix) {
      // test 모드 사용자인데 _test 접미사가 없으면 추가
      sessionId = sessionId + '_test';
    } else if (!isTestMode && hasTestSuffix) {
      // 일반 사용자인데 _test 접미사가 있으면 제거
      sessionId = sessionId.replace(/_test$/, '');
    }

    // tripId가 있으면 여행 소유권 확인 (UserTrip 사용)
    if (tripId) {
      const trip = await prisma.userTrip.findFirst({
        where: { id: tripId, userId: user.id },
      });

      if (!trip) {
        return NextResponse.json(
          { ok: false, error: '여행을 찾을 수 없습니다' },
          { status: 404 }
        );
      }
    }

    // 기존 히스토리 찾기 또는 생성
    const existing = await prisma.chatHistory.findFirst({
      where: {
        userId: user.id,
        ...(tripId ? { tripId } : {}),
        sessionId,
      },
    });

    if (existing) {
      // 업데이트
      const updated = await prisma.chatHistory.update({
        where: { id: existing.id },
        data: {
          messages: messages as any,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        ok: true,
        historyId: updated.id,
        sessionId: updated.sessionId,
      });
    } else {
      // 생성
      const now = new Date();
      const created = await prisma.chatHistory.create({
        data: {
          userId: user.id,
          tripId: tripId || null,
          sessionId,
          messages: messages as any,
          updatedAt: now,
        },
      });

      return NextResponse.json({
        ok: true,
        historyId: created.id,
        sessionId: created.sessionId,
      });
    }
  } catch (error: any) {
    console.error('[API] 채팅 히스토리 저장 오류:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '히스토리 저장 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
