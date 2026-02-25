export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * GET /api/partner/funnel-messages/[id]
 * 특정 퍼널 메시지 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);

    if (isNaN(id)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    // 판매원/대리점장 프로필 확인
    const affiliateProfile = await prisma.affiliateProfile.findFirst({
      where: { userId: user.id },
      select: { id: true, type: true },
    });

    if (!affiliateProfile) {
      return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
    }

    // 퍼널 메시지 조회 (본인 것 또는 본인 그룹의 것)
    const message = await prisma.funnelMessage.findFirst({
      where: {
        id,
        OR: [
          { adminId: user.id },
          {
            CustomerGroup: {
              affiliateProfileId: affiliateProfile.id,
            },
          },
        ],
      },
      include: {
        FunnelMessageStage: {
          orderBy: { order: 'asc' },
        },
        CustomerGroup: {
          select: {
            id: true,
            name: true,
            affiliateProfileId: true,
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json({ ok: false, error: '퍼널 메시지를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      message: {
        id: message.id,
        adminId: message.adminId,
        groupId: message.groupId,
        messageType: message.messageType,
        title: message.title,
        category: message.category,
        groupName: message.groupName,
        description: message.description,
        senderPhone: message.senderPhone,
        senderEmail: message.senderEmail,
        sendTime: message.sendTime,
        optOutNumber: message.optOutNumber,
        autoAddOptOut: message.autoAddOptOut,
        isActive: message.isActive,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
        stages: message.FunnelMessageStage.map(stage => ({
          id: stage.id,
          stageNumber: stage.stageNumber,
          daysAfter: stage.daysAfter,
          sendTime: stage.sendTime,
          content: stage.content,
          imageUrl: stage.imageUrl,
          order: stage.order,
        })),
        customerGroup: message.CustomerGroup,
      },
    });
  } catch (error: any) {
    console.error('[Partner Funnel Messages GET by ID] Error:', error);
    return NextResponse.json(
      { ok: false, error: '퍼널 메시지 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/partner/funnel-messages/[id]
 * 퍼널 메시지 수정
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);

    if (isNaN(id)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    // 판매원/대리점장 프로필 확인
    const affiliateProfile = await prisma.affiliateProfile.findFirst({
      where: { userId: user.id },
      select: { id: true, type: true },
    });

    if (!affiliateProfile) {
      return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
    }

    // 퍼널 메시지 권한 확인
    const existingMessage = await prisma.funnelMessage.findFirst({
      where: {
        id,
        OR: [
          { adminId: user.id },
          {
            CustomerGroup: {
              affiliateProfileId: affiliateProfile.id,
            },
          },
        ],
      },
    });

    if (!existingMessage) {
      return NextResponse.json({ ok: false, error: '퍼널 메시지를 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    const body = await req.json();
    const {
      title,
      category,
      groupName,
      description,
      senderPhone,
      senderEmail,
      sendTime,
      optOutNumber,
      autoAddOptOut,
      isActive,
      stages,
    } = body;

    // 퍼널 메시지 업데이트
    const message = await prisma.funnelMessage.update({
      where: { id },
      data: {
        title: title || existingMessage.title,
        category: category !== undefined ? category : existingMessage.category,
        groupName: groupName !== undefined ? groupName : existingMessage.groupName,
        description: description !== undefined ? description : existingMessage.description,
        senderPhone: senderPhone !== undefined ? senderPhone : existingMessage.senderPhone,
        senderEmail: senderEmail !== undefined ? senderEmail : existingMessage.senderEmail,
        sendTime: sendTime !== undefined ? sendTime : existingMessage.sendTime,
        optOutNumber: optOutNumber !== undefined ? optOutNumber : existingMessage.optOutNumber,
        autoAddOptOut: autoAddOptOut !== undefined ? autoAddOptOut : existingMessage.autoAddOptOut,
        isActive: isActive !== undefined ? isActive : existingMessage.isActive,
      },
    });

    // 단계 업데이트 (제공된 경우)
    if (stages && Array.isArray(stages)) {
      // 기존 단계 삭제
      await prisma.funnelMessageStage.deleteMany({
        where: { funnelMessageId: id },
      });

      // 새 단계 생성
      await prisma.funnelMessageStage.createMany({
        data: stages.map((stage: any, index: number) => ({
          funnelMessageId: id,
          stageNumber: index + 1,
          daysAfter: stage.daysAfter || 0,
          sendTime: stage.sendTime || null,
          content: stage.content,
          imageUrl: stage.imageUrl || null,
          order: index,
        })),
      });
    }

    console.log('[Partner Funnel Messages PUT] 수정 성공:', { id });

    return NextResponse.json({ ok: true, message });
  } catch (error: any) {
    console.error('[Partner Funnel Messages PUT] Error:', error);
    return NextResponse.json(
      { ok: false, error: '퍼널 메시지 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/funnel-messages/[id]
 * 퍼널 메시지 삭제
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);

    if (isNaN(id)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    // 판매원/대리점장 프로필 확인
    const affiliateProfile = await prisma.affiliateProfile.findFirst({
      where: { userId: user.id },
      select: { id: true, type: true },
    });

    if (!affiliateProfile) {
      return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
    }

    // 퍼널 메시지 권한 확인 (본인이 생성한 것만 삭제 가능)
    const existingMessage = await prisma.funnelMessage.findFirst({
      where: {
        id,
        adminId: user.id, // 본인이 생성한 것만
      },
    });

    if (!existingMessage) {
      return NextResponse.json({ ok: false, error: '퍼널 메시지를 찾을 수 없거나 삭제 권한이 없습니다.' }, { status: 404 });
    }

    // 단계 먼저 삭제
    await prisma.funnelMessageStage.deleteMany({
      where: { funnelMessageId: id },
    });

    // 퍼널 메시지 삭제
    await prisma.funnelMessage.delete({
      where: { id },
    });

    console.log('[Partner Funnel Messages DELETE] 삭제 성공:', { id });

    return NextResponse.json({ ok: true, message: '퍼널 메시지가 삭제되었습니다.' });
  } catch (error: any) {
    console.error('[Partner Funnel Messages DELETE] Error:', error);
    return NextResponse.json(
      { ok: false, error: '퍼널 메시지 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
