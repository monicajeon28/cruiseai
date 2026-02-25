export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/partner/trips
 * 파트너용 판매 가능한 크루즈 상품 목록 조회
 * 
 * 주의: Trip(예약 내역)이 아닌 CruiseProduct(판매 중인 상품)를 반환합니다.
 * 예약 페이지에서는 판매 가능한 상품 목록을 보여줘야 하기 때문입니다.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    // 파트너 권한 확인 (mallUserId가 있으면 파트너)
    const userWithProfile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mallUserId: true },
    });

    if (!userWithProfile?.mallUserId) {
      return NextResponse.json({ ok: false, message: 'Partner access required' }, { status: 403 });
    }

    // 판매 가능한 CruiseProduct 조회 (saleStatus가 '판매중지'가 아닌 상품)
    const products = await prisma.cruiseProduct.findMany({
      where: {
        NOT: {
          saleStatus: '판매중지',
        },
      },
      include: {
        MallProductContent: {
          select: {
            layout: true,
            isActive: true,
          },
        },
        // ⚠️ Trip 관계는 제거 (DB에 Trip.productId 컬럼이 없음)
        // Trip 정보는 필요시 별도로 조회하거나, MallProductContent.layout.departureDate 사용
      },
      orderBy: [
        { createdAt: 'desc' }, // 최신 상품 먼저
      ],
    });

    // 데이터가 없으면 빈 배열 반환
    if (!products || products.length === 0) {
      return NextResponse.json({ ok: true, trips: [] });
    }

    // 포맷팅 (Trip 형식으로 변환하여 기존 프론트엔드와 호환성 유지)
    // ⚠️ 중요: Trip이 없어도 CruiseProduct를 trips로 변환 (예약 폼에서 상품 선택 가능하도록)
    const formattedTrips = products.map((product) => {
      const pricing = product.MallProductContent?.layout && 
                     typeof product.MallProductContent.layout === 'object' &&
                     'pricing' in product.MallProductContent.layout
        ? (product.MallProductContent.layout as any).pricing
        : null;

      // departureDate 우선순위: MallProductContent.layout.departureDate > null
      let departureDate = '';
      if (product.MallProductContent?.layout && 
          typeof product.MallProductContent.layout === 'object' &&
          'departureDate' in product.MallProductContent.layout) {
        const layoutDate = (product.MallProductContent.layout as any).departureDate;
        if (layoutDate) {
          departureDate = typeof layoutDate === 'string' ? layoutDate : new Date(layoutDate).toISOString().split('T')[0];
        }
      }

      // endDate: product.endDate 사용 (없으면 빈 문자열)
      const endDate = (product as any).endDate
        ? (product as any).endDate.toISOString().split('T')[0]
        : '';

      return {
        id: product.id, // ⚠️ 중요: Product ID를 사용 (Trip이 없으므로)
        productCode: product.productCode,
        shipName: product.shipName,
        departureDate,
        endDate,
        cruiseName: `${product.cruiseLine} ${product.shipName}`,
        destination: product.itineraryPattern && typeof product.itineraryPattern === 'object'
          ? (() => {
              try {
                const pattern = product.itineraryPattern as any;
                // ⚠️ 수정: itineraryPattern이 문자열 배열인 경우 (예: ['Barcelona', 'Marseille', 'Genoa', 'Naples'])
                if (Array.isArray(pattern)) {
                  // 문자열 배열인 경우 그대로 반환
                  if (pattern.length > 0 && typeof pattern[0] === 'string') {
                    return pattern;
                  }
                  // 객체 배열인 경우 location 추출
                  return pattern
                    .filter((day: any) => day && day.location)
                    .map((day: any) => day.location)
                    .filter((loc: any) => loc);
                }
                if (pattern.destination && Array.isArray(pattern.destination)) {
                  return pattern.destination;
                }
              } catch (e) {
                // JSON 파싱 실패 시 빈 배열
              }
              return [];
            })()
          : [],
        status: 'Upcoming', // 기본값
        product: {
          id: product.id,
          productCode: product.productCode,
          cruiseLine: product.cruiseLine,
          shipName: product.shipName,
          packageName: product.packageName,
          source: product.source,
          MallProductContent: product.MallProductContent ? {
            layout: product.MallProductContent.layout,
            isActive: product.MallProductContent.isActive,
          } : null,
        },
      };
    });

    return NextResponse.json({ ok: true, trips: formattedTrips });
  } catch (error: any) {
    console.error('GET /api/partner/trips error:', error);
    console.error('GET /api/partner/trips error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    // 에러 발생 시 빈 배열 반환 (500 에러 방지)
    return NextResponse.json({ 
      ok: true, 
      trips: [],
      error: error.message || '데이터 조회 중 오류가 발생했습니다.',
      errorCode: error.code,
      errorMeta: error.meta,
    });
  }
}
