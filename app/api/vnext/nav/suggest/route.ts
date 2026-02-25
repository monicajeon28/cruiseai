export const dynamic = 'force-dynamic';

// app/api/vnext/nav/suggest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  COUNTRIES,
  portsByCountry,
  findCountryCodeByKorean,   // 없으면 아래 normalizeCountry에서 COUNTRIES 기반으로 처리하므로 선택적
} from '@/vnext/lib/nav/data';
import * as AP from '@/vnext/lib/chat/airports'; // airportsByCountry 또는 AIRPORTS 어느쪽이든 지원

type SItem = { id: string; label: string; subtitle?: string; country?: string };

// ---- 고정 연관검색(도착지) ----
const FIXED_NEARBY: SItem[] = [
  { id: 'nearby:식당', label: '근처 식당' },
  { id: 'nearby:관광지', label: '관광지' },
  { id: 'nearby:맛집', label: '근처맛집' },
  { id: 'nearby:스타벅스', label: '스타벅스' },
  { id: 'nearby:편의점', label: '편의점' },
  { id: 'nearby:마트', label: '마트' },
];

// ---- 국가 토큰 정규화(국가 코드/한글명/영문명 모두 허용) ----
function normalizeCountry(input: string): string | null {
  const raw = (input || '').trim();
  if (!raw) return null;
  const s = raw.toLowerCase();

  // 빠른 코드/별칭
  if (['us','usa','united states','미국'].includes(s)) return 'US';
  if (['tw','taiwan','대만'].includes(s)) return 'TW';
  if (['jp','japan','일본'].includes(s)) return 'JP';
  if (['kr','korea','south korea','대한민국','한국'].includes(s)) return 'KR';
  if (['hk','hong kong','홍콩'].includes(s)) return 'HK';

  // COUNTRIES 표에서 한글 라벨/영문 라벨 부분일치 지원
  const norm = (v:string)=>v.toLowerCase().replace(/\s+/g,'');
  const t = norm(s);
  const hit = COUNTRIES.find(c =>
    norm(c.label).includes(t) || norm(c.value)===t
  );
  if (hit) return hit.value.toUpperCase();

  // 선택적으로 data.ts에서 제공하는 함수 사용
  try {
    const byKor = (findCountryCodeByKorean as any)?.(raw);
    if (byKor) return String(byKor).toUpperCase();
  } catch {}

  return null;
}

// ---- 공항 조회(데이터 두 형태 모두 지원) ----
function getAirportsByCountry(cc: string): SItem[] {
  const out: SItem[] = [];
  const C = cc.toUpperCase();

  // 1) airportsByCountry.{CC}
  const byCountry = (AP as any).airportsByCountry?.[C];
  if (Array.isArray(byCountry)) {
    for (const a of byCountry) {
      out.push({
        id: a.code ?? a.q ?? a.name,
        label: a.name ?? a.label ?? String(a.code ?? ''),
        subtitle: a.code ?? undefined,
        country: C,
      });
    }
  }

  // 2) AIRPORTS 평면 배열
  if (!out.length && Array.isArray((AP as any).AIRPORTS)) {
    const list = (AP as any).AIRPORTS as any[];
    for (const a of list) {
      const code = String(a.countryCode || a.country || '').toUpperCase();
      if (code === C) {
        out.push({
          id: a.code ?? a.iata ?? a.name,
          label: a.name ?? `${a.city || ''} ${a.code || ''}`.trim(),
          subtitle: a.code ?? a.iata,
          country: C,
        });
      }
    }
  }

  // 3) 최소 폴백(대표 공항) — 데이터가 비어있을 때만
  if (!out.length) {
    const fallback: Record<string, [string,string][]> = {
      US: [['LAX','Los Angeles International Airport'],['JFK','John F. Kennedy International Airport'],['MIA','Miami International Airport']],
      TW: [['TPE','Taipei Taoyuan Intl.'],['TSA','Taipei Songshan'],['KHH','Kaohsiung Intl.']],
      JP: [['HND','Tokyo Haneda'],['NRT','Narita Intl.']],
      KR: [['ICN','Incheon Intl.'],['GMP','Gimpo Intl.']],
      HK: [['HKG','Hong Kong Intl.']],
    };
    (fallback[C] ?? []).forEach(([code,name]) => {
      out.push({ id: code, label: name, subtitle: code, country: C });
    });
  }

  return out;
}

function toPortItems(arr: { label: string; value: string }[], country?: string): SItem[] {
  return arr.map(p => ({ id: p.value, label: p.label, subtitle: p.value, country }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slot = (searchParams.get('slot') || 'from') as 'from'|'to';
  const q = (searchParams.get('q') || '').trim();
  const anchorCountry = (searchParams.get('anchorCountry') || '').toUpperCase();

  // ── FROM: 국가명 검색 → 그 나라 공항 + 현 위치
  if (slot === 'from') {
    const cc = normalizeCountry(q);
    if (cc) {
      const airports = getAirportsByCountry(cc);
      const head: SItem[] = [{ id: 'current_location', label: '현 위치' }];
      return NextResponse.json({ items: [...head, ...airports] });
    }
    // 국가를 못 알아들으면 기본: 현 위치만 우선 노출
    return NextResponse.json({ items: [{ id: 'current_location', label: '현 위치' }] });
  }

  // ── TO: 항상 고정 연관검색 버튼을 맨 앞에 붙인다
  const fixed = FIXED_NEARBY;

  // 앵커 국가가 있으면: 해당 국가의 크루즈 터미널을 뒤에 붙임
  const cc = anchorCountry || normalizeCountry(q) || '';
  if (cc && portsByCountry[cc]) {
    const ports = toPortItems(portsByCountry[cc], cc);
    return NextResponse.json({ items: [...fixed, ...ports] });
  }

  // 앵커 없음: 고정 버튼만 우선
  return NextResponse.json({ items: fixed });
}
