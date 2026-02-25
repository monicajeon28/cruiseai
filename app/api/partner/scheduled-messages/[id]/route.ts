export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * GET /api/partner/scheduled-messages/[id]
 * 특정 예약 메시지 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);

    if (isNaN(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid message ID' }, { status: 400 });
    }

    const message = await prisma.scheduledMessage.findFirst({
      where: {
        id,
        adminId: user.id, // 본인이 생성한 메시지만
      },
      include: {
        ScheduledMessageStage: {
          orderBy: { order: 'asc' },
        },
        CustomerGroup: {
          select: {
            id: true,
            name: true,
            _count: { select: { CustomerGroupMember: true } },
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json({ ok: false, error: 'Message not found' }, { status: 404 });
    }

    // Transform for frontend
    const formattedMessage = {
      ...message,
      stages: message.ScheduledMessageStage || [],
      targetGroup: message.CustomerGroup ? {
        id: message.CustomerGroup.id,
        name: message.CustomerGroup.name,
        _count: { members: message.CustomerGroup._count.CustomerGroupMember },
      } : null,
    };

    return NextResponse.json({ ok: true, message: formattedMessage });
  } catch (error) {
    console.error('[Partner Scheduled Messages GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch scheduled message' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/partner/scheduled-messages/[id]
 * 예약 메시지 수정 (판매원은 수정 불가)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);

    if (isNaN(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid message ID' }, { status: 400 });
    }

    // 판매원/대리점장 프로필 확인
    const affiliateProfile = await prisma.affiliateProfile.findFirst({
      where: { userId: user.id },
      select: { id: true, type: true },
    });

    if (!affiliateProfile) {
      return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
    }

    const body = await req.json();
    const {
      title,
      category,
      groupName,
      description,
      sendMethod,
      senderName,
      senderPhone,
      senderEmail,
      optOutNumber,
      isAdMessage,
      autoAddAdTag,
      autoAddOptOut,
      startDate,
      startTime,
      maxDays,
      repeatInterval,
      targetGroupId,
      stages,
      isActive,
    } = body;

    // 대리점장/판매원은 SMS, 이메일만 사용 가능 (카카오톡, 크루즈가이드 제한)
    if (sendMethod === 'kakao' || sendMethod === 'cruise-guide') {
      return NextResponse.json(
        { ok: false, error: '파트너는 SMS와 이메일 발송만 이용 가능합니다.' },
        { status: 400 }
      );
    }

    // 메시지 소유권 확인
    const existingMessage = await prisma.scheduledMessage.findFirst({
      where: {
        id,
        adminId: user.id,
      },
    });

    if (!existingMessage) {
      return NextResponse.json({ ok: false, error: 'Message not found or unauthorized' }, { status: 404 });
    }

    // targetGroupId가 있으면 해당 그룹이 판매원/대리점장의 그룹인지 확인
    let finalTargetGroupId: number | null = null;
    let metadata: any = {};

    if (targetGroupId) {
      // 먼저 PartnerCustomerGroup 확인 (대리점장용)
      const partnerGroup = await prisma.partnerCustomerGroup.findFirst({
        where: {
          id: targetGroupId,
          profileId: affiliateProfile.id,
        },
      });

      if (partnerGroup) {
        // PartnerCustomerGroup인 경우 metadata에 저장하고 targetGroupId는 null
        metadata.partnerGroupId = targetGroupId;
        finalTargetGroupId = null;
      } else {
        // CustomerGroup 확인 (관리자용, 판매원용)
        const group = await prisma.customerGroup.findFirst({
          where: {
            id: targetGroupId,
            affiliateProfileId: affiliateProfile.id,
          },
        });

        if (!group) {
          return NextResponse.json(
            { ok: false, error: '선택한 그룹을 찾을 수 없거나 권한이 없습니다.' },
            { status: 403 }
          );
        }
        finalTargetGroupId = targetGroupId;
      }
    }

    // 기존 단계 삭제 후 새로 생성
    await prisma.scheduledMessageStage.deleteMany({
      where: { scheduledMessageId: id },
    });

    // 예약 메시지 업데이트
    const updatedMessage = await prisma.scheduledMessage.update({
      where: { id },
      data: {
        title,
        category: category || '예약메시지',
        groupName: groupName || null,
        description: description || null,
        sendMethod,
        senderName: senderName || null,
        senderPhone: senderPhone || null,
        senderEmail: senderEmail || null,
        optOutNumber: optOutNumber || null,
        isAdMessage: isAdMessage || false,
        autoAddAdTag: autoAddAdTag !== false,
        autoAddOptOut: autoAddOptOut !== false,
        startDate: startDate ? new Date(startDate) : null,
        startTime: startTime || null,
        maxDays: maxDays || (sendMethod === 'sms' ? 999999 : 99999),
        repeatInterval: repeatInterval || null,
        targetGroupId: finalTargetGroupId,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
        isActive: isActive !== undefined ? isActive : true,
        ScheduledMessageStage: {
          create: stages.map((stage: any, index: number) => ({
            stageNumber: stage.stageNumber || index + 1,
            daysAfter: stage.daysAfter || 0,
            sendTime: stage.sendTime || null,
            title: stage.title,
            content: stage.content,
            order: index,
          })),
        },
      },
      include: {
        ScheduledMessageStage: {
          orderBy: { order: 'asc' },
        },
        CustomerGroup: {
          select: {
            id: true,
            name: true,
            _count: { select: { CustomerGroupMember: true } },
          },
        },
      },
    });

    // 고객그룹 연결 동기화 (그룹 변경 또는 sendMethod 변경 시)
    const existingMetadata = existingMessage.metadata as Record<string, any> | null;
    const oldPartnerGroupId = existingMetadata?.partnerGroupId;
    const newPartnerGroupId = metadata.partnerGroupId;
    const oldSendMethod = existingMessage.sendMethod;
    const newSendMethod = sendMethod;

    // sendMethod가 변경되었거나 그룹이 변경된 경우 동기화
    const groupChanged = oldPartnerGroupId !== newPartnerGroupId;
    const sendMethodChanged = oldSendMethod !== newSendMethod;

    if (groupChanged || sendMethodChanged) {
      const oldFieldToUpdate = oldSendMethod === 'sms' ? 'funnelSmsIds' : 'funnelEmailIds';
      const newFieldToUpdate = newSendMethod === 'sms' ? 'funnelSmsIds' : 'funnelEmailIds';

      // 이전 그룹에서 퍼널 ID 제거
      if (oldPartnerGroupId) {
        const oldGroup = await prisma.partnerCustomerGroup.findUnique({
          where: { id: oldPartnerGroupId },
          select: { funnelSmsIds: true, funnelEmailIds: true },
        });

        if (oldGroup) {
          const oldIds = (oldGroup[oldFieldToUpdate] as number[]) || [];
          const updatedOldIds = oldIds.filter(fid => fid !== id);

          if (oldIds.length !== updatedOldIds.length) {
            await prisma.partnerCustomerGroup.update({
              where: { id: oldPartnerGroupId },
              data: {
                [oldFieldToUpdate]: updatedOldIds,
              },
            });
            console.log(`[Partner Scheduled Messages PUT] 퍼널 ID ${id}가 이전 고객그룹 ${oldPartnerGroupId}의 ${oldFieldToUpdate}에서 제거됨`);
          }
        }
      }

      // 새 그룹에 퍼널 ID 추가
      if (newPartnerGroupId) {
        const newGroup = await prisma.partnerCustomerGroup.findUnique({
          where: { id: newPartnerGroupId },
          select: { funnelSmsIds: true, funnelEmailIds: true },
        });

        if (newGroup) {
          const newIds = (newGroup[newFieldToUpdate] as number[]) || [];

          if (!newIds.includes(id)) {
            await prisma.partnerCustomerGroup.update({
              where: { id: newPartnerGroupId },
              data: {
                [newFieldToUpdate]: [...newIds, id],
              },
            });
            console.log(`[Partner Scheduled Messages PUT] 퍼널 ID ${id}가 새 고객그룹 ${newPartnerGroupId}의 ${newFieldToUpdate}에 추가됨`);
          }
        }
      }
    }

    // targetGroup 조회 (metadata에 partnerGroupId가 있는 경우)
    let targetGroup = null;
    if (updatedMessage.CustomerGroup) {
      targetGroup = {
        id: updatedMessage.CustomerGroup.id,
        name: updatedMessage.CustomerGroup.name,
        _count: { members: updatedMessage.CustomerGroup._count.CustomerGroupMember },
      };
    } else if (updatedMessage.metadata && typeof updatedMessage.metadata === 'object' && (updatedMessage.metadata as any).partnerGroupId) {
      const partnerGroupId = (updatedMessage.metadata as any).partnerGroupId;
      const partnerGroup = await prisma.partnerCustomerGroup.findUnique({
        where: { id: partnerGroupId },
        select: {
          id: true,
          name: true,
          _count: { select: { AffiliateLead: true } },
        },
      });
      if (partnerGroup) {
        targetGroup = {
          id: partnerGroup.id,
          name: partnerGroup.name,
          _count: { members: partnerGroup._count.AffiliateLead },
        };
      }
    }

    // Transform for frontend
    const formattedMessage = {
      ...updatedMessage,
      stages: updatedMessage.ScheduledMessageStage || [],
      targetGroup,
    };

    return NextResponse.json({ ok: true, message: formattedMessage });
  } catch (error) {
    console.error('[Partner Scheduled Messages PUT] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to update scheduled message' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/scheduled-messages/[id]
 * 예약 메시지 삭제 (판매원은 삭제 불가)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);

    if (isNaN(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid message ID' }, { status: 400 });
    }

    // 판매원/대리점장 프로필 확인
    const affiliateProfile = await prisma.affiliateProfile.findFirst({
      where: { userId: user.id },
      select: { id: true, type: true },
    });

    if (!affiliateProfile) {
      return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
    }

    // 메시지 소유권 확인
    const existingMessage = await prisma.scheduledMessage.findFirst({
      where: {
        id,
        adminId: user.id,
      },
    });

    if (!existingMessage) {
      return NextResponse.json({ ok: false, error: 'Message not found or unauthorized' }, { status: 404 });
    }

    // 삭제 전에 고객그룹에서 퍼널 ID 제거 (고객그룹-퍼널 연결 동기화)
    const existingMetadata = existingMessage.metadata as Record<string, any> | null;
    if (existingMetadata?.partnerGroupId) {
      const partnerGroup = await prisma.partnerCustomerGroup.findUnique({
        where: { id: existingMetadata.partnerGroupId },
        select: { funnelSmsIds: true, funnelEmailIds: true },
      });

      if (partnerGroup) {
        const fieldToUpdate = existingMessage.sendMethod === 'sms' ? 'funnelSmsIds' : 'funnelEmailIds';
        const currentIds = (partnerGroup[fieldToUpdate] as number[]) || [];
        const updatedIds = currentIds.filter(fid => fid !== id);

        if (currentIds.length !== updatedIds.length) {
          await prisma.partnerCustomerGroup.update({
            where: { id: existingMetadata.partnerGroupId },
            data: {
              [fieldToUpdate]: updatedIds,
            },
          });
          console.log(`[Partner Scheduled Messages DELETE] 퍼널 ID ${id}가 고객그룹 ${existingMetadata.partnerGroupId}의 ${fieldToUpdate}에서 제거됨`);
        }
      }
    }

    // 예약 메시지 삭제 (Cascade로 단계도 자동 삭제됨)
    await prisma.scheduledMessage.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true, message: '예약 메시지가 삭제되었습니다.' });
  } catch (error) {
    console.error('[Partner Scheduled Messages DELETE] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to delete scheduled message' },
      { status: 500 }
    );
  }
}
