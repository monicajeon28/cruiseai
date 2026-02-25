export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

// POST: 메시지 확인 처리
export async function POST(
  req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const messageId = parseInt(params.messageId);
    if (isNaN(messageId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid message ID' },
        { status: 400 }
      );
    }

    // 메시지가 존재하고 사용자에게 발송된 것인지 확인
    const message = await prisma.adminMessage.findFirst({
      where: {
        id: messageId,
        isActive: true,
        userId: user.id, // 자신에게 직접 발송된 메시지만
      },
    });

    if (!message) {
      return NextResponse.json(
        { ok: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    // 이미 확인했는지 확인
    const existingRead = await prisma.userMessageRead.findUnique({
      where: {
        userId_messageId: {
          userId: user.id,
          messageId: messageId,
        },
      },
    });

    if (!existingRead) {
      // 확인 기록 생성
      await prisma.userMessageRead.create({
        data: {
          userId: user.id,
          messageId: messageId,
        },
      });

      // 메시지의 readCount 증가
      await prisma.adminMessage.update({
        where: { id: messageId },
        data: {
          readCount: { increment: 1 },
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[User Messages Read POST] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to mark message as read' },
      { status: 500 }
    );
  }
}
