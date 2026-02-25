import terminalsData from '@/data/terminals.json';
import { normalizeCountry } from '@/lib/nav/country';
import { POI, buildTokens } from '@/lib/nav/poiTokens'; // Import POI and buildTokens

// Remove local POI type definition as it's now imported

const ALL: POI[] = terminalsData as unknown as POI[];

export function isAirport(p: POI) {
  return /airport/i.test(p.name) || /공항/i.test(p.name_ko);
}
export function isCruise(p: POI) {
  return /cruise|terminal|port/i.test(p.name) || /크루즈|터미널|항/i.test(p.name_ko);
}

/** ★ 공항/도시/터미널 자유 텍스트에서 국가를 유추 */
export function resolveCountryFromText(t: string): string | null {
  const q = (t || '').trim().toLowerCase();
  if (!q) return null;

  // 1) 먼저 나라명 자체가 들어있으면 바로 반환
  const byName = normalizeCountry(q);
  if (byName) return byName;

  for (const p of ALL) {
    const tokens = buildTokens(p).map(token => token.toLowerCase()); // Use buildTokens

    // ★ 핵심: 양방향 포함 체크 (q ⊂ tok 또는 tok ⊂ q)
    if (tokens.some(tok => tok && (q.includes(tok) || tok.includes(q)))) {
      return p.country;
    }
  }
  return null;
}

/** from: 공항 우선 (기존 그대로) */
export function findOrigins(q: string): POI[] {
  const cn = normalizeCountry(q);
  if (cn) return ALL.filter(p => isAirport(p) && p.country === cn).slice(0, 8);

  // 토큰 매칭
  const qn = (q || '').toLowerCase();
  return ALL.filter(isAirport)
    .filter(p => {
      const tokens = buildTokens(p).map(token => token.toLowerCase());
      return tokens.some(tok => tok.includes(qn) || qn.includes(tok));
    })
    .slice(0, 8);
}

/** ★ to: hint(출발값)에서 국가를 최대한 뽑아 그 나라 크루즈만 우선 노출 */
export function findDestinations(q: string, hint?: string): POI[] {
  // ① hint에서 나라 추론(나라명/공항명/도시명 모두 지원)
  const cnFromHint =
    normalizeCountry(hint || '') ||
    resolveCountryFromText(hint || '');

  // ② q 자체가 나라/도시일 수도 있으니 보조로 한 번 더
  const cnFallback =
    normalizeCountry(q || '') ||
    resolveCountryFromText(q || '');

  const cn = cnFromHint || cnFallback; // ← 최종 국가

  // 기준 리스트(크루즈만)
  let base = ALL.filter(isCruise);
  if (cn) base = base.filter(p => p.country === cn); // ★ 나라 제한

  const qnorm = (q || '').trim().toLowerCase();
  const GENERIC = ['크루즈', '크루즈터미널', '터미널', '항', 'port', 'cruise', 'terminal'];
  const isGeneric = !qnorm || GENERIC.some(g => qnorm.includes(g));

  const match = (p: POI) => {
    if (isGeneric) return true;
    const tokens = buildTokens(p).map(token => token.toLowerCase());
    return tokens.some(tok => tok.includes(qnorm) || qnorm.includes(tok));
  };

  const score = (p: POI) => {
    let s = 0;
    if (/cruise|terminal|port/i.test(p.name)) s += 2;
    if ((p.name_ko + ' ' + (p.keywords_ko || []).join(' ')).toLowerCase().includes('크루즈')) s += 2;
    return s;
  };

  return base.filter(match).sort((a,b) => score(b)-score(a)).slice(0, 12);
}
