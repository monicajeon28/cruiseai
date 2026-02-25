// lib/pricing-utils.ts
// 가격 계산 유틸리티 함수

import prisma from '@/lib/prisma';

export interface CurrentPriceResult {
  period: {
    id: number;
    name: string;
    startDate: Date;
    endDate: Date;
  } | null;
  prices: {
    cabinType: string;
    fareCategory: string;
    fareLabel: string | null;
    saleAmount: number;
    costAmount: number;
    netRevenue: number | null;
    maxPrice: number | null;
    discountRate: number;
  }[];
  hasActivePeriod: boolean;
}

/**
 * 현재 날짜 기준 적용 가격 조회
 */
export async function getCurrentPrice(
  productCode: string,
  targetDate?: Date
): Promise<CurrentPriceResult> {
  const now = targetDate || new Date();

  // 상품 조회
  const product = await prisma.cruiseProduct.findUnique({
    where: { productCode },
    select: { id: true, maxPrice: true },
  });

  if (!product) {
    return { period: null, prices: [], hasActivePeriod: false };
  }

  // 현재 날짜에 해당하는 기간 조회
  const period = await prisma.productPricePeriod.findFirst({
    where: {
      cruiseProductId: product.id,
      startDate: { lte: now },
      endDate: { gte: now },
      isActive: true,
    },
    include: {
      ProductCabinPrice: {
        orderBy: [
          { cabinType: 'asc' },
          { fareCategory: 'asc' },
        ],
      },
    },
    orderBy: { startDate: 'desc' },
  });

  if (!period) {
    return { period: null, prices: [], hasActivePeriod: false };
  }

  // 객실별 최고가 조회
  const maxPrices = await prisma.productMaxPrice.findMany({
    where: { cruiseProductId: product.id },
  });

  const maxPriceMap = new Map<string, number>(
    maxPrices.map((mp) => [mp.cabinType, mp.maxPrice])
  );

  // 가격 목록 구성 (할인율 계산 포함)
  const prices = period.ProductCabinPrice.map((price) => {
    const maxPrice = maxPriceMap.get(price.cabinType) || null;
    const discountRate = calculateDiscountRate(maxPrice, price.saleAmount);

    return {
      cabinType: price.cabinType,
      fareCategory: price.fareCategory,
      fareLabel: price.fareLabel,
      saleAmount: price.saleAmount,
      costAmount: price.costAmount,
      netRevenue: price.netRevenue,
      maxPrice,
      discountRate,
    };
  });

  return {
    period: {
      id: period.id,
      name: period.name,
      startDate: period.startDate,
      endDate: period.endDate,
    },
    prices,
    hasActivePeriod: true,
  };
}

/**
 * 특정 날짜의 가격 조회 (판매 기록용)
 */
export async function getPriceAtDate(
  productCode: string,
  targetDate: Date
): Promise<CurrentPriceResult> {
  return getCurrentPrice(productCode, targetDate);
}

/**
 * 할인율 계산
 */
export function calculateDiscountRate(
  maxPrice: number | null,
  currentPrice: number
): number {
  if (!maxPrice || maxPrice <= 0 || currentPrice >= maxPrice) {
    return 0;
  }
  const discount = ((maxPrice - currentPrice) / maxPrice) * 100;
  return Math.round(discount);
}

/**
 * 순매출 계산
 */
export function calculateNetRevenue(
  saleAmount: number,
  costAmount: number
): number {
  return saleAmount - costAmount;
}

/**
 * 수당 분배 계산 (기본 비율)
 */
export interface CommissionDistribution {
  hqShare: number;      // 본사 수당
  branchShare: number;  // 대리점장 수당
  salesShare: number;   // 판매원 수당
  total: number;        // 총 순매출
}

export function calculateCommissionDistribution(
  netRevenue: number,
  hqRate: number = 0.3,      // 기본 30%
  branchRate: number = 0.4  // 기본 40%
): CommissionDistribution {
  const hqShare = Math.floor(netRevenue * hqRate);
  const branchShare = Math.floor(netRevenue * branchRate);
  const salesShare = netRevenue - hqShare - branchShare;

  return {
    hqShare,
    branchShare,
    salesShare,
    total: netRevenue,
  };
}

/**
 * AffiliateCommissionTier 동기화
 * 가격 기간의 가격을 AffiliateProduct의 CommissionTier에 반영
 */
export async function syncCommissionTiers(
  cruiseProductId: number,
  periodId: number
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  try {
    // 기간의 가격 조회
    const period = await prisma.productPricePeriod.findUnique({
      where: { id: periodId },
      include: {
        ProductCabinPrice: true,
        CruiseProduct: {
          select: { productCode: true },
        },
      },
    });

    if (!period) {
      return { synced: 0, errors: ['Period not found'] };
    }

    // 해당 상품의 AffiliateProduct 조회
    const affiliateProducts = await prisma.affiliateProduct.findMany({
      where: {
        cruiseProductId,
        status: 'active',
      },
    });

    for (const affiliateProduct of affiliateProducts) {
      for (const price of period.ProductCabinPrice) {
        const netRevenue = price.saleAmount - price.costAmount;
        const distribution = calculateCommissionDistribution(netRevenue);

        try {
          await prisma.affiliateCommissionTier.upsert({
            where: {
              affiliateProductId_cabinType_fareCategory_fareLabel: {
                affiliateProductId: affiliateProduct.id,
                cabinType: price.cabinType,
                fareCategory: price.fareCategory,
                fareLabel: price.fareLabel || '',
              },
            },
            create: {
              affiliateProductId: affiliateProduct.id,
              cabinType: price.cabinType,
              fareCategory: price.fareCategory,
              fareLabel: price.fareLabel || '',
              saleAmount: price.saleAmount,
              costAmount: price.costAmount,
              hqShareAmount: distribution.hqShare,
              branchShareAmount: distribution.branchShare,
              salesShareAmount: distribution.salesShare,
            },
            update: {
              saleAmount: price.saleAmount,
              costAmount: price.costAmount,
              hqShareAmount: distribution.hqShare,
              branchShareAmount: distribution.branchShare,
              salesShareAmount: distribution.salesShare,
            },
          });
          synced++;
        } catch (err: any) {
          errors.push(
            `Failed to sync tier for ${price.cabinType}/${price.fareCategory}: ${err.message}`
          );
        }
      }
    }

    return { synced, errors };
  } catch (error: any) {
    return { synced, errors: [error.message] };
  }
}

/**
 * 가격 포맷팅 (천단위 콤마)
 */
export function formatPrice(price: number, currency: string = 'KRW'): string {
  if (currency === 'KRW') {
    return `${price.toLocaleString()}원`;
  }
  return price.toLocaleString();
}

/**
 * 할인 배지 텍스트
 */
export function getDiscountBadge(discountRate: number): string | null {
  if (discountRate <= 0) return null;
  return `${discountRate}% OFF`;
}
