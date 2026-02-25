// lib/scheduler/lifecycleManager.ts
// 크루즈가이드 앱: node-cron 없는 stub (스케줄러는 메인 앱에서 실행)

import prisma from '@/lib/prisma';

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
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Lifecycle] Failed to reactivate user:', error);
    return false;
  }
}

export async function updateLastActive(userId: number): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    });
  } catch (error) {
    console.debug('[Lifecycle] Failed to update lastActiveAt:', error);
  }
}

// 가이드 앱은 스케줄러 실행 안 함 (메인 앱에서 처리)
export function startLifecycleManager() {
  console.log('[Lifecycle] Guide app: scheduler skipped (runs in main app)');
}

export async function manualHibernationCheck() {}
export async function manualReactivationNotifications() {}
