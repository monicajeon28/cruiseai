export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * GET /api/partner/dashboard/stats
 * 파트너(대리점장/판매원) 대시보드 통계 데이터
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 프로필 확인
    const profile = await prisma.affiliateProfile.findFirst({
      where: { userId: user.id },
      select: {
        id: true,
        type: true,
        userId: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, error: 'Profile not found' }, { status: 404 });
    }

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    let stats: any = {
      profileType: profile.type,
      // 기본값 설정 (컴포넌트 호환성)
      totalLinks: 0,
      totalLeads: 0,
      totalSales: 0,
      teamMembers: 0,
      recentLeads: [],
      recentSales: [],
      monthlySales: [],
    };

    // 대리점장인 경우
    if (profile.type === 'BRANCH_MANAGER') {
      // 1. 팀원 통계
      const teamRelations = await prisma.affiliateRelation.findMany({
        where: {
          managerId: profile.id,
          status: 'ACTIVE',
        },
        include: {
          AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile: {
            include: {
              User: { select: { isHibernated: true, isLocked: true } },
            },
          },
        },
      });

      const totalAgents = teamRelations.length;
      const activeAgents = teamRelations.filter(
        rel => !rel.AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile?.User?.isHibernated &&
          !rel.AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile?.User?.isLocked
      ).length;

      // 2. 팀 매출 통계 (본인 + 팀원)
      const teamProfileIds = [
        profile.id,
        ...teamRelations.map(rel => rel.agentId),
      ];

      const thisMonthTeamSales = await prisma.affiliateSale.aggregate({
        where: {
          managerId: profile.id,
          createdAt: { gte: thisMonthStart },
          status: { in: ['CONFIRMED', 'SETTLED'] },
        },
        _sum: { saleAmount: true },
        _count: { id: true },
      });

      const lastMonthTeamSales = await prisma.affiliateSale.aggregate({
        where: {
          managerId: profile.id,
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
          status: { in: ['CONFIRMED', 'SETTLED'] },
        },
        _sum: { saleAmount: true },
        _count: { id: true },
      });

      // 3. 개인 매출
      const thisMonthPersonalSales = await prisma.affiliateSale.aggregate({
        where: {
          agentId: profile.id,
          createdAt: { gte: thisMonthStart },
          status: { in: ['CONFIRMED', 'SETTLED'] },
        },
        _sum: { saleAmount: true },
        _count: { id: true },
      });

      // 4. 수수료 통계 (CommissionLedger는 status 필드가 없으므로 amount 합계 사용)
      const thisMonthCommission = await prisma.commissionLedger.aggregate({
        where: {
          profileId: profile.id,
          createdAt: { gte: thisMonthStart },
        },
        _sum: { amount: true },
      });

      const totalCommission = await prisma.commissionLedger.aggregate({
        where: {
          profileId: profile.id,
        },
        _sum: { amount: true },
      });

      // 5. 고객 통계
      const totalCustomers = await prisma.affiliateLead.count({
        where: { managerId: profile.id },
      });

      const customersByStatus = await prisma.affiliateLead.groupBy({
        by: ['status'],
        where: { managerId: profile.id },
        _count: { id: true },
      });

      // 6. 팀원별 실적
      const agentPerformance = await Promise.all(
        teamRelations.map(async (rel) => {
          const agent = rel.AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile;
          const sales = await prisma.affiliateSale.aggregate({
            where: {
              agentId: agent?.id,
              createdAt: { gte: thisMonthStart },
              status: { in: ['CONFIRMED', 'SETTLED'] },
            },
            _sum: { saleAmount: true },
            _count: { id: true },
          });

          return {
            agentId: agent?.id,
            agentUserId: agent?.userId,
            salesCount: sales._count.id,
            salesAmount: sales._sum.saleAmount || 0,
          };
        })
      );

      stats.team = {
        agents: {
          total: totalAgents,
          active: activeAgents,
        },
        sales: {
          thisMonth: {
            total: {
              count: thisMonthTeamSales._count.id,
              amount: thisMonthTeamSales._sum.saleAmount || 0,
            },
            personal: {
              count: thisMonthPersonalSales._count.id,
              amount: thisMonthPersonalSales._sum.saleAmount || 0,
            },
          },
          lastMonth: {
            count: lastMonthTeamSales._count.id,
            amount: lastMonthTeamSales._sum.saleAmount || 0,
          },
        },
        performance: agentPerformance,
      };

      stats.commission = {
        thisMonth: thisMonthCommission._sum.amount || 0,
        total: totalCommission._sum.amount || 0,
      };

      stats.customers = {
        total: totalCustomers,
        byStatus: Object.fromEntries(
          customersByStatus.map(stat => [stat.status, stat._count.id])
        ),
      };

      // 링크 수 조회
      const totalLinks = await prisma.affiliateLink.count({
        where: { managerId: profile.id },
      });

      // 최근 리드 조회
      const recentLeads = await prisma.affiliateLead.findMany({
        where: { managerId: profile.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          customerName: true,
          customerPhone: true,
          status: true,
          createdAt: true,
        },
      });

      // 최근 판매 조회
      const recentSalesData = await prisma.affiliateSale.findMany({
        where: { managerId: profile.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          saleAmount: true,
          status: true,
          saleDate: true,
          createdAt: true,
        },
      });

      // 컴포넌트 호환용 flat 필드 설정
      stats.totalLinks = totalLinks;
      stats.totalLeads = totalCustomers;
      stats.totalSales = thisMonthTeamSales._count.id || 0;
      stats.teamMembers = totalAgents;
      stats.recentLeads = recentLeads.map(l => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
      }));
      stats.recentSales = recentSalesData.map(s => ({
        ...s,
        saleDate: s.saleDate?.toISOString() || null,
        createdAt: s.createdAt.toISOString(),
      }));
    }
    // 판매원인 경우
    else {
      // 1. 개인 매출 통계
      const thisMonthSales = await prisma.affiliateSale.aggregate({
        where: {
          agentId: profile.id,
          createdAt: { gte: thisMonthStart },
          status: { in: ['CONFIRMED', 'SETTLED'] },
        },
        _sum: { saleAmount: true },
        _count: { id: true },
      });

      const lastMonthSales = await prisma.affiliateSale.aggregate({
        where: {
          agentId: profile.id,
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
          status: { in: ['CONFIRMED', 'SETTLED'] },
        },
        _sum: { saleAmount: true },
        _count: { id: true },
      });

      const totalSales = await prisma.affiliateSale.aggregate({
        where: {
          agentId: profile.id,
          status: { in: ['CONFIRMED', 'SETTLED'] },
        },
        _sum: { saleAmount: true },
        _count: { id: true },
      });

      // 2. 수수료 통계 (CommissionLedger는 status 필드가 없으므로 amount 합계 사용)
      const thisMonthCommission = await prisma.commissionLedger.aggregate({
        where: {
          profileId: profile.id,
          createdAt: { gte: thisMonthStart },
        },
        _sum: { amount: true },
      });

      const totalCommission = await prisma.commissionLedger.aggregate({
        where: {
          profileId: profile.id,
        },
        _sum: { amount: true },
      });

      // 3. 고객 통계
      const totalCustomers = await prisma.affiliateLead.count({
        where: { agentId: profile.id },
      });

      const customersByStatus = await prisma.affiliateLead.groupBy({
        by: ['status'],
        where: { agentId: profile.id },
        _count: { id: true },
      });

      // 4. 매니저 정보
      const managerRelation = await prisma.affiliateRelation.findFirst({
        where: {
          agentId: profile.id,
          status: 'ACTIVE',
        },
        include: {
          AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile: {
            include: {
              User: { select: { id: true, name: true } },
            },
          },
        },
      });

      stats.sales = {
        thisMonth: {
          count: thisMonthSales._count.id,
          amount: thisMonthSales._sum.saleAmount || 0,
        },
        lastMonth: {
          count: lastMonthSales._count.id,
          amount: lastMonthSales._sum.saleAmount || 0,
        },
        total: {
          count: totalSales._count.id,
          amount: totalSales._sum.saleAmount || 0,
        },
      };

      stats.commission = {
        thisMonth: thisMonthCommission._sum.amount || 0,
        total: totalCommission._sum.amount || 0,
      };

      stats.customers = {
        total: totalCustomers,
        byStatus: Object.fromEntries(
          customersByStatus.map(stat => [stat.status, stat._count.id])
        ),
      };

      stats.manager = managerRelation ? {
        userId: managerRelation.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile?.User?.id,
        name: managerRelation.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile?.User?.name,
      } : null;

      // 링크 수 조회
      const totalLinks = await prisma.affiliateLink.count({
        where: { agentId: profile.id },
      });

      // 최근 리드 조회
      const recentLeads = await prisma.affiliateLead.findMany({
        where: { agentId: profile.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          customerName: true,
          customerPhone: true,
          status: true,
          createdAt: true,
        },
      });

      // 최근 판매 조회
      const recentSalesData = await prisma.affiliateSale.findMany({
        where: { agentId: profile.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          saleAmount: true,
          status: true,
          saleDate: true,
          createdAt: true,
        },
      });

      // 컴포넌트 호환용 flat 필드 설정
      stats.totalLinks = totalLinks;
      stats.totalLeads = totalCustomers;
      stats.totalSales = totalSales._count.id || 0;
      stats.teamMembers = 0; // 판매원은 팀원이 없음
      stats.recentLeads = recentLeads.map(l => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
      }));
      stats.recentSales = recentSalesData.map(s => ({
        ...s,
        saleDate: s.saleDate?.toISOString() || null,
        createdAt: s.createdAt.toISOString(),
      }));
    }

    // 공통: 지난 6개월 매출 추세
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    let monthlySales: any[] = [];

    try {
      let rawSales: any[] = [];
      if (profile.type === 'BRANCH_MANAGER') {
        rawSales = await prisma.$queryRaw`
          SELECT
            TO_CHAR("createdAt", 'YYYY-MM') as month,
            COUNT(*)::int as count,
            COALESCE(SUM("saleAmount"), 0)::numeric as total
          FROM "AffiliateSale"
          WHERE "managerId" = ${profile.id}
            AND "createdAt" >= ${sixMonthsAgo}
            AND status IN ('CONFIRMED', 'SETTLED')
          GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
          ORDER BY month ASC
        `;
      } else {
        rawSales = await prisma.$queryRaw`
          SELECT
            TO_CHAR("createdAt", 'YYYY-MM') as month,
            COUNT(*)::int as count,
            COALESCE(SUM("saleAmount"), 0)::numeric as total
          FROM "AffiliateSale"
          WHERE "agentId" = ${profile.id}
            AND "createdAt" >= ${sixMonthsAgo}
            AND status IN ('CONFIRMED', 'SETTLED')
          GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
          ORDER BY month ASC
        `;
      }
      // BigInt를 Number로 변환
      monthlySales = rawSales.map(row => ({
        month: row.month,
        count: Number(row.count),
        total: Number(row.total),
      }));
    } catch (sqlError) {
      console.error('[Partner Dashboard Stats] SQL Error:', sqlError);
      // SQL 에러 시 빈 배열로 처리 (API 자체는 동작하도록)
      monthlySales = [];
    }

    stats.salesTrend = monthlySales;
    stats.monthlySales = monthlySales; // 컴포넌트 호환용

    return NextResponse.json({
      ok: true,
      stats,
    });
  } catch (error: any) {
    console.error('[Partner Dashboard Stats] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
