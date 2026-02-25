export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { resolveTerminalByText, type POI, type Terminal, TERMINALS } from '@/lib/terminals';
import { buildDrivingUrl, buildTransitUrl, buildMapUrl } from '../../../../src/lib/nav/urls';

// Removed local POI type definition
// type POI = { id:string; name:string; name_ko:string; keywords_ko?:string[]; lat:number; lng:number; city:string; country:string; };
// Removed ALL constant
// const ALL: POI[] = terminalsData as unknown as POI[];

const isCurrentText = (s?:string) => /^(현\s?위치|current\s?location)$/i.test((s||'').trim());
const PLACEHOLDERS = ['', '현 위치', '현위치'];
const isPlaceholder = (s?:string) => PLACEHOLDERS.includes((s||'').trim());

const pickOr = (pick?: { id?:string; label?:string } | null, text?: string) => {
  const pl = (pick?.label || '').trim();
  const tl = (text || '').trim();
  if (isCurrentText(tl)) return '현 위치';
  if (isPlaceholder(tl)) return pl ? pl : '';
  return tl || pl;
};

const enc = encodeURIComponent;
const gDirTransitLL = (lat:number,lng:number,q:string) => `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${enc(q)}&travelmode=transit`;
const gDirDrivingLL = (lat:number,lng:number,q:string) => `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${enc(q)}&travelmode=driving`;
const gDirTransitMe = (q:string) => `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${enc(q)}&travelmode=transit`;
const gDirDrivingMe = (q:string) => `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${enc(q)}&travelmode=driving`;
const gSearchLL = (lat:number,lng:number,q:string) => `https://www.google.com/maps/search/${enc(q)}/@${lat},${lng},14z`;
const gSearch = (q:string) => `https://www.google.com/maps/search/${enc(q)}`;

const NEAR_RE = /^\s*(근처|주변|near|附近)\s*(.*)\s*$/i;
const CATEGORY_WORDS = ['맛집','식당','카페','관광지','명소','쇼핑','백화점','시장','마트','편의점','약국','병원','버스정류장','지하철역','세븐일레븐','스타벅스','라멘','스시','seafood','restaurant','cafe','attraction','mall','market','convenience','pharmacy'];
const isNearbyQuery = (text:string) => {
  const t = (text||'').trim(); if (!t) return false;
  if (NEAR_RE.test(t)) return true;
  return CATEGORY_WORDS.some(w => t.includes(w));
};
const extractQuery = (text:string) => {
  const m = (text||'').trim().match(NEAR_RE);
  return (m ? (m[2]||'맛집') : text || '맛집').trim();
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const gps = body.gps as { lat?: number; lng?: number } | undefined;
  const fromPick = body.fromPick as { id?:string; label?:string } | null;
  const toPick   = body.toPick   as { id?:string; label?:string } | null;
  const fromStr  = pickOr(fromPick, (body.from || '').trim());
  const toStr    = pickOr(toPick,   (body.to   || '').trim());

  // 근처검색
  if (isNearbyQuery(toStr)) {
    const query = extractQuery(toStr);

    if (isCurrentText(fromStr) || fromPick?.id === 'current_location') {
      if (gps?.lat && gps?.lng) {
        return NextResponse.json({
          ok: true,
          card: {
            title: `현 위치 → ${query}`,
            links: [
              { label: '대중교통', href: gDirTransitLL(gps.lat,gps.lng, query), emoji: '🚌' },
              { label: '자동차',   href: gDirDrivingLL(gps.lat,gps.lng, query), emoji: '🚗' },
              { label: '지도로 보기', href: gSearchLL(gps.lat,gps.lng, query),  emoji: '🗺️' },
            ],
            from: { label: '현 위치' },
            to:   { label: `근처 ${query}` },
          }
        });
      }
      return NextResponse.json({
        ok: true,
        card: {
          title: `현 위치 → ${query}`,
          links: [
            { label: '대중교통', href: gDirTransitMe(query), emoji: '🚌' },
            { label: '자동차',   href: gDirDrivingMe(query), emoji: '🚗' },
            { label: '지도로 보기', href: gSearch(query),     emoji: '🗺️' },
          ],
          from: { label: '현 위치' },
          to:   { label: `근처 ${query}` },
        }
      });
    }

    const poi = resolveTerminalByText(fromStr);
    if (poi) {
      return NextResponse.json({
        ok: true,
        card: {
          title: `${poi.name_ko} → ${query}`,
          links: [
            { label: '대중교통', href: gDirTransitLL(poi.lat, poi.lng, query), emoji: '🚌' },
            { label: '자동차',   href: gDirDrivingLL(poi.lat, poi.lng, query), emoji: '🚗' },
            { label: '지도로 보기', href: gSearchLL(poi.lat, poi.lng, query),  emoji: '🗺️' },
          ],
          from: { label: poi.name_ko },
          to:   { label: `근처 ${query}` },
        }
      });
    }

    if (!isPlaceholder(fromStr)) {
      return NextResponse.json({
        ok: true,
        card: {
          title: `${fromStr} → ${query}`,
          links: [
            { label: '대중교통', href: gDirTransitMe(`${fromStr} ${query}`), emoji: '🚌' },
            { label: '자동차',   href: gDirDrivingMe(`${fromStr} ${query}`), emoji: '🚗' },
            { label: '지도로 보기', href: gSearch(`${fromStr} ${query}`),     emoji: '🗺️' },
          ],
          from: { label: fromStr },
          to:   { label: `근처 ${query}` },
        }
      });
    }

    return NextResponse.json({ ok:false, error:'출발지를 찾을 수 없어요.' }, { status:200 });
  }

  // 현 위치 → 목적지(텍스트/POI)
  if (isCurrentText(fromStr) || fromPick?.id === 'current_location') {
    const toPoi = resolveTerminalByText(toStr) || null;
    const destLabel = toPoi?.name_ko || toStr || '목적지';
    return NextResponse.json({
      ok: true,
      card: {
        title: `현 위치 → ${destLabel}`,
        links: [
          { label: '대중교통', href: `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${encodeURIComponent(destLabel)}&travelmode=transit`, emoji: '🚌' },
          { label: '자동차',   href: `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${encodeURIComponent(destLabel)}&travelmode=driving`, emoji: '🚗' },
          { label: '지도로 보기', href: `https://www.google.com/maps/search/${encodeURIComponent(destLabel)}`, emoji: '🗺️' },
        ],
        from: { label: '현 위치' },
        to:   { label: destLabel },
      }
    });
  }

  // POI ↔ POI
  const fromPoi = resolveTerminalByText(fromStr);
  const toPoi   = resolveTerminalByText(toStr);

  if (!fromPoi) return NextResponse.json({ ok:false, error:'출발지를 찾을 수 없어요.' }, { status:200 });
  if (!toPoi)   return NextResponse.json({ ok:false, error:'목적지를 찾을 수 없어요.' },   { status:200 });

  return NextResponse.json({
    ok: true,
    card: {
      title: `${fromPoi.name_ko} → ${toPoi.name_ko}`,
      links: [
        { label: '대중교통', href: buildTransitUrl(fromPoi.name_ko, toPoi.name_ko), emoji: '🚌' },
        { label: '자동차',   href: buildDrivingUrl(fromPoi.name_ko, toPoi.name_ko),  emoji: '🚗' },
        { label: '지도로 보기', href: buildMapUrl(toPoi.name_ko),                     emoji: '🗺️' },
      ],
      from: { label: fromPoi.name_ko },
      to:   { label: toPoi.name_ko },
    }
  });
}
