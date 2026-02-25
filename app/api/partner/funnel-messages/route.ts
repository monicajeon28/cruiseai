export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * GET /api/partner/funnel-messages
 * 판매원/대리점장의 퍼널 메시지 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
    console.log('[Partner Funnel Messages GET] 요청 시작');

    const user = await getSessionUser();
    if (!user) {
      console.log('[Partner Funnel Messages GET] 사용자 인증 실패');
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Partner Funnel Messages GET] 사용자 확인:', { userId: user.id, name: user.name });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'sms', 'email', 'kakao'

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
      console.error('[Partner Funnel Messages GET] 프로필 조회 실패:', profileError);
      return NextResponse.json(
        { ok: false, error: '프로필 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (!affiliateProfile) {
      console.log('[Partner Funnel Messages GET] 프로필 없음:', { userId: user.id });
      return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
    }

    console.log('[Partner Funnel Messages GET] 프로필 확인:', { profileId: affiliateProfile.id, type: affiliateProfile.type });

    // 조회할 adminId 목록 구성
    const adminIds: number[] = [user.id]; // 본인 것

    // 대리점장인 경우 소속 판매원의 메시지도 포함
    if (affiliateProfile.type === 'BRANCH_MANAGER') {
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
      console.log('[Partner Funnel Messages GET] 대리점장 - 판매원 메시지 포함:', { adminIds });
    }

    // 퍼널 메시지 조회 조건
    const where: any = {
      OR: [
        // 본인이 생성한 퍼널
        { adminId: { in: adminIds } },
        // 본인/판매원의 그룹에 연결된 퍼널
        {
          CustomerGroup: {
            affiliateProfileId: affiliateProfile.id,
          },
        },
      ],
    };

    if (type) {
      where.messageType = type;
    }

    let messages;
    try {
      messages = await prisma.funnelMessage.findMany({
        where,
        include: {
          FunnelMessageStage: {
            orderBy: { order: 'asc' },
          },
          CustomerGroup: {
            select: {
              id: true,
              name: true,
              affiliateProfileId: true,
              AffiliateProfile: {
                select: {
                  id: true,
                  displayName: true,
                  branchLabel: true,
                  type: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (dbError: any) {
      console.error('[Partner Funnel Messages GET] DB 조회 실패:', dbError);
      return NextResponse.json(
        { ok: false, error: '퍼널 메시지 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    console.log('[Partner Funnel Messages GET] 조회 성공:', { count: messages.length });

    return NextResponse.json({
      ok: true,
      messages: messages.map(msg => ({
        id: msg.id,
        adminId: msg.adminId,
        groupId: msg.groupId,
        messageType: msg.messageType,
        title: msg.title,
        category: msg.category,
        groupName: msg.groupName,
        description: msg.description,
        senderPhone: msg.senderPhone,
        senderEmail: msg.senderEmail,
        sendTime: msg.sendTime,
        optOutNumber: msg.optOutNumber,
        autoAddOptOut: msg.autoAddOptOut,
        isActive: msg.isActive,
        createdAt: msg.createdAt.toISOString(),
        updatedAt: msg.updatedAt.toISOString(),
        stages: msg.FunnelMessageStage.map(stage => ({
          id: stage.id,
          stageNumber: stage.stageNumber,
          daysAfter: stage.daysAfter,
          sendTime: stage.sendTime,
          content: stage.content,
          imageUrl: stage.imageUrl,
          order: stage.order,
          createdAt: stage.createdAt.toISOString(),
          updatedAt: stage.updatedAt.toISOString(),
        })),
        customerGroup: msg.CustomerGroup ? {
          id: msg.CustomerGroup.id,
          name: msg.CustomerGroup.name,
          affiliateProfileId: msg.CustomerGroup.affiliateProfileId,
        } : null,
        // 소유자 정보
        owner: msg.CustomerGroup?.AffiliateProfile
          ? {
              type: msg.CustomerGroup.AffiliateProfile.type || 'agent',
              name: msg.CustomerGroup.AffiliateProfile.displayName || msg.CustomerGroup.AffiliateProfile.branchLabel,
            }
          : { type: 'self', name: '나' },
      })),
    });
  } catch (error: any) {
    console.error('[Partner Funnel Messages GET] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: '퍼널 메시지를 불러오는데 실패했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/funnel-messages
 * 퍼널 메시지 생성
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
      messageType,
      title,
      category,
      groupName,
      description,
      senderPhone,
      senderEmail,
      sendTime,
      optOutNumber,
      autoAddOptOut,
      groupId,
      stages,
    } = body;

    if (!messageType || !title) {
      return NextResponse.json({ ok: false, error: '메시지 타입과 제목은 필수입니다.' }, { status: 400 });
    }

    if (!stages || !Array.isArray(stages) || stages.length === 0) {
      return NextResponse.json({ ok: false, error: '최소 1개의 메시지 단계가 필요합니다.' }, { status: 400 });
    }

    // 그룹 권한 확인 (groupId가 있는 경우)
    if (groupId) {
      const group = await prisma.customerGroup.findFirst({
        where: {
          id: groupId,
          OR: [
            { adminId: user.id },
            { affiliateProfileId: affiliateProfile.id },
          ],
        },
      });

      if (!group) {
        return NextResponse.json({ ok: false, error: '그룹에 대한 권한이 없습니다.' }, { status: 403 });
      }
    }

    // 퍼널 메시지 생성
    const message = await prisma.funnelMessage.create({
      data: {
        adminId: user.id,
        groupId: groupId || null,
        messageType,
        title,
        category: category || null,
        groupName: groupName || null,
        description: description || null,
        senderPhone: senderPhone || null,
        senderEmail: senderEmail || null,
        sendTime: sendTime || null,
        optOutNumber: optOutNumber || null,
        autoAddOptOut: autoAddOptOut !== false,
        FunnelMessageStage: {
          create: stages.map((stage: any, index: number) => ({
            stageNumber: index + 1,
            daysAfter: stage.daysAfter || 0,
            sendTime: stage.sendTime || null,
            content: stage.content,
            imageUrl: stage.imageUrl || null,
            order: index,
          })),
        },
      },
      include: {
        FunnelMessageStage: {
          orderBy: { order: 'asc' },
        },
      },
    });

    console.log('[Partner Funnel Messages POST] 생성 성공:', { id: message.id });

    return NextResponse.json({ ok: true, message });
  } catch (error: any) {
    console.error('[Partner Funnel Messages POST] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: '퍼널 메시지 생성에 실패했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}
