export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * GET /api/partner/products/active
 * 판매중인 활성 상품 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 판매중인 상품만 조회
    const products = await prisma.cruiseProduct.findMany({
      where: {
        saleStatus: '판매중',
      },
      select: {
        id: true,
        productCode: true,
        cruiseLine: true,
        shipName: true,
        packageName: true,
        nights: true,
        days: true,
        basePrice: true,
        tags: true,
        category: true,
        itineraryPattern: true,
        saleStatus: true,
      },
      orderBy: {
        productCode: 'asc',
      },
    });

    return NextResponse.json({ ok: true, products });
  } catch (error) {
    console.error('[Partner Active Products GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch active products' },
      { status: 500 }
    );
  }
}
