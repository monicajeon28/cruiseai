export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getSubscriptionInfo } from '@/lib/subscription-limits';

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    let subscriptionInfo = await getSubscriptionInfo(sessionUser.id);

    // gest 계정인데 정액제 계약서가 없는 경우 자동 생성
    if (!subscriptionInfo) {
      const isGest = (sessionUser as any).mallUserId?.toLowerCase().startsWith('gest') || sessionUser.phone?.toLowerCase().startsWith('gest');
      if (isGest) {
        try {
          const prisma = (await import('@/lib/prisma')).default;
          const existingContract = await prisma.affiliateContract.findFirst({
            where: {
              userId: sessionUser.id,
              metadata: {
                path: ['contractType'],
                equals: 'SUBSCRIPTION_AGENT',
              },
            },
          });

          if (!existingContract) {
            const now = new Date();
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 7); // 7일 무료 체험

            const contractEndDate = new Date();
            contractEndDate.setDate(contractEndDate.getDate() + 7);

            await prisma.affiliateContract.create({
              data: {
                userId: sessionUser.id,
                name: sessionUser.name || '정액제 판매원',
                residentId: '000000-0000000',
                phone: sessionUser.phone || '000-0000-0000',
                email: `${(sessionUser as any).mallUserId || sessionUser.phone}@example.com`,
                address: '테스트 주소',
                status: 'completed', // gest 계정은 완료 상태로 시작
                metadata: {
                  contractType: 'SUBSCRIPTION_AGENT',
                  isTrial: true,
                  trialEndDate: trialEndDate.toISOString(),
                },
                contractStartDate: now,
                contractEndDate: contractEndDate,
                submittedAt: now,
                updatedAt: now,
              },
            });

            // 계약서 생성 후 다시 조회
            subscriptionInfo = await getSubscriptionInfo(sessionUser.id);
          }
        } catch (error: any) {
          console.error('[Subscription Check] Failed to auto-create contract:', error);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      subscription: subscriptionInfo ? {
        isTrial: subscriptionInfo.isTrial,
        status: subscriptionInfo.status,
        trialEndDate: subscriptionInfo.trialEndDate?.toISOString() || null,
        endDate: subscriptionInfo.endDate?.toISOString() || null,
      } : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: error.message || '구독 정보를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

