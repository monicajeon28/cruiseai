// lib/scheduler/tripStatusUpdater.ts
// 여행 상태 자동 업데이트 스케줄러

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 여행 상태를 날짜 기준으로 자동 업데이트
 * - Upcoming: 출발 전
 * - InProgress: 출발일 ~ 종료일
 * - Completed: 종료일 이후
 */
async function updateTripStatuses() {
  try {
    console.log('[Trip Status Updater] Starting status update...');

    const now = new Date();
    now.setHours(0, 0, 0, 0); // 자정 기준

    // 1) Upcoming -> InProgress (오늘이 출발일이거나 이후)
    const startedTrips = await prisma.trip.updateMany({
      where: {
        status: 'Upcoming',
        departureDate: {
          lte: now,
        },
        endDate: {
          gte: now,
        },
      },
      data: {
        status: 'InProgress',
      },
    });

    console.log(`[Trip Status Updater] ✅ Updated ${startedTrips.count} trip(s) to InProgress`);

    // 2) InProgress -> Completed (오늘이 종료일 이후)
    const completedTrips = await prisma.trip.updateMany({
      where: {
        status: 'InProgress',
        endDate: {
          lt: now,
        },
      },
      data: {
        status: 'Completed',
      },
    });

    console.log(`[Trip Status Updater] ✅ Updated ${completedTrips.count} trip(s) to Completed`);

    // 3) 통계 출력
    const statusCounts = await prisma.trip.groupBy({
      by: ['status'],
      _count: true,
    });

    console.log('[Trip Status Updater] 📊 Current status distribution:');
    statusCounts.forEach((stat) => {
      console.log(`  - ${stat.status}: ${stat._count} trip(s)`);
    });

    console.log('[Trip Status Updater] ✅ Status update completed successfully');
  } catch (error) {
    console.error('[Trip Status Updater] ❌ Error during status update:', error);
  }
}

/**
 * 스케줄러 시작
 * 매일 자정(00:00)에 실행
 */
export function startTripStatusScheduler() {
  console.log('[Trip Status Updater] 🚀 Starting scheduler...');

  // 매일 자정에 실행 (cron: '0 0 * * *')
  cron.schedule('0 0 * * *', async () => {
    console.log('[Trip Status Updater] ⏰ Running scheduled update at:', new Date().toISOString());
    await updateTripStatuses();
  });

  console.log('[Trip Status Updater] ✅ Scheduler started (runs daily at 00:00)');

  // 서버 시작 시 한 번 실행
  updateTripStatuses();
}

/**
 * 수동 실행 함수 (테스트/디버깅용)
 */
export async function manualUpdateTripStatuses() {
  return updateTripStatuses();
}

// 스크립트로 직접 실행 시
if (require.main === module) {
  updateTripStatuses()
    .then(() => {
      console.log('✅ Manual update completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Manual update failed:', error);
      process.exit(1);
    });
}

