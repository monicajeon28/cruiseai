export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // tripId: 쿼리 파라미터로 전달된다고 가정 (없으면 401)
    const { searchParams } = new URL(request.url);
    const tripIdParam = searchParams.get('tripId');
    if (!tripIdParam) {
      return NextResponse.json({ error: 'Missing tripId' }, { status: 401 });
    }
    const tripId = Number(tripIdParam);

    // 히스토리 검색 (최신 50개, 오래된 순 정렬)
    const histories = await prisma.chatHistory.findMany({
      where: { userId, tripId },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    // 가장 최근(가장 마지막) 기록만 보관하는 형태면, messages(Json)만 사용
    // 여러 세션 기록이 있다면, 최신 세션만!
    // 여기서는 모든 sessionId별로 get, 여러 건일 수 있음:
    // 여러 개면 messages를 순차로 합쳐 하나의 배열로
    let allMessages: {
      id: string;
      role: 'user' | 'assistant';
      content: string;
    }[] = [];

    for (const history of histories) {
      if (Array.isArray(history.messages)) {
        // 이미 배열로 올때
        allMessages = allMessages.concat(
          history.messages.map((msg: any, idx: number) => ({
            id:
              typeof msg.id === 'string'
                ? msg.id
                : `${history.id}_${idx}`,
            role: msg.role,
            content: msg.content,
          })),
        );
      } else if (history.messages && typeof history.messages === 'object') {
        // messages가 객체(단건)일 때
        allMessages.push({
          id: history.messages.id || `${history.id}_0`,
          role: history.messages.role,
          content: history.messages.content,
        });
      }
    }

    // 50개 제한을 messages 전체에 걸 수도 있음 (혹시 많을 경우)
    if (allMessages.length > 50) {
      allMessages = allMessages.slice(-50); // 최신 50개만
    }

    return NextResponse.json(allMessages);
  } catch (err) {
    console.error('[GET /chat/history] error:', err);
    return NextResponse.json(
      { error: 'Failed to load chat history' },
      { status: 500 },
    );
  }
}
