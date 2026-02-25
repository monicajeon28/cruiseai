// app/api/public/products/route.ts
// 공개 상품 목록 조회 API (로그인 불필요)

// 성능 최적화: 10분 캐싱 (상품 목록은 자주 변경되지 않음)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';  // Edge Runtime 금지 (Prisma 사용)
export const revalidate = 600;    // 10분 캐싱 - 동시 1000명 접속 시 DB 부하 90% 감소

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET: 상품 목록 조회
 * 로그인 없이 접근 가능
 * 
 * Query Parameters:
 * - page: 페이지 번호 (기본값: 1)
 * - limit: 페이지당 항목 수 (기본값: 12)
 * - sort: 정렬 방식 ('newest', 'price_asc', 'price_desc', 'popular')
 * - region: 지역 필터 ('japan', 'southeast-asia', 'singapore', 'western-mediterranean', 'eastern-mediterranean', 'alaska', 'usa')
 * - cruiseLine: 크루즈 라인 필터
 * - shipName: 크루즈선 이름 필터
 * - keyword: 키워드 필터 (recommendedKeywords에서 검색)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '12', 10);
    const sort = searchParams.get('sort') || 'newest';
    const region = searchParams.get('region') || '';
    const cruiseLine = searchParams.get('cruiseLine') || '';
    const shipName = searchParams.get('shipName') || '';
    const keyword = searchParams.get('keyword') || ''; // 키워드 파라미터 추가
    const themeType = (searchParams.get('themeType') || '').trim();
    const themeValue = (searchParams.get('themeValue') || '').trim();
    const themeLimit = parseInt(searchParams.get('themeLimit') || '0', 10);
    const isThemeRequest = Boolean(themeType && themeValue);

    // WHERE 조건 구성
    const where: any = {};

    // 크루즈 라인 필터링
    if (cruiseLine && cruiseLine !== 'all') {
      // SQLite는 contains와 mode를 지원하지 않으므로 JavaScript에서 필터링
      // Prisma 쿼리에서는 모든 상품을 가져온 후 필터링
    }

    // 크루즈선 이름 필터링
    if (shipName && shipName !== 'all') {
      // SQLite는 contains와 mode를 지원하지 않으므로 JavaScript에서 필터링
      // Prisma 쿼리에서는 모든 상품을 가져온 후 필터링
    }

    // 정렬 조건
    let orderBy: any = {};
    switch (sort) {
      case 'price_asc':
        orderBy = { basePrice: 'asc' };
        break;
      case 'price_desc':
        orderBy = { basePrice: 'desc' };
        break;
      case 'popular':
        // 인기도는 Trip 수로 계산 (나중에 개선 가능)
        orderBy = { createdAt: 'desc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    // 어필리에이트 수당이 완료된 상품만 조회
    // 필터링 조건:
    // 1. status: 'active' - 활성 상태인 상품만
    // 2. isPublished: true - 게시된 상품만
    // 3. effectiveFrom <= now - 적용 시작일이 현재보다 이전이어야 함
    // 4. effectiveTo IS NULL OR effectiveTo >= now - 적용 종료일이 없거나, 현재보다 이후여야 함
    //    (적용 종료일이 지난 상품은 자동으로 제외됨)
    // 5. 삭제된 상품은 데이터베이스에서 제거되므로 자동으로 필터링됨
    const now = new Date();
    
    let activeAffiliateProducts;
    try {
      // effectiveFrom은 필수 필드이므로 null 체크 불필요, effectiveTo만 null 가능
      // Prisma 쿼리 구조: 최상위 레벨에 AND와 OR을 동시에 사용할 수 없으므로 AND로 묶어야 함
      activeAffiliateProducts = await prisma.affiliateProduct.findMany({
        where: {
          AND: [
            { status: 'active' }, // 활성 상태만
            { isPublished: true }, // 게시된 상품만
            { effectiveFrom: { lte: now } }, // 적용 시작일이 현재보다 이전이어야 함
            {
              OR: [
                { effectiveTo: null }, // 적용 종료일이 없으면 계속 유효
                { effectiveTo: { gte: now } }, // 적용 종료일이 현재보다 이후여야 함 (종료일이 지난 상품은 제외)
              ],
            },
          ],
        },
        select: {
          productCode: true,
          cruiseProductId: true,
          effectiveFrom: true,
          effectiveTo: true,
          status: true,
          isPublished: true,
        },
      });
    } catch (queryError: any) {
      console.error('[Public Products API] AffiliateProduct query error:', queryError);
      console.error('[Public Products API] Query error details:', {
        message: queryError?.message,
        name: queryError?.name,
        code: queryError?.code,
        stack: queryError?.stack,
      });
      // 쿼리 에러 발생 시 빈 배열 반환
      activeAffiliateProducts = [];
    }

    // 디버깅: AffiliateProduct 조회 결과 로그
    console.log('[Public Products API] Active AffiliateProducts:', {
      count: activeAffiliateProducts.length,
      productCodes: activeAffiliateProducts.map(ap => ap.productCode),
      now: now.toISOString(),
      details: activeAffiliateProducts.map(ap => ({
        productCode: ap.productCode,
        status: ap.status,
        isPublished: ap.isPublished,
        effectiveFrom: ap.effectiveFrom?.toISOString(),
        effectiveTo: ap.effectiveTo?.toISOString(),
      })),
    });

    const affiliateProductCodes = new Set(
      activeAffiliateProducts.map(ap => ap.productCode)
    );

    // 어필리에이트 수당이 완료된 상품이 없으면 빈 배열 반환
    if (affiliateProductCodes.size === 0) {
      console.log('[Public Products API] No active affiliate products found');
      return NextResponse.json({
        ok: true,
        products: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
        },
      });
    }

    console.log('[Public Products API] Looking for CruiseProducts with codes:', Array.from(affiliateProductCodes));

    // 상품 조회 (어필리에이트 수당이 완료된 상품만, saleStatus는 선택적)
    let allProducts = await prisma.cruiseProduct.findMany({
      where: {
        AND: [
          {
            productCode: {
              in: Array.from(affiliateProductCodes), // AffiliateProduct가 있는 상품만
            },
          },
          {
            // saleStatus가 '판매중지' 또는 '3일체험'이 아닌 상품만 포함
            AND: [
              {
                NOT: {
                  saleStatus: '판매중지',
                },
              },
              {
                NOT: {
                  saleStatus: '3일체험',
                },
              },
            ],
          },
        ],
      },
      orderBy,
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
        isUrgent: true, // 긴급 상품 여부 추가
        isMainProduct: true, // 주력 상품 여부 추가
        updatedAt: true, // 최근 설정 순서를 위해 필요
        createdAt: true,
        tags: true,
        isPopular: true,
        isRecommended: true,
        isPremium: true,
        isGeniePack: true,
        saleStatus: true, // 디버깅용
        isDomestic: true,
        isJapan: true,
        isBudget: true,
        category: true,
        MallProductContent: {
          select: {
            thumbnail: true,
            layout: true,
          },
        },
      },
    });

    console.log('[Public Products API] Found CruiseProducts:', {
      count: allProducts.length,
      productCodes: allProducts.map(p => p.productCode),
      saleStatuses: allProducts.map(p => p.saleStatus),
    });

    // CruiseProduct가 없으면 빈 배열 반환
    if (allProducts.length === 0) {
      console.log('[Public Products API] No CruiseProducts found for affiliate product codes');
      return NextResponse.json({
        ok: true,
        products: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
        },
      });
    }

    // 긴급 상품과 주력 상품을 분리하고 최근 설정 순서대로 정렬
    const urgentProducts = allProducts
      .filter(p => p.isUrgent)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3); // 최대 3개만

    const mainProducts = allProducts
      .filter(p => p.isMainProduct && !p.isUrgent) // 긴급이 아닌 주력 상품만
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 9); // 샘플 상품 9개 표시 (롯데JTB, 더블유, 크루즈닷 각 3개씩)

    const normalProducts = allProducts.filter(p => !p.isUrgent && !p.isMainProduct);

    // 최종 정렬: 긴급(최대 3개, 최신순) -> 주력(최대 9개, 최신순) -> 일반 상품
    allProducts = [...urgentProducts, ...mainProducts, ...normalProducts];
    
    // 원본 상품 데이터 저장 (키워드 검색용)
    const originalProducts = [...allProducts];

    // 성능 최적화: JSON 파싱 결과 캐싱 (같은 데이터를 여러 번 파싱하지 않음)
    const parsedLayoutCache = new Map<number, any>();
    const parsedItineraryCache = new Map<number, any>();

    const getParsedLayout = (product: any): any => {
      if (!product.MallProductContent?.layout) return null;
      if (parsedLayoutCache.has(product.id)) {
        return parsedLayoutCache.get(product.id);
      }
      try {
        const layout = typeof product.MallProductContent.layout === 'string' 
          ? JSON.parse(product.MallProductContent.layout) 
          : product.MallProductContent.layout;
        parsedLayoutCache.set(product.id, layout);
        return layout;
      } catch (e) {
        parsedLayoutCache.set(product.id, null);
        return null;
      }
    };

    const getParsedItinerary = (product: any): any => {
      if (!product.itineraryPattern) return null;
      if (parsedItineraryCache.has(product.id)) {
        return parsedItineraryCache.get(product.id);
      }
      try {
        const pattern = typeof product.itineraryPattern === 'string' 
          ? JSON.parse(product.itineraryPattern) 
          : product.itineraryPattern;
        parsedItineraryCache.set(product.id, pattern);
        return pattern;
      } catch (e) {
        parsedItineraryCache.set(product.id, null);
        return null;
      }
    };

    // 지역 필터링 (MallProductContent.layout.destination 우선, itineraryPattern fallback)
    // 키워드가 도시명일 수 있으므로, 키워드가 있으면 지역 필터링을 더 유연하게 처리
    if (region && region !== 'all' && region !== 'other') {
      const regionMap: Record<string, { countries: string[], cities?: string[] }> = {
        'japan': { 
          countries: ['JP', 'Japan', '일본'],
          cities: ['도쿄', '오사카', '요코하마', '고베', '나고야', '후쿠오카', '삿포로', 'Tokyo', 'Osaka', 'Yokohama', 'Kobe', 'Nagoya', 'Fukuoka', 'Sapporo']
        },
        'southeast-asia': { 
          countries: ['TH', 'Thailand', '태국', 'VN', 'Vietnam', '베트남', 'MY', 'Malaysia', '말레이시아'],
          cities: ['방콕', '파타야', '푸켓', '호치민', '하노이', '쿠알라룸푸르', '펜앙', '랑카위', 'Bangkok', 'Pattaya', 'Phuket', 'Ho Chi Minh', 'Hanoi', 'Kuala Lumpur', 'Penang', 'Langkawi']
        },
        'singapore': { 
          countries: ['SG', 'Singapore', '싱가포르'],
          cities: ['싱가포르', 'Singapore']
        },
        'western-mediterranean': { 
          countries: ['ES', 'Spain', '스페인', 'FR', 'France', '프랑스', 'IT', 'Italy', '이탈리아'],
          cities: ['바르셀로나', '마르세유', '제노아', '라벤나', '베니스', 'Barcelona', 'Marseille', 'Genoa', 'Ravenna', 'Venice']
        },
        'eastern-mediterranean': { 
          countries: ['GR', 'Greece', '그리스', 'TR', 'Turkey', '터키'],
          cities: ['아테네', '미코노스', '스플리트', 'Athens', 'Mykonos', 'Split']
        },
        'alaska': { 
          countries: ['US', 'USA', '미국', 'Alaska', '알래스카'],
          cities: ['알래스카', '앵커리지', '주노', '스캐그웨이', '싯카', 'Alaska', 'Anchorage', 'Juneau', 'Skagway', 'Sitka']
        },
        'usa': { 
          countries: ['US', 'USA', '미국', 'United States', 'United States of America', 'America'],
          cities: ['시애틀', '주노', '스캐그웨이', '싯카', '앵커리지', '빅토리아', '밴쿠버', 'Seattle', 'Juneau', 'Skagway', 'Sitka', 'Anchorage', 'Victoria', 'Vancouver']
        },
      };

      const regionConfig = regionMap[region];
      if (!regionConfig) {
        // 기존 로직 유지 (하위 호환성)
        const legacyRegionMap: Record<string, string[]> = {
          'japan': ['JP', 'Japan', '일본'],
          'southeast-asia': ['TH', 'Thailand', '태국', 'VN', 'Vietnam', '베트남', 'MY', 'Malaysia', '말레이시아'],
          'singapore': ['SG', 'Singapore', '싱가포르'],
          'western-mediterranean': ['ES', 'Spain', '스페인', 'FR', 'France', '프랑스', 'IT', 'Italy', '이탈리아'],
          'eastern-mediterranean': ['GR', 'Greece', '그리스', 'TR', 'Turkey', '터키'],
          'alaska': ['US', 'USA', '미국', 'Alaska', '알래스카'],
          'usa': ['US', 'USA', '미국', 'United States', 'United States of America', 'America'],
        };
        const targetRegions = legacyRegionMap[region] || [];
        
        allProducts = allProducts.filter(product => {
          if (product.MallProductContent?.layout) {
            try {
              const layout = typeof product.MallProductContent.layout === 'string' 
                ? JSON.parse(product.MallProductContent.layout) 
                : product.MallProductContent.layout;
              
              if (layout && typeof layout === 'object' && layout.destination && Array.isArray(layout.destination)) {
                const destinations = layout.destination.map((d: any) => d.toString().toUpperCase());
                const matches = destinations.some(dest => 
                  targetRegions.some(r => dest.includes(r.toUpperCase()) || r.toUpperCase().includes(dest))
                );
                if (matches) return true;
              }
            } catch (e) {
              // 파싱 실패 시 무시
            }
          }
          
          if (product.itineraryPattern) {
            try {
              const pattern = typeof product.itineraryPattern === 'string' 
                ? JSON.parse(product.itineraryPattern) 
                : product.itineraryPattern;
              
              if (Array.isArray(pattern)) {
                const matches = pattern.some((item: any) => {
                  if (typeof item === 'object' && item.country) {
                    const country = item.country.toString().toUpperCase();
                    return targetRegions.some(r => country.includes(r.toUpperCase()) || r.toUpperCase().includes(country));
                  }
                  return false;
                });
                if (matches) return true;
              }
            } catch (e) {
              // 파싱 실패 시 무시
            }
          }
          
          return false;
        });
      } else {
        const targetCountries = regionConfig.countries.map(c => c.toUpperCase());
        const targetCities = (regionConfig.cities || []).map(c => c.toUpperCase());
        
        // 목적지 문자열에서 국가명과 도시명 추출하는 헬퍼 함수
        const extractCountryAndCity = (destStr: string): { country: string, city: string } => {
          const dest = destStr.toString();
          // "미국 (United States) - 시애틀 (Seattle)" 형식에서 국가명과 도시명 추출
          const parts = dest.split(' - ');
          let country = '';
          let city = '';
          
          if (parts.length >= 1) {
            // 국가명 부분에서 괄호 제거 및 추출
            const countryPart = parts[0].trim();
            country = countryPart.split('(')[0].trim(); // "미국 (United States)" -> "미국"
          }
          
          if (parts.length >= 2) {
            // 도시명 부분에서 괄호 제거 및 추출
            const cityPart = parts[1].trim();
            city = cityPart.split('(')[0].trim(); // "시애틀 (Seattle)" -> "시애틀"
          }
          
          return { country: country.toUpperCase(), city: city.toUpperCase() };
        };
        
        allProducts = allProducts.filter(product => {
          // 1. MallProductContent.layout.destination 확인 (우선)
          if (product.MallProductContent?.layout) {
            try {
              const layout = typeof product.MallProductContent.layout === 'string' 
                ? JSON.parse(product.MallProductContent.layout) 
                : product.MallProductContent.layout;
              
              if (layout && typeof layout === 'object' && layout.destination && Array.isArray(layout.destination)) {
                const matches = layout.destination.some((dest: any) => {
                  const destStr = dest.toString();
                  const destUpper = destStr.toUpperCase();
                  
                  // 전체 문자열에서 국가명/도시명 직접 매칭
                  const countryMatch = targetCountries.some(country => 
                    destUpper.includes(country) || country.includes(destUpper.split(' - ')[0]?.trim() || '')
                  );
                  
                  const cityMatch = targetCities.length > 0 && targetCities.some(city => 
                    destUpper.includes(city)
                  );
                  
                  if (countryMatch || cityMatch) return true;
                  
                  // "국가 - 도시" 형식에서 국가명과 도시명 추출하여 매칭
                  const { country, city } = extractCountryAndCity(destStr);
                  
                  // 국가명 매칭
                  const countryMatches = targetCountries.some(targetCountry => {
                    const targetCountryUpper = targetCountry.toUpperCase();
                    return country.includes(targetCountryUpper) || 
                           targetCountryUpper.includes(country) ||
                           destUpper.includes(targetCountryUpper);
                  });
                  
                  // 도시명 매칭
                  const cityMatches = targetCities.length > 0 && targetCities.some(targetCity => {
                    const targetCityUpper = targetCity.toUpperCase();
                    return city.includes(targetCityUpper) || 
                           targetCityUpper.includes(city) ||
                           destUpper.includes(targetCityUpper);
                  });
                  
                  return countryMatches || cityMatches;
                });
                
                if (matches) return true;
              }
            } catch (e) {
              // 파싱 실패 시 무시
            }
          }
          
          // 2. itineraryPattern에서 country 필드 확인 (fallback)
          if (product.itineraryPattern) {
            try {
              const pattern = typeof product.itineraryPattern === 'string' 
                ? JSON.parse(product.itineraryPattern) 
                : product.itineraryPattern;
              
              if (Array.isArray(pattern)) {
                const matches = pattern.some((item: any) => {
                  if (typeof item === 'object' && item.country) {
                    const country = item.country.toString().toUpperCase();
                    return targetCountries.some(r => country.includes(r) || r.includes(country));
                  }
                  return false;
                });
                if (matches) return true;
              }
            } catch (e) {
              // 파싱 실패 시 무시
            }
          }
          
          return false;
        });
      }
    } else if (region === 'other') {
      const regionMap: Record<string, { countries: string[], cities?: string[] }> = {
        'japan': { 
          countries: ['JP', 'Japan', '일본'],
          cities: ['도쿄', '오사카', '요코하마', '고베', '나고야', '후쿠오카', '삿포로', 'Tokyo', 'Osaka', 'Yokohama', 'Kobe', 'Nagoya', 'Fukuoka', 'Sapporo']
        },
        'southeast-asia': { 
          countries: ['TH', 'Thailand', '태국', 'VN', 'Vietnam', '베트남', 'MY', 'Malaysia', '말레이시아'],
          cities: ['방콕', '파타야', '푸켓', '호치민', '하노이', '쿠알라룸푸르', '펜앙', '랑카위', 'Bangkok', 'Pattaya', 'Phuket', 'Ho Chi Minh', 'Hanoi', 'Kuala Lumpur', 'Penang', 'Langkawi']
        },
        'singapore': { 
          countries: ['SG', 'Singapore', '싱가포르'],
          cities: ['싱가포르', 'Singapore']
        },
        'western-mediterranean': { 
          countries: ['ES', 'Spain', '스페인', 'FR', 'France', '프랑스', 'IT', 'Italy', '이탈리아'],
          cities: ['바르셀로나', '마르세유', '제노아', '라벤나', '베니스', 'Barcelona', 'Marseille', 'Genoa', 'Ravenna', 'Venice']
        },
        'eastern-mediterranean': { 
          countries: ['GR', 'Greece', '그리스', 'TR', 'Turkey', '터키'],
          cities: ['아테네', '미코노스', '스플리트', 'Athens', 'Mykonos', 'Split']
        },
        'alaska': { 
          countries: ['US', 'USA', '미국', 'Alaska', '알래스카'],
          cities: ['알래스카', '앵커리지', '주노', '스캐그웨이', '싯카', 'Alaska', 'Anchorage', 'Juneau', 'Skagway', 'Sitka']
        },
        'usa': { 
          countries: ['US', 'USA', '미국', 'United States', 'United States of America', 'America'],
          cities: ['시애틀', '주노', '스캐그웨이', '싯카', '앵커리지', '빅토리아', '밴쿠버', 'Seattle', 'Juneau', 'Skagway', 'Sitka', 'Anchorage', 'Victoria', 'Vancouver']
        },
      };

      const regionConfig = regionMap[region];
      if (!regionConfig) {
        // 기존 로직 유지 (하위 호환성)
        const legacyRegionMap: Record<string, string[]> = {
          'japan': ['JP', 'Japan', '일본'],
          'southeast-asia': ['TH', 'Thailand', '태국', 'VN', 'Vietnam', '베트남', 'MY', 'Malaysia', '말레이시아'],
          'singapore': ['SG', 'Singapore', '싱가포르'],
          'western-mediterranean': ['ES', 'Spain', '스페인', 'FR', 'France', '프랑스', 'IT', 'Italy', '이탈리아'],
          'eastern-mediterranean': ['GR', 'Greece', '그리스', 'TR', 'Turkey', '터키'],
          'alaska': ['US', 'USA', '미국', 'Alaska', '알래스카'],
          'usa': ['US', 'USA', '미국', 'United States', 'United States of America', 'America'],
        };
        const targetRegions = legacyRegionMap[region] || [];
        
        allProducts = allProducts.filter(product => {
          if (product.MallProductContent?.layout) {
            try {
              const layout = typeof product.MallProductContent.layout === 'string' 
                ? JSON.parse(product.MallProductContent.layout) 
                : product.MallProductContent.layout;
              
              if (layout && typeof layout === 'object' && layout.destination && Array.isArray(layout.destination)) {
                const destinations = layout.destination.map((d: any) => d.toString().toUpperCase());
                const matches = destinations.some(dest => 
                  targetRegions.some(r => dest.includes(r.toUpperCase()) || r.toUpperCase().includes(dest))
                );
                if (matches) return true;
              }
            } catch (e) {
              // 파싱 실패 시 무시
            }
          }
          
          if (product.itineraryPattern) {
            try {
              const pattern = typeof product.itineraryPattern === 'string' 
                ? JSON.parse(product.itineraryPattern) 
                : product.itineraryPattern;
              
              if (Array.isArray(pattern)) {
                const matches = pattern.some((item: any) => {
                  if (typeof item === 'object' && item.country) {
                    const country = item.country.toString().toUpperCase();
                    return targetRegions.some(r => country.includes(r.toUpperCase()) || r.toUpperCase().includes(country));
                  }
                  return false;
                });
                if (matches) return true;
              }
            } catch (e) {
              // 파싱 실패 시 무시
            }
          }
          
          return false;
        });
      } else {
        const targetCountries = regionConfig.countries.map(c => c.toUpperCase());
        const targetCities = (regionConfig.cities || []).map(c => c.toUpperCase());
        
        // 목적지 문자열에서 국가명과 도시명 추출하는 헬퍼 함수
        const extractCountryAndCity = (destStr: string): { country: string, city: string } => {
          const dest = destStr.toString();
          // "미국 (United States) - 시애틀 (Seattle)" 형식에서 국가명과 도시명 추출
          const parts = dest.split(' - ');
          let country = '';
          let city = '';
          
          if (parts.length >= 1) {
            // 국가명 부분에서 괄호 제거 및 추출
            const countryPart = parts[0].trim();
            country = countryPart.split('(')[0].trim(); // "미국 (United States)" -> "미국"
          }
          
          if (parts.length >= 2) {
            // 도시명 부분에서 괄호 제거 및 추출
            const cityPart = parts[1].trim();
            city = cityPart.split('(')[0].trim(); // "시애틀 (Seattle)" -> "시애틀"
          }
          
          return { country: country.toUpperCase(), city: city.toUpperCase() };
        };
        
        allProducts = allProducts.filter(product => {
          // 1. MallProductContent.layout.destination 확인 (우선)
          if (product.MallProductContent?.layout) {
            try {
              const layout = typeof product.MallProductContent.layout === 'string' 
                ? JSON.parse(product.MallProductContent.layout) 
                : product.MallProductContent.layout;
              
              if (layout && typeof layout === 'object' && layout.destination && Array.isArray(layout.destination)) {
                const matches = layout.destination.some((dest: any) => {
                  const destStr = dest.toString();
                  const destUpper = destStr.toUpperCase();
                  
                  // 전체 문자열에서 국가명/도시명 직접 매칭
                  const countryMatch = targetCountries.some(country => 
                    destUpper.includes(country) || country.includes(destUpper.split(' - ')[0]?.trim() || '')
                  );
                  
                  const cityMatch = targetCities.length > 0 && targetCities.some(city => 
                    destUpper.includes(city)
                  );
                  
                  if (countryMatch || cityMatch) return true;
                  
                  // "국가 - 도시" 형식에서 국가명과 도시명 추출하여 매칭
                  const { country, city } = extractCountryAndCity(destStr);
                  
                  // 국가명 매칭
                  const countryMatches = targetCountries.some(targetCountry => {
                    const targetCountryUpper = targetCountry.toUpperCase();
                    return country.includes(targetCountryUpper) || 
                           targetCountryUpper.includes(country) ||
                           destUpper.includes(targetCountryUpper);
                  });
                  
                  // 도시명 매칭
                  const cityMatches = targetCities.length > 0 && targetCities.some(targetCity => {
                    const targetCityUpper = targetCity.toUpperCase();
                    return city.includes(targetCityUpper) || 
                           targetCityUpper.includes(city) ||
                           destUpper.includes(targetCityUpper);
                  });
                  
                  return countryMatches || cityMatches;
                });
                
                if (matches) return true;
              }
            } catch (e) {
              // 파싱 실패 시 무시
            }
          }
          
          // 2. itineraryPattern에서 country 필드 확인 (fallback)
          if (product.itineraryPattern) {
            try {
              const pattern = typeof product.itineraryPattern === 'string' 
                ? JSON.parse(product.itineraryPattern) 
                : product.itineraryPattern;
              
              if (Array.isArray(pattern)) {
                const matches = pattern.some((item: any) => {
                  if (typeof item === 'object' && item.country) {
                    const country = item.country.toString().toUpperCase();
                    return targetCountries.some(r => country.includes(r) || r.includes(country));
                  }
                  return false;
                });
                if (matches) return true;
              }
            } catch (e) {
              // 파싱 실패 시 무시
            }
          }
          
          return false;
        });
      }
    } else if (region === 'other') {
      // "기타" 지역: 위에 정의된 지역에 해당하지 않는 모든 상품
      const definedRegions = [
        'JP', 'Japan', '일본',
        'TH', 'Thailand', '태국', 'VN', 'Vietnam', '베트남', 'MY', 'Malaysia', '말레이시아',
        'SG', 'Singapore', '싱가포르',
        'ES', 'Spain', '스페인', 'FR', 'France', '프랑스', 'IT', 'Italy', '이탈리아',
        'GR', 'Greece', '그리스', 'TR', 'Turkey', '터키',
        'US', 'USA', '미국', 'Alaska', '알래스카', 'United States', 'United States of America', 'America'
      ];
      
      allProducts = allProducts.filter(product => {
        // MallProductContent.layout.destination 확인 - 캐싱된 파싱 결과 사용
        let hasDefinedRegion = false;
        const layout = getParsedLayout(product);
        if (layout && typeof layout === 'object' && layout.destination && Array.isArray(layout.destination)) {
          const destinations = layout.destination.map((d: any) => d.toString().toUpperCase());
          hasDefinedRegion = destinations.some(dest =>
            definedRegions.some(r => dest.includes(r.toUpperCase()) || r.toUpperCase().includes(dest))
          );
        }
        
        // itineraryPattern 확인 - 캐싱된 파싱 결과 사용
        const pattern = getParsedItinerary(product);
        if (!pattern || !Array.isArray(pattern)) {
          return !hasDefinedRegion; // destination에도 없으면 기타
        }
        
        // itineraryPattern의 모든 country가 정의된 지역에 포함되지 않는 경우
        const countries = pattern
          .map((item: any) => {
            if (typeof item === 'object' && item.country) {
              return item.country.toString().toUpperCase();
            }
            return null;
          })
          .filter((c: string | null) => c !== null);
        
        // 모든 country가 정의된 지역에 포함되지 않으면 기타
        const hasDefinedInPattern = countries.some((country: string) =>
          definedRegions.some(r => country.includes(r.toUpperCase()) || r.toUpperCase().includes(country))
        );
        
        return !hasDefinedRegion && !hasDefinedInPattern;
      });
    }

    // 키워드 필터링 (recommendedKeywords와 destination에서 검색)
    // 키워드가 있으면 지역 필터링 결과와 OR 조건으로 처리 (더 유연한 검색)
    if (keyword && keyword.trim()) {
      const keywordLower = keyword.trim().toLowerCase();
      // 원본 상품 데이터에서 키워드 검색 (지역 필터링 전 데이터)
      const keywordMatches = originalProducts.filter(product => {
        // 1. 크루즈 라인 검색
        if (product.cruiseLine) {
          const cruiseLineLower = product.cruiseLine.toLowerCase();
          // 한글명 추출 (괄호 앞 부분)
          const koreanName = cruiseLineLower.split('(')[0].trim();
          // 영문명 추출 (괄호 안 부분)
          const englishMatch = cruiseLineLower.match(/\(([^)]+)\)/);
          const englishName = englishMatch ? englishMatch[1].trim() : '';
          
          if (koreanName.includes(keywordLower) || keywordLower.includes(koreanName) ||
              (englishName && (englishName.includes(keywordLower) || keywordLower.includes(englishName))) ||
              cruiseLineLower.includes(keywordLower) || keywordLower.includes(cruiseLineLower)) {
            if (process.env.NODE_ENV === 'development' && product.productCode === 'POP-NEW-001') {
              console.log('[DEBUG KEYWORD] POP-NEW-001 MATCHED in cruiseLine:', cruiseLineLower);
            }
            return true;
          }
        }
        
        // 2. 선박명 검색
        if (product.shipName) {
          const shipNameLower = product.shipName.toLowerCase();
          // 한글명 추출 (괄호 앞 부분)
          const koreanName = shipNameLower.split('(')[0].trim();
          // 영문명 추출 (괄호 안 부분)
          const englishMatch = shipNameLower.match(/\(([^)]+)\)/);
          const englishName = englishMatch ? englishMatch[1].trim() : '';
          
          if (koreanName.includes(keywordLower) || keywordLower.includes(koreanName) ||
              (englishName && (englishName.includes(keywordLower) || keywordLower.includes(englishName))) ||
              shipNameLower.includes(keywordLower) || keywordLower.includes(shipNameLower)) {
            if (process.env.NODE_ENV === 'development' && product.productCode === 'POP-NEW-001') {
              console.log('[DEBUG KEYWORD] POP-NEW-001 MATCHED in shipName:', shipNameLower);
            }
            return true;
          }
        }
        
        // 3. MallProductContent.layout.recommendedKeywords 확인
        if (product.MallProductContent?.layout) {
          try {
            const layout = typeof product.MallProductContent.layout === 'string' 
              ? JSON.parse(product.MallProductContent.layout) 
              : product.MallProductContent.layout;
            
            if (layout && typeof layout === 'object') {
              // recommendedKeywords 검색
              if (layout.recommendedKeywords) {
                let keywords: string[] = [];
                if (Array.isArray(layout.recommendedKeywords)) {
                  keywords = layout.recommendedKeywords;
                } else if (typeof layout.recommendedKeywords === 'string') {
                  try {
                    keywords = JSON.parse(layout.recommendedKeywords);
                  } catch (e) {
                    keywords = [layout.recommendedKeywords];
                  }
                }
                
                // 키워드 매칭 (부분 일치)
                const keywordMatches = keywords.some((kw: string) => {
                  if (!kw) return false;
                  const kwStr = kw.toString().toLowerCase();
                  return kwStr.includes(keywordLower) || keywordLower.includes(kwStr);
                });
                
                if (keywordMatches) return true;
              }
              
              // destination에서 도시명 검색 (예: "미국 - 시애틀"에서 "시애틀" 검색)
              if (layout.destination) {
                // destination이 배열이 아닐 수도 있으므로 유연하게 처리
                let destinations: any[] = [];
                
                if (Array.isArray(layout.destination)) {
                  destinations = layout.destination;
                } else if (typeof layout.destination === 'string') {
                  try {
                    const parsed = JSON.parse(layout.destination);
                    if (Array.isArray(parsed)) {
                      destinations = parsed;
                    } else {
                      destinations = [layout.destination];
                    }
                  } catch {
                    destinations = [layout.destination];
                  }
                } else {
                  destinations = [layout.destination];
                }
                
                const destinationMatches = destinations.some((dest: any) => {
                  const destStr = dest.toString();
                  const destLower = destStr.toLowerCase();
                  
                  // 디버깅: POP-NEW-001 상품 확인 (개발 환경에서만)
                  const isDebugProduct = process.env.NODE_ENV === 'development' && product.productCode === 'POP-NEW-001';
                  if (isDebugProduct) {
                    console.log('[DEBUG KEYWORD] POP-NEW-001 destination:', destStr, 'keyword:', keywordLower);
                  }
                  
                  // 전체 문자열에서 키워드 검색
                  if (destLower.includes(keywordLower)) {
                    if (isDebugProduct) {
                      console.log('[DEBUG KEYWORD] POP-NEW-001 matched in full string');
                    }
                    return true;
                  }
                  
                  // "국가 - 도시" 형식에서 도시명 추출하여 검색
                  if (destLower.includes(' - ')) {
                    const cityPart = destLower.split(' - ')[1]?.trim() || '';
                    // 도시명 한글 부분 검색 (예: "시애틀 (Seattle)" -> "시애틀")
                    const cityKorean = cityPart.split('(')[0].trim();
                    if (cityKorean.includes(keywordLower) || keywordLower.includes(cityKorean)) {
                      if (isDebugProduct) {
                        console.log('[DEBUG KEYWORD] POP-NEW-001 matched in cityKorean:', cityKorean);
                      }
                      return true;
                    }
                    // 괄호 안의 영문 도시명도 검색 (예: "시애틀 (Seattle)")
                    const cityInParens = cityPart.match(/\(([^)]+)\)/)?.[1]?.toLowerCase() || '';
                    if (cityInParens && (cityInParens.includes(keywordLower) || keywordLower.includes(cityInParens))) {
                      if (isDebugProduct) {
                        console.log('[DEBUG KEYWORD] POP-NEW-001 matched in cityInParens:', cityInParens);
                      }
                      return true;
                    }
                    // 국가명도 검색 (예: "미국 - 시애틀"에서 "미국" 검색)
                    const countryPart = destLower.split(' - ')[0]?.trim() || '';
                    const countryKorean = countryPart.split('(')[0].trim();
                    if (countryKorean.includes(keywordLower) || keywordLower.includes(countryKorean)) {
                      if (isDebugProduct) {
                        console.log('[DEBUG KEYWORD] POP-NEW-001 matched in countryKorean:', countryKorean);
                      }
                      return true;
                    }
                  } else {
                    // "국가" 형식만 있는 경우 (예: "미국")
                    const countryKorean = destLower.split('(')[0].trim();
                    if (countryKorean.includes(keywordLower) || keywordLower.includes(countryKorean)) {
                      if (isDebugProduct) {
                        console.log('[DEBUG KEYWORD] POP-NEW-001 matched in country only:', countryKorean);
                      }
                      return true;
                    }
                  }
                  
                  return false;
                });
                
                if (destinationMatches) {
                  if (process.env.NODE_ENV === 'development' && product.productCode === 'POP-NEW-001') {
                    console.log('[DEBUG KEYWORD] POP-NEW-001 MATCHED in keyword search');
                  }
                  return true;
                }
              }
            }
          } catch (e) {
            // 파싱 실패 시 무시
          }
        }
        
        // 4. fallback: product.recommendedKeywords 필드 확인
        if (product.recommendedKeywords) {
          let keywords: string[] = [];
          if (Array.isArray(product.recommendedKeywords)) {
            keywords = product.recommendedKeywords;
          } else if (typeof product.recommendedKeywords === 'string') {
            try {
              keywords = JSON.parse(product.recommendedKeywords);
            } catch (e) {
              keywords = [product.recommendedKeywords];
            }
          }
          
          const matches = keywords.some((kw: string) => {
            if (!kw) return false;
            const kwStr = kw.toString().toLowerCase();
            return kwStr.includes(keywordLower) || keywordLower.includes(kwStr);
          });
          
          if (matches) return true;
        }
        
        return false;
      });
      
      // 키워드 검색 결과가 있으면 지역 필터링 결과와 병합 (OR 조건)
      if (keywordMatches.length > 0) {
        // 지역 필터링이 이미 실행된 경우, 키워드 검색 결과와 병합
        const existingProductCodes = new Set(allProducts.map(p => p.productCode));
        keywordMatches.forEach(product => {
          if (!existingProductCodes.has(product.productCode)) {
            allProducts.push(product);
          }
        });
      }
    }

    // 크루즈 라인 및 크루즈선 이름 필터링 (JavaScript에서 처리)
    // 한국어 이름 우선 매칭, 부분 일치 지원
    if (cruiseLine && cruiseLine !== 'all') {
      const cruiseLineSearch = cruiseLine.trim(); // 한국어 이름으로 검색
      allProducts = allProducts.filter(product => {
        const productCruiseLine = product.cruiseLine || '';
        
        // 한국어 이름 추출 (괄호 앞 부분)
        const koreanName = productCruiseLine.split('(')[0].trim();
        
        // 한국어 이름으로 직접 매칭 (대소문자 무시)
        if (koreanName.toLowerCase().includes(cruiseLineSearch.toLowerCase()) || 
            cruiseLineSearch.toLowerCase().includes(koreanName.toLowerCase())) {
          return true;
        }
        
        // 전체 문자열로도 매칭 (한/영 혼합 저장된 경우 대비)
        if (productCruiseLine.toLowerCase().includes(cruiseLineSearch.toLowerCase()) ||
            cruiseLineSearch.toLowerCase().includes(productCruiseLine.toLowerCase())) {
          return true;
        }
        
        return false;
      });
    }

    if (shipName && shipName !== 'all') {
      const shipNameSearch = shipName.trim(); // 한국어 이름으로 검색
      allProducts = allProducts.filter(product => {
        const productShipName = product.shipName || '';
        
        // 한국어 이름 추출 (괄호 앞 부분)
        const koreanName = productShipName.split('(')[0].trim();
        
        // 한국어 이름으로 직접 매칭 (대소문자 무시)
        if (koreanName.toLowerCase().includes(shipNameSearch.toLowerCase()) ||
            shipNameSearch.toLowerCase().includes(koreanName.toLowerCase())) {
          return true;
        }
        
        // 전체 문자열로도 매칭 (한/영 혼합 저장된 경우 대비)
        if (productShipName.toLowerCase().includes(shipNameSearch.toLowerCase()) ||
            shipNameSearch.toLowerCase().includes(productShipName.toLowerCase())) {
          return true;
        }
        
        return false;
      });
    }

    if (isThemeRequest) {
      const normalizedValue = themeValue.toLowerCase();
      const classificationFlagMap: Record<string, string> = {
        popular: 'isPopular',
        recommended: 'isRecommended',
        premium: 'isPremium',
        genie: 'isGeniePack',
        domestic: 'isDomestic',
        japan: 'isJapan',
        budget: 'isBudget',
      };

      allProducts = allProducts.filter((product) => {
        switch (themeType) {
          case 'classification': {
            const flagKey = classificationFlagMap[normalizedValue];
            if (!flagKey) return false;
            return Boolean((product as any)[flagKey]);
          }
          case 'cruiseLine': {
            const productCruiseLine = (product.cruiseLine || '').toLowerCase();
            return productCruiseLine.includes(normalizedValue);
          }
          case 'category': {
            const category = (product.category || '').toString().toLowerCase();
            return category.includes(normalizedValue);
          }
          case 'tag': {
            const sanitizedValue = normalizedValue.replace(/^#/, '');
            let tags: string[] = [];

            if (Array.isArray(product.tags)) {
              tags = product.tags.map(tag => (tag ?? '').toString());
            } else if (typeof product.tags === 'string' && product.tags.trim()) {
              try {
                const parsed = JSON.parse(product.tags);
                if (Array.isArray(parsed)) {
                  tags = parsed.map(tag => (tag ?? '').toString());
                } else if (parsed) {
                  tags = [parsed.toString()];
                }
              } catch (error) {
                tags = product.tags.split(',').map(tag => tag.trim());
              }
            }

            return tags.some(tag => {
              if (!tag) return false;
              const tagValue = tag.toLowerCase().replace(/^#/, '');
              return tagValue.includes(sanitizedValue) || sanitizedValue.includes(tagValue);
            });
          }
          default:
            return true;
        }
      });
    }
 
    // 각 상품에 destination 및 recommendedKeywords 추가
    const productsWithDestination = allProducts.map(product => {
      let destination: string[] | null = null;
      let recommendedKeywords: string[] | null = null;
      
      // MallProductContent.layout에서 destination과 recommendedKeywords 추출
      if (product.MallProductContent?.layout) {
        try {
          const layout = typeof product.MallProductContent.layout === 'string' 
            ? JSON.parse(product.MallProductContent.layout) 
            : product.MallProductContent.layout;
          
          if (layout && typeof layout === 'object') {
            // destination 추출
            if (layout.destination && Array.isArray(layout.destination)) {
              destination = layout.destination;
            }
            
            // recommendedKeywords 추출
            if (layout.recommendedKeywords && Array.isArray(layout.recommendedKeywords)) {
              recommendedKeywords = layout.recommendedKeywords;
            } else if (layout.recommendedKeywords && typeof layout.recommendedKeywords === 'string') {
              try {
                recommendedKeywords = JSON.parse(layout.recommendedKeywords);
              } catch (e) {
                recommendedKeywords = [];
              }
            }
          }
        } catch (e) {
          console.error('Failed to parse layout:', e);
        }
      }
      
      // itineraryPattern에서 destination 추출 (country 필드에서 추출)
      if (!destination && product.itineraryPattern) {
        try {
          const pattern = typeof product.itineraryPattern === 'string' 
            ? JSON.parse(product.itineraryPattern) 
            : product.itineraryPattern;
          
          if (Array.isArray(pattern)) {
            // 각 일정에서 country 필드 추출 (중복 제거)
            const countries = new Set<string>();
            const countryNames: Record<string, string> = {
              'JP': '일본', 'KR': '한국', 'TH': '태국', 'VN': '베트남', 'MY': '말레이시아',
              'SG': '싱가포르', 'ES': '스페인', 'FR': '프랑스', 'IT': '이탈리아', 'GR': '그리스',
              'TR': '터키', 'US': '미국', 'CN': '중국', 'TW': '대만', 'HK': '홍콩',
              'PH': '필리핀', 'ID': '인도네시아', 'NO': '노르웨이', 'HR': '크로아티아', 'CA': '캐나다'
            };
            
            pattern.forEach((day: any) => {
              if (day && typeof day === 'object' && day.country && day.country !== 'KR') {
                const countryCode = day.country.toString().toUpperCase();
                const countryName = countryNames[countryCode] || countryCode;
                countries.add(countryName);
              }
            });
            
            if (countries.size > 0) {
              destination = Array.from(countries);
            }
          } else if (pattern && typeof pattern === 'object' && pattern.destination && Array.isArray(pattern.destination)) {
            // 기존 방식도 지원 (하위 호환성)
            destination = pattern.destination;
          }
        } catch (e) {
          console.error('[Public Products API] itineraryPattern 파싱 실패:', e);
        }
      }
      
      return {
        ...product,
        destination, // destination 필드 추가
        recommendedKeywords, // recommendedKeywords 필드 추가
        thumbnail: product.MallProductContent?.thumbnail || null, // 썸네일 추가
        mallProductContent: product.MallProductContent || null, // layout 포함
        MallProductContent: undefined, // 응답에서 제거
        // 추가 필드들
        departurePort: product.MallProductContent?.layout 
          ? (() => {
              try {
                const layout = typeof product.MallProductContent.layout === 'string' 
                  ? JSON.parse(product.MallProductContent.layout) 
                  : product.MallProductContent.layout;
                return layout?.departurePort || null;
              } catch {
                return null;
              }
            })()
          : null,
        duration: product.nights || null, // nights를 duration으로 매핑
        region: destination && destination.length > 0 ? destination[0] : null, // 첫 번째 destination을 region으로
      };
    });
 
    if (isThemeRequest) {
      let themedProducts = productsWithDestination;
      if (themeLimit > 0) {
        themedProducts = themedProducts.slice(0, themeLimit);
      }

      return NextResponse.json({
        ok: true,
        products: themedProducts,
      });
    }

    // 페이지네이션
    const total = productsWithDestination.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProducts = productsWithDestination.slice(startIndex, endIndex);

    // limit=1000인 경우 (연관검색어 생성용) 전체 상품 반환
    const responseProducts = isThemeRequest || (limit >= 1000) ? productsWithDestination : paginatedProducts;
    
    // limit=1000인 경우 recommendedKeywords 포함 여부 로그 (상세)
    if (limit >= 1000) {
      const productsWithKeywords = responseProducts.filter((p: any) => {
        return p.recommendedKeywords && (
          (Array.isArray(p.recommendedKeywords) && p.recommendedKeywords.length > 0) ||
          (typeof p.recommendedKeywords === 'string' && p.recommendedKeywords.trim())
        );
      });
      
      // 각 상품의 recommendedKeywords 추출 과정 로그
      const detailedLog = responseProducts.slice(0, 5).map((p: any) => {
        let extractedKeywords: string[] | null = null;
        
        // MallProductContent.layout에서 추출 시도
        if (p.mallProductContent?.layout) {
          try {
            const layout = typeof p.mallProductContent.layout === 'string' 
              ? JSON.parse(p.mallProductContent.layout) 
              : p.mallProductContent.layout;
            if (layout?.recommendedKeywords) {
              if (Array.isArray(layout.recommendedKeywords)) {
                extractedKeywords = layout.recommendedKeywords;
              } else if (typeof layout.recommendedKeywords === 'string') {
                try {
                  extractedKeywords = JSON.parse(layout.recommendedKeywords);
                } catch {
                  extractedKeywords = [layout.recommendedKeywords];
                }
              }
            }
          } catch (e) {
            // 파싱 실패
          }
        }
        
        return {
          productCode: p.productCode,
          hasMallContent: !!p.mallProductContent,
          hasLayout: !!p.mallProductContent?.layout,
          layoutRecommendedKeywords: extractedKeywords,
          productRecommendedKeywords: p.recommendedKeywords,
          finalRecommendedKeywords: p.recommendedKeywords || extractedKeywords
        };
      });
      
      console.log('[Public Products API] Products with recommendedKeywords (detailed):', {
        total: responseProducts.length,
        withKeywords: productsWithKeywords.length,
        sampleProducts: detailedLog,
        allKeywords: productsWithKeywords.flatMap((p: any) => {
          const keywords = Array.isArray(p.recommendedKeywords) 
            ? p.recommendedKeywords 
            : (typeof p.recommendedKeywords === 'string' ? [p.recommendedKeywords] : []);
          return keywords.map((kw: string) => ({ productCode: p.productCode, keyword: kw }));
        })
      });
    }
    
    return NextResponse.json({
      ok: true,
      products: responseProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('[Public Products API] GET error:', error);
    console.error('[Public Products API] Error message:', error?.message);
    console.error('[Public Products API] Error stack:', error?.stack);
    console.error('[Public Products API] Error name:', error?.name);
    console.error('[Public Products API] Error code:', error?.code);
    return NextResponse.json(
      {
        ok: false,
        error: '상품 목록을 불러올 수 없습니다.',
        message: error?.message || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? {
          message: error?.message,
          name: error?.name,
          code: error?.code,
          stack: error?.stack,
        } : undefined
      },
      { status: 500 }
    );
  }
}






