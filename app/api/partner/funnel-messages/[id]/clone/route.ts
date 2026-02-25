export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * POST /api/partner/funnel-messages/[id]/clone
 * 공유받은 퍼널 메시지를 내 퍼널로 복제
 *
 * 요구사항:
 * - 공유받은 퍼널만 복제 가능 (FunnelMessageShare 확인)
 * - FunnelMessage 전체 복제 (title, description, messageType, stages 등)
 * - FunnelMessageStage도 함께 복제
 * - sourceId에 원본 ID 저장
 * - ownerProfileId에 복제한 사람의 프로필 ID 저장
 * - 복제된 퍼널은 isTemplate = false
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('[Partner Funnel Clone] 요청 시작');

    const user = await getSessionUser();
    if (!user) {
      console.log('[Partner Funnel Clone] 사용자 인증 실패');
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const sourceFunnelId = parseInt(resolvedParams.id);

    if (isNaN(sourceFunnelId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 퍼널 ID입니다.' }, { status: 400 });
    }

    console.log('[Partner Funnel Clone] 사용자 확인:', { userId: user.id, name: user.name, sourceFunnelId });

    // 1. 판매원/대리점장 프로필 확인
    const affiliateProfile = await prisma.affiliateProfile.findFirst({
      where: { userId: user.id },
      select: {
        id: true,
        type: true,
        displayName: true,
        branchLabel: true,
      },
    });

    if (!affiliateProfile) {
      console.log('[Partner Funnel Clone] 프로필 없음:', { userId: user.id });
      return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
    }

    console.log('[Partner Funnel Clone] 프로필 확인:', { profileId: affiliateProfile.id, type: affiliateProfile.type });

    // 2. 원본 퍼널 메시지 조회
    const sourceFunnel = await prisma.funnelMessage.findUnique({
      where: { id: sourceFunnelId },
      include: {
        FunnelMessageStage: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!sourceFunnel) {
      console.log('[Partner Funnel Clone] 원본 퍼널을 찾을 수 없음:', { sourceFunnelId });
      return NextResponse.json({ ok: false, error: '원본 퍼널을 찾을 수 없습니다.' }, { status: 404 });
    }

    console.log('[Partner Funnel Clone] 원본 퍼널 확인:', {
      id: sourceFunnel.id,
      title: sourceFunnel.title,
      stageCount: sourceFunnel.FunnelMessageStage.length
    });

    // 3. 공유 권한 확인 - FunnelMessageShare에서 해당 퍼널이 나에게 공유되었는지 확인
    // 공유 조건 구성
    const shareConditions: any[] = [
      { shareType: 'ALL', status: 'ACTIVE' },
      { shareType: 'SPECIFIC', targetProfileId: affiliateProfile.id, status: 'ACTIVE' },
    ];

    if (affiliateProfile.type === 'BRANCH_MANAGER') {
      shareConditions.push({ shareType: 'BRANCH_MANAGER', status: 'ACTIVE' });
    }
    if (affiliateProfile.type === 'SALES_AGENT') {
      shareConditions.push({ shareType: 'SALES_AGENT', status: 'ACTIVE' });
    }

    const share = await prisma.funnelMessageShare.findFirst({
      where: {
        funnelMessageId: sourceFunnelId,
        OR: shareConditions,
      },
    });

    if (!share) {
      console.log('[Partner Funnel Clone] 공유 권한 없음:', {
        sourceFunnelId,
        profileId: affiliateProfile.id,
        profileType: affiliateProfile.type
      });
      return NextResponse.json(
        { ok: false, error: '이 퍼널은 공유받지 않았거나 복제할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    console.log('[Partner Funnel Clone] 공유 권한 확인:', {
      shareId: share.id,
      shareType: share.shareType
    });

    // 4. 퍼널 메시지 복제
    const clonedFunnel = await prisma.funnelMessage.create({
      data: {
        // 소유자 정보
        adminId: user.id,
        ownerProfileId: affiliateProfile.id,

        // 복제 관계
        sourceId: sourceFunnelId,
        isTemplate: false, // 복제된 퍼널은 템플릿이 아님

        // 원본 퍼널의 정보 복사
        messageType: sourceFunnel.messageType,
        title: `${sourceFunnel.title} (복사본)`,
        category: sourceFunnel.category,
        groupName: sourceFunnel.groupName,
        description: sourceFunnel.description,
        senderPhone: sourceFunnel.senderPhone,
        senderEmail: sourceFunnel.senderEmail,
        sendTime: sourceFunnel.sendTime,
        optOutNumber: sourceFunnel.optOutNumber,
        autoAddOptOut: sourceFunnel.autoAddOptOut,
        isActive: sourceFunnel.isActive,

        // groupId는 null로 설정 (복제 시점에는 특정 그룹에 연결하지 않음)
        groupId: null,

        // 단계 복제
        FunnelMessageStage: {
          create: sourceFunnel.FunnelMessageStage.map((stage, index) => ({
            stageNumber: stage.stageNumber,
            daysAfter: stage.daysAfter,
            sendTime: stage.sendTime,
            content: stage.content,
            imageUrl: stage.imageUrl,
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

    console.log('[Partner Funnel Clone] 복제 성공:', {
      clonedId: clonedFunnel.id,
      sourceId: sourceFunnelId,
      title: clonedFunnel.title,
      stageCount: clonedFunnel.FunnelMessageStage.length
    });

    return NextResponse.json({
      ok: true,
      message: clonedFunnel,
      details: {
        sourceId: sourceFunnelId,
        clonedId: clonedFunnel.id,
        stageCount: clonedFunnel.FunnelMessageStage.length,
      },
    });
  } catch (error: any) {
    console.error('[Partner Funnel Clone] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: '퍼널 복제에 실패했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}
