export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { requirePartnerContext } from '@/app/api/partner/_utils';

/**
 * GET /api/partner/agents/db-stats
 * 대리점장의 판매원별 DB 관리 현황 조회
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { profile } = await requirePartnerContext();
    
    // 대리점장만 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, error: 'Only branch managers can view agent DB stats' }, { status: 403 });
    }

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month'); // YYYY-MM 형식

    // 월별 필터링 날짜 계산
    let dateFilter: { gte?: Date; lte?: Date } = {};
    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
      dateFilter = {
        gte: startDate,
        lte: endDate,
      };
    } else {
      // 기본값: 현재 달
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      dateFilter = {
        gte: startDate,
        lte: endDate,
      };
    }

    // 판매원 목록 조회
    const relations = await prisma.affiliateRelation.findMany({
      where: {
        managerId: profile.id,
        status: 'ACTIVE',
      },
      include: {
        AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            affiliateCode: true,
            User: {
              select: {
                mallUserId: true,
              },
            },
          },
        },
      },
    });

    const agents = relations.map(rel => rel.AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile).filter(Boolean);

    // 각 판매원별 DB 통계 조회
    const agentStats = await Promise.all(
      agents.map(async (agent) => {
        if (!agent) return null;

        // 할당된 고객 수 (선택된 달 기준)
        const totalCustomers = await prisma.affiliateLead.count({
          where: {
            agentId: agent.id,
            managerId: profile.id,
            createdAt: dateFilter,
          },
        });

        // 선택된 달 내 활동한 고객 수 (7일 기준)
        const sevenDaysAgo = dateFilter.lte ? new Date(dateFilter.lte.getTime() - 7 * 24 * 60 * 60 * 1000) : new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const activeCustomers = await prisma.affiliateLead.count({
          where: {
            agentId: agent.id,
            managerId: profile.id,
            createdAt: dateFilter,
            OR: [
              { lastContactedAt: { gte: sevenDaysAgo, lte: dateFilter.lte } },
              { updatedAt: { gte: sevenDaysAgo, lte: dateFilter.lte } },
            ],
          },
        });

        // 선택된 달 내 활동한 고객 수 (30일 기준)
        const thirtyDaysAgo = dateFilter.lte ? new Date(dateFilter.lte.getTime() - 30 * 24 * 60 * 60 * 1000) : new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentActiveCustomers = await prisma.affiliateLead.count({
          where: {
            agentId: agent.id,
            managerId: profile.id,
            createdAt: dateFilter,
            OR: [
              { lastContactedAt: { gte: thirtyDaysAgo, lte: dateFilter.lte } },
              { updatedAt: { gte: thirtyDaysAgo, lte: dateFilter.lte } },
            ],
          },
        });

        // 상태별 고객 수 (선택된 달 기준)
        const statusCounts = await prisma.affiliateLead.groupBy({
          by: ['status'],
          where: {
            agentId: agent.id,
            managerId: profile.id,
            createdAt: dateFilter,
          },
          _count: true,
        });

        const statusMap = statusCounts.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {} as Record<string, number>);

        // 최근 할당된 고객 (선택된 달 내)
        const recentAssigned = await prisma.affiliateLead.count({
          where: {
            agentId: agent.id,
            managerId: profile.id,
            createdAt: dateFilter,
          },
        });

        return {
          agentId: agent.id,
          agentName: agent.displayName || '판매원',
          affiliateCode: agent.affiliateCode,
          mallUserId: agent.User?.mallUserId,
          stats: {
            totalCustomers,
            activeCustomers7d: activeCustomers,
            activeCustomers30d: recentActiveCustomers,
            recentAssigned,
            statusCounts: statusMap,
          },
        };
      })
    );

    return NextResponse.json({
      ok: true,
      agents: agentStats.filter(Boolean),
    });
  } catch (error: any) {
    console.error('[Partner Agent DB Stats] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch agent DB stats' },
      { status: 500 }
    );
  }
}
