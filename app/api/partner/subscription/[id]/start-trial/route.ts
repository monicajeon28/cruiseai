export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 대리점장이 자신의 팀 판매원에게 무료 체험 시작
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } = await requirePartnerContext();

    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, message: '대리점장만 무료 체험을 시작할 수 있습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const contractId = parseInt(id);

    // 계약서 조회 및 권한 확인
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      include: {
        user: {
          include: {
            AffiliateProfile: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ ok: false, message: '계약서를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 대리점장의 팀에 속한 판매원인지 확인
    if (contract.invitedByProfileId !== profile.id) {
      // 관계 확인
      const relation = await prisma.affiliateRelation.findFirst({
        where: {
          managerId: profile.id,
          agentId: contract.user?.AffiliateProfile?.id,
          status: 'ACTIVE',
        },
      });

      if (!relation) {
        return NextResponse.json({ ok: false, message: '자신의 팀 판매원만 무료 체험을 시작할 수 있습니다.' }, { status: 403 });
      }
    }

    const metadata = (contract.metadata as any) || {};

    // 이미 무료 체험이 시작되었는지 확인
    if (metadata.isTrial === true && metadata.trialEndDate) {
      const trialEndDate = new Date(metadata.trialEndDate);
      if (new Date() < trialEndDate) {
        return NextResponse.json({ ok: false, message: '이미 무료 체험이 진행 중입니다.' }, { status: 400 });
      }
    }

    // 무료 체험 기간 설정 (7일)
    const trialStartDate = new Date();
    const trialEndDate = new Date(trialStartDate);
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    // 정식 구독 시작일 (체험 종료일)
    const subscriptionStartDate = new Date(trialEndDate);
    const subscriptionEndDate = new Date(subscriptionStartDate);
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);

    // 계약서 업데이트
    await prisma.affiliateContract.update({
      where: { id: contractId },
      data: {
        contractStartDate: trialStartDate,
        contractEndDate: subscriptionEndDate,
        status: 'submitted',
        metadata: {
          ...metadata,
          contractType: 'SUBSCRIPTION_AGENT',
          isTrial: true,
          trialStartDate: trialStartDate.toISOString(),
          trialEndDate: trialEndDate.toISOString(),
          subscriptionStartDate: subscriptionStartDate.toISOString(),
          subscriptionEndDate: subscriptionEndDate.toISOString(),
          nextBillingDate: trialEndDate.toISOString(),
          paymentAmount: 300000,
          paymentRequired: true,
          trialStartedBy: profile.id,
        },
      },
    });

    logger.log('[Partner Subscription Start Trial]', {
      contractId,
      managerId: profile.id,
      trialEndDate: trialEndDate.toISOString(),
    });

    return NextResponse.json({
      ok: true,
      message: '무료 체험이 시작되었습니다. (7일)',
      trialEndDate: trialEndDate.toISOString(),
    });
  } catch (error: any) {
    logger.error('[Partner Subscription Start Trial API] Error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || '무료 체험 시작에 실패했습니다.' },
      { status: 500 }
    );
  }
}


