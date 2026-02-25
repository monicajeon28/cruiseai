// app/api/partner/sales/route.ts
// 파트너 판매 내역 조회 API

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '../_utils';
import prisma from '@/lib/prisma';

/**
 * GET: 파트너의 판매 내역 조회
 */
export async function GET(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext({ includeManagedAgents: true });

    // 관리하는 에이전트 ID 목록
    const managedAgentIds = profile.managedAgents?.map((a) => a.id) || [];

    // 판매 내역 조회 (본인 + 관리하는 에이전트)
    const sales = await prisma.affiliateSale.findMany({
      where: {
        OR: [
          { managerId: profile.id },
          { agentId: profile.id },
          ...(managedAgentIds.length > 0
            ? [{ agentId: { in: managedAgentIds } }]
            : []),
        ],
      },
      orderBy: { saleDate: 'desc' },
      take: 100,
      select: {
        id: true,
        externalOrderCode: true,
        productCode: true,
        cabinType: true,
        fareCategory: true,
        headcount: true,
        saleAmount: true,
        costAmount: true,
        netRevenue: true,
        branchCommission: true,
        salesCommission: true,
        overrideCommission: true,
        withholdingAmount: true,
        status: true,
        saleDate: true,
        confirmedAt: true,
        metadata: true,
        AffiliateProduct: {
          select: {
            id: true,
            productCode: true,
            title: true,
            CruiseProduct: {
              select: {
                packageName: true,
                cruiseLine: true,
                shipName: true,
              },
            },
          },
        },
        AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            branchLabel: true,
          },
        },
        AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            User: {
              select: {
                mallUserId: true,
                name: true,
              },
            },
          },
        },
        AffiliateLead: {
          select: {
            id: true,
            customerName: true,
            customerPhone: true,
          },
        },
      },
    });

    // 수당 통계 계산
    const stats = {
      totalSales: sales.length,
      totalSaleAmount: sales.reduce((sum, s) => sum + (s.saleAmount || 0), 0),
      totalBranchCommission: sales.reduce((sum, s) => sum + (s.branchCommission || 0), 0),
      totalSalesCommission: sales.reduce((sum, s) => sum + (s.salesCommission || 0), 0),
      totalOverrideCommission: sales.reduce((sum, s) => sum + (s.overrideCommission || 0), 0),
      totalWithholding: sales.reduce((sum, s) => sum + (s.withholdingAmount || 0), 0),
      myCommission: 0,
    };

    // 내 역할 계산
    const myCommission = sales.reduce((sum, sale) => {
      if (profile.type === 'BRANCH_MANAGER') {
        // 대리점장: branchCommission + (내가 직접 판매한 경우 salesCommission)
        return (
          sum +
          (sale.managerId === profile.id ? sale.branchCommission || 0 : 0) +
          (sale.agentId === profile.id ? sale.salesCommission || 0 : 0)
        );
      } else if (profile.type === 'SALES_AGENT') {
        // 판매원: salesCommission만
        return sum + (sale.agentId === profile.id ? sale.salesCommission || 0 : 0);
      }
      return sum;
    }, 0);

    stats.myCommission = myCommission;

    return NextResponse.json({
      ok: true,
      sales,
      stats,
      profileType: profile.type,
      profileId: profile.id,
    });
  } catch (error: any) {
    console.error('[Partner Sales API] Error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || '판매 내역을 불러올 수 없습니다.' },
      { status: error.status || 500 }
    );
  }
}
