'use client';

// import React from 'react'; // 사용되지 않으므로 제거
// import { useMemo, ReactNode } from 'react'; // 사용되지 않으므로 제거
// import { taiwanAirports } from './airports'; // 사용되지 않으므로 제거
// import { navCtx } from '@/lib/chat/taiwanNav'; // 사용되지 않으므로 제거
// import { renderEmphasis } from '@/lib/utils'; // 사용되지 않으므로 제거
// import { terminalsByRegion } from '@/lib/nav/data'; // 사용되지 않으므로 제거
// import { gmapsDir, gmapsNearby } from '@/lib/nav/urls'; // 사용되지 않으므로 제거

// ⬇ 파일 상단에 보조 유틸 추가
const ARROWS = /->|→|~>|에서|부터|to|까지/;
const NEAR_WORDS = /(근처|가까운|주변)/;
const POI_WORDS: Record<string, string[]> = {
  '카페': ['cafe', 'coffee'],
  '맛집': ['restaurant','food'],
  '관광지': ['tourist attraction','sightseeing'],
  '아이가 놀만한 곳': ['playground','kids activity','theme park'],
  '스타벅스': ['Starbucks','cafe'],
};

export type GoParse =
  | { kind:'route'; from:string; to:string }
  | { kind:'nearby'; what:string };

/** “인천공항에서 카이탁 터미널까지”, “포트에버글레이즈 가는길”, “근처 스타벅스” 등 파싱 */
export function parseGoQuery(q: string): GoParse | null {
  const s = q.trim().replaceAll(/\s+/g,' ');
  // 1) 근처 검색
  if (NEAR_WORDS.test(s)) {
    const key = Object.keys(POI_WORDS).find(k => s.includes(k)) || '관광지';
    return { kind:'nearby', what:key };
  }
  // 2) 출발/도착 분리
  const m = s.split(ARROWS).map(v => v.trim()).filter(Boolean);
  if (m.length >= 2) {
    const [from, to] = [m[0], m[m.length-1]];
    return { kind:'route', from, to };
  }
  // 3) “OOO 터미널 어떻게 가” 형태
  if (/어떻게 가|가는 길|길찾기/.test(s)) {
    const to = s.replace(/.*?(어디|어떻게 가|가는 길|길찾기).*/,'').trim() || s;
    return { kind:'route', from:'현위치', to };
  }
  // 4) “포트 에버글레이즈” 단독 → 도착만 인식
  if (s.length >= 2 && /터미널|공항|포트|항/.test(s)) {
    return { kind:'route', from:'현위치', to:s };
  }
  // 5) “근처 OOO” 키워드 매칭
  const key2 = Object.keys(POI_WORDS).find(k => s.includes(k));
  if (key2) return { kind:'nearby', what:key2 };
  return null;
}

/** gmaps 링크 3종(대중교통/자동차/지도로 보기) */
export function buildMapLinks(from:string, to:string) {
  const enc = (s:string)=> encodeURIComponent(s);
  return {
    transit: `https://www.google.com/maps/dir/?api=1&origin=${enc(from)}&destination=${enc(to)}&travelmode=transit`,
    driving: `https://www.google.com/maps/dir/?api=1&origin=${enc(from)}&destination=${enc(to)}&travelmode=driving`,
    map:     `https://www.google.com/maps/search/?api=1&query=${enc(to)}`
  };
}

/** 근처 검색 링크(카테고리 → 영어 검색어 묶음 중 1개 우선) */
export function buildNearbyLink(what:string) {
  const kws = POI_WORDS[what] ?? ['tourist attraction'];
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(kws[0])}`;
}
