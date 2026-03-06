export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

// 국가명을 통화 코드로 매핑
const COUNTRY_TO_CURRENCY: Record<string, { code: string; symbol: string; name: string }> = {
  '대한민국': { code: 'KRW', symbol: '₩', name: '원' },
  '한국': { code: 'KRW', symbol: '₩', name: '원' },
  '일본': { code: 'JPY', symbol: '¥', name: '엔' },
  '중국': { code: 'CNY', symbol: '¥', name: '위안' },
  '대만': { code: 'TWD', symbol: 'NT$', name: '달러' },
  '타이완': { code: 'TWD', symbol: 'NT$', name: '달러' },
  '홍콩': { code: 'HKD', symbol: 'HK$', name: '달러' },
  '싱가포르': { code: 'SGD', symbol: 'S$', name: '달러' },
  '싱가폴': { code: 'SGD', symbol: 'S$', name: '달러' },
  '태국': { code: 'THB', symbol: '฿', name: '바트' },
  '베트남': { code: 'VND', symbol: '₫', name: '동' },
  '필리핀': { code: 'PHP', symbol: '₱', name: '페소' },
  '말레이시아': { code: 'MYR', symbol: 'RM', name: '링깃' },
  '인도네시아': { code: 'IDR', symbol: 'Rp', name: '루피아' },
  '미국': { code: 'USD', symbol: '$', name: '달러' },
  '캐나다': { code: 'CAD', symbol: 'C$', name: '달러' },
  '호주': { code: 'AUD', symbol: 'A$', name: '달러' },
  '뉴질랜드': { code: 'NZD', symbol: 'NZ$', name: '달러' },
  '영국': { code: 'GBP', symbol: '£', name: '파운드' },
  '유럽': { code: 'EUR', symbol: '€', name: '유로' },
  '프랑스': { code: 'EUR', symbol: '€', name: '유로' },
  '독일': { code: 'EUR', symbol: '€', name: '유로' },
  '이탈리아': { code: 'EUR', symbol: '€', name: '유로' },
  '스페인': { code: 'EUR', symbol: '€', name: '유로' },
  '그리스': { code: 'EUR', symbol: '€', name: '유로' },
  '포르투갈': { code: 'EUR', symbol: '€', name: '유로' },
  '네덜란드': { code: 'EUR', symbol: '€', name: '유로' },
  '벨기에': { code: 'EUR', symbol: '€', name: '유로' },
  '오스트리아': { code: 'EUR', symbol: '€', name: '유로' },
  '스위스': { code: 'CHF', symbol: 'CHF', name: '프랑' },
  '노르웨이': { code: 'NOK', symbol: 'kr', name: '크로네' },
  '스웨덴': { code: 'SEK', symbol: 'kr', name: '크로나' },
  '덴마크': { code: 'DKK', symbol: 'kr', name: '크로네' },
  '러시아': { code: 'RUB', symbol: '₽', name: '루블' },
  '터키': { code: 'TRY', symbol: '₺', name: '리라' },
  '아랍에미리트': { code: 'AED', symbol: 'د.إ', name: '디르함' },
  'UAE': { code: 'AED', symbol: 'د.إ', name: '디르함' },
  '두바이': { code: 'AED', symbol: 'د.إ', name: '디르함' },
};

// 국가명에서 통화 정보 추출 (예: "일본 - 도쿄" → { code: 'JPY', symbol: '¥', name: '엔' })
function extractCurrency(destination: string): { code: string; symbol: string; name: string } | null {
  const country = destination.split('-')[0].split(',')[0].trim();
  return COUNTRY_TO_CURRENCY[country] || null;
}

export async function GET(req: NextRequest) {
  try {
    // 인증 확인
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 사용자의 최신 여행 정보 조회 (UserTrip 사용)
    const latestTrip = await prisma.userTrip.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        destination: true,
        startDate: true,
        endDate: true,
      },
    });

    const currencySet = new Map<string, { code: string; symbol: string; name: string; country: string }>();

    // 여행지가 있으면 여행지 통화 우선 추가
    if (latestTrip) {
      const rawDest = latestTrip.destination;
      // Prisma Json? 타입: null/string/string[] 등 다양한 형태 안전 처리
      const destinations: string[] = Array.isArray(rawDest)
        ? (rawDest as unknown[]).filter((d): d is string => typeof d === 'string')
        : typeof rawDest === 'string'
        ? [rawDest]
        : [];

      destinations.forEach((dest) => {
        const currency = extractCurrency(dest);
        if (currency) {
          const country = dest.split('-')[0].trim();
          currencySet.set(currency.code, { ...currency, country });
        }
      });
    }

    // 기본 필수 통화 (KRW + USD만 — 여행지 없을 때 최소 기본값)
    const essentialCurrencies = [
      { code: 'KRW', symbol: '₩', name: '원', country: '한국' },
      { code: 'USD', symbol: '$', name: '달러', country: '미국' },
    ];

    // 여행지 기반 통화가 없으면 KRW+USD만 포함
    // 여행지 통화가 있으면 해당 통화들 + KRW만 포함
    if (currencySet.size === 0) {
      essentialCurrencies.forEach(c => currencySet.set(c.code, c));
    } else {
      // KRW가 없으면 추가 (항상 포함)
      if (!currencySet.has('KRW')) {
        currencySet.set('KRW', essentialCurrencies[0]);
      }
      // USD가 없으면 추가 (국제 기준 통화)
      if (!currencySet.has('USD')) {
        currencySet.set('USD', essentialCurrencies[1]);
      }
    }

    const currencies = Array.from(currencySet.values());

    return NextResponse.json({
      success: true,
      currencies,
      tripDates: latestTrip ? {
        startDate: latestTrip.startDate,
        endDate: latestTrip.endDate,
      } : null,
      tripId: latestTrip?.id,
    });
  } catch (error) {
    logger.error('[API /wallet/countries] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch countries' },
      { status: 500 }
    );
  }
}
