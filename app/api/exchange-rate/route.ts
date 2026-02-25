export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const currency = searchParams.get('currency') || 'USD';

    // exchangerate-api.com의 무료 API 사용
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${currency}`,
      {
        headers: {
          'User-Agent': 'cruise-guide-app',
        },
        next: { revalidate: 3600 } // 1시간 캐시
      }
    );

    if (!response.ok) {
      throw new Error(`환율 API 요청 실패: ${response.status}`);
    }

    const data = await response.json();
    
    // KRW와 USD 환율 추출
    const krwRate = data.rates?.KRW;
    const usdRate = currency === 'USD' ? 1 : data.rates?.USD;
    
    if (!krwRate) {
      throw new Error('KRW 환율 정보를 찾을 수 없습니다.');
    }

    return NextResponse.json({
      success: true,
      data: {
        baseCurrency: currency,
        krw: {
          rate: krwRate,
          formatted: `1 ${currency} = ${krwRate.toLocaleString('ko-KR')} KRW`
        },
        usd: {
          rate: usdRate || 1,
          formatted: currency === 'USD' 
            ? `1 USD = 1 USD` 
            : `1 ${currency} = ${Math.round(usdRate || 1)} USD` // 소수점 제거
        },
        lastUpdated: data.date || new Date().toISOString().split('T')[0]
      }
    }, {
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Cache-Control': 'public, max-age=3600', // 1시간 캐시
      },
    });

  } catch (error) {
    console.error('환율 API 오류:', error);
    
    // 백업 환율 (대략적인 값) - KRW와 USD 기준
    const fallbackRatesKRW: { [key: string]: number } = {
      USD: 1380,
      EUR: 1500,
      JPY: 9.2,
      CNY: 190,
      GBP: 1750,
      AUD: 900,
      CAD: 1020,
      CHF: 1520,
      HKD: 177,
      SGD: 1030
    };

    const fallbackRatesUSD: { [key: string]: number } = {
      USD: 1,
      EUR: 1.09,
      JPY: 0.0067,
      CNY: 0.138,
      GBP: 1.27,
      AUD: 0.65,
      CAD: 0.74,
      CHF: 1.10,
      HKD: 0.128,
      SGD: 0.75
    };

    const currency = new URL(request.url).searchParams.get('currency') || 'USD';
    const fallbackKrwRate = fallbackRatesKRW[currency] || 1380;
    const fallbackUsdRate = fallbackRatesUSD[currency] || 1;

    return NextResponse.json({
      success: false,
      error: '실시간 환율을 가져올 수 없어 근사치를 제공합니다.',
      data: {
        baseCurrency: currency,
        krw: {
          rate: fallbackKrwRate,
          formatted: `1 ${currency} = ${fallbackKrwRate.toLocaleString('ko-KR')} KRW (근사치)`
        },
        usd: {
          rate: fallbackUsdRate,
          formatted: currency === 'USD' 
            ? `1 USD = 1 USD` 
            : `1 ${currency} = ${Math.round(fallbackUsdRate)} USD (근사치)` // 소수점 제거
        },
        lastUpdated: new Date().toISOString().split('T')[0],
        isFallback: true
      }
    }, {
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
    });
  }
} 
