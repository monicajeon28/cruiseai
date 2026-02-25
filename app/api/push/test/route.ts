export const dynamic = 'force-dynamic';

// app/api/push/test/route.ts
// 푸시 알림 테스트 API (개발용)

import { NextRequest, NextResponse } from 'next/server';
import { sendNotificationToUser } from '@/lib/push/server';
import { getSession } from '@/lib/session';

/**
 * 테스트: 사용자 자신에게 푸시 알림을 전송합니다.
 * curl -X POST http://localhost:3000/api/push/test \
 *   -H "Content-Type: application/json" \
 *   -d '{"title":"테스트","body":"이것은 테스트 알림입니다"}'
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!(session as any)?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const { title, body } = await req.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: '제목과 내용이 필요합니다' },
        { status: 400 }
      );
    }

    const result = await sendNotificationToUser((session as any).user.id, {
      title,
      body,
      icon: '/images/ai-cruise-logo.png',
      badge: '/images/ai-cruise-logo.png',
    });

    return NextResponse.json(
      {
        message: '테스트 알림 전송 완료',
        result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] 테스트 알림 전송 오류:', error);
    return NextResponse.json(
      { error: '알림 전송 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
