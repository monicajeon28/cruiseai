export type Intent = "directions" | "nearby" | "translate" | "photos" | "free";

// “지니야 가자/보여줘” 탭이 보내는 explicitMode 로 강제 지정 가능
export function detectIntent(t: string, explicitMode?: "go" | "show" | "general"): Intent {
  const s = t.toLowerCase();

  if (explicitMode === "go") return "directions";
  if (explicitMode === "show") return "photos";
  if (explicitMode === "general") return "free";

  if (isDirectionsLike(s)) return "directions";
  if (isNearbyLike(s)) return "nearby";

  return "free";
}

export function isDirectionsLike(t: string) {
  return /(어떻게\s*가|길찾기|가는\s*법|route|directions)/i.test(t);
}
export function isNearbyLike(t: string) {
  return /(근처|주변|nearby)/i.test(t);
}
export function isHereLike(t: string) {
  return /(현\s*위치|지금\s*여기|현재\s*내\s*위치)/i.test(t);
}

// “A에서 B까지” / “A -> B” / “A부터 B까지” 형태 모두 파싱
export function parseOriginDestination(text: string) {
  let originText = "";
  let destText = "";

  const m1 = text.match(/(.+?)\s*(에서|부터)\s*(.+?)\s*(까지|가|로)/); // A에서 B까지/가/로
  if (m1) {
    originText = (m1[1] || "").trim();
    destText = (m1[3] || "").trim();
  }
  // "A → B" 형식도 처리 (InputBar에서 보내는 형식)
  const m2_arrow = text.match(/(.+?)\s*(→|->)\s*(.+)/);              // A → B, A -> B
  if (!m1 && m2_arrow) {
    originText = (m2_arrow[1] || "").trim();
    destText = (m2_arrow[3] || "").trim();
  }
  
  // "A에서 B" 형식 처리 (m2와 구분)
  const m2_from = text.match(/(.+?)\s*에서\s*(.+)/);
  if (!m1 && !m2_arrow && m2_from) {
    originText = (m2_from[1] || "").trim();
    destText = (m2_from[2] || "").trim();
  }
  if (!originText && !destText) {
    // “미국 크루즈 터미널 어떻게 가?” => 목적지만 추출
    const m3 = text.match(/(.+?)\s*(어떻게\s*가|길찾기)/);
    if (m3) destText = (m3[1] || "").trim();
  }
  return { originText, destText };
}

// route.ts에서 parseTwoPlace를 사용하므로 해당 함수를 새로 추가
export function parseTwoPlace(t: string) {
  const a = /(.*?)(에서|부터)\s*(.*?)(까지)/.exec(t)
  if (a) return { origin: a[1].trim(), destination: a[3].trim() }
  // "→"와 "->" 모두 처리
  const b = /(.*?)(→|->)\s*(.*)/.exec(t)
  if (b) return { origin: b[1].trim(), destination: b[3].trim() }
  return null
}

export function isTwoPlaceForm(t: string) {
  // "X에서 Y까지", "X->Y", "X→Y", "X 부터 Y 까지" 형태
  return /(.*?)(에서|부터)\s*(.*?)(까지)/.test(t) || /(.*?)(→|->)\s*(.*)/.test(t)
}

// 별칭/카테고리 검색
export function resolvePlaceName(name: string, DB: LocationsDB): string | null {
  if (!name) return null;
  const n = name.trim();
  if (DB.aliases[n]) return DB.aliases[n];

  for (const category of ["terminals", "airports", "stations"] as const) {
    const cand = Object.keys(DB[category]).find(k => k.includes(n) || n.includes(k));
    if (cand) return cand;
  }
  return null;
}

export const AIRPORTS = [
  { name: '인천국제공항', code: 'ICN', query: 'Incheon International Airport' },
  { name: '홍콩국제공항', code: 'HKG', query: 'Hong Kong International Airport' },
  { name: '마이애미 국제공항', code: 'MIA', query: 'Miami International Airport' },
  // …
]

export function pickAirportLike(text: string) {
  const t = text.toLowerCase()
  return AIRPORTS.filter(a =>
    t.includes(a.name.toLowerCase()) || t.includes(a.code.toLowerCase()),
  )
}

export function isAirportToTerminal(t: string) {
  return /(공항).*(터미널)|터미널.*(공항)/.test(t)
}

// 타입
export type LocationsDB = {
  aliases: Record<string, string>;
  terminals: Record<string, { map_query: string }>;
  airports: Record<string, { map_query: string }>;
  stations: Record<string, { map_query: string }>;
};

// 구글맵 링크
export function gmapDir(origin: string, dest: string, mode: "driving" | "transit" | "walking" = "driving") {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=${mode}`;
}
export function gmapSearch(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// 근처 키워드
export const NEARBY_KEYWORDS = ["스타벅스", "카페", "편의점", "마트", "market", "식당", "약국", "호텔"];

// 검색 키워드 (NEARBY_KEYWORDS 확장)
export const SEARCH_KEYWORDS = [
  ...NEARBY_KEYWORDS,
  "맛집", "restaurant", "food", "dining", "eatery",
  "관광지", "tourist", "attraction", "sightseeing", "landmark", "spot",
  "은행", "bank",
  "병원", "hospital", "clinic", "medical",
  "주유소", "gas station", "gasoline", "petrol",
  "ATM", "atm",
  "마트", "supermarket", "grocery",
  "약국", "pharmacy", "drugstore",
  "호텔", "hotel", "accommodation"
];

export function extractNearbyKeyword(t: string) {
  return NEARBY_KEYWORDS.find(k => t.toLowerCase().includes(k.toLowerCase()));
}

export function extractSearchKeyword(t: string): string | null {
  const lower = t.toLowerCase();
  return SEARCH_KEYWORDS.find(k => lower.includes(k.toLowerCase())) || null;
}

export function isKeywordSearch(text: string): boolean {
  return extractSearchKeyword(text) !== null;
} 