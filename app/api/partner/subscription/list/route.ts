export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 대리점장이 자신의 팀에 속한 정액제 판매원 목록 조회
 */
export async function GET() {
  try {
    const { profile } = await requirePartnerContext();

    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, message: '대리점장만 조회 가능합니다.' }, { status: 403 });
    }

    // 대리점장 소유의 판매원들 조회
    const relations = await prisma.affiliateRelation.findMany({
      where: {
        managerId: profile.id,
        status: 'ACTIVE',
      },
      include: {
        AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile: {
          include: {
            user: true,
          },
        },
      },
    });

    const agentProfileIds = relations.map((r) => r.agentId);
    const agentUserIds = relations
      .map((r) => r.AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile?.user?.id)
      .filter((id): id is number => id !== null && id !== undefined);

    // 정액제 판매원 계약서 조회
    const contracts = await prisma.affiliateContract.findMany({
      where: {
        userId: { in: agentUserIds },
        metadata: {
          path: ['contractType'],
          equals: 'SUBSCRIPTION_AGENT',
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            mallUserId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // subscriptions 형태로 변환
    const subscriptions = contracts.map((contract) => {
      const metadata = (contract.metadata as any) || {};
      const startDate = contract.contractStartDate || contract.createdAt;
      const endDate = contract.contractEndDate || (() => {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + 2);
        return date;
      })();
      
      let nextBillingDate = metadata?.nextBillingDate 
        ? new Date(metadata.nextBillingDate)
        : (() => {
            const date = new Date(endDate);
            date.setMonth(date.getMonth() - 1);
            return date;
          })();
      
      if (nextBillingDate < new Date()) {
        nextBillingDate = new Date(endDate);
      }
      
      const isTrial = metadata?.isTrial === true;
      const trialEndDate = metadata?.trialEndDate ? new Date(metadata.trialEndDate) : null;
      const now = new Date();
      const isCurrentlyTrial = isTrial && trialEndDate && now < trialEndDate;

      return {
        id: contract.id,
        userId: contract.userId || 0,
        mallUserId: contract.user?.mallUserId || `user_${contract.id}`,
        status: isCurrentlyTrial 
          ? 'trial' 
          : contract.status === 'completed' 
            ? 'active' 
            : contract.status === 'terminated' 
              ? 'expired' 
              : 'pending',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        nextBillingDate: nextBillingDate.toISOString(),
        isTrial: isCurrentlyTrial,
        trialEndDate: trialEndDate?.toISOString() || null,
        user: contract.user || {
          id: contract.userId || 0,
          name: contract.name,
          phone: contract.phone,
          email: contract.email,
        },
      };
    });

    return NextResponse.json({
      ok: true,
      subscriptions,
    });
  } catch (error: any) {
    logger.error('[Partner Subscription List API] Error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || '구독 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}


