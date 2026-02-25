export function normalizeCountry(input: string): string | null {
  const t = (input || '').trim().toLowerCase();

  // 한글/영문/약어 모두 커버
  const MAP: Record<string, string> = {
    '미국': 'USA', 'usa': 'USA', 'u.s.a': 'USA', 'united states': 'USA',
    'us': 'USA', 'u.s.': 'USA', 'america': 'USA',
    '일본': 'Japan', 'japan': 'Japan',
    '중국': 'China', 'china': 'China', 'prc': 'China',
    '대만': 'Taiwan', 'taiwan': 'Taiwan',
    '싱가포르': 'Singapore', 'singapore': 'Singapore',
    '대한민국': 'South Korea', '한국': 'South Korea', 'south korea': 'South Korea',
    '캐나다': 'Canada', 'canada': 'Canada',
    '영국': 'United Kingdom', 'uk': 'United Kingdom', 'united kingdom': 'United Kingdom',
    '프랑스': 'France', 'france': 'France',
    '이탈리아': 'Italy', 'italy': 'Italy',
    '스페인': 'Spain', 'spain': 'Spain',
    '아랍에미리트': 'UAE', 'uae': 'UAE', 'united arab emirates': 'UAE',
    '호주': 'Australia', 'australia': 'Australia',
    '홍콩': 'Hong Kong', 'hong kong': 'Hong Kong', 'hk': 'Hong Kong',
    '마카오': 'Macau', 'macau': 'Macau', 'macao': 'Macau',
  };

  // 완전일치
  if (MAP[t]) return MAP[t];

  // 토큰 안에 포함되어 있어도 잡기("미국 공항", "USA airports" 등)
  for (const [k, v] of Object.entries(MAP)) {
    if (t.includes(k)) return v;
  }
  return null;
}
