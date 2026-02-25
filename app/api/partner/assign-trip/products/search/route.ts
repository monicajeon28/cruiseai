import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requirePartnerContext();
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim() || '';

    const products = await prisma.cruiseProduct.findMany({
      where: {
        saleStatus: { not: '판매중지' },
        OR: query
          ? [
            { packageName: { contains: query, mode: 'insensitive' } },
            { productCode: { contains: query, mode: 'insensitive' } },
          ]
          : undefined,
      },
      select: {
        id: true,
        productCode: true,
        cruiseLine: true,
        shipName: true,
        packageName: true,
        nights: true,
        days: true,
        itineraryPattern: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ ok: true, products });
  } catch (error) {
    logger.error('[Partner AssignTrip] product search error:', error);
    return NextResponse.json(
      { ok: false, error: '상품 검색에 실패했습니다.' },
      { status: 500 }
    );
  }
}
