export type Place = { text: string };

export type LatLng = { lat: number; lng: number };

export function gmDirUrl(opts: {
  origin: string | LatLng;
  destination: string | LatLng | string;
  mode: 'driving' | 'transit' | 'walking';
}) {
  const enc = (v: string) => encodeURIComponent(v);
  const point = (p: string | LatLng) =>
    typeof p === 'string' ? enc(p) : `${p.lat},${p.lng}`;

  const origin = point(opts.origin);
  const dest = point(opts.destination);
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=${opts.mode}`;
}

export function gmSearchUrl(q: string | LatLng) {
  const val = typeof q === 'string' ? encodeURIComponent(q) : `${q.lat},${q.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${val}`;
}

// ====== 추가: 도시 기본 공항/터미널 프리셋(필요시 계속 보강) ======
const CITY_PRESETS: Record<string, { airport: string; cruise: string }> = {
  '마이애미':   { airport: 'Miami International Airport',           cruise: 'PortMiami Cruise Terminal' },
  '홍콩':       { airport: 'Hong Kong International Airport',        cruise: 'Kai Tak Cruise Terminal' },
  '카이탁':     { airport: 'Hong Kong International Airport',        cruise: 'Kai Tak Cruise Terminal' },
  '오션터미널': { airport: 'Hong Kong International Airport',        cruise: 'Ocean Terminal, Tsim Sha Tsui' },
  '도쿄':       { airport: 'Haneda Airport',                         cruise: 'Yokohama Osanbashi Pier' },
  '요코하마':   { airport: 'Haneda Airport',                         cruise: 'Yokohama Osanbashi Pier' },
  '부산':       { airport: 'Gimhae International Airport',           cruise: 'Busan International Passenger Terminal' },
  '인천':       { airport: 'Incheon International Airport',          cruise: 'Incheon International Ferry Terminal' },
  '제주':       { airport: 'Jeju International Airport',             cruise: 'Jeju International Passenger Terminal' },
  // 이탈리아
  '라벤나':        { airport: 'Bologna Guglielmo Marconi Airport',     cruise: 'Porto di Ravenna Terminal' },
  '치비타베키아':  { airport: 'Rome Fiumicino Airport',                cruise: 'Civitavecchia Cruise Terminal' },
  '나폴리':        { airport: 'Naples International Airport',          cruise: 'Stazione Marittima Napoli' },
  '바리':          { airport: 'Karol Wojtyla Airport Bari',            cruise: 'Porto di Bari Terminal' },
  '팔레르모':      { airport: 'Palermo Falcone Borsellino Airport',    cruise: 'Porto di Palermo' },
  '제노바':        { airport: 'Genova Cristoforo Colombo Airport',     cruise: 'Terminal Crociere Genova' },
  '베네치아':      { airport: 'Venice Marco Polo Airport',             cruise: 'Venice Cruise Terminal (Marittima)' },
  '트리에스테':    { airport: 'Trieste Airport',                       cruise: 'Porto di Trieste' },
  // 크로아티아
  '스플리트':      { airport: 'Split Airport',                         cruise: 'Split Ferry Port' },
  '두브로브니크':  { airport: 'Dubrovnik Airport',                     cruise: 'Dubrovnik Cruise Port (Gruz)' },
  '코토르':        { airport: 'Tivat Airport',                         cruise: 'Port of Kotor' },
  // 그리스
  '피레우스':      { airport: 'Athens International Airport',          cruise: 'Port of Piraeus Cruise Terminal' },
  '헤라클리온':    { airport: 'Heraklion International Airport',       cruise: 'Port of Heraklion' },
  '산토리니':      { airport: 'Santorini Thira Airport',               cruise: 'Santorini Old Port (Skala)' },
  '미코노스':      { airport: 'Mykonos Island National Airport',       cruise: 'Mykonos New Port' },
  '코르푸':        { airport: 'Corfu International Airport',           cruise: 'Corfu Cruise Port' },
  '카타콜론':      { airport: 'Araxos Airport',                        cruise: 'Katakolo Cruise Port' },
  // 스페인
  '바르셀로나':    { airport: 'Barcelona El Prat Airport',             cruise: 'Port de Barcelona' },
  '팔마':          { airport: 'Palma de Mallorca Airport',             cruise: 'Port de Palma Cruise Terminal' },
  // 프랑스
  '마르세유':      { airport: 'Marseille Provence Airport',            cruise: 'Port de Marseille Joliette' },
  '툴롱':          { airport: 'Toulon Hyeres Airport',                 cruise: 'Port de Toulon' },
  // 터키
  '이스탄불':      { airport: 'Istanbul Airport',                      cruise: 'Galataport Istanbul' },
  '쿠샤다시':      { airport: 'Izmir Adnan Menderes Airport',          cruise: 'Kusadasi Cruise Port' },
};

const trim = (s?: string) => (s ?? '').replace(/\s+/g, ' ').trim();
const contains = (t: string, ...keys: string[]) => keys.some(k => t.toLowerCase().includes(k.toLowerCase()));

function cityPreset(place: string) {
  const hit = Object.keys(CITY_PRESETS).find(k => place.includes(k));
  return hit ? CITY_PRESETS[hit] : null;
}
function inferAirport(place: string) {
  const p = cityPreset(place);
  return p ? p.airport : `${place} 공항`;
}
function inferCruise(place: string) {
  const p = cityPreset(place);
  return p ? p.cruise : `${place} 크루즈 터미널`;
}

// ====== 교체: 패턴 한 가지 -> 다중 패턴 지원 ======
export function resolveFromTo(text: string):
  | { origin: Place; dest: Place; originText: string; destText: string }
  | null {
  const t = trim(text);
  if (!t) return null;

  // 1) 명시적 분리 패턴들
  const patterns: RegExp[] = [
    /(.+?)에서\s+(.+?)까지/i,
    /(.+?)부터\s+(.+?)까지/i,
    /(.+?)\s*(?:->|→|⇒|➡|~>|\~>)\s*(.+)/i,
    /(.+?)\s+to\s+(.+)/i,
    /(.+?)\s+(?:가는\s?길|route to|way to)\s+(.+)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (!m) continue;
    let a = trim(m[1]), b = trim(m[2]);
    if (!a || !b) continue;

    // 공항/터미널 키워드 없으면 자동 보강
    if (!/(공항|airport)/i.test(a)) a = inferAirport(a);
    if (!/(크루즈|터미널|부두|port|pier|cruise)/i.test(b)) b = inferCruise(b);

    return { origin: { text: a }, dest: { text: b }, originText: a, destText: b };
  }

  // 2) 지명 한 개만 주어진 경우(예: "마이애미", "도쿄", "카이탁")
  if (/^[가-힣a-z0-9()\-.'’\s]+$/i.test(t)) {
    const a = inferAirport(t);
    const b = inferCruise(t);
    return { origin: { text: a }, dest: { text: b }, originText: a, destText: b };
  }

  return null;
}

export function buildAllDirUrls(origin: Place, dest: Place) {
  return {
    transit: gmDirUrl({ origin: origin.text, destination: dest.text, mode: 'transit' }), // 대중교통
    driving: gmDirUrl({ origin: origin.text, destination: dest.text, mode: 'driving' }), // 자동차
    walking: gmDirUrl({ origin: origin.text, destination: dest.text, mode: 'walking' }), // 지도보기(걷기 중심)
  };
}

// Aliases for backwards compatibility
export const buildDirectionsUrl = gmDirUrl;
export const buildSearchUrl = gmSearchUrl;
