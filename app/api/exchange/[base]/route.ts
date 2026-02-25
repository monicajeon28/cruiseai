export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  { params }: { params: { base: string } }
) {
  const base = (params.base || 'USD').toUpperCase();

  // 기본 응답(폴백)
  let data = {
    baseCurrency: base,
    krw: { rate: 1300, formatted: '1 ' + base + ' = 1,300 KRW' },
    usd: { rate: base === 'USD' ? 1 : 0.0077, formatted: `1 ${base} = ${base === 'USD' ? '1' : '0.0077'} USD` },
    lastUpdated: new Date().toISOString().slice(0, 10),
    isFallback: true,
  };

  try {
    // open.er-api (무료, 인증 불필요)
    const r = await fetch(`https://open.er-api.com/v6/latest/${base}`, { next: { revalidate: 3600 } });
    if (r.ok) {
      const j = await r.json();
      const KRW = j?.rates?.KRW;
      const USD = j?.rates?.USD;
      if (KRW && USD) {
        data = {
          baseCurrency: base,
          krw: { rate: KRW, formatted: `1 ${base} = ${Intl.NumberFormat('ko-KR').format(KRW)} KRW` },
          usd: { rate: USD, formatted: `1 ${base} = ${USD.toFixed(4)} USD` },
          lastUpdated: new Date(j.time_last_update_utc || Date.now()).toISOString().slice(0, 10),
          isFallback: false,
        };
      }
    }
  } catch {
    // 폴백 유지
  }

  return NextResponse.json(data);
}
