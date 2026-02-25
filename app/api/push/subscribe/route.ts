export const dynamic = 'force-dynamic';

// app/api/push/subscribe/route.ts
// 푸시 알림 구독 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    // session은 SessionPayload이므로 userId를 직접 사용
    if (!session?.userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const userId = parseInt(session.userId);

    const subscriptionData = await req.json();

    // 유효성 검사
    if (!subscriptionData.endpoint || !subscriptionData.keys) {
      console.error('[API] Invalid subscription data:', subscriptionData);
      return NextResponse.json(
        { error: '잘못된 푸시 구독 정보입니다', received: Object.keys(subscriptionData) },
        { status: 400 }
      );
    }

    // 기존 구독 확인 (중복 방지)
    const existingSubscription = await prisma.pushSubscription.findUnique({
      where: { endpoint: subscriptionData.endpoint },
    });

    if (existingSubscription) {
      // 기존 구독 업데이트
      await prisma.pushSubscription.update({
        where: { id: existingSubscription.id },
        data: {
          keys: subscriptionData.keys,
          userAgent: req.headers.get('user-agent') || undefined,
          updatedAt: new Date(),
        },
      });
      console.log('[API] 구독 정보 업데이트 완료:', subscriptionData.endpoint);
    } else {
      // 새 구독 생성
      await prisma.pushSubscription.create({
        data: {
          userId: userId,
          endpoint: subscriptionData.endpoint,
          keys: subscriptionData.keys,
          userAgent: req.headers.get('user-agent') || undefined,
        },
      });
      console.log('[API] 새 구독 정보 생성 완료:', subscriptionData.endpoint);
    }

    return NextResponse.json(
      { ok: true, message: '알림 구독이 완료되었습니다' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] 푸시 구독 오류:', error);
    return NextResponse.json(
      { error: '구독 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
