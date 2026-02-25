import { useMemo } from 'react';
import terminals from '@/data/terminals.json';
import { normalize, includesKo } from '@/src/vnext/lib/nav/utils';
import { findCountryCodeByKorean, portsByCountry } from '@/src/vnext/lib/nav/data';

type Terminal = {
  id: string;
  name: string;        // 영문 공식 명칭
  name_ko?: string;    // 한글 표시명
  keywords_ko?: string[];
  city?: string;
  country?: string;
};

type Options = {
  // 예: "미국", "일본" 같은 한글 국가 라벨 (없으면 전체)
  countryKor?: string | null;
  // 예: "마이애미" "로스앤젤레스" 등 힌트 (없어도 됨)
  cityKorHint?: string | null;
  // 도착지 입력값 (예: "크루즈", "마이애미 크루즈 터미널")
  toInput?: string;
  // 최대 표시 개수
  limit?: number;
};

export function useRelatedPorts(opts: Options) {
  const { countryKor, cityKorHint, toInput, limit = 12 } = opts;

  const countryIso = useMemo(
    () => (countryKor ? findCountryCodeByKorean(countryKor) : null),
    [countryKor]
  );

  const list = useMemo(() => {
    const seen = new Set<string>();
    const q = (toInput ?? '').trim();

    // 1) 우선순위 A: countryIso가 있으면 해당 국가 터미널만
    let base = (terminals as Terminal[]).filter(t =>
      countryIso ? t.country?.toLowerCase().startsWith(countryIso.toLowerCase()) || // ISO(US, JP..)가 country 필드에서 다르게 표기될 수 있어 느슨히
                   t.country?.toLowerCase() === 'usa' && countryIso === 'US' ||
                   t.country?.toLowerCase() === 'united states' && countryIso === 'US'
                 : true
    );

    // 2) 우선순위 B: city 힌트가 있으면 도시 부분일치로 한번 더 좁히기 (없으면 스킵)
    if (cityKorHint) {
      base = base.filter(t =>
        includesKo(t.city ?? '', cityKorHint) ||
        includesKo(t.name_ko ?? '', cityKorHint) ||
        includesKo(t.name, cityKorHint)
      );
    }

    // 3) 도착지 입력값이 있으면 label/keywords에서 추가 필터
    if (q) {
      base = base.filter(t => {
        if (includesKo(t.name_ko ?? '', q)) return true;
        if (includesKo(t.name, q)) return true;
        if ((t.keywords_ko || []).some(k => includesKo(k, q))) return true;
        if (includesKo(t.city ?? '', q)) return true;
        return false;
      });
    }

    // 4) 정렬(라이트): 한국어 이름 우선 → 영문 → 도시
    base.sort((a, b) => {
      const la = a.name_ko || a.name;
      const lb = b.name_ko || b.name;
      return la.localeCompare(lb, 'ko');
    });

    // 5) 중복 id 제거 + 라벨 구성
    const final = [];
    for (const t of base) {
      if (!t.id || seen.has(t.id)) continue;
      seen.add(t.id);

      // 한국어 표시가 있으면 ko 우선, 없으면 영문
      const label = t.name_ko
        ? `${t.name_ko}${t.city ? ' · ' + t.city : ''}`
        : `${t.name}${t.city ? ' · ' + t.city : ''}`;

      final.push({
        id: t.id,
        label,
        city: t.city,
        country: t.country,
        value: t.name, // 검색 질의로 보낼 영문 공식명
      });
      if (final.length >= limit) break;
    }

    // 6) 국가만 있고 결과가 너무 적으면 data.ts의 portsByCountry 보강
    if (final.length < Math.min(6, limit) && countryIso && portsByCountry[countryIso]) {
      for (const p of portsByCountry[countryIso]) {
        if (final.find(f => f.label.includes(p.label))) continue;
        final.push({
          id: `fallback-${p.value}`,
          label: p.label,
          value: p.value,
        });
        if (final.length >= limit) break;
      }
    }

    return final;
  }, [countryIso, cityKorHint, toInput, limit]);

  return list;
}
