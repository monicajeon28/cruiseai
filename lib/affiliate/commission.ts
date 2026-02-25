import type { Prisma } from '@prisma/client';

export type CommissionEntryType = 'HQ_NET' | 'BRANCH_COMMISSION' | 'SALES_COMMISSION' | 'OVERRIDE_COMMISSION' | 'WITHHOLDING' | string;

export const DEFAULT_CURRENCY = 'KRW';
export const DEFAULT_WITHHOLDING_RATE = 3.3;

export interface CommissionTierSnapshot {
  cabinType?: string | null;
  saleAmount?: number | null;
  costAmount?: number | null;
  hqShareAmount?: number | null;
  branchShareAmount?: number | null;
  salesShareAmount?: number | null;
  overrideAmount?: number | null;
  currency?: string | null;
  metadata?: Prisma.JsonValue;
}

export interface CommissionCalculationInput {
  saleAmount: number;
  costAmount?: number | null;
  branchCommission?: number | null;
  salesCommission?: number | null;
  overrideCommission?: number | null;
  withholdingRate?: number | null;
  managerWithholdingRate?: number | null;
  includeHqNet?: boolean;
  tier?: CommissionTierSnapshot | null;
  currency?: string | null;
}

export interface CommissionBreakdown {
  saleAmount: number;
  costAmount: number;
  netRevenue: number;
  hqNet: number;
  branchCommission: number;
  salesCommission: number;
  overrideCommission: number;
  withholdingAmount: number;
  branchWithholding: number;
  overrideWithholding: number;
  totalWithholding: number;
  currency: string;
}

export interface LedgerGenerationOptions extends CommissionCalculationInput {
  saleId: number;
  managerProfileId?: number | null;
  agentProfileId?: number | null;
  overrideProfileId?: number | null;
  currency?: string;
  extraAdjustments?: Array<{
    entryType: CommissionEntryType;
    amount: number;
    profileId?: number | null;
    withholdingAmount?: number | null;
    notes?: string | null;
    metadata?: Prisma.JsonValue;
  }>;
  metadata?: Prisma.JsonValue;
}

export interface LedgerGenerationResult {
  breakdown: CommissionBreakdown;
  ledgerEntries: Prisma.CommissionLedgerCreateManyInput[];
}

const roundAmount = (value: number) => Math.round(value);

function resolveCurrency(input?: string | null, tier?: CommissionTierSnapshot | null) {
  return tier?.currency ?? input ?? DEFAULT_CURRENCY;
}

function resolveWithholdingRate(rate?: number | null) {
  if (rate == null || Number.isNaN(rate)) {
    return DEFAULT_WITHHOLDING_RATE;
  }
  return rate;
}

function coerceAmount(value?: number | null) {
  if (value == null || Number.isNaN(value)) {
    return 0;
  }
  return value;
}

export function calculateCommissionBreakdown(input: CommissionCalculationInput): CommissionBreakdown {
  const tier = input.tier ?? undefined;
  const saleAmount = roundAmount(coerceAmount(input.saleAmount ?? tier?.saleAmount ?? 0));
  const costAmount = roundAmount(coerceAmount(input.costAmount ?? tier?.costAmount ?? 0));
  const netRevenue = roundAmount(saleAmount - costAmount);

  const branchCommission = roundAmount(
    coerceAmount(input.branchCommission ?? tier?.branchShareAmount ?? 0),
  );
  const salesCommission = roundAmount(
    coerceAmount(input.salesCommission ?? tier?.salesShareAmount ?? 0),
  );
  const overrideCommission = roundAmount(
    coerceAmount(input.overrideCommission ?? tier?.overrideAmount ?? 0),
  );

  // 🔴 CRITICAL VALIDATION: Total commissions must not exceed net revenue
  const totalCommissions = branchCommission + salesCommission + overrideCommission;
  if (totalCommissions > netRevenue) {
    const error = new Error(
      `Commission configuration error: Total commissions (${totalCommissions.toLocaleString()}) exceed net revenue (${netRevenue.toLocaleString()}). ` +
      `Breakdown: Branch=${branchCommission.toLocaleString()}, Sales=${salesCommission.toLocaleString()}, Override=${overrideCommission.toLocaleString()}`
    );
    console.error('[Commission Validation Failed]', {
      saleAmount,
      costAmount,
      netRevenue,
      branchCommission,
      salesCommission,
      overrideCommission,
      totalCommissions,
      excess: totalCommissions - netRevenue,
    });
    throw error;
  }

  const includeHq = input.includeHqNet ?? true;
  const hqNetCandidate = includeHq
    ? roundAmount(coerceAmount(tier?.hqShareAmount ?? netRevenue - branchCommission - salesCommission - overrideCommission))
    : 0;
  const hqNet = Math.max(hqNetCandidate, 0);

  // 🟡 WARNING: If hqNet was clamped to 0, log a warning (shouldn't happen after validation above)
  if (includeHq && hqNetCandidate < 0) {
    console.warn('[Commission Warning] HQ net was negative and clamped to 0. This should not happen after validation.', {
      hqNetCandidate,
      netRevenue,
      totalCommissions,
    });
  }

  const withholdingRate = resolveWithholdingRate(input.withholdingRate);
  const managerWithholdingRate = resolveWithholdingRate(
    input.managerWithholdingRate != null ? input.managerWithholdingRate : input.withholdingRate,
  );
  const withholdingAmount = roundAmount((salesCommission * withholdingRate) / 100);
  const branchWithholding = branchCommission > 0 ? roundAmount((branchCommission * managerWithholdingRate) / 100) : 0;
  const overrideWithholding = overrideCommission > 0 ? roundAmount((overrideCommission * managerWithholdingRate) / 100) : 0;
  const totalWithholding = withholdingAmount + branchWithholding + overrideWithholding;
  const currency = resolveCurrency(input.currency ?? undefined, tier);

  return {
    saleAmount,
    costAmount,
    netRevenue,
    hqNet,
    branchCommission,
    salesCommission,
    overrideCommission,
    withholdingAmount,
    branchWithholding,
    overrideWithholding,
    totalWithholding,
    currency,
  };
}

export function generateLedgerEntries(options: LedgerGenerationOptions): LedgerGenerationResult {
  if (!options.saleId) {
    throw new Error('generateLedgerEntries requires a saleId');
  }

  const breakdown = calculateCommissionBreakdown(options);
  const currency = options.currency ?? breakdown.currency;
  const notesMetadata = options.metadata ?? undefined;
  const createMetadataNote = (note: string): Prisma.JsonValue | undefined => {
    if (!notesMetadata) {
      return { note };
    }
    if (typeof notesMetadata === 'object' && notesMetadata !== null && !Array.isArray(notesMetadata)) {
      return { ...notesMetadata, note };
    }
    return { note, context: notesMetadata };
  };

  const entries: Prisma.CommissionLedgerCreateManyInput[] = [];

  if ((options.includeHqNet ?? true) && breakdown.hqNet > 0) {
    entries.push({
      saleId: options.saleId,
      profileId: null,
      entryType: 'HQ_NET',
      amount: breakdown.hqNet,
      currency,
      withholdingAmount: 0,
      metadata: notesMetadata,
      isSettled: false,
      updatedAt: new Date(),
    });
  }

  if (breakdown.branchCommission > 0 && options.managerProfileId) {
    entries.push({
      saleId: options.saleId,
      profileId: options.managerProfileId,
      entryType: 'BRANCH_COMMISSION',
      amount: breakdown.branchCommission,
      currency,
      withholdingAmount: breakdown.branchWithholding,
      metadata: notesMetadata,
      isSettled: false,
      updatedAt: new Date(),
    });
  }

  if (breakdown.salesCommission > 0 && options.agentProfileId) {
    entries.push({
      saleId: options.saleId,
      profileId: options.agentProfileId,
      entryType: 'SALES_COMMISSION',
      amount: breakdown.salesCommission,
      currency,
      withholdingAmount: breakdown.withholdingAmount,
      metadata: notesMetadata,
      isSettled: false,
      updatedAt: new Date(),
    });
  }

  if (breakdown.overrideCommission > 0) {
    entries.push({
      saleId: options.saleId,
      profileId: options.overrideProfileId ?? options.managerProfileId ?? null,
      entryType: 'OVERRIDE_COMMISSION',
      amount: breakdown.overrideCommission,
      currency,
      withholdingAmount: breakdown.overrideWithholding,
      metadata: notesMetadata,
      isSettled: false,
      updatedAt: new Date(),
    });
  }

  // 🎯 Combine manager withholdings to avoid unique constraint violation
  const totalManagerWithholding = breakdown.branchWithholding + breakdown.overrideWithholding;
  if (totalManagerWithholding > 0 && options.managerProfileId) {
    const withholdingNote = [];
    if (breakdown.branchWithholding > 0) {
      withholdingNote.push(`브랜치: ${breakdown.branchWithholding.toLocaleString()}원`);
    }
    if (breakdown.overrideWithholding > 0) {
      withholdingNote.push(`오버라이드: ${breakdown.overrideWithholding.toLocaleString()}원`);
    }

    entries.push({
      saleId: options.saleId,
      profileId: options.managerProfileId,
      entryType: 'WITHHOLDING',
      amount: -totalManagerWithholding,
      currency,
      withholdingAmount: 0,
      metadata: createMetadataNote(`manager-withholding: ${withholdingNote.join(', ')}`),
      notes: `자동 원천징수 (대리점장: ${withholdingNote.join(', ')})`,
      isSettled: false,
      updatedAt: new Date(),
    });
  }

  options.extraAdjustments?.forEach((adjustment) => {
    if (!adjustment || adjustment.amount === 0) {
      return;
    }

    entries.push({
      saleId: options.saleId,
      profileId: adjustment.profileId ?? null,
      entryType: adjustment.entryType,
      amount: roundAmount(adjustment.amount),
      currency,
      withholdingAmount: adjustment.withholdingAmount ?? 0,
      metadata: adjustment.metadata ?? notesMetadata,
      notes: adjustment.notes ?? undefined,
      isSettled: false,
      updatedAt: new Date(),
    });
  });

  return { breakdown, ledgerEntries: entries };
}