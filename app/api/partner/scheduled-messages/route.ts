export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * GET /api/partner/scheduled-messages
 * 판매원/대리점장의 예약 메시지 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
    console.log('[Partner Scheduled Messages GET] 요청 시작');

    const user = await getSessionUser();
    if (!user) {
      console.log('[Partner Scheduled Messages GET] 사용자 인증 실패');
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Partner Scheduled Messages GET] 사용자 확인:', { userId: user.id, name: user.name });

    // 판매원/대리점장 프로필 확인
    let affiliateProfile;
    try {
      affiliateProfile = await prisma.affiliateProfile.findFirst({
        where: { userId: user.id },
        select: {
          id: true,
          type: true,
          AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile: {
            where: { status: 'ACTIVE' },
            select: {
              AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile: {
                select: {
                  id: true,
                  userId: true,
                },
              },
            },
          },
        },
      });
    } catch (profileError: any) {
      console.error('[Partner Scheduled Messages GET] 프로필 조회 실패:', profileError);
      return NextResponse.json(
        { ok: false, error: '프로필 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (!affiliateProfile) {
      console.log('[Partner Scheduled Messages GET] 프로필 없음:', { userId: user.id });
      return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
    }

    console.log('[Partner Scheduled Messages GET] 프로필 확인:', { profileId: affiliateProfile.id, type: affiliateProfile.type });

    // 조회할 adminId 목록 구성
    const adminIds: number[] = [user.id]; // 본인 것

    // 대리점장인 경우 소속 판매원의 메시지도 포함
    if (affiliateProfile.type === 'BRANCH_MANAGER') {
      // managedRelations 조회
      const managedRelations = await prisma.affiliateRelation.findMany({
        where: {
          managerId: affiliateProfile.id,
          status: 'ACTIVE',
        },
        include: {
          AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
      });

      for (const relation of managedRelations) {
        const agent = relation.AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile;
        if (agent?.userId) {
          adminIds.push(agent.userId);
        }
      }
      console.log('[Partner Scheduled Messages GET] 대리점장 - 판매원 메시지 포함:', { adminIds });
    }

    let messages;
    try {
      messages = await prisma.scheduledMessage.findMany({
        where: {
          adminId: { in: adminIds }, // 본인 것 + 판매원 것(대리점장인 경우)
        },
        select: {
          id: true,
          adminId: true,
          title: true,
          category: true,
          groupName: true,
          description: true,
          sendMethod: true,
          senderName: true,
          senderPhone: true,
          senderEmail: true,
          optOutNumber: true,
          isAdMessage: true,
          autoAddAdTag: true,
          autoAddOptOut: true,
          startDate: true,
          startTime: true,
          maxDays: true,
          repeatInterval: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          metadata: true,
          targetGroupId: true,
          ScheduledMessageStage: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              stageNumber: true,
              daysAfter: true,
              sendTime: true,
              title: true,
              content: true,
              order: true,
            },
          },
          CustomerGroup: {
            select: {
              id: true,
              name: true,
              _count: { select: { CustomerGroupMember: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      console.log('[Partner Scheduled Messages GET] 메시지 조회 완료:', { count: messages.length });
    } catch (messagesError: any) {
      console.error('[Partner Scheduled Messages GET] 메시지 조회 실패:', messagesError);
      console.error('[Partner Scheduled Messages GET] 메시지 조회 에러 상세:', {
        message: messagesError?.message,
        code: messagesError?.code,
        meta: messagesError?.meta,
      });
      return NextResponse.json(
        { ok: false, error: '메시지 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // metadata에 partnerGroupId가 있는 메시지들의 PartnerCustomerGroup 조회
    let partnerGroupMap = new Map();
    try {
      const partnerGroupIds = messages
        .filter((msg) => {
          try {
            if (!msg.metadata) return false;
            if (typeof msg.metadata === 'string') {
              const parsed = JSON.parse(msg.metadata);
              return parsed && typeof parsed === 'object' && parsed.partnerGroupId;
            }
            return typeof msg.metadata === 'object' && (msg.metadata as any).partnerGroupId;
          } catch {
            return false;
          }
        })
        .map((msg) => {
          try {
            if (typeof msg.metadata === 'string') {
              const parsed = JSON.parse(msg.metadata);
              return parsed?.partnerGroupId;
            }
            return (msg.metadata as any)?.partnerGroupId;
          } catch {
            return null;
          }
        })
        .filter((id): id is number => id !== null && typeof id === 'number');

      if (partnerGroupIds.length > 0) {
        const partnerGroups = await prisma.partnerCustomerGroup.findMany({
          where: { id: { in: partnerGroupIds } },
          select: {
            id: true,
            name: true,
            _count: { select: { AffiliateLead: true } },
          },
        });
        partnerGroupMap = new Map(partnerGroups.map((g) => [g.id, g]));
        console.log('[Partner Scheduled Messages GET] 파트너 그룹 조회 완료:', { count: partnerGroups.length });
      }
    } catch (partnerGroupError: any) {
      console.error('[Partner Scheduled Messages GET] 파트너 그룹 조회 실패:', partnerGroupError);
      // 파트너 그룹 조회 실패해도 계속 진행
    }

    // 프론트엔드 형식에 맞게 변환
    const formattedMessages = messages.map((msg) => {
      let targetGroup = null;

      try {
        if (msg.CustomerGroup) {
          // CustomerGroup이 있는 경우
          targetGroup = {
            id: msg.CustomerGroup.id,
            name: msg.CustomerGroup.name,
            _count: {
              members: msg.CustomerGroup._count.CustomerGroupMember,
            },
          };
        } else if (msg.metadata) {
          // metadata 파싱
          let metadataObj: any = null;
          try {
            if (typeof msg.metadata === 'string') {
              metadataObj = JSON.parse(msg.metadata);
            } else if (typeof msg.metadata === 'object') {
              metadataObj = msg.metadata;
            }
          } catch (parseError) {
            console.warn('[Partner Scheduled Messages GET] metadata 파싱 실패:', parseError);
          }

          if (metadataObj && metadataObj.partnerGroupId) {
            const partnerGroupId = metadataObj.partnerGroupId;
            const partnerGroup = partnerGroupMap.get(partnerGroupId);
            if (partnerGroup) {
              targetGroup = {
                id: partnerGroup.id,
                name: partnerGroup.name,
                _count: {
                  members: partnerGroup._count.AffiliateLead,
                },
              };
            }
          }
        }
      } catch (targetGroupError) {
        console.warn('[Partner Scheduled Messages GET] targetGroup 처리 실패:', targetGroupError);
      }

      return {
        ...msg,
        stages: msg.ScheduledMessageStage || [],
        targetGroup,
      };
    });

    console.log('[Partner Scheduled Messages GET] 응답 준비 완료:', { count: formattedMessages.length });

    return NextResponse.json({ ok: true, messages: formattedMessages });
  } catch (error: any) {
    console.error('[Partner Scheduled Messages GET] Error:', error);
    console.error('[Partner Scheduled Messages GET] Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
      meta: error?.meta,
    });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to fetch scheduled messages',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/scheduled-messages
 * 대리점장의 예약 메시지 생성 (판매원은 생성 불가)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
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
    } = body;

    if (!title || !sendMethod) {
      return NextResponse.json(
        { ok: false, error: '제목과 발송 방식은 필수입니다.' },
        { status: 400 }
      );
    }

    // 대리점장/판매원은 SMS, 이메일만 사용 가능 (카카오톡, 크루즈가이드 제한)
    if (sendMethod === 'kakao' || sendMethod === 'cruise-guide') {
      return NextResponse.json(
        { ok: false, error: '파트너는 SMS와 이메일 발송만 이용 가능합니다.' },
        { status: 400 }
      );
    }

    if (!stages || stages.length === 0) {
      return NextResponse.json(
        { ok: false, error: '최소 1개의 메시지 단계가 필요합니다.' },
        { status: 400 }
      );
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

    // 예약 메시지 생성
    const scheduledMessage = await prisma.scheduledMessage.create({
      data: {
        adminId: user.id, // 판매원/대리점장의 User ID
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
        isActive: true,
        ScheduledMessageStage: {
          create: stages.map((stage: any, index: number) => ({
            stageNumber: stage.stageNumber || index + 1,
            daysAfter: stage.daysAfter || 0,
            sendTime: stage.sendTime || null,
            title: stage.title,
            content: stage.content,
            order: index,
            updatedAt: new Date(), // Explicitly set updatedAt
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

    // PartnerCustomerGroup에 퍼널 ID 추가 (고객그룹-퍼널 연결)
    if (metadata.partnerGroupId) {
      const partnerGroup = await prisma.partnerCustomerGroup.findUnique({
        where: { id: metadata.partnerGroupId },
        select: { funnelSmsIds: true, funnelEmailIds: true },
      });

      if (partnerGroup) {
        const fieldToUpdate = sendMethod === 'sms' ? 'funnelSmsIds' : 'funnelEmailIds';
        const currentIds = (partnerGroup[fieldToUpdate] as number[]) || [];

        // 중복 방지
        if (!currentIds.includes(scheduledMessage.id)) {
          await prisma.partnerCustomerGroup.update({
            where: { id: metadata.partnerGroupId },
            data: {
              [fieldToUpdate]: [...currentIds, scheduledMessage.id],
            },
          });
          console.log(`[Partner Scheduled Messages POST] 퍼널 ID ${scheduledMessage.id}가 고객그룹 ${metadata.partnerGroupId}의 ${fieldToUpdate}에 추가됨`);
        }
      }
    }

    // targetGroup 조회 (metadata에 partnerGroupId가 있는 경우)
    let targetGroup = null;
    if (scheduledMessage.CustomerGroup) {
      targetGroup = {
        id: scheduledMessage.CustomerGroup.id,
        name: scheduledMessage.CustomerGroup.name,
        _count: {
          members: scheduledMessage.CustomerGroup._count.CustomerGroupMember,
        },
      };
    } else if (scheduledMessage.metadata && typeof scheduledMessage.metadata === 'object' && (scheduledMessage.metadata as any).partnerGroupId) {
      const partnerGroupId = (scheduledMessage.metadata as any).partnerGroupId;
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
          _count: {
            members: partnerGroup._count.AffiliateLead,
          },
        };
      }
    }

    // 프론트엔드 형식에 맞게 변환
    const formattedMessage = {
      ...scheduledMessage,
      stages: scheduledMessage.ScheduledMessageStage,
      targetGroup,
    };

    return NextResponse.json({ ok: true, message: formattedMessage });
  } catch (error: any) {
    console.error('[Partner Scheduled Messages POST] Error:', error);
    console.error('[Partner Scheduled Messages POST] Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
      meta: error?.meta,
    });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to create scheduled message',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined,
      },
      { status: 500 }
    );
  }
}
