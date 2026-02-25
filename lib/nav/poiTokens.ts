export type POI = {
  id: string;
  name: string;
  name_ko: string;
  keywords_ko?: string[];
  lat: number; lng: number;
  city: string; country: string;
};

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()·.,\-]/g, '');

// 한글 키워드 → 영문 동의어 간단 확장 (필요하면 더 추가)
const KO_SYNONYM_MAP: [RegExp, string[]][] = [
  [/국제/g, ['intl','international']],
  [/공항/g, ['airport','airpt']],
  [/터미널/g, ['terminal','passenger']],
  [/여객/g, ['passenger']],
  [/항$/g,   ['port','harbor','harbour']],
  [/크루즈/g,['cruise']],
];

function expandSynonymsKorean(s: string): string[] {
  const out = new Set<string>([s]);
  for (const [re, repls] of KO_SYNONYM_MAP) {
    if (re.test(s)) for (const r of repls) out.add(s.replace(re, r));
  }
  return [...out];
}

// 괄호 코드 추출: "Tokyo Haneda Airport (HND)" → HND
function extractCodes(s: string): string[] {
  const m = s.match(/\(([A-Z0-9]{2,5})\)/g);
  if (!m) return [];
  return m.map(x => x.replace(/[()]/g, ''));
}

// ★ 모든 POI에 동일 규칙으로 토큰 생성
export function buildTokens(p: POI) {
  const raw: string[] = [
    p.name_ko, p.name, p.city, p.country,
    ...(p.keywords_ko || []),
  ].filter(Boolean);

  const expanded: string[] = [];
  for (const t of raw) {
    expanded.push(t);
    expandSynonymsKorean(t).forEach(v => expanded.push(v));
    extractCodes(t).forEach(code => expanded.push(code));
  }

  // 원형 + 정규화(공백/기호 제거) 둘 다 보관
  const withVariants = new Set<string>();
  for (const t of expanded) {
    withVariants.add(t);
    withVariants.add(norm(t));
  }
  return [...withVariants].filter(Boolean);
}
