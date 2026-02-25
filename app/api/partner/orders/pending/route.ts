export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/partner/orders/pending
 * 파트너의 PENDING 또는 COMPLETED 상태인 주문(AffiliateSale) 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    // 파트너 권한 확인
    const userWithProfile = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        AffiliateProfile: {
          select: {
            id: true,
            affiliateCode: true,
          },
        },
      },
    });

    if (!userWithProfile?.mallUserId) {
      return NextResponse.json({ ok: false, message: 'Partner access required' }, { status: 403 });
    }

    const affiliateProfile = userWithProfile.AffiliateProfile?.[0] ||
      (Array.isArray(userWithProfile.AffiliateProfile) && userWithProfile.AffiliateProfile.length > 0
        ? userWithProfile.AffiliateProfile[0]
        : null);

    if (!affiliateProfile) {
      console.log('[Partner Orders Pending] AffiliateProfile이 없습니다.');
      return NextResponse.json({ ok: true, orders: [] });
    }

    console.log('[Partner Orders Pending] 요청한 파트너 ID:', affiliateProfile.id);
    console.log('[Partner Orders Pending] AffiliateCode:', affiliateProfile.affiliateCode);

    // AffiliateSale 조회 (PENDING 또는 COMPLETED 상태, managerId 또는 agentId가 일치하는 것만)
    const affiliateSales = await prisma.affiliateSale.findMany({
      where: {
        AND: [
          {
            status: {
              in: ['PENDING', 'COMPLETED', 'CONFIRMED'], // PENDING, COMPLETED, CONFIRMED 상태
            },
          },
          {
            OR: [
              { managerId: affiliateProfile.id },
              { agentId: affiliateProfile.id },
            ],
          },
        ],
      },
      include: {
        Payment: {
          select: {
            id: true,
            orderId: true,
            productCode: true,
            productName: true,
            amount: true,
            currency: true,
            buyerName: true,
            buyerEmail: true,
            buyerTel: true,
            paidAt: true,
            metadata: true,
            status: true,
          },
        },
      },
      orderBy: {
        saleDate: 'desc', // 최신 주문 먼저
      },
      take: 50, // 최근 50개만
    });

    console.log('[Partner Orders Pending] DB에서 조회된 AffiliateSale 개수:', affiliateSales.length);
    console.log('[Partner Orders Pending] 조회 조건:');
    console.log('  - status: PENDING, COMPLETED, CONFIRMED');
    console.log('  - managerId 또는 agentId:', affiliateProfile.id);

    // productCode로 CruiseProduct 조회 (배치)
    const productCodes = [...new Set(
      affiliateSales
        .map((sale) => sale.productCode)
        .filter((code): code is string => !!code)
    )];

    let products: Array<any> = [];
    if (productCodes.length > 0) {
      products = await prisma.cruiseProduct.findMany({
        where: { productCode: { in: productCodes } },
        select: {
          id: true,
          productCode: true,
          cruiseLine: true,
          shipName: true,
          packageName: true,
          nights: true,
          days: true,
        },
      });
    }

    const productMap = new Map(products.map((p) => [p.productCode, p]));

    // 포맷팅 (Payment 정보 우선, 없으면 AffiliateSale 정보 사용)
    const formattedOrders = affiliateSales.map((sale) => {
      const payment = sale.Payment;
      const product = sale.productCode ? productMap.get(sale.productCode) : null;

      return {
        id: payment?.id || sale.id,
        orderId: payment?.orderId || sale.externalOrderCode || `ORDER-${sale.id}`,
        productCode: sale.productCode || payment?.productCode || product?.productCode,
        productName: payment?.productName || product?.packageName || '상품 정보 없음',
        amount: payment?.amount || sale.saleAmount || 0,
        currency: payment?.currency || 'KRW',
        buyerName: payment?.buyerName || '구매자 정보 없음',
        buyerEmail: payment?.buyerEmail || null,
        buyerTel: payment?.buyerTel || null,
        paidAt: payment?.paidAt ? payment.paidAt.toISOString() : (sale.saleDate ? sale.saleDate.toISOString() : null),
        metadata: payment?.metadata || null,
        status: sale.status,
        sale: {
          id: sale.id,
          productCode: sale.productCode,
          cabinType: sale.cabinType,
          fareCategory: sale.fareCategory,
          headcount: sale.headcount,
        },
        product: product ? {
          id: product.id,
          productCode: product.productCode,
          cruiseLine: product.cruiseLine,
          shipName: product.shipName,
          packageName: product.packageName,
        } : null,
      };
    });

    return NextResponse.json({ ok: true, orders: formattedOrders });
  } catch (error: any) {
    console.error('GET /api/partner/orders/pending error:', error);
    // 에러 발생 시 빈 배열 반환 (500 에러 방지)
    return NextResponse.json({
      ok: true,
      orders: [],
      error: error.message || '주문 내역 조회 중 오류가 발생했습니다.'
    });
  }
}
