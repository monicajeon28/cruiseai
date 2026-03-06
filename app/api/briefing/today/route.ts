export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import { normalizeItineraryPattern, extractCountryCodesFromItineraryPattern } from '@/lib/utils/itineraryPattern';
import { getKoreanCruiseLineName, getKoreanShipName, getKoreanNameFromFullString } from '@/lib/utils/cruiseNames';
import { Redis as UpstashRedis } from '@upstash/redis';

/**
 * GET /api/briefing/today
 * 오늘의 데일리 브리핑 정보를 반환합니다.
 */
export async function GET(_req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      logger.log('[Briefing API] 사용자 인증 실패: 세션이 없음');
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    logger.log('[Briefing API] 사용자 인증 성공:', { userId: user.id });

    // 사용자의 전체 여행 수 + 테스트 모드 여부 병렬 조회
    const [tripCount, userMeta] = await Promise.all([
      prisma.userTrip.count({ where: { userId: user.id } }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { customerStatus: true },
      }),
    ]);
    const isTestUser = userMeta?.customerStatus === 'test' || userMeta?.customerStatus === 'test-locked';

    // 최신 여행(온보딩 정보) 조회 - createdAt desc로 최신 온보딩 정보 가져오기
    logger.log('[Briefing API] 사용자 UserTrip 조회 시작:', { userId: user.id });
    
    const allTrips = await prisma.userTrip.findMany({
      where: {
        userId: user.id,
      },
      orderBy: { createdAt: 'desc' },
      select: { 
        id: true, 
        cruiseName: true,
        startDate: true, 
        endDate: true,
        nights: true,
        days: true,
        destination: true,
        createdAt: true,
        productId: true,
        CruiseProduct: {
          select: {
            id: true,
            productCode: true,
            cruiseLine: true,
            shipName: true,
            itineraryPattern: true,
          },
        },
      },
    });

    logger.log('[Briefing API] 사용자 Trip 목록:', { userId: user.id, tripCount: allTrips.length });

    // 오늘 활성 여행 우선, 다음 예정 여행, 최신 여행 순으로 선택
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const activeTrip =
      allTrips.find((t: (typeof allTrips)[number]) => {
        if (!t.startDate) return false;
        const s = new Date(t.startDate);
        s.setHours(0, 0, 0, 0);
        const e = t.endDate ? new Date(t.endDate) : null;
        if (e) e.setHours(23, 59, 59, 999);
        return s <= todayMidnight && (!e || todayMidnight <= e);
      }) ||
      allTrips.find((t: (typeof allTrips)[number]) => {
        if (!t.startDate) return false;
        const s = new Date(t.startDate);
        s.setHours(0, 0, 0, 0);
        return s > todayMidnight;
      }) ||
      allTrips[0] ||
      null;

    logger.log('[Briefing API] 사용자 Trip 조회 결과:', { userId: user.id, found: !!activeTrip });

    if (!activeTrip) {
      logger.warn('[Briefing API] Trip을 찾을 수 없음:', { userId: user.id });
      return NextResponse.json({
        ok: true,
        hasTrip: false,
        message: 'No active trip found',
      });
    }

    // 오늘 날짜
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 여행 시작일부터 현재까지의 일수 계산 (Day 1, Day 2...)
    const startDate = activeTrip.startDate ? new Date(activeTrip.startDate) : today;
    startDate.setHours(0, 0, 0, 0);
    
    // 여행 시작 전이면 Day 0으로 설정 (출발 전 브리핑 표시)
    let dayNumber = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (dayNumber < 1) {
      dayNumber = 0; // 출발 전
    }

    // 오늘과 내일의 Itinerary 조회
    // 여행 시작 전이면 첫 번째 일정(출발일)을 표시
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let todayItinerary: Awaited<ReturnType<typeof prisma.itinerary.findFirst>>;
    let tomorrowItinerary: Awaited<ReturnType<typeof prisma.itinerary.findFirst>>;
    
    if (dayNumber === 0) {
      // 출발 전: 첫 번째 일정(출발일)을 오늘 일정으로 표시
      todayItinerary = await prisma.itinerary.findFirst({
        where: {
          userTripId: activeTrip.id,
          day: 1, // 첫 번째 일정
        },
        orderBy: { date: 'asc' },
      });
      
      // 내일 일정은 두 번째 일정
      tomorrowItinerary = await prisma.itinerary.findFirst({
        where: {
          userTripId: activeTrip.id,
          day: 2,
        },
        orderBy: { date: 'asc' },
      });
    } else {
      // 여행 중: 실제 오늘/내일 날짜의 일정 조회
      [todayItinerary, tomorrowItinerary] = await Promise.all([
        prisma.itinerary.findFirst({
          where: {
            userTripId: activeTrip.id, // UserTrip의 id 사용
            date: {
              gte: today,
              lt: tomorrow,
            },
          },
          orderBy: { date: 'asc' },
        }),
        prisma.itinerary.findFirst({
          where: {
            userTripId: activeTrip.id, // UserTrip의 id 사용
            date: {
              gte: tomorrow,
              lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000),
            },
          },
          orderBy: { date: 'asc' },
        }),
      ]);
    }

    // D-Day 계산 (출발일 기준 또는 종료일 기준)
    let dday = 0;
    let ddayType: 'departure' | 'return' = 'departure';
    
    // today와 startDate를 시간을 제거한 날짜로 정규화
    const todayNormalized = new Date(today);
    todayNormalized.setHours(0, 0, 0, 0);
    const startDateNormalized = new Date(startDate);
    startDateNormalized.setHours(0, 0, 0, 0);
    
    logger.log('[Briefing API] D-day 계산 시작:', {
      today: todayNormalized.toISOString(),
      startDate: startDateNormalized.toISOString(),
      endDate: activeTrip.endDate ? new Date(activeTrip.endDate).toISOString() : null,
      todayBeforeStart: todayNormalized < startDateNormalized,
      todayAfterEnd: activeTrip.endDate ? todayNormalized > new Date(activeTrip.endDate) : false,
    });
    
    if (todayNormalized < startDateNormalized) {
      // 여행 시작 전: 출발일까지 D-day
      dday = Math.ceil((startDateNormalized.getTime() - todayNormalized.getTime()) / (1000 * 60 * 60 * 24));
      ddayType = 'departure';
      logger.log('[Briefing API] D-day 계산 결과 (출발일 전):', { dday, ddayType });
    } else if (activeTrip.endDate) {
      const endDateNormalized = new Date(activeTrip.endDate);
      endDateNormalized.setHours(0, 0, 0, 0);
      
      if (todayNormalized <= endDateNormalized) {
        // 여행 중: 종료일까지 D-day 계산 (종료일 하루 전과 종료일 체크)
        const daysUntilEnd = Math.ceil((endDateNormalized.getTime() - todayNormalized.getTime()) / (1000 * 60 * 60 * 24));
        
        // 종료일 하루 전 (D-1) 또는 종료일 (D-0)인 경우 return 타입으로 설정
        if (daysUntilEnd === 1) {
          dday = 1;
          ddayType = 'return';
          logger.log('[Briefing API] D-day 계산 결과 (종료일 하루 전):', { dday, ddayType, daysUntilEnd, today: todayNormalized.toISOString(), endDate: endDateNormalized.toISOString() });
        } else if (daysUntilEnd === 0) {
          dday = 0;
          ddayType = 'return';
          logger.log('[Briefing API] D-day 계산 결과 (종료일):', { dday, ddayType, daysUntilEnd, today: todayNormalized.toISOString(), endDate: endDateNormalized.toISOString() });
        } else {
          // 그 외에는 출발일 기준으로 계산
          dday = Math.floor((todayNormalized.getTime() - startDateNormalized.getTime()) / (1000 * 60 * 60 * 24));
          ddayType = 'departure';
          logger.log('[Briefing API] D-day 계산 결과 (여행 중, 출발일 기준):', { dday, ddayType, daysUntilEnd });
        }
      } else {
        // 여행 종료 후: 출발일 기준으로 음수 D-day
        dday = Math.floor((todayNormalized.getTime() - startDateNormalized.getTime()) / (1000 * 60 * 60 * 24));
        ddayType = 'departure';
        logger.log('[Briefing API] D-day 계산 결과 (여행 종료 후, 출발일 기준):', { dday, ddayType });
      }
    } else {
      // endDate가 없으면 출발일 기준으로만 계산
      dday = Math.floor((todayNormalized.getTime() - startDateNormalized.getTime()) / (1000 * 60 * 60 * 24));
      ddayType = 'departure';
      logger.log('[Briefing API] D-day 계산 결과 (endDate 없음, 출발일 기준):', { dday, ddayType });
    }

    // 크루즈명 한국어 변환
    let koreanCruiseName = activeTrip.cruiseName;
    if (activeTrip.CruiseProduct) {
      const cruiseLine = activeTrip.CruiseProduct.cruiseLine || '';
      const shipName = activeTrip.CruiseProduct.shipName || '';
      const koreanCruiseLine = getKoreanCruiseLineName(cruiseLine);
      const koreanShipName = getKoreanShipName(cruiseLine, shipName);
      koreanCruiseName = `${koreanCruiseLine} ${koreanShipName}`;
    } else if (activeTrip.cruiseName) {
      // CruiseProduct 없으면 cruiseName 전체 문자열로 한국어 변환 시도
      koreanCruiseName = getKoreanNameFromFullString(activeTrip.cruiseName);
    }

    logger.log('[Briefing API] 크루즈명 변환:', {
      original: activeTrip.cruiseName,
      korean: koreanCruiseName,
    });

    // 국가명 매핑 (국가 코드 -> 한글 국가명) - 먼저 정의
    const COUNTRY_NAMES: Record<string, string> = {
      'KR': '한국', 'JP': '일본', 'CN': '중국', 'TW': '대만', 'HK': '홍콩', 'MO': '마카오',
      'US': '미국', 'CA': '캐나다', 'MX': '멕시코', 'BR': '브라질', 'AR': '아르헨티나',
      'GB': '영국', 'FR': '프랑스', 'DE': '독일', 'IT': '이탈리아', 'ES': '스페인', 'GR': '그리스',
      'HR': '크로아티아', 'ME': '몬테네그로', 'MT': '몰타', 'PT': '포르투갈',
      'NO': '노르웨이', 'IS': '아이슬란드', 'FI': '핀란드', 'SE': '스웨덴',
      'EE': '에스토니아', 'LV': '라트비아', 'NL': '네덜란드', 'BE': '벨기에', 'DK': '덴마크',
      'TH': '태국', 'VN': '베트남', 'PH': '필리핀', 'SG': '싱가포르', 'MY': '말레이시아', 'ID': '인도네시아',
      'AU': '호주', 'NZ': '뉴질랜드', 'RU': '러시아', 'AE': 'UAE', 'TR': '터키',
      'BS': '바하마', 'BM': '버뮤다',
    };

    // 국가명 -> 국가 코드 역매핑 (더 많은 변형 지원)
    const COUNTRY_NAME_TO_CODE: Record<string, string> = {
      // 한국어 국가명
      '대한민국': 'KR', '한국': 'KR',
      '일본': 'JP',
      '중국': 'CN',
      '대만': 'TW', '타이완': 'TW',
      '홍콩': 'HK',
      '필리핀': 'PH',
      '미국': 'US',
      '캐나다': 'CA',
      '멕시코': 'MX',
      '영국': 'GB',
      '프랑스': 'FR',
      '독일': 'DE',
      '이탈리아': 'IT',
      '스페인': 'ES',
      '그리스': 'GR',
      '호주': 'AU', '오스트레일리아': 'AU',
      '뉴질랜드': 'NZ',
      '태국': 'TH',
      '베트남': 'VN',
      '싱가포르': 'SG',
      '인도네시아': 'ID',
      '말레이시아': 'MY',
      '마카오': 'MO',
      '브라질': 'BR',
      '아르헨티나': 'AR',
      '러시아': 'RU',
      'UAE': 'AE',
      '터키': 'TR',
      '크로아티아': 'HR', '몬테네그로': 'ME', '몰타': 'MT', '포르투갈': 'PT',
      '노르웨이': 'NO', '아이슬란드': 'IS', '핀란드': 'FI', '스웨덴': 'SE',
      '에스토니아': 'EE', '라트비아': 'LV', '네덜란드': 'NL', '벨기에': 'BE', '덴마크': 'DK',
      '바하마': 'BS', '버뮤다': 'BM',
      // 영어 국가명
      'South Korea': 'KR', 'Korea': 'KR',
      'Japan': 'JP',
      'China': 'CN',
      'Taiwan': 'TW',
      'Hong Kong': 'HK',
      'Philippines': 'PH',
      'United States': 'US', 'USA': 'US',
      'Canada': 'CA',
      'Mexico': 'MX',
      'United Kingdom': 'GB', 'UK': 'GB',
      'France': 'FR',
      'Germany': 'DE',
      'Italy': 'IT',
      'Spain': 'ES',
      'Greece': 'GR',
      'Croatia': 'HR', 'Montenegro': 'ME', 'Malta': 'MT', 'Portugal': 'PT',
      'Norway': 'NO', 'Iceland': 'IS', 'Finland': 'FI', 'Sweden': 'SE',
      'Estonia': 'EE', 'Latvia': 'LV', 'Netherlands': 'NL', 'Belgium': 'BE', 'Denmark': 'DK',
      'Bahamas': 'BS', 'Bermuda': 'BM',
      'Australia': 'AU',
      'New Zealand': 'NZ',
      'Thailand': 'TH',
      'Vietnam': 'VN',
      'Singapore': 'SG',
      'Indonesia': 'ID',
      'Malaysia': 'MY',
    };

    // 목적지 문자열에서 국가 코드 추출 함수
    const extractCountryCode = (dest: string): string | null => {
      if (!dest || typeof dest !== 'string') return null;

      // 1. 목적지 문자열에서 국가명 추출 (예: "중국 - 상하이" -> "중국")
      const destParts = dest.split(' - ')[0].split(',')[0].trim();

      // 2. 국가명으로 국가 코드 직접 찾기
      let countryCode = COUNTRY_NAME_TO_CODE[destParts];
      if (countryCode) return countryCode;

      // 3. 전체 문자열로도 시도
      countryCode = COUNTRY_NAME_TO_CODE[dest];
      if (countryCode) return countryCode;

      // 4. 부분 매칭 시도
      for (const [name, code] of Object.entries(COUNTRY_NAME_TO_CODE)) {
        if (destParts.includes(name) || name.includes(destParts) ||
            dest.includes(name) || name.includes(dest)) {
          return code;
        }
      }

      return null;
    };

    // 온보딩에서 선택한 국가들 (Trip.destination) 또는 Itinerary에서 국가 조회
    let uniqueCountries = new Map<string, string | null>();

    // 1순위: 온보딩에서 선택한 국가들 (Trip.destination)
    if (activeTrip.destination && typeof activeTrip.destination === 'object') {
      const destinations = activeTrip.destination as any;
      logger.log('[Briefing API] Trip.destination 확인:', { 
        destination: destinations,
        isArray: Array.isArray(destinations),
        type: typeof destinations
      });

      // destination이 배열인 경우 (예: ["일본 - 도쿄", "대만 - 타이페이"])
      if (Array.isArray(destinations)) {
        destinations.forEach((dest: string) => {
          logger.log('[Briefing API] destination 배열 항목 처리:', { dest });
          const countryCode = extractCountryCode(dest);
          logger.log('[Briefing API] 추출된 국가 코드:', { dest, countryCode });
          if (countryCode && countryCode !== 'KR' && !uniqueCountries.has(countryCode)) {
            // 지역명이 있는 경우 추출 (예: "일본 - 도쿄" -> "도쿄")
            const location = dest.includes(' - ') ? dest.split(' - ')[1]?.trim() : null;
            uniqueCountries.set(countryCode, location);
            logger.log('[Briefing API] 국가 추가:', { countryCode, location });
          }
        });
      } else if (typeof destinations === 'object') {
        // destination이 객체인 경우 처리
        Object.values(destinations).forEach((dest: any) => {
          if (typeof dest === 'string') {
            logger.log('[Briefing API] destination 객체 항목 처리:', { dest });
            const countryCode = extractCountryCode(dest);
            logger.log('[Briefing API] 추출된 국가 코드:', { dest, countryCode });
            if (countryCode && countryCode !== 'KR' && !uniqueCountries.has(countryCode)) {
              const location = dest.includes(' - ') ? dest.split(' - ')[1]?.trim() : null;
              uniqueCountries.set(countryCode, location);
              logger.log('[Briefing API] 국가 추가:', { countryCode, location });
            }
          }
        });
      }
    }
    
    // 2순위: Itinerary에서 국가 조회 (항상 시도 - 가장 확실한 방법)
    // destination에서 국가를 찾지 못했거나, 추가 국가 정보가 있을 수 있으므로 항상 확인
    logger.log('[Briefing API] Itinerary에서 국가 조회 시작 (userTripId:', activeTrip.id, ')');
    const allItineraries = await prisma.itinerary.findMany({
      where: {
        userTripId: activeTrip.id, // UserTrip의 id 사용
      },
      select: {
        id: true,
        day: true,
        date: true,
        type: true,
        country: true,
        location: true,
      },
      orderBy: {
        day: 'asc',
      },
    });

    logger.log('[Briefing API] All itineraries (전체 조회):', { 
      userTripId: activeTrip.id, 
      count: allItineraries.length,
      allItems: allItineraries.map((it: (typeof allItineraries)[number]) => ({
        id: it.id,
        day: it.day,
        date: it.date,
        type: it.type,
        country: it.country,
        location: it.location
      }))
    });

    // 국가가 있는 Itinerary만 필터링
    const itinerariesWithCountry = allItineraries.filter((it: (typeof allItineraries)[number]) => it.country && it.country !== 'KR');
    logger.log('[Briefing API] 국가가 있는 Itinerary:', {
      count: itinerariesWithCountry.length,
      items: itinerariesWithCountry.map((it: (typeof allItineraries)[number]) => ({
        day: it.day,
        type: it.type,
        country: it.country,
        location: it.location,
      }))
    });

    if (itinerariesWithCountry.length === 0) {
      logger.warn('[Briefing API] ⚠️ Itinerary에 국가 정보가 없습니다. itineraryPattern에서 추출을 시도합니다.');
    }

    itinerariesWithCountry.forEach((it: (typeof allItineraries)[number]) => {
      const countryCode = String(it.country).toUpperCase();
      if (!uniqueCountries.has(countryCode)) {
        uniqueCountries.set(countryCode, it.location);
        logger.log('[Briefing API] Itinerary에서 국가 추가:', { 
          day: it.day,
          type: it.type,
          country: countryCode, 
          location: it.location 
        });
      }
    });

    // 3순위: CruiseProduct의 itineraryPattern에서 국가 추출 (항상 시도 - 가장 확실한 방법)
    // destination이나 Itinerary에 국가가 없을 수 있으므로 항상 확인
    if (activeTrip.CruiseProduct?.itineraryPattern) {
      logger.log('[Briefing API] itineraryPattern에서 국가 추출 시도');
      try {
        const itineraryPattern = normalizeItineraryPattern(activeTrip.CruiseProduct.itineraryPattern);
        
        logger.log('[Briefing API] itineraryPattern:', { 
          isArray: Array.isArray(itineraryPattern),
          length: itineraryPattern.length,
          firstItem: itineraryPattern.length > 0 ? itineraryPattern[0] : null,
          allItems: itineraryPattern.map((item: any, idx: number) => ({
            index: idx,
            day: item.day,
            type: item.type,
            country: item.country,
            location: item.location,
          })),
        });
        
        // extractCountryCodesFromItineraryPattern 유틸리티 함수 사용
        const countryCodes = extractCountryCodesFromItineraryPattern(activeTrip.CruiseProduct.itineraryPattern);
        logger.log('[Briefing API] extractCountryCodesFromItineraryPattern 결과:', countryCodes);
        
        // 유틸리티 함수 결과를 uniqueCountries에 추가
        countryCodes.forEach((countryCode) => {
          if (countryCode && countryCode !== 'KR' && !uniqueCountries.has(countryCode)) {
            // 해당 국가의 location 찾기
            const dayWithCountry = itineraryPattern.find((day: any) => 
              day && typeof day === 'object' && String(day.country).toUpperCase() === countryCode
            );
            const location = dayWithCountry?.location || null;
            uniqueCountries.set(countryCode, location);
            logger.log('[Briefing API] itineraryPattern에서 국가 추가 (유틸리티 함수 사용):', { 
              countryCode, 
              location 
            });
          }
        });
        
        // 기존 로직도 유지 (fallback)
        itineraryPattern.forEach((day: any, index: number) => {
          if (day && typeof day === 'object' && day.country) {
            const countryCode = String(day.country).toUpperCase();
            if (countryCode && countryCode !== 'KR' && !uniqueCountries.has(countryCode)) {
              uniqueCountries.set(countryCode, day.location || null);
              logger.log('[Briefing API] itineraryPattern에서 국가 추가 (기존 로직):', { 
                index, 
                day: day.day,
                type: day.type,
                country: countryCode, 
                location: day.location 
              });
            }
          }
        });
      } catch (e) {
        logger.error('[Briefing API] itineraryPattern 파싱 실패:', e);
      }
    }

    // 4순위: uniqueCountries가 여전히 비어있으면 경고 로그
    if (uniqueCountries.size === 0) {
      logger.warn('[Briefing API] ⚠️ 모든 방법으로 국가를 찾지 못함. 날씨 정보를 생성할 수 없습니다.');
      logger.warn('[Briefing API] 디버깅 정보:', {
        userTripId: activeTrip.id, // UserTrip의 id 사용
        destination: activeTrip.destination,
        destinationType: typeof activeTrip.destination,
        hasCruiseProduct: !!activeTrip.CruiseProduct,
        hasItineraryPattern: !!activeTrip.CruiseProduct?.itineraryPattern,
        itineraryPatternType: typeof activeTrip.CruiseProduct?.itineraryPattern,
      });
    }

    logger.log('[Briefing API] Unique countries (from onboarding or itinerary):', Array.from(uniqueCountries.entries()));
    logger.log('[Briefing API] Unique countries size:', uniqueCountries.size);
    logger.log('[Briefing API] ActiveTrip.CruiseProduct:', {
      hasCruiseProduct: !!activeTrip.CruiseProduct,
      productId: activeTrip.CruiseProduct?.id,
      productCode: activeTrip.CruiseProduct?.productCode,
      hasItineraryPattern: !!activeTrip.CruiseProduct?.itineraryPattern,
      itineraryPatternType: typeof activeTrip.CruiseProduct?.itineraryPattern,
      itineraryPatternLength: Array.isArray(activeTrip.CruiseProduct?.itineraryPattern) 
        ? activeTrip.CruiseProduct.itineraryPattern.length 
        : 'not array',
      itineraryPatternRaw: activeTrip.CruiseProduct?.itineraryPattern 
        ? (typeof activeTrip.CruiseProduct.itineraryPattern === 'string' 
            ? activeTrip.CruiseProduct.itineraryPattern.substring(0, 500)
            : JSON.stringify(activeTrip.CruiseProduct.itineraryPattern).substring(0, 500))
        : null,
    });
    
    // uniqueCountries가 비어있으면 더 자세한 디버깅 정보 출력
    if (uniqueCountries.size === 0) {
      logger.error('[Briefing API] ❌ 국가 추출 실패 - 상세 디버깅 정보:');
      logger.error('[Briefing API] 1. Trip.destination:', {
        destination: activeTrip.destination,
        destinationType: typeof activeTrip.destination,
        isArray: Array.isArray(activeTrip.destination),
        isObject: typeof activeTrip.destination === 'object' && activeTrip.destination !== null,
      });
      logger.error('[Briefing API] 2. Itinerary 테이블:', {
        userTripId: activeTrip.id,
        itineraryCount: allItineraries.length,
        itinerariesWithCountry: itinerariesWithCountry.length,
        sampleItineraries: allItineraries.slice(0, 3).map((it: (typeof allItineraries)[number]) => ({
          day: it.day,
          type: it.type,
          country: it.country,
          location: it.location,
        })),
      });
      logger.error('[Briefing API] 3. CruiseProduct.itineraryPattern:', {
        hasCruiseProduct: !!activeTrip.CruiseProduct,
        hasItineraryPattern: !!activeTrip.CruiseProduct?.itineraryPattern,
        itineraryPatternType: typeof activeTrip.CruiseProduct?.itineraryPattern,
        itineraryPatternValue: activeTrip.CruiseProduct?.itineraryPattern
          ? (typeof activeTrip.CruiseProduct.itineraryPattern === 'string'
              ? activeTrip.CruiseProduct.itineraryPattern.substring(0, 1000)
              : JSON.stringify(activeTrip.CruiseProduct.itineraryPattern).substring(0, 1000))
          : null,
      });

      // extractCountryCodesFromItineraryPattern 직접 테스트
      if (activeTrip.CruiseProduct?.itineraryPattern) {
        try {
          const testCountryCodes = extractCountryCodesFromItineraryPattern(activeTrip.CruiseProduct.itineraryPattern);
          logger.error('[Briefing API] 4. extractCountryCodesFromItineraryPattern 테스트 결과:', testCountryCodes);
        } catch (e) {
          logger.error('[Briefing API] 4. extractCountryCodesFromItineraryPattern 테스트 실패:', e);
        }
      }
    }

    // 최후 fallback: 모든 추출 실패 시 todayItinerary.country 직접 사용
    if (uniqueCountries.size === 0) {
      const fallbackCountryRaw = todayItinerary?.country || tomorrowItinerary?.country;
      if (fallbackCountryRaw && fallbackCountryRaw !== 'KR') {
        // 2자리 ISO 코드이면 바로 사용, 한글이면 역매핑
        const code = fallbackCountryRaw.length === 2
          ? fallbackCountryRaw.toUpperCase()
          : COUNTRY_NAME_TO_CODE[fallbackCountryRaw] ?? null;
        if (code && code !== 'KR') {
          uniqueCountries.set(code, todayItinerary?.location || null);
          logger.log('[Briefing API] fallback: todayItinerary.country 사용:', { raw: fallbackCountryRaw, code });
        }
      }
    }

    // 국가별 시간대 매핑 (UTC 오프셋, 시:분 형식)
    const COUNTRY_TIMEZONES: Record<string, string> = {
      'KR': 'Asia/Seoul',      // UTC+9
      'JP': 'Asia/Tokyo',      // UTC+9
      'CN': 'Asia/Shanghai',   // UTC+8
      'TW': 'Asia/Taipei',     // UTC+8
      'HK': 'Asia/Hong_Kong',  // UTC+8
      'MO': 'Asia/Macau',      // UTC+8
      'US': 'America/New_York', // UTC-5 (동부 기준, 실제로는 지역별로 다름)
      'CA': 'America/Toronto', // UTC-5
      'MX': 'America/Mexico_City', // UTC-6
      'BR': 'America/Sao_Paulo',  // UTC-3
      'AR': 'America/Argentina/Buenos_Aires', // UTC-3
      'GB': 'Europe/London',   // UTC+0
      'FR': 'Europe/Paris',    // UTC+1
      'DE': 'Europe/Berlin',   // UTC+1
      'IT': 'Europe/Rome',     // UTC+1
      'ES': 'Europe/Madrid',   // UTC+1
      'GR': 'Europe/Athens',   // UTC+2
      'TH': 'Asia/Bangkok',    // UTC+7
      'VN': 'Asia/Ho_Chi_Minh', // UTC+7
      'PH': 'Asia/Manila',     // UTC+8
      'SG': 'Asia/Singapore',  // UTC+8
      'MY': 'Asia/Kuala_Lumpur', // UTC+8
      'ID': 'Asia/Jakarta',    // UTC+7
      'AU': 'Australia/Sydney', // UTC+10
      'NZ': 'Pacific/Auckland', // UTC+12
      'RU': 'Europe/Moscow',   // UTC+3
      'AE': 'Asia/Dubai',      // UTC+4
      'TR': 'Europe/Istanbul', // UTC+3
    };

    // 국가별 날씨 쿼리용 대표 도시 (WeatherAPI.com)
    const COUNTRY_DEFAULT_CITY: Record<string, string> = {
      'JP': 'Tokyo', 'CN': 'Shanghai', 'HK': 'Hong Kong', 'TW': 'Taipei',
      'MO': 'Macau', 'KR': 'Seoul', 'US': 'New York', 'CA': 'Toronto',
      'MX': 'Mexico City', 'BR': 'Rio de Janeiro', 'AR': 'Buenos Aires',
      'GB': 'London', 'FR': 'Paris', 'DE': 'Berlin', 'IT': 'Rome',
      'ES': 'Barcelona', 'GR': 'Athens', 'TH': 'Bangkok', 'VN': 'Ho Chi Minh City',
      'PH': 'Manila', 'SG': 'Singapore', 'MY': 'Kuala Lumpur', 'ID': 'Bali',
      'AU': 'Sydney', 'NZ': 'Auckland', 'RU': 'Moscow', 'AE': 'Dubai',
      'TR': 'Istanbul',
    };

    // WeatherAPI 아이콘 코드 → 이모지 변환
    function getWeatherIcon(code: number, isDay: number): string {
      if (code === 1000) return isDay ? '☀️' : '🌙';
      if (code <= 1009) return '⛅';
      if (code <= 1030) return '🌫️';
      if (code <= 1087) return '⛈️';
      if (code <= 1135) return '🌫️';
      if (code <= 1147) return '❄️';
      if (code <= 1201) return '🌧️';
      if (code <= 1225) return '❄️';
      if (code <= 1237) return '🌨️';
      if (code <= 1282) return '⛈️';
      return '🌥️';
    }

    // 각 국가별 날씨 및 시간 정보 생성 (WeatherAPI.com 무료 플랜: 현재날씨 무료)
    const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

    // Upstash Redis 클라이언트 (날씨 캐싱 - 1시간 TTL, WeatherAPI 호출 최소화)
    const weatherRedis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
      ? new UpstashRedis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
      : null;

    const weathers = await Promise.all(
      Array.from(uniqueCountries.entries()).map(async ([countryCode, location]) => {
        const timezone = COUNTRY_TIMEZONES[countryCode] || 'UTC';
        const now = new Date();

        let timeString = '';
        try {
          const formatter = new Intl.DateTimeFormat('ko-KR', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
          timeString = formatter.format(now);
        } catch (error) {
          logger.error(`[Briefing API] Error formatting time for ${countryCode}:`, error);
        }

        // 테스트 유저: API 호출 없이 더미 데이터 즉시 반환
        if (isTestUser) {
          return {
            country: COUNTRY_NAMES[countryCode] || countryCode,
            countryCode,
            location,
            temp: 22 as number | null,
            condition: '체험 데이터' as string | null,
            icon: '🌤️' as string | null,
            time: timeString,
            isDummyWeather: true,
          };
        }

        // 실유저: 실제 날씨 API 호출 (실패 시 null 반환 - 가짜 데이터 절대 없음)
        let temp: number | null = null;
        let condition: string | null = null;
        let icon: string | null = null;

        // Redis 캐시 키 (1시간 단위: YYYY-MM-DDTHH)
        const weatherCacheKey = `weather:${countryCode}:${new Date().toISOString().slice(0, 13)}`;

        // 1단계: Redis 캐시 확인
        let cacheHit = false;
        if (weatherRedis) {
          try {
            const cached = await weatherRedis.get<{ temp: number; condition: string; icon: string }>(weatherCacheKey);
            if (cached) {
              temp = cached.temp;
              condition = cached.condition;
              icon = cached.icon;
              cacheHit = true;
              logger.log(`[Briefing API] 날씨 캐시 히트: ${countryCode}`);
            }
          } catch {
            // Redis 실패 시 WeatherAPI 직접 호출 (graceful degradation)
          }
        }

        // 2단계: 캐시 미스 시 WeatherAPI 호출 (5초 타임아웃)
        if (!cacheHit && WEATHER_API_KEY) {
          try {
            const cityQuery = COUNTRY_DEFAULT_CITY[countryCode] || countryCode;
            logger.log(`[Briefing API] WeatherAPI 호출: ${countryCode} → ${cityQuery}`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            try {
              const weatherRes = await fetch(
                `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(cityQuery)}&lang=ko`,
                { cache: 'no-store', signal: controller.signal }
              );
              clearTimeout(timeoutId);
              if (weatherRes.ok) {
                const wd = await weatherRes.json();
                temp = Math.round(wd.current.temp_c);
                condition = wd.current.condition.text;
                icon = getWeatherIcon(wd.current.condition.code, wd.current.is_day);
                logger.log(`[Briefing API] WeatherAPI 성공: ${countryCode} → ${temp}°C, ${condition}`);
                if (weatherRedis) {
                  weatherRedis.set(weatherCacheKey, { temp, condition, icon }, { ex: 3600 }).catch(() => {});
                }
              } else {
                clearTimeout(timeoutId);
                const errBody = await weatherRes.text();
                logger.error(`[Briefing API] WeatherAPI 실패: ${countryCode}, status=${weatherRes.status}, body=${errBody}`);
              }
            } catch (fetchErr: any) {
              clearTimeout(timeoutId);
              if (fetchErr.name === 'AbortError') {
                logger.warn(`[Briefing API] WeatherAPI 타임아웃 (5s): ${countryCode}`);
              } else {
                throw fetchErr;
              }
            }
          } catch (e) {
            logger.error(`[Briefing API] WeatherAPI fetch 예외: ${countryCode}:`, e);
          }
        } else if (!cacheHit) {
          logger.warn('[Briefing API] WEATHER_API_KEY 환경변수가 없음');
        }

        return {
          country: COUNTRY_NAMES[countryCode] || countryCode,
          countryCode,
          location,
          temp,
          condition,
          icon,
          time: timeString,
          isDummyWeather: false,
        };
      })
    );

    logger.log('[Briefing API] Weathers array:', weathers);

    // 기존 단일 weather 필드도 유지 (하위 호환성)
    const weather = weathers.length > 0 && weathers[0].temp !== null ? {
      temp: weathers[0].temp,
      condition: weathers[0].condition,
      icon: weathers[0].icon,
      isDummyWeather: weathers[0].isDummyWeather ?? false,
    } : null;

    return NextResponse.json({
      ok: true,
      hasTrip: true,
      briefing: {
        date: today.toISOString(),
        dayNumber,
        cruiseName: koreanCruiseName,
        nights: activeTrip.nights || 0,
        days: activeTrip.days || 0,
        startDate: activeTrip.startDate ? activeTrip.startDate.toISOString() : null,
        endDate: activeTrip.endDate ? activeTrip.endDate.toISOString() : null,
        tripNumber: tripCount, // 몇번째 여행 정보 추가
        userTripId: activeTrip.id, // UserTrip의 id 사용 // 여행 ID 추가 (추가 버튼용)
        today: todayItinerary ? {
          location: todayItinerary.location,
          country: todayItinerary.country ? COUNTRY_NAMES[todayItinerary.country] || todayItinerary.country : null, // 한국어 국가명 변환
          type: todayItinerary.type,
          arrival: todayItinerary.arrival,
          departure: todayItinerary.departure,
          language: todayItinerary.language,
          currency: todayItinerary.currency,
          notes: todayItinerary.notes,
        } : null,
        tomorrow: tomorrowItinerary ? {
          location: tomorrowItinerary.location,
          country: tomorrowItinerary.country ? COUNTRY_NAMES[tomorrowItinerary.country] || tomorrowItinerary.country : null, // 한국어 국가명 변환
          type: tomorrowItinerary.type,
          arrival: tomorrowItinerary.arrival,
        } : null,
        dday,
        ddayType,
        weather, // 하위 호환성을 위해 유지
        weathers, // 여러 국가의 날씨 배열 추가
      },
    });
  } catch (error) {
    logger.error('GET /api/briefing/today error:', error);
    return NextResponse.json(
      { ok: false, message: 'Server error' },
      { status: 500 }
    );
  }
}
