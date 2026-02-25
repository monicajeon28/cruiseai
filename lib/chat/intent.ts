export type Intent = 'NAVIGATE' | 'NEARBY' | 'PHOTO' | 'GENERAL';

export type Slots = {
  origin?: string;         // 출발지 자연어
  destination?: string;    // 도착지 자연어
  countryHint?: string;    // “미국/일본/대만/홍콩…” 등
  category?: 'food'|'cafe'|'kids'|'sights'|'shopping';
};

const R = {
  navigate: /(어떻게\s*가|가는\s*법|길찾기|터미널\s*까지|공항\s*까지|지도)/i,
  nearby: /(근처|가까운|near|around|주변)/i,
  country: /(미국|일본|대만|홍콩|한국|대한민국|중국|대륙|유럽|태국|베트남)/i,
  categories: {
    food: /(맛집|restaurant|food)/i,
    cafe: /(카페|cafe)/i,
    kids: /(아이|키즈|children|play|놀)/i,
    sights: /(관광지|명소|sight|attraction)/i,
    shopping: /(쇼핑|mall|아울렛)/i,
  }
};

export function detectIntent(q: string): Intent {
  if (R.nearby.test(q)) return 'NEARBY';
  if (R.navigate.test(q)) return 'NAVIGATE';
  return 'GENERAL';
}

export function extractSlots(q: string): Slots {
  const s: Slots = {};
  const m = q.match(R.country);
  if (m) s.countryHint = m[1];

  for (const [k,re] of Object.entries(R.categories)) {
    if (re.test(q)) s.category = k as Slots['category'];
  }

  // 아주 간단한 origin/destination 추정:
  // “A에서 B까지/로/가/터미널” 형태 우선
  const od1 = q.match(/(.+?)에서\s+(.+?)(까지|로)?/);
  if (od1) {
    s.origin = od1[1].trim();
    s.destination = od1[2].trim();
  } else {
    // “…터미널” “…공항” 만 있고 출발지는 없는 케이스
    const dest = q.match(/(.+?)(터미널|공항|station|port)/i);
    if (dest) s.destination = dest[0].trim();
  }
  return s;
}













