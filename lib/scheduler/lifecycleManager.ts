// lib/scheduler/lifecycleManager.ts
// 고객 생애주기 관리: 동면 및 재활성화 시스템

import cron from 'node-cron';
import prisma from '@/lib/prisma';
import { sendNotificationToUser } from '@/lib/push/server';
import { recoverDbFromTerminatedContracts } from './contractTerminationHandler';

/**
 * 동면 처리 (크루즈몰 가입 기준 6개월 미로그인 사용자)
 * 매일 새벽 2시 실행
 */
async function hibernateInactiveUsers() {
  try {
    console.log('[Lifecycle] 🌙 Starting hibernation check...');

    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000); // 6개월 = 180일

    // 크루즈몰 가입 기준 6개월 이상 로그인하지 않은 사용자 조회
    // role이 'community'인 크루즈몰 고객만 대상
    const inactiveUsers = await prisma.user.findMany({
      where: {
        role: 'community', // 크루즈몰 고객만
        isHibernated: false,
        OR: [
          // lastActiveAt이 있고 6개월 이상 지난 경우
          {
            lastActiveAt: {
              lt: sixMonthsAgo,
            },
          },
          // lastActiveAt이 없고 가입일(createdAt) 기준 6개월 이상 지난 경우
          {
            lastActiveAt: null,
            createdAt: {
              lt: sixMonthsAgo,
            },
          },
        ],
      },
    });

    console.log(`[Lifecycle] Found ${inactiveUsers.length} inactive mall user(s)`);

    for (const user of inactiveUsers) {
      // 동면 상태로 전환
      await prisma.user.update({
        where: { id: user.id },
        data: {
          isHibernated: true,
          hibernatedAt: now,
          customerStatus: 'dormant', // customerStatus도 동면으로 설정
        },
      });

      console.log(`[Lifecycle] 😴 User ${user.id} (${user.name}) hibernated (6 months inactive)`);
    }

    console.log(`[Lifecycle] ✅ Hibernation check completed: ${inactiveUsers.length} user(s) hibernated`);
  } catch (error) {
    console.error('[Lifecycle] ❌ Hibernation check failed:', error);
  }
}

/**
 * 재활성화 알림 발송 (동면 후 주기적으로)
 * 매주 월요일 오전 10시 실행
 */
async function sendReactivationNotifications() {
  try {
    console.log('[Lifecycle] 🔔 Starting reactivation notifications...');

    const now = new Date();
    
    // 동면 상태이고 마지막 알림 후 30일 이상 지난 사용자
    const hibernatedUsers = await prisma.user.findMany({
      where: {
        isHibernated: true,
        hibernatedAt: {
          not: null,
        },
      },
    });

    console.log(`[Lifecycle] Found ${hibernatedUsers.length} hibernated user(s)`);

    let sentCount = 0;

    for (const user of hibernatedUsers) {
      // CMS 템플릿에서 재활성화 메시지 조회
      const template = await prisma.cmsNotificationTemplate.findUnique({
        where: { triggerCode: 'REACTIVATION_90D' },
      });

      if (!template || !template.isActive) continue;

      // 이미 재활성화 알림을 보냈는지 확인 (30일 이내)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const recentNotification = await prisma.notificationLog.findFirst({
        where: {
          userId: user.id,
          notificationType: 'REACTIVATION',
          sentAt: {
            gte: thirtyDaysAgo,
          },
        },
      });

      if (recentNotification) {
        console.log(`[Lifecycle] User ${user.id} already received reactivation within 30 days`);
        continue;
      }

      // 재활성화 알림 발송
      const userName = user.name || '고객';
      const message = template.message.replace(/\[고객명\]/g, userName);

      const result = await sendNotificationToUser(user.id, {
        title: template.title,
        body: message,
        tag: 'reactivation',
        requireInteraction: false,
        data: { url: '/onboarding', action: 'reactivate' },
      });

      if (result.success) {
        // 알림 로그 기록
        await prisma.notificationLog.create({
          data: {
            userId: user.id,
            tripId: null,
            itineraryId: null,
            notificationType: 'REACTIVATION',
            eventKey: `REACTIVATION_${user.id}_${now.getTime()}`,
            title: template.title,
            body: message,
          },
        });

        sentCount++;
        console.log(`[Lifecycle] 📨 Reactivation notification sent to user ${user.id}`);
      }
    }

    console.log(`[Lifecycle] ✅ Reactivation notifications sent: ${sentCount}/${hibernatedUsers.length}`);
  } catch (error) {
    console.error('[Lifecycle] ❌ Reactivation notifications failed:', error);
  }
}

/**
 * 재활성화 처리 (로그인 시 자동)
 */
export async function reactivateUser(userId: number): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isHibernated: true },
    });

    if (user && user.isHibernated) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isHibernated: false,
          hibernatedAt: null,
          lastActiveAt: new Date(),
        },
      });

      console.log(`[Lifecycle] 🌟 User ${userId} reactivated`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Lifecycle] Failed to reactivate user:', error);
    return false;
  }
}

/**
 * 활동 시각 업데이트 (로그인, API 호출 시)
 */
export async function updateLastActive(userId: number): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastActiveAt: new Date(),
      },
    });
  } catch (error) {
    // 에러 무시 (중요하지 않은 작업)
    console.debug('[Lifecycle] Failed to update lastActiveAt:', error);
  }
}

/**
 * Lifecycle Manager 시작
 */
export function startLifecycleManager() {
  console.log('[Lifecycle] 🚀 Starting Lifecycle Manager...');

  // 동면 체크: 매일 새벽 2시 (cron: '0 2 * * *')
  cron.schedule('0 2 * * *', async () => {
    console.log('[Lifecycle] ⏰ Running hibernation check...');
    await hibernateInactiveUsers();
  });

  // 재활성화 알림: 매주 월요일 오전 10시 (cron: '0 10 * * 1')
  cron.schedule('0 10 * * 1', async () => {
    console.log('[Lifecycle] ⏰ Running reactivation notifications...');
    await sendReactivationNotifications();
  });

  // 계약 해지 후 DB 회수: 매일 새벽 3시 (cron: '0 3 * * *')
  cron.schedule('0 3 * * *', async () => {
    console.log('[Lifecycle] ⏰ Running contract termination DB recovery...');
    await recoverDbFromTerminatedContracts();
  });

  console.log('[Lifecycle] ✅ Lifecycle Manager started');
  console.log('[Lifecycle]    - Hibernation check: Daily at 02:00 (6 months inactive for mall users)');
  console.log('[Lifecycle]    - Reactivation notifications: Monday at 10:00');
  console.log('[Lifecycle]    - Contract termination DB recovery: Daily at 03:00 (7 days after termination)');

  // 서버 시작 시 즉시 1회 실행
  hibernateInactiveUsers();
}

/**
 * 수동 실행 (테스트용)
 */
export async function manualHibernationCheck() {
  console.log('[Lifecycle] 🔧 Manual hibernation check started');
  await hibernateInactiveUsers();
}

export async function manualReactivationNotifications() {
  console.log('[Lifecycle] 🔧 Manual reactivation notifications started');
  await sendReactivationNotifications();
}

