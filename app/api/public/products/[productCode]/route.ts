export const dynamic = 'force-dynamic';

// app/api/public/products/[productCode]/route.ts
// 공개 상품 상세 조회 API (로그인 불필요)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET: 상품 상세 정보 조회
 * 로그인 없이 접근 가능
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { productCode: string } }
) {
  try {
    // Next.js 15+에서는 params가 Promise일 수 있음
    const resolvedParams = await params;
    const productCode = resolvedParams.productCode?.toUpperCase();

    if (!productCode) {
      return NextResponse.json(
        { ok: false, error: '상품 코드가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('[Public Product Detail API] 조회 시작:', productCode);

    // 어필리에이트 상품 유효성 확인
    // 구매몰에 표시되려면:
    // 1. AffiliateProduct가 존재해야 함
    // 2. status: 'active', isPublished: true
    // 3. effectiveFrom <= now
    // 4. effectiveTo IS NULL OR effectiveTo >= now (종료일이 지난 상품은 제외)
    // 5. 삭제된 상품은 자동으로 제외됨
    const now = new Date();
    const affiliateProduct = await prisma.affiliateProduct.findFirst({
      where: {
        AND: [
          { productCode },
          { status: 'active' },
          { isPublished: true },
          { effectiveFrom: { lte: now } },
          {
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: now } },
            ],
          },
        ],
      },
      select: {
        id: true,
        productCode: true,
        status: true,
        isPublished: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });

    if (!affiliateProduct) {
      console.warn('[Public Product Detail API] 유효한 어필리에이트 상품이 없음:', productCode);
      return NextResponse.json(
        { ok: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 상품 조회
    const product = await prisma.cruiseProduct.findUnique({
      where: { productCode },
      select: {
        id: true,
        productCode: true,
        cruiseLine: true,
        shipName: true,
        packageName: true,
        nights: true,
        days: true,
        basePrice: true,
        source: true,
        itineraryPattern: true,
        description: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
        MallProductContent: {
          select: {
            thumbnail: true,
            images: true,
            videos: true,
            layout: true,
          },
        },
      },
    });

    if (!product) {
      console.warn('[Public Product Detail API] 상품을 찾을 수 없음:', productCode);
      return NextResponse.json(
        { ok: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    console.log('[Public Product Detail API] 상품 조회 성공:', {
      productCode: product.productCode,
      hasItineraryPattern: !!product.itineraryPattern,
    });

    return NextResponse.json({
      ok: true,
      product,
    });
  } catch (error) {
    console.error('[Public Product Detail API] GET error:', error);
    console.error('[Public Product Detail API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        ok: false, 
        error: '상품 정보를 불러올 수 없습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
