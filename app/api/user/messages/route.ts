export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

// GET: 고객의 미확인 메시지 조회
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 현재 사용자에게 발송된 메시지 조회
    // 관리자가 메시지를 보낼 때 각 사용자에게 개별 메시지가 생성되므로 userId로 필터링
    const messages = await prisma.adminMessage.findMany({
      where: {
        isActive: true,
        userId: user.id, // 자신에게 직접 발송된 메시지만
        AND: [
          {
            OR: [
              { sendAt: null }, // 즉시 발송
              { sendAt: { lte: new Date() } }, // 예약 시간이 지난 것
            ],
          },
          // 아직 확인하지 않은 메시지
          {
            NOT: {
              UserMessageRead: {
                some: {
                  userId: user.id,
                },
              },
            },
          },
        ],
      },
      include: {
        User_AdminMessage_adminIdToUser: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10, // 최대 10개
    });

    // 프론트엔드에서 사용하기 쉽도록 데이터 변환
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      title: msg.title,
      content: msg.content,
      messageType: msg.messageType,
      createdAt: msg.createdAt.toISOString(),
      admin: msg.User_AdminMessage_adminIdToUser,
    }));

    return NextResponse.json({ ok: true, messages: formattedMessages });
  } catch (error) {
    console.error('[User Messages GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
