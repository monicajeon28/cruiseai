// lib/affiliate/audit-log.ts
// 계약/수당 관련 감사 로그 기록 유틸리티

import type { Prisma, PrismaClient } from '@prisma/client';
import prisma from '@/lib/prisma';

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

export type AuditLogCategory = 'CONTRACT' | 'COMMISSION' | 'DB_RECOVERY' | 'RENEWAL' | 'TERMINATION';
export type AuditLogAction = 
  | 'CREATED' 
  | 'UPDATED' 
  | 'APPROVED' 
  | 'REJECTED' 
  | 'TERMINATED' 
  | 'RENEWED' 
  | 'RECOVERED' 
  | 'CALCULATED'
  | 'PROCESSED'
  | 'RETRY'
  | 'FAILED';

export interface AuditLogInput {
  category: AuditLogCategory;
  action: AuditLogAction;
  contractId?: number | null;
  saleId?: number | null;
  profileId?: number | null;
  userId?: number | null;
  performedById?: number | null;
  performedBySystem?: boolean;
  details?: Prisma.JsonValue;
  metadata?: Prisma.JsonValue;
}

/**
 * 감사 로그 기록
 */
export async function logAffiliateAudit(
  input: AuditLogInput,
  client: PrismaClientOrTx = prisma
): Promise<void> {
  try {
    await client.affiliateAuditLog.create({
      data: {
        category: input.category,
        action: input.action,
        contractId: input.contractId ?? null,
        saleId: input.saleId ?? null,
        profileId: input.profileId ?? null,
        userId: input.userId ?? null,
        performedById: input.performedById ?? null,
        performedBySystem: input.performedBySystem ?? false,
        details: input.details ?? null,
        metadata: input.metadata ?? null,
      },
    });
  } catch (error) {
    console.error('[AffiliateAuditLog] Failed to log audit:', error);
    // 감사 로그 실패해도 메인 작업은 계속 진행
  }
}

/**
 * 계약 관련 감사 로그
 */
export async function logContractAudit(
  action: AuditLogAction,
  contractId: number,
  options: {
    performedById?: number | null;
    performedBySystem?: boolean;
    details?: Prisma.JsonValue;
    metadata?: Prisma.JsonValue;
  } = {},
  client: PrismaClientOrTx = prisma
): Promise<void> {
  await logAffiliateAudit(
    {
      category: 'CONTRACT',
      action,
      contractId,
      performedById: options.performedById ?? null,
      performedBySystem: options.performedBySystem ?? false,
      details: options.details ?? null,
      metadata: options.metadata ?? null,
    },
    client
  );
}

/**
 * 수당 관련 감사 로그
 */
export async function logCommissionAudit(
  action: AuditLogAction,
  saleId: number,
  options: {
    profileId?: number | null;
    userId?: number | null;
    performedById?: number | null;
    performedBySystem?: boolean;
    details?: Prisma.JsonValue;
    metadata?: Prisma.JsonValue;
  } = {},
  client: PrismaClientOrTx = prisma
): Promise<void> {
  await logAffiliateAudit(
    {
      category: 'COMMISSION',
      action,
      saleId,
      profileId: options.profileId ?? null,
      userId: options.userId ?? null,
      performedById: options.performedById ?? null,
      performedBySystem: options.performedBySystem ?? false,
      details: options.details ?? null,
      metadata: options.metadata ?? null,
    },
    client
  );
}

/**
 * DB 회수 관련 감사 로그
 */
export async function logDbRecoveryAudit(
  action: AuditLogAction,
  options: {
    contractId?: number | null;
    profileId?: number | null;
    userId?: number | null;
    performedById?: number | null;
    performedBySystem?: boolean;
    details?: Prisma.JsonValue;
    metadata?: Prisma.JsonValue;
  } = {},
  client: PrismaClientOrTx = prisma
): Promise<void> {
  await logAffiliateAudit(
    {
      category: 'DB_RECOVERY',
      action,
      contractId: options.contractId ?? null,
      profileId: options.profileId ?? null,
      userId: options.userId ?? null,
      performedById: options.performedById ?? null,
      performedBySystem: options.performedBySystem ?? false,
      details: options.details ?? null,
      metadata: options.metadata ?? null,
    },
    client
  );
}

/**
 * 갱신 관련 감사 로그
 */
export async function logRenewalAudit(
  action: AuditLogAction,
  contractId: number,
  options: {
    performedById?: number | null;
    performedBySystem?: boolean;
    details?: Prisma.JsonValue;
    metadata?: Prisma.JsonValue;
  } = {},
  client: PrismaClientOrTx = prisma
): Promise<void> {
  await logAffiliateAudit(
    {
      category: 'RENEWAL',
      action,
      contractId,
      performedById: options.performedById ?? null,
      performedBySystem: options.performedBySystem ?? false,
      details: options.details ?? null,
      metadata: options.metadata ?? null,
    },
    client
  );
}

/**
 * 계약 해지 관련 감사 로그
 */
export async function logTerminationAudit(
  action: AuditLogAction,
  contractId: number,
  options: {
    performedById?: number | null;
    performedBySystem?: boolean;
    details?: Prisma.JsonValue;
    metadata?: Prisma.JsonValue;
  } = {},
  client: PrismaClientOrTx = prisma
): Promise<void> {
  await logAffiliateAudit(
    {
      category: 'TERMINATION',
      action,
      contractId,
      performedById: options.performedById ?? null,
      performedBySystem: options.performedBySystem ?? false,
      details: options.details ?? null,
      metadata: options.metadata ?? null,
    },
    client
  );
}


