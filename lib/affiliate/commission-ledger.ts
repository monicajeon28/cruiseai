import type { Prisma, PrismaClient } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  DEFAULT_WITHHOLDING_RATE,
  DEFAULT_CURRENCY,
  generateLedgerEntries,
} from './commission';

export interface SyncLedgerOptions {
  regenerate?: boolean;
  includeHq?: boolean;
}

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

export async function syncSaleCommissionLedgers(
  saleId: number,
  options: SyncLedgerOptions = {},
  client: PrismaClientOrTx = prisma,
) {
  if (!saleId || Number.isNaN(saleId)) {
    throw new Error('syncSaleCommissionLedgers requires a valid saleId');
  }

  const sale = await client.affiliateSale.findUnique({
    where: { id: saleId },
    include: {
      AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile: {
        select: {
          id: true,
          withholdingRate: true,
          displayName: true,
          affiliateCode: true,
        },
      },
      AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile: {
        select: {
          id: true,
          withholdingRate: true,
          displayName: true,
          affiliateCode: true,
        },
      },
      AffiliateProduct: {
        select: {
          id: true,
          productCode: true,
          title: true,
          currency: true,
        },
      },
    },
  });

  if (!sale) {
    throw new Error(`Sale #${saleId} not found`);
  }

  const managerWithholding = sale.AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile?.withholdingRate ?? DEFAULT_WITHHOLDING_RATE;
  const agentWithholding = sale.AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile?.withholdingRate ?? DEFAULT_WITHHOLDING_RATE;
  // AffiliateSale에 currency 필드가 없으므로 AffiliateProduct에서 가져오거나 기본값 사용
  const currency = sale.AffiliateProduct?.currency ?? DEFAULT_CURRENCY;

  const metadata: Prisma.JsonValue = {
    source: 'auto-generated',
    saleId: sale.id,
    saleStatus: sale.status,
    managerId: sale.managerId ?? null,
    agentId: sale.agentId ?? null,
    saleDate: sale.saleDate?.toISOString() ?? null,
    productCode: sale.productCode ?? sale.AffiliateProduct?.productCode ?? null,
  };

  const { breakdown, ledgerEntries } = generateLedgerEntries({
    saleId: sale.id,
    saleAmount: sale.saleAmount,
    costAmount: sale.costAmount,
    branchCommission: sale.branchCommission,
    salesCommission: sale.salesCommission,
    overrideCommission: sale.overrideCommission,
    managerProfileId: sale.managerId ?? undefined,
    agentProfileId: sale.agentId ?? undefined,
    overrideProfileId: sale.managerId ?? undefined,
    withholdingRate: agentWithholding,
    managerWithholdingRate: managerWithholding,
    currency,
    includeHqNet: options.includeHq ?? true,
    metadata,
  });

  if (options.regenerate) {
    await client.commissionLedger.deleteMany({ where: { saleId: sale.id } });
  }

  if (ledgerEntries.length > 0) {
    await client.commissionLedger.createMany({ data: ledgerEntries, skipDuplicates: true });
  }

  await client.affiliateSale.update({
    where: { id: sale.id },
    data: {
      netRevenue: breakdown.netRevenue,
      branchCommission: breakdown.branchCommission,
      salesCommission: breakdown.salesCommission,
      overrideCommission: breakdown.overrideCommission,
      // currency 필드는 AffiliateSale 모델에 없으므로 제거
    },
  });

  return {
    saleId: sale.id,
    breakdown,
    entriesCreated: ledgerEntries.length,
  };
}
