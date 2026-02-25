// lib/scheduler/affiliateLinkCleanup.ts
// 어필리에이트 링크 자동 정리 스케줄러

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { backupLinkData } from '../backup/affiliateDataBackup';

const prisma = new PrismaClient();

interface CleanupStats {
  expired: number;
  inactive: number;
  archived: number;
  testLinks: number;
  total: number;
  backedUp: number;
  backupErrors: number;
}

/**
 * 만료된 링크 상태 변경
 */
async function expireLinks(): Promise<number> {
  const now = new Date();
  
  const result = await prisma.affiliateLink.updateMany({
    where: {
      status: 'ACTIVE',
      expiresAt: {
        lt: now,
      },
    },
    data: {
      status: 'EXPIRED',
    },
  });

  return result.count;
}

/**
 * 비활성 링크 아카이빙
 * - INACTIVE 상태
 * - 180일 이상 미접근
 * - 리드/판매 기록 없음
 */
async function archiveInactiveLinks(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 180);

  // 리드나 판매가 있는 링크 ID 조회
  const activeLinkIds = await prisma.$queryRaw<{ linkId: number }[]>`
    SELECT DISTINCT link_id as "linkId"
    FROM "AffiliateLead"
    WHERE link_id IS NOT NULL
    UNION
    SELECT DISTINCT link_id as "linkId"
    FROM "AffiliateSale"
    WHERE link_id IS NOT NULL
  `;

  const activeIds = activeLinkIds.map((r) => r.linkId);

  const result = await prisma.affiliateLink.updateMany({
    where: {
      status: 'INACTIVE',
      lastAccessedAt: {
        lt: cutoffDate,
      },
      ...(activeIds.length > 0 && {
        id: {
          notIn: activeIds,
        },
      }),
    },
    data: {
      status: 'REVOKED',
    },
  });

  return result.count;
}

/**
 * 오래된 링크 아카이빙
 * - 생성일 365일 이상
 * - 180일 이상 미접근
 * - 리드/판매 기록 없음
 */
async function archiveOldLinks(): Promise<number> {
  const createdCutoff = new Date();
  createdCutoff.setDate(createdCutoff.getDate() - 365);

  const accessedCutoff = new Date();
  accessedCutoff.setDate(accessedCutoff.getDate() - 180);

  // 리드나 판매가 있는 링크 ID 조회
  const activeLinkIds = await prisma.$queryRaw<{ linkId: number }[]>`
    SELECT DISTINCT link_id as "linkId"
    FROM "AffiliateLead"
    WHERE link_id IS NOT NULL
    UNION
    SELECT DISTINCT link_id as "linkId"
    FROM "AffiliateSale"
    WHERE link_id IS NOT NULL
  `;

  const activeIds = activeLinkIds.map((r) => r.linkId);

  const result = await prisma.affiliateLink.updateMany({
    where: {
      createdAt: {
        lt: createdCutoff,
      },
      lastAccessedAt: {
        lt: accessedCutoff,
      },
      status: {
        in: ['ACTIVE', 'INACTIVE'],
      },
      ...(activeIds.length > 0 && {
        id: {
          notIn: activeIds,
        },
      }),
    },
    data: {
      status: 'REVOKED',
    },
  });

  return result.count;
}

/**
 * 테스트/임시 링크 삭제
 * - campaignName에 "test", "임시", "temp" 포함
 * - 생성 후 30일 경과
 * - 리드/판매 기록 없음
 * 
 * ⚠️ 중요: 삭제 전 본사 데이터 백업 수행
 */
async function deleteTestLinks(): Promise<{
  deleted: number;
  backedUp: number;
  backupErrors: number;
}> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  // 리드나 판매가 있는 링크 ID 조회
  const activeLinkIds = await prisma.$queryRaw<{ linkId: number }[]>`
    SELECT DISTINCT link_id as "linkId"
    FROM "AffiliateLead"
    WHERE link_id IS NOT NULL
    UNION
    SELECT DISTINCT link_id as "linkId"
    FROM "AffiliateSale"
    WHERE link_id IS NOT NULL
  `;

  const activeIds = activeLinkIds.map((r) => r.linkId);

  // 테스트 링크 조회
  const testLinks = await prisma.affiliateLink.findMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
      OR: [
        { campaignName: { contains: 'test' } },
        { campaignName: { contains: '임시' } },
        { campaignName: { contains: 'temp' } },
        { campaignName: { contains: 'Test' } },
        { campaignName: { contains: 'TEST' } },
        { campaignName: { contains: 'Temp' } },
        { campaignName: { contains: 'TEMP' } },
      ],
      ...(activeIds.length > 0 && {
        id: {
          notIn: activeIds,
        },
      }),
    },
    select: {
      id: true,
    },
  });

  if (testLinks.length === 0) {
    return { deleted: 0, backedUp: 0, backupErrors: 0 };
  }

  const testLinkIds = testLinks.map((l) => l.id);

  // ⚠️ 중요: 삭제 전 본사 데이터 백업
  console.log(`[Affiliate Link Cleanup] 📦 Backing up data for ${testLinkIds.length} link(s) before deletion...`);
  const backupResult = await backupLinkData(testLinkIds);
  
  if (!backupResult.success) {
    console.error(`[Affiliate Link Cleanup] ⚠️ Backup completed with ${backupResult.errors.length} error(s)`);
    backupResult.errors.forEach((err) => console.error(`  - ${err}`));
  } else {
    console.log(`[Affiliate Link Cleanup] ✅ Backup completed: ${backupResult.backedUp} link(s) backed up`);
  }

  // 관련 이벤트 삭제
  await prisma.affiliateLinkEvent.deleteMany({
    where: {
      linkId: {
        in: testLinkIds,
      },
    },
  });

  // 링크 삭제 (CASCADE로 리드/판매는 보존)
  // ⚠️ 주의: AffiliateProfile(판매원몰 아이디)는 절대 삭제되지 않음
  // 리드, 판매, 여권, 계약서는 백업되었고 DB에도 그대로 보존됨
  const result = await prisma.affiliateLink.deleteMany({
    where: {
      id: {
        in: testLinkIds,
      },
    },
  });

  return {
    deleted: result.count,
    backedUp: backupResult.backedUp,
    backupErrors: backupResult.errors.length,
  };
}

/**
 * 링크 정리 실행
 */
async function cleanupAffiliateLinks(): Promise<CleanupStats> {
  try {
    console.log('[Affiliate Link Cleanup] 🧹 Starting cleanup process...');

    const stats: CleanupStats = {
      expired: 0,
      inactive: 0,
      archived: 0,
      testLinks: 0,
      total: 0,
      backedUp: 0,
      backupErrors: 0,
    };

    // 1. 만료된 링크 상태 변경
    stats.expired = await expireLinks();
    console.log(`[Affiliate Link Cleanup] ✅ Expired ${stats.expired} link(s)`);

    // 2. 비활성 링크 아카이빙
    stats.inactive = await archiveInactiveLinks();
    console.log(`[Affiliate Link Cleanup] ✅ Archived ${stats.inactive} inactive link(s)`);

    // 3. 오래된 링크 아카이빙
    stats.archived = await archiveOldLinks();
    console.log(`[Affiliate Link Cleanup] ✅ Archived ${stats.archived} old link(s)`);

    // 4. 테스트 링크 삭제 (백업 포함)
    const testLinkResult = await deleteTestLinks();
    stats.testLinks = testLinkResult.deleted;
    stats.backedUp = testLinkResult.backedUp;
    stats.backupErrors = testLinkResult.backupErrors;
    console.log(`[Affiliate Link Cleanup] ✅ Deleted ${stats.testLinks} test link(s) (${stats.backedUp} backed up)`);

    stats.total = stats.expired + stats.inactive + stats.archived + stats.testLinks;

    // 통계 출력
    const statusCounts = await prisma.affiliateLink.groupBy({
      by: ['status'],
      _count: true,
    });

    console.log('[Affiliate Link Cleanup] 📊 Current status distribution:');
    statusCounts.forEach((stat) => {
      console.log(`  - ${stat.status}: ${stat._count} link(s)`);
    });

    console.log(`[Affiliate Link Cleanup] ✅ Cleanup completed: ${stats.total} link(s) processed`);

    return stats;
  } catch (error) {
    console.error('[Affiliate Link Cleanup] ❌ Error during cleanup:', error);
    throw error;
  }
}

/**
 * 스케줄러 시작
 * 매주 월요일 새벽 3시에 실행
 */
export function startAffiliateLinkCleanupScheduler() {
  console.log('[Affiliate Link Cleanup] 🚀 Starting scheduler...');
  console.log('[Affiliate Link Cleanup] 📅 Schedule: Every Monday at 3:00 AM');

  // 매주 월요일 새벽 3시 (0 3 * * 1)
  cron.schedule('0 3 * * 1', async () => {
    console.log('[Affiliate Link Cleanup] ⏰ Scheduled cleanup triggered');
    await cleanupAffiliateLinks();
  });

  console.log('[Affiliate Link Cleanup] ✅ Scheduler started');
}

/**
 * 수동 실행용 함수 (API에서 호출)
 */
export async function runManualCleanup(): Promise<CleanupStats> {
  return await cleanupAffiliateLinks();
}

