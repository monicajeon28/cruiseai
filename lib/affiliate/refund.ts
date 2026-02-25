// lib/affiliate/refund.ts
// 환불 처리 유틸리티

import prisma from '@/lib/prisma';

/**
 * 환불 처리
 * - AffiliateSale 상태를 REFUNDED로 변경
 * - 기존 수당에 대한 마이너스 REFUND 엔트리 생성
 * - 다음 정산에서 자동으로 반영됨
 */
export async function processRefund(
  saleId: number,
  refundReason: string,
  processedBy: number
): Promise<{
  success: boolean;
  sale: any;
  refundEntries: any[];
}> {
  // AffiliateSale 조회
  const sale = await prisma.affiliateSale.findUnique({
    where: { id: saleId },
    include: {
      manager: {
        select: {
          id: true,
          displayName: true,
        },
      },
      agent: {
        select: {
          id: true,
          displayName: true,
        },
      },
      ledgerEntries: {
        where: {
          entryType: {
            notIn: ['REFUND'], // 기존 REFUND 엔트리는 제외
          },
        },
        include: {
          profile: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      },
    },
  });

  if (!sale) {
    throw new Error('판매 정보를 찾을 수 없습니다.');
  }

  if (sale.status === 'REFUNDED') {
    throw new Error('이미 환불 처리된 판매입니다.');
  }

  if (sale.status === 'CANCELLED') {
    throw new Error('취소된 판매는 환불할 수 없습니다.');
  }

  // 기존 수당 엔트리들을 기반으로 마이너스 REFUND 엔트리 생성
  const refundEntries = [];

  for (const entry of sale.ledgerEntries) {
    // REFUND 엔트리 생성 (마이너스 금액)
    const refundEntry = await prisma.commissionLedger.create({
      data: {
        saleId: sale.id,
        profileId: entry.profileId,
        entryType: 'REFUND',
        amount: -entry.amount, // 마이너스 금액
        currency: entry.currency,
        withholdingAmount: entry.withholdingAmount ? -entry.withholdingAmount : null, // 마이너스 원천징수
        isSettled: false, // 아직 정산되지 않음
        notes: `환불: ${refundReason}`,
        metadata: {
          originalEntryId: entry.id,
          originalEntryType: entry.entryType,
          refundReason,
          processedBy,
          processedAt: new Date().toISOString(),
        },
      },
    });

    refundEntries.push(refundEntry);
  }

  // AffiliateSale 상태 업데이트
  const updatedSale = await prisma.affiliateSale.update({
    where: { id: saleId },
    data: {
      status: 'REFUNDED',
      refundedAt: new Date(),
      cancellationReason: refundReason,
      metadata: {
        ...((sale.metadata as any) || {}),
        refundProcessedBy: processedBy,
        refundProcessedAt: new Date().toISOString(),
        refundReason,
      },
    },
    include: {
      manager: {
        select: {
          id: true,
          displayName: true,
        },
      },
      agent: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  // Lead 상태 업데이트 (있는 경우)
  if (sale.leadId) {
    await prisma.affiliateLead.update({
      where: { id: sale.leadId },
      data: {
        status: 'REFUNDED',
        metadata: {
          ...((await prisma.affiliateLead.findUnique({
            where: { id: sale.leadId },
            select: { metadata: true },
          }))?.metadata as any || {}),
          refundSaleId: sale.id,
          refundProcessedAt: new Date().toISOString(),
        },
      },
    });
  }

  return {
    success: true,
    sale: updatedSale,
    refundEntries,
  };
}

/**
 * 환불 취소 (환불 처리 취소)
 * - REFUND 엔트리 삭제
 * - AffiliateSale 상태를 원래 상태로 복구
 */
export async function cancelRefund(
  saleId: number,
  processedBy: number
): Promise<{
  success: boolean;
  sale: any;
}> {
  const sale = await prisma.affiliateSale.findUnique({
    where: { id: saleId },
    include: {
      ledgerEntries: {
        where: {
          entryType: 'REFUND',
        },
      },
    },
  });

  if (!sale) {
    throw new Error('판매 정보를 찾을 수 없습니다.');
  }

  if (sale.status !== 'REFUNDED') {
    throw new Error('환불 처리되지 않은 판매입니다.');
  }

  // REFUND 엔트리 삭제
  await prisma.commissionLedger.deleteMany({
    where: {
      saleId: sale.id,
      entryType: 'REFUND',
    },
  });

  // AffiliateSale 상태 복구 (원래 상태로)
  const originalStatus = sale.confirmedAt ? 'CONFIRMED' : 'PENDING';
  const updatedSale = await prisma.affiliateSale.update({
    where: { id: saleId },
    data: {
      status: originalStatus,
      refundedAt: null,
      cancellationReason: null,
      metadata: {
        ...((sale.metadata as any) || {}),
        refundCancelledBy: processedBy,
        refundCancelledAt: new Date().toISOString(),
      },
    },
  });

  // Lead 상태 복구 (있는 경우)
  if (sale.leadId) {
    const originalLeadStatus = sale.confirmedAt ? 'PURCHASED' : 'NEW';
    await prisma.affiliateLead.update({
      where: { id: sale.leadId },
      data: {
        status: originalLeadStatus,
      },
    });
  }

  return {
    success: true,
    sale: updatedSale,
  };
}
