// lib/push/server.ts
// 서버 사이드 웹 푸시 알림 시스템

import webpush from 'web-push';
import prisma from '@/lib/prisma';

// VAPID 설정
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;

if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: Record<string, string | number>;
}

/**
 * 특정 사용자에게 웹 푸시 알림을 전송합니다.
 */
export async function sendNotificationToUser(
  userId: number,
  payload: NotificationPayload
): Promise<{ success: boolean; sentCount: number; errors: string[] }> {
  try {
    // 사용자의 모든 푸시 구독을 조회
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      console.log(`[Push] 사용자 ${userId}에 대한 구독 정보가 없습니다.`);
      return { success: true, sentCount: 0, errors: [] };
    }

    const errors: string[] = [];
    let sentCount = 0;

    // 모든 구독에 알림 전송
    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: subscription.keys as { p256dh: string; auth: string },
        };

        await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
        sentCount++;
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        console.error(`[Push] 알림 전송 실패 (${subscription.endpoint}):`, errorMsg);

        // 410 Gone 오류면 구독 삭제
        if (error?.statusCode === 410) {
          await prisma.pushSubscription.delete({
            where: { id: subscription.id },
          });
        }

        errors.push(errorMsg);
      }
    }

    return { success: sentCount > 0, sentCount, errors };
  } catch (error) {
    console.error('[Push] 알림 전송 중 오류:', error);
    return {
      success: false,
      sentCount: 0,
      errors: [String(error)],
    };
  }
}

/**
 * 여러 사용자에게 알림을 전송합니다.
 */
export async function sendNotificationToUsers(
  userIds: number[],
  payload: NotificationPayload
): Promise<{ totalSent: number; totalErrors: number }> {
  let totalSent = 0;
  let totalErrors = 0;

  for (const userId of userIds) {
    const result = await sendNotificationToUser(userId, payload);
    totalSent += result.sentCount;
    totalErrors += result.errors.length;
  }

  return { totalSent, totalErrors };
}

/**
 * 브로드캐스트 알림 전송 (전체 또는 특정 사용자 그룹)
 */
export async function sendBroadcastNotification(
  payload: NotificationPayload & { requireInteraction?: boolean },
  targetUserIds?: number[]
): Promise<{ totalSent: number; totalErrors: number }> {
  try {
    let userIds: number[] = [];

    if (targetUserIds && targetUserIds.length > 0) {
      // 특정 사용자들에게만 전송
      userIds = targetUserIds;
    } else {
      // 전체 사용자에게 전송
      const allUsers = await prisma.user.findMany({
        select: { id: true },
      });
      userIds = allUsers.map(u => u.id);
    }

    return await sendNotificationToUsers(userIds, payload);
  } catch (error) {
    console.error('[Push] 브로드캐스트 알림 전송 중 오류:', error);
    return { totalSent: 0, totalErrors: 1 };
  }
}

/**
 * 구독 정보 저장
 */
export async function savePushSubscription(
  userId: number,
  subscription: PushSubscriptionJSON,
  userAgent?: string
): Promise<boolean> {
  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        keys: subscription.keys,
        userAgent,
        updatedAt: new Date(),
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        userAgent,
      },
    });

    console.log(`[Push] Subscription saved for user ${userId}`);
    return true;
  } catch (error) {
    console.error(`[Push] Failed to save subscription for user ${userId}`, error);
    return false;
  }
}

/**
 * 구독 정보 삭제
 */
export async function deletePushSubscription(endpoint: string): Promise<boolean> {
  try {
    await prisma.pushSubscription.delete({
      where: { endpoint },
    });

    console.log('[Push] Subscription deleted', { endpoint: endpoint.substring(0, 50) + '...' });
    return true;
  } catch (error) {
    console.error('[Push] Failed to delete subscription', error);
    return false;
  }
}

// web-push의 PushSubscription 타입
interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

