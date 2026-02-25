// lib/scheduler/rePurchaseTrigger.ts
// 재구매 트리거 자동 생성 스케줄러

import cron from 'node-cron';
import prisma from '@/lib/prisma';
import { createTripEndTrigger, createGracePeriodEndTrigger } from '@/lib/rePurchase/trigger';

/**
 * 여행 종료된 사용자 확인 및 트리거 생성
 */
async function checkTripEnds() {
  try {
    console.log('[RePurchase Trigger] Checking for ended trips...');

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // 오늘 종료된 여행 찾기 (Reservation을 통해 User 조회)
    const endedTrips = await prisma.trip.findMany({
      where: {
        status: 'Completed',
        endDate: {
          lte: now,
        },
      },
      include: {
        Reservation: {
          select: {
            mainUserId: true,
          },
        },
      },
    });

    console.log(`[RePurchase Trigger] Found ${endedTrips.length} ended trip(s)`);

    let created = 0;
    for (const trip of endedTrips) {
      // 각 예약의 사용자에 대해 트리거 생성
      const userIds = trip.Reservation.map(r => r.mainUserId);
      const uniqueUserIds = [...new Set(userIds)] as number[];

      for (const userId of uniqueUserIds) {
        try {
          // 이미 트리거가 있는지 확인
          const existing = await prisma.rePurchaseTrigger.findFirst({
            where: {
              userId,
              lastTripEndDate: trip.endDate ? new Date(trip.endDate) : undefined,
              triggerType: 'grace_period_end',
            },
          });

          if (!existing && trip.endDate) {
            await createTripEndTrigger(userId, new Date(trip.endDate));
            created++;
            console.log(`[RePurchase Trigger] Created trigger for user ${userId}, trip ${trip.id}`);
          }
        } catch (error) {
          console.error(`[RePurchase Trigger] Error creating trigger for trip ${trip.id}, user ${userId}:`, error);
        }
      }
    }

    console.log(`[RePurchase Trigger] ✅ Created ${created} new trigger(s)`);
  } catch (error) {
    console.error('[RePurchase Trigger] ❌ Error during trip end check:', error);
  }
}

/**
 * 유예 기간 종료된 사용자 확인 및 트리거 생성
 */
async function checkGracePeriodEnds() {
  try {
    console.log('[RePurchase Trigger] Checking for grace period ends...');

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // 1일 전 종료된 여행 찾기 (유예 기간 종료)
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const endedTrips = await prisma.trip.findMany({
      where: {
        status: 'Completed',
        endDate: {
          gte: oneDayAgo,
          lt: now,
        },
      },
      include: {
        Reservation: {
          select: {
            mainUserId: true,
          },
        },
      },
    });

    console.log(`[RePurchase Trigger] Found ${endedTrips.length} trip(s) with grace period ending`);

    let created = 0;
    for (const trip of endedTrips) {
      // 각 예약의 사용자에 대해 트리거 생성
      const userIds = trip.Reservation.map(r => r.mainUserId);
      const uniqueUserIds = [...new Set(userIds)] as number[];

      for (const userId of uniqueUserIds) {
        try {
          // 이미 트리거가 있는지 확인
          const existing = await prisma.rePurchaseTrigger.findFirst({
            where: {
              userId,
              lastTripEndDate: trip.endDate ? new Date(trip.endDate) : undefined,
              triggerType: 'grace_period_end',
            },
          });

          if (!existing && trip.endDate) {
            await createGracePeriodEndTrigger(userId, new Date(trip.endDate));
            created++;
            console.log(`[RePurchase Trigger] Created grace period trigger for user ${userId}, trip ${trip.id}`);
          }
        } catch (error) {
          console.error(`[RePurchase Trigger] Error creating grace period trigger for trip ${trip.id}, user ${userId}:`, error);
        }
      }
    }

    console.log(`[RePurchase Trigger] ✅ Created ${created} new grace period trigger(s)`);
  } catch (error) {
    console.error('[RePurchase Trigger] ❌ Error during grace period check:', error);
  }
}

/**
 * 스케줄러 시작
 */
export function startRePurchaseTriggerScheduler() {
  console.log('[RePurchase Trigger] 🚀 Starting scheduler...');

  // 매일 자정에 실행: 여행 종료 확인
  cron.schedule('0 0 * * *', async () => {
    console.log('[RePurchase Trigger] ⏰ Running trip end check at:', new Date().toISOString());
    await checkTripEnds();
  });

  // 매일 오전 9시에 실행: 유예 기간 종료 확인
  cron.schedule('0 9 * * *', async () => {
    console.log('[RePurchase Trigger] ⏰ Running grace period check at:', new Date().toISOString());
    await checkGracePeriodEnds();
  });

  console.log('[RePurchase Trigger] ✅ Scheduler started');
  console.log('[RePurchase Trigger]    - Trip end check: Daily at 00:00');
  console.log('[RePurchase Trigger]    - Grace period check: Daily at 09:00');

  // 서버 시작 시 한 번 실행
  checkTripEnds();
  checkGracePeriodEnds();
}

/**
 * 수동 실행 함수 (테스트용)
 */
export async function manualCheckTripEnds() {
  return checkTripEnds();
}

export async function manualCheckGracePeriodEnds() {
  return checkGracePeriodEnds();
}
