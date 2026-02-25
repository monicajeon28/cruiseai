// lib/affiliate/sales-notification.ts
// 판매 확정 관련 알림

import prisma from '@/lib/prisma';
import { sendNotificationToUser } from '@/lib/push/server';

/**
 * 판매 확정 승인 알림
 */
export async function notifySaleApproved(saleId: number) {
  try {
    const sale = await prisma.affiliateSale.findUnique({
      where: { id: saleId },
      include: {
        AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile: {
          include: {
            User: {
              select: { id: true, name: true },
            },
          },
        },
        AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile: {
          include: {
            User: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!sale) return;

    // 판매원에게 알림
    if (sale.agentId && sale.AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile?.User) {
      await sendNotificationToUser(sale.AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile.User.id, {
        title: '✅ 판매 확정 승인',
        body: `판매 #${saleId}이(가) 승인되었습니다. 수당이 계산되었습니다.`,
        data: { saleId, type: 'sale_approved' },
      });
    }

    // 대리점장에게 알림 (판매원이 아닌 경우)
    if (sale.managerId && sale.AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile?.User && !sale.agentId) {
      await sendNotificationToUser(sale.AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile.User.id, {
        title: '✅ 판매 확정 승인',
        body: `판매 #${saleId}이(가) 승인되었습니다. 수당이 계산되었습니다.`,
        data: { saleId, type: 'sale_approved' },
      });
    }
  } catch (error) {
    console.error('[Notify Sale Approved] Error:', error);
  }
}

/**
 * 판매 확정 거부 알림
 */
export async function notifySaleRejected(saleId: number, reason: string) {
  try {
    const sale = await prisma.affiliateSale.findUnique({
      where: { id: saleId },
      include: {
        AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile: {
          include: {
            User: {
              select: { id: true, name: true },
            },
          },
        },
        AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile: {
          include: {
            User: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!sale) return;

    // 판매원에게 알림
    if (sale.agentId && sale.AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile?.User) {
      await sendNotificationToUser(sale.AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile.User.id, {
        title: '❌ 판매 확정 거부',
        body: `판매 #${saleId}이(가) 거부되었습니다. 사유: ${reason}`,
        data: { saleId, type: 'sale_rejected', reason },
      });
    }

    // 대리점장에게 알림
    if (sale.managerId && sale.AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile?.User && !sale.agentId) {
      await sendNotificationToUser(sale.AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile.User.id, {
        title: '❌ 판매 확정 거부',
        body: `판매 #${saleId}이(가) 거부되었습니다. 사유: ${reason}`,
        data: { saleId, type: 'sale_rejected', reason },
      });
    }
  } catch (error) {
    console.error('[Notify Sale Rejected] Error:', error);
  }
}
