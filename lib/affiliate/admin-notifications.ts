// lib/affiliate/admin-notifications.ts
// 관리자 알림 시스템 (계약/수당/DB 회수 관련)

import prisma from '@/lib/prisma';
import { sendNotificationToUser } from '@/lib/push/server';

export type NotificationType =
  | 'CONTRACT_TERMINATED'
  | 'CONTRACT_RENEWAL_APPROVED'
  | 'CONTRACT_RENEWAL_REJECTED'
  | 'DB_RECOVERY_FAILED'
  | 'DB_RECOVERY_SUCCESS'
  | 'COMMISSION_CALCULATION_FAILED'
  | 'COMMISSION_CALCULATION_SUCCESS'
  | 'COMMISSION_TIER_MISSING'
  | 'APIS_SYNC_FAILED';

export interface AdminNotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  contractId?: number;
  saleId?: number;
  profileId?: number;
  details?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 관리자에게 알림 전송
 */
export async function notifyAdmin(
  payload: AdminNotificationPayload
): Promise<void> {
  try {
    // 모든 관리자 계정 찾기
    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true, name: true },
    });

    if (admins.length === 0) {
      console.warn('[AdminNotification] No admin users found');
      return;
    }

    // 푸시 알림 전송
    const notificationPayload = {
      title: payload.title,
      body: payload.message,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `admin-${payload.type}`,
      requireInteraction: payload.priority === 'critical' || payload.priority === 'high',
      data: {
        type: payload.type,
        contractId: payload.contractId || null,
        saleId: payload.saleId || null,
        profileId: payload.profileId || null,
        priority: payload.priority || 'medium',
        ...payload.details,
      },
    };

    // 모든 관리자에게 알림 전송
    for (const admin of admins) {
      try {
        await sendNotificationToUser(admin.id, notificationPayload);
        console.log(`[AdminNotification] Sent ${payload.type} to admin ${admin.id}`);
      } catch (error) {
        console.error(`[AdminNotification] Failed to send to admin ${admin.id}:`, error);
      }
    }

    // AdminMessage에도 기록 (대시보드에서 확인 가능)
    await prisma.adminMessage.createMany({
      data: admins.map(admin => ({
        adminId: admins[0].id, // 첫 번째 관리자가 발신자
        userId: null, // 전체 관리자 대상
        title: payload.title,
        content: payload.message,
        messageType: payload.priority === 'critical' ? 'error' : payload.priority === 'high' ? 'warning' : 'info',
        isActive: true,
        metadata: {
          type: payload.type,
          contractId: payload.contractId || null,
          saleId: payload.saleId || null,
          profileId: payload.profileId || null,
          priority: payload.priority || 'medium',
          ...payload.details,
        },
      })),
    });

    console.log(`[AdminNotification] ✅ Notification sent: ${payload.type}`);
  } catch (error) {
    console.error('[AdminNotification] Failed to send notification:', error);
    // 알림 실패해도 메인 작업은 계속 진행
  }
}

/**
 * 계약 해지 알림
 */
export async function notifyContractTerminated(
  contractId: number,
  contractType: string,
  reason: string,
  userId?: number | null
): Promise<void> {
  await notifyAdmin({
    type: 'CONTRACT_TERMINATED',
    title: '⚠️ 계약 해지 알림',
    message: `${contractType} 계약이 해지되었습니다. (계약 ID: ${contractId})`,
    contractId,
    profileId: userId ? undefined : undefined,
    details: {
      contractType,
      reason,
      userId,
    },
    priority: 'high',
  });
}

/**
 * 계약 갱신 승인 알림
 */
export async function notifyContractRenewalApproved(
  contractId: number,
  renewalDate: string
): Promise<void> {
  await notifyAdmin({
    type: 'CONTRACT_RENEWAL_APPROVED',
    title: '✅ 계약 갱신 승인',
    message: `계약이 갱신되었습니다. (계약 ID: ${contractId}, 갱신일: ${renewalDate})`,
    contractId,
    details: {
      renewalDate,
    },
    priority: 'medium',
  });
}

/**
 * 계약 갱신 거부 알림
 */
export async function notifyContractRenewalRejected(
  contractId: number,
  contractType: string
): Promise<void> {
  await notifyAdmin({
    type: 'CONTRACT_RENEWAL_REJECTED',
    title: '❌ 계약 갱신 거부',
    message: `${contractType} 계약 갱신이 거부되었습니다. (계약 ID: ${contractId})`,
    contractId,
    details: {
      contractType,
    },
    priority: 'high',
  });
}

/**
 * DB 회수 실패 알림
 */
export async function notifyDbRecoveryFailed(
  contractId: number,
  contractType: string,
  error: string,
  retryCount: number
): Promise<void> {
  await notifyAdmin({
    type: 'DB_RECOVERY_FAILED',
    title: '🚨 DB 회수 실패',
    message: `${contractType} 계약의 DB 회수가 실패했습니다. (계약 ID: ${contractId}, 재시도: ${retryCount}회)`,
    contractId,
    details: {
      contractType,
      error,
      retryCount,
    },
    priority: retryCount >= 3 ? 'critical' : 'high',
  });
}

/**
 * DB 회수 성공 알림
 */
export async function notifyDbRecoverySuccess(
  contractId: number,
  contractType: string,
  recoveredCount: { leads: number; sales: number; links: number }
): Promise<void> {
  await notifyAdmin({
    type: 'DB_RECOVERY_SUCCESS',
    title: '✅ DB 회수 완료',
    message: `${contractType} 계약의 DB가 성공적으로 회수되었습니다. (계약 ID: ${contractId})`,
    contractId,
    details: {
      contractType,
      recoveredCount,
    },
    priority: 'medium',
  });
}

/**
 * 수당 계산 실패 알림
 */
export async function notifyCommissionCalculationFailed(
  saleId: number,
  error: string
): Promise<void> {
  await notifyAdmin({
    type: 'COMMISSION_CALCULATION_FAILED',
    title: '⚠️ 수당 계산 실패',
    message: `판매 ID ${saleId}의 수당 계산이 실패했습니다.`,
    saleId,
    details: {
      error,
    },
    priority: 'high',
  });
}

/**
 * 수당 계산 성공 알림 (중요한 경우만)
 */
export async function notifyCommissionCalculationSuccess(
  saleId: number,
  amount: number
): Promise<void> {
  // 큰 금액인 경우만 알림 (선택적)
  if (amount > 1000000) { // 100만원 이상
    await notifyAdmin({
      type: 'COMMISSION_CALCULATION_SUCCESS',
      title: '💰 대액 수당 계산 완료',
      message: `판매 ID ${saleId}의 수당이 계산되었습니다. (금액: ${amount.toLocaleString()}원)`,
      saleId,
      details: {
        amount,
      },
      priority: 'low',
    });
  }
}

/**
 * CommissionTier 누락 알림
 * 상품/객실 타입에 대한 수당 설정이 없을 때 관리자에게 알림
 */
export async function notifyCommissionTierMissing(
  productCode: string,
  cabinType: string,
  affiliateProductId: number | null,
  fareCategory?: string | null
): Promise<void> {
  await notifyAdmin({
    type: 'COMMISSION_TIER_MISSING',
    title: '⚠️ 수당 티어 설정 누락',
    message: `상품 "${productCode}"의 객실 타입 "${cabinType}"에 대한 수당 설정이 없습니다. 수당이 0원으로 처리됩니다.`,
    details: {
      productCode,
      cabinType,
      affiliateProductId,
      fareCategory,
    },
    priority: 'high',
  });
}

/**
 * APIS 동기화 실패 알림
 */
export async function notifyApisSyncFailed(
  tripId: number,
  error: string,
  retryCount: number
): Promise<void> {
  await notifyAdmin({
    type: 'APIS_SYNC_FAILED',
    title: '🚨 APIS 동기화 실패',
    message: `Trip ID ${tripId}의 APIS 스프레드시트 동기화가 실패했습니다. (재시도: ${retryCount}회)`,
    details: {
      tripId,
      error,
      retryCount,
    },
    priority: retryCount >= 3 ? 'critical' : 'high',
  });
}


