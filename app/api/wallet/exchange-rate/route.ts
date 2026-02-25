export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

// 환율 API - ExchangeRate-API 사용 (무료, 하루 1500회 제한)
// 대안: Open Exchange Rates, Fixer.io 등

type ExchangeRates = {
  [key: string]: number;
};

// 캐시 (메모리에 저장, 1시간마다 갱신)
let cachedRates: { rates: ExchangeRates; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1시간

async function fetchExchangeRates(): Promise<ExchangeRates> {
  try {
    // 캐시 확인
    if (cachedRates && Date.now() - cachedRates.timestamp < CACHE_DURATION) {
      console.log('[Exchange Rate API] Using cached rates');
      return cachedRates.rates;
    }

    // ExchangeRate-API 호출 (USD 기준)
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      next: { revalidate: 3600 }, // 1시간마다 재검증
    });

    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates');
    }

    const data = await response.json();
    const rates = data.rates as ExchangeRates;

    // 캐시 저장
    cachedRates = {
      rates,
      timestamp: Date.now(),
    };

    console.log('[Exchange Rate API] Fetched new rates from API');
    return rates;
  } catch (error) {
    console.error('[Exchange Rate API] Error fetching rates:', error);

    // 폴백: 고정 환율 (최근 평균치)
    return {
      KRW: 1300,
      USD: 1,
      JPY: 150,
      CNY: 7.2,
      TWD: 31,
      HKD: 7.8,
      SGD: 1.35,
      THB: 35,
      VND: 24000,
      PHP: 55,
      MYR: 4.6,
      IDR: 15600,
      EUR: 0.92,
      GBP: 0.79,
      AUD: 1.52,
      NZD: 1.65,
      CAD: 1.36,
      CHF: 0.88,
      NOK: 10.5,
      SEK: 10.3,
      DKK: 6.9,
      RUB: 92,
      TRY: 32,
      AED: 3.67,
    };
  }
}

// GET: 환율 조회
// Query params:
//   - from: 출발 통화 (예: USD, KRW)
//   - to: 도착 통화 (예: JPY)
//   - amount: 금액 (선택)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from') || 'USD';
    const to = searchParams.get('to') || 'KRW';
    const amountStr = searchParams.get('amount');

    const rates = await fetchExchangeRates();

    // USD 기준이므로 변환 계산
    // 예: KRW → JPY = (1 / rates.KRW) * rates.JPY
    const fromRate = rates[from] || 1;
    const toRate = rates[to] || 1;
    const exchangeRate = toRate / fromRate;

    let converted = null;
    if (amountStr) {
      const amount = parseFloat(amountStr);
      if (!isNaN(amount)) {
        converted = amount * exchangeRate;
      }
    }

    return NextResponse.json({
      success: true,
      from,
      to,
      rate: exchangeRate,
      converted,
      timestamp: cachedRates?.timestamp || Date.now(),
    });
  } catch (error) {
    console.error('[API /wallet/exchange-rate] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch exchange rate' },
      { status: 500 }
    );
  }
}

// POST: 여러 통화의 환율 일괄 조회
// Body: { currencies: ['KRW', 'JPY', 'USD', ...] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const currencies = body.currencies as string[];

    if (!Array.isArray(currencies) || currencies.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid currencies array' },
        { status: 400 }
      );
    }

    const rates = await fetchExchangeRates();

    // 각 통화를 KRW 기준으로 변환 (한국인 사용자 기준)
    const baseCurrency = 'KRW';
    const baseRate = rates[baseCurrency] || 1;

    const result = currencies.map(currency => {
      const currencyRate = rates[currency] || 1;
      const rateToKRW = baseRate / currencyRate; // 해당 통화 1단위 = X 원

      return {
        code: currency,
        rateToKRW, // 해당 통화 1단위당 원화
        rateFromKRW: 1 / rateToKRW, // 원화 1원당 해당 통화
      };
    });

    return NextResponse.json({
      success: true,
      baseCurrency,
      rates: result,
      timestamp: cachedRates?.timestamp || Date.now(),
    });
  } catch (error) {
    console.error('[API /wallet/exchange-rate POST] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch exchange rates' },
      { status: 500 }
    );
  }
}
