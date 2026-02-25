export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { PartnerApiError, requirePartnerContext } from '@/app/api/partner/_utils';

const CONFIRMED_SALE_STATUS = ['CONFIRMED', 'PAID', 'PAYOUT_SCHEDULED'] as const;
const LEAD_ACTIVE_STATUS = ['NEW', 'CONTACTED', 'IN_PROGRESS'] as const;
const COMMISSION_ENTRY_TYPES = ['SALES_COMMISSION', 'OVERRIDE_COMMISSION', 'WITHHOLDING'] as const;

export async function GET(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext({ includeManagedAgents: true });
    const isBranchManager = profile.type === 'BRANCH_MANAGER';
    const isSalesAgent = profile.type === 'SALES_AGENT';

    const managerProfileId = isSalesAgent
      ? profile.agentRelations?.[0]?.managerId ?? null
      : profile.id;

    const agentProfileIds: number[] = [];

    if (isBranchManager) {
      profile.managedRelations?.forEach((relation) => {
        if (relation.agent?.id) {
          agentProfileIds.push(relation.agent.id);
        }
      });
    } else if (isSalesAgent) {
      agentProfileIds.push(profile.id);
    }

    const baseProfiles = agentProfileIds.length
      ? await prisma.affiliateProfile.findMany({
        where: { id: { in: agentProfileIds } },
        select: {
          id: true,
          userId: true,
          affiliateCode: true,
          type: true,
          status: true,
          displayName: true,
          branchLabel: true,
          nickname: true,
          createdAt: true,
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              mallUserId: true,
              mallNickname: true,
              password: true, // 비밀번호 추가
            },
          },
        },
      })
      : [];

    let leadsGroup: Array<any> = [];
    if (agentProfileIds.length) {
      leadsGroup = await prisma.affiliateLead.groupBy({
        by: ['agentId', 'status'],
        where: {
          agentId: { in: agentProfileIds },
        },
        _count: { _all: true },
      });
    }

    let salesGroup: Array<any> = [];
    if (agentProfileIds.length) {
      salesGroup = await prisma.affiliateSale.groupBy({
        by: ['agentId', 'status'],
        where: {
          agentId: { in: agentProfileIds },
        },
        _count: { _all: true },
        _sum: {
          saleAmount: true,
          netRevenue: true,
        },
        _max: {
          saleDate: true,
        },
      });
    }

    let ledgerGroup: Array<any> = [];
    if (agentProfileIds.length) {
      ledgerGroup = await prisma.commissionLedger.groupBy({
        by: ['profileId', 'entryType', 'isSettled'],
        where: {
          profileId: { in: agentProfileIds },
          entryType: { in: COMMISSION_ENTRY_TYPES },
        },
        _sum: { amount: true, withholdingAmount: true },
      });
    }

    const leadsByAgent = leadsGroup.reduce<Record<number, Record<string, number>>>((acc, row) => {
      if (row.agentId === null) return acc;
      if (!acc[row.agentId]) acc[row.agentId] = {};
      acc[row.agentId][row.status] = row._count._all;
      return acc;
    }, {});

    const salesByAgent = salesGroup.reduce<Record<number, (typeof salesGroup)[number][]>>((acc, row) => {
      if (row.agentId === null) return acc;
      if (!acc[row.agentId]) acc[row.agentId] = [];
      acc[row.agentId].push(row);
      return acc;
    }, {});

    const ledgerByAgent = ledgerGroup.reduce<Record<number, (typeof ledgerGroup)[number][]>>((acc, row) => {
      if (row.profileId === null) return acc;
      if (!acc[row.profileId]) acc[row.profileId] = [];
      acc[row.profileId].push(row);
      return acc;
    }, {});

    const agents = baseProfiles.map((base) => {
      const leads = leadsByAgent[base.id] || {};
      const sales = salesByAgent[base.id] || [];
      const ledgers = ledgerByAgent[base.id] || [];

      const leadsTotal = Object.values(leads).reduce((sum, count) => sum + count, 0);
      const leadsActive = LEAD_ACTIVE_STATUS.reduce((sum, status) => sum + (leads[status] ?? 0), 0);

      let salesCount = 0;
      let totalSalesAmount = 0;
      let confirmedSalesAmount = 0;
      let netRevenue = 0;
      let lastSaleAt: Date | null = null;

      sales.forEach((row) => {
        const count = row._count?._all ?? 0;
        const amount = row._sum?.saleAmount ?? 0;
        const net = row._sum?.netRevenue ?? 0;
        salesCount += count;
        totalSalesAmount += amount ?? 0;
        netRevenue += net ?? 0;
        if (CONFIRMED_SALE_STATUS.includes(row.status as (typeof CONFIRMED_SALE_STATUS)[number])) {
          confirmedSalesAmount += amount ?? 0;
        }
        if (row._max?.saleDate) {
          const saleDate = row._max.saleDate;
          if (!lastSaleAt || saleDate > lastSaleAt) {
            lastSaleAt = saleDate;
          }
        }
      });

      let pendingCommission = 0;
      let settledCommission = 0;
      let overrideCommission = 0;
      let withholding = 0;

      ledgers.forEach((row) => {
        const amount = row._sum.amount ?? 0;
        const withholdingAmount = row._sum.withholdingAmount ?? 0;
        if (row.entryType === 'SALES_COMMISSION') {
          if (row.isSettled) settledCommission += amount;
          else pendingCommission += amount;
        }
        if (row.entryType === 'OVERRIDE_COMMISSION') {
          overrideCommission += amount;
        }
        if (row.entryType === 'WITHHOLDING') {
          withholding += amount;
        }
        if (!row.isSettled) {
          pendingCommission += amount;
        }
      });

      return {
        profileId: base.id,
        affiliateCode: base.affiliateCode,
        type: base.type,
        status: base.status,
        displayName: base.displayName ?? base.nickname ?? base.User?.mallNickname ?? null,
        branchLabel: base.branchLabel ?? null,
        joinedAt: base.createdAt?.toISOString() ?? null,
        user: {
          id: base.User?.id ?? null,
          name: base.User?.name ?? null,
          email: base.User?.email ?? null,
          phone: base.User?.phone ?? null,
          mallUserId: base.User?.mallUserId ?? null,
          mallNickname: base.User?.mallNickname ?? null,
          password: base.User?.password ?? null, // 비밀번호 추가
        },
        metrics: {
          leadsTotal,
          leadsActive,
          salesCount,
          totalSalesAmount,
          confirmedSalesAmount,
          netRevenue,
          pendingCommission,
          settledCommission,
          overrideCommission,
          withholding,
          lastSaleAt: lastSaleAt ? lastSaleAt.toISOString() : null,
        },
      };
    });

    const summary = agents.reduce(
      (acc, agent) => {
        acc.agentCount += 1;
        acc.leadsTotal += agent.metrics.leadsTotal;
        acc.salesCount += agent.metrics.salesCount;
        acc.salesAmount += agent.metrics.totalSalesAmount;
        acc.confirmedSalesAmount += agent.metrics.confirmedSalesAmount;
        acc.pendingCommission += agent.metrics.pendingCommission;
        acc.settledCommission += agent.metrics.settledCommission;
        acc.overrideCommission += agent.metrics.overrideCommission;
        return acc;
      },
      {
        agentCount: 0,
        leadsTotal: 0,
        salesCount: 0,
        salesAmount: 0,
        confirmedSalesAmount: 0,
        pendingCommission: 0,
        settledCommission: 0,
        overrideCommission: 0,
      },
    );

    return NextResponse.json({
      ok: true,
      role: profile.type,
      managerProfileId,
      agents,
      summary,
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error('GET /api/partner/agents error:', error);
    return NextResponse.json({ ok: false, message: '판매원 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
