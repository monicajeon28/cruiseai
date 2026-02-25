export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';

const WITHHOLDING_RATE = 3.3;

// 커미션 원장 엔트리 타입
type LedgerEntry = {
  id: number;
  profileId: number;
  entryType: string;
  amount: number;
  withholdingAmount: number | null;
  createdAt: Date;
  AffiliateSale: {
    id: number;
    productCode: string | null;
    saleAmount: number | null;
    saleDate: Date | null;
    cabinType: string | null;
    headcount: number | null;
    AffiliateLead: {
      customerName: string | null;
    } | null;
  } | null;
};

// 팀원 프로필 타입
type AgentProfile = {
  id: number;
  affiliateCode: string | null;
  displayName: string | null;
  nickname: string | null;
  type: string;
  bankName: string | null;
  bankAccount: string | null;
  bankAccountHolder: string | null;
  withholdingRate: number | null;
};

/**
 * 커미션 원장 엔트리를 명세서 상세 항목으로 변환
 */
function processLedgerEntries(
  entries: LedgerEntry[],
  withholdingRate: number
) {
  let salesCommission = 0;
  let branchCommission = 0;
  let overrideCommission = 0;
  let totalGrossAmount = 0;
  let totalWithholdingAmount = 0;
  let salesCount = 0;
  let totalSaleAmount = 0;

  const details = entries.map((entry) => {
    const amount = entry.amount;
    const withholding = entry.withholdingAmount ?? Math.round(amount * withholdingRate / 100);
    const netAmount = amount - withholding;

    totalGrossAmount += amount;
    totalWithholdingAmount += withholding;

    if (entry.AffiliateSale?.saleAmount) {
      totalSaleAmount += entry.AffiliateSale.saleAmount;
      salesCount++;
    }

    switch (entry.entryType) {
      case 'SALES_COMMISSION':
        salesCommission += amount;
        break;
      case 'BRANCH_COMMISSION':
        branchCommission += amount;
        break;
      case 'OVERRIDE_COMMISSION':
        overrideCommission += amount;
        break;
    }

    return {
      entryId: entry.id,
      saleId: entry.AffiliateSale?.id ?? null,
      productCode: entry.AffiliateSale?.productCode ?? null,
      saleAmount: entry.AffiliateSale?.saleAmount ?? null,
      saleDate: entry.AffiliateSale?.saleDate?.toISOString() ?? null,
      cabinType: entry.AffiliateSale?.cabinType ?? null,
      headcount: entry.AffiliateSale?.headcount ?? null,
      customerName: entry.AffiliateSale?.AffiliateLead?.customerName ?? null,
      entryType: entry.entryType,
      amount,
      withholdingAmount: withholding,
      netAmount,
    };
  });

  return {
    salesCount,
    totalSaleAmount,
    salesCommission,
    branchCommission,
    overrideCommission,
    grossAmount: totalGrossAmount,
    withholdingAmount: totalWithholdingAmount,
    netAmount: totalGrossAmount - totalWithholdingAmount,
    entryCount: entries.length,
    details,
  };
}

/**
 * GET /api/partner/team-statements
 * 대리점장이 자신의 팀원(판매원)들의 정산 명세서를 조회
 *
 * Query params:
 *   - settlementId: 정산 ID (필수)
 *   - page: 페이지 번호 (선택, 기본값: 1)
 *   - pageSize: 페이지당 팀원 수 (선택, 기본값: 50)
 *
 * 최적화: N+1 쿼리 문제 해결 - 단일 쿼리 + 메모리 그룹핑
 */
export async function GET(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext({ includeManagedAgents: true });

    // 대리점장만 접근 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json(
        { ok: false, message: '대리점장만 팀원 정산 내역을 조회할 수 있습니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const settlementIdParam = searchParams.get('settlementId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));

    if (!settlementIdParam) {
      return NextResponse.json(
        { ok: false, message: 'settlementId가 필요합니다.' },
        { status: 400 }
      );
    }

    const settlementId = parseInt(settlementIdParam, 10);
    if (isNaN(settlementId)) {
      return NextResponse.json(
        { ok: false, message: '잘못된 정산 ID입니다.' },
        { status: 400 }
      );
    }

    // 정산 정보 조회
    const settlement = await prisma.monthlySettlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      return NextResponse.json(
        { ok: false, message: '정산 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 총 팀원 수 조회 (페이지네이션용)
    const totalCount = await prisma.affiliateRelation.count({
      where: {
        managerId: profile.id,
        status: 'ACTIVE',
      },
    });

    if (totalCount === 0) {
      return NextResponse.json({
        ok: true,
        settlement: {
          id: settlement.id,
          periodStart: settlement.periodStart.toISOString(),
          periodEnd: settlement.periodEnd.toISOString(),
          status: settlement.status,
          paymentDate: settlement.paymentDate?.toISOString() || null,
        },
        statements: [],
        pagination: {
          page: 1,
          pageSize,
          totalCount: 0,
          totalPages: 0,
        },
        message: '관리 중인 팀원이 없습니다.',
      });
    }

    // 대리점장이 관리하는 판매원들 조회 (페이지네이션 적용)
    const managedRelations = await prisma.affiliateRelation.findMany({
      where: {
        managerId: profile.id,
        status: 'ACTIVE',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile: {
          select: {
            id: true,
            affiliateCode: true,
            displayName: true,
            nickname: true,
            type: true,
            bankName: true,
            bankAccount: true,
            bankAccountHolder: true,
            withholdingRate: true,
          },
        },
      },
    });

    // 팀원 ID 배열 수집
    const agentIds = managedRelations.map(
      (r) => r.AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile.id
    );

    // 팀원 프로필 맵 생성 (빠른 조회용)
    const agentMap = new Map<number, AgentProfile>();
    for (const relation of managedRelations) {
      const agent = relation.AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile;
      agentMap.set(agent.id, agent);
    }

    // ============================================
    // 최적화: 단일 쿼리로 모든 팀원의 커미션 원장 조회
    // ============================================

    // 1차: settlementId로 조회 (IN 절 사용)
    const ledgerEntriesBySettlement = await prisma.commissionLedger.findMany({
      where: {
        profileId: { in: agentIds },
        settlementId: settlementId,
      },
      include: {
        AffiliateSale: {
          select: {
            id: true,
            productCode: true,
            saleAmount: true,
            saleDate: true,
            cabinType: true,
            headcount: true,
            AffiliateLead: {
              select: {
                customerName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // profileId별로 그룹핑
    const ledgerByProfile = new Map<number, LedgerEntry[]>();
    for (const entry of ledgerEntriesBySettlement) {
      const existing = ledgerByProfile.get(entry.profileId) || [];
      existing.push(entry as LedgerEntry);
      ledgerByProfile.set(entry.profileId, existing);
    }

    // settlementId로 조회된 결과가 없는 팀원들만 추출
    const agentsWithoutSettlementEntries = agentIds.filter(
      (id) => !ledgerByProfile.has(id) || ledgerByProfile.get(id)!.length === 0
    );

    // 2차: 정산 기간 내 createdAt으로 조회 (settlementId가 없는 경우)
    if (agentsWithoutSettlementEntries.length > 0) {
      const ledgerEntriesByPeriod = await prisma.commissionLedger.findMany({
        where: {
          profileId: { in: agentsWithoutSettlementEntries },
          createdAt: {
            gte: settlement.periodStart,
            lte: settlement.periodEnd,
          },
        },
        include: {
          AffiliateSale: {
            select: {
              id: true,
              productCode: true,
              saleAmount: true,
              saleDate: true,
              cabinType: true,
              headcount: true,
              AffiliateLead: {
                select: {
                  customerName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // 추가 그룹핑
      for (const entry of ledgerEntriesByPeriod) {
        const existing = ledgerByProfile.get(entry.profileId) || [];
        existing.push(entry as LedgerEntry);
        ledgerByProfile.set(entry.profileId, existing);
      }
    }

    // ============================================
    // 메모리에서 명세서 생성 (DB 쿼리 없음)
    // ============================================
    const statements = agentIds.map((agentId) => {
      const agent = agentMap.get(agentId)!;
      const ledgerEntries = ledgerByProfile.get(agentId) || [];
      const withholdingRate = agent.withholdingRate ?? WITHHOLDING_RATE;

      const processed = processLedgerEntries(ledgerEntries, withholdingRate);

      return {
        profileId: agent.id,
        affiliateCode: agent.affiliateCode,
        displayName: agent.displayName || agent.nickname,
        type: agent.type,
        periodStart: settlement.periodStart.toISOString(),
        periodEnd: settlement.periodEnd.toISOString(),
        ...processed,
        withholdingRate,
        bankName: agent.bankName,
        bankAccount: agent.bankAccount,
        bankAccountHolder: agent.bankAccountHolder,
        confirmed: false,
        confirmedAt: null,
      };
    });

    return NextResponse.json({
      ok: true,
      settlement: {
        id: settlement.id,
        periodStart: settlement.periodStart.toISOString(),
        periodEnd: settlement.periodEnd.toISOString(),
        status: settlement.status,
        paymentDate: settlement.paymentDate?.toISOString() || null,
      },
      statements,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (error: any) {
    console.error('[Team Statements API] GET error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: '팀원 정산 내역을 불러오지 못했습니다.',
        error: error?.message || String(error),
      },
      { status: error.status || 500 }
    );
  }
}
