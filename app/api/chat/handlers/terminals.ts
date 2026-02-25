import type { ChatMessage } from '@/lib/chat-types';
import { buildDirectionsUrl, buildSearchUrl, gmDirUrl } from '@/lib/maps';
import terminalsData from '@/data/terminals.json';
import { normalize, includesKo } from '@/src/vnext/lib/nav/utils';
import { findCountryCodeByKorean, portsByCountry, CRUISE_TERMINALS } from '@/src/vnext/lib/nav/data';

// locations는 현재 사용되지 않으므로 제거 (필요시 다시 추가)
// import locations from '@/data/locations.json';

type Terminal = {
  id: string;
  name: string;        // 영문 공식 명칭
  name_ko?: string;    // 한글 표시명
  keywords_ko?: string[];
  city?: string;
  country?: string;
};

interface RelatedPort {
  id: string;
  label: string;
  city?: string;
  country?: string;
  value: string; // 검색 질의로 보낼 영문 공식명
}

function getRelatedPorts(opts: {
  countryKor?: string | null;
  cityKorHint?: string | null;
  toInput?: string;
  limit?: number;
}): RelatedPort[] {
  const { countryKor, cityKorHint, toInput, limit = 12 } = opts;

  const countryIso = countryKor ? findCountryCodeByKorean(countryKor) : null;

  const seen = new Set<string>();
  const q = (toInput ?? '').trim();

  let base = (terminalsData as Terminal[]).filter(t =>
    countryIso ? t.country?.toLowerCase().startsWith(countryIso.toLowerCase()) ||
                 t.country?.toLowerCase() === 'usa' && countryIso === 'US' ||
                 t.country?.toLowerCase() === 'united states' && countryIso === 'US'
               : true
  );

  if (cityKorHint) {
    base = base.filter(t =>
      includesKo(t.city ?? '', cityKorHint) ||
      includesKo(t.name_ko ?? '', cityKorHint) ||
      includesKo(t.name, cityKorHint)
    );
  }

  if (q) {
    base = base.filter(t => {
      if (includesKo(t.name_ko ?? '', q)) return true;
      if (includesKo(t.name, q)) return true;
      if ((t.keywords_ko || []).some(k => includesKo(k, q))) return true;
      if (includesKo(t.city ?? '', q)) return true;
      return false;
    });
  }

  base.sort((a, b) => {
    const la = a.name_ko || a.name;
    const lb = b.name_ko || b.name;
    return la.localeCompare(lb, 'ko');
  });

  const final: RelatedPort[] = [];
  for (const t of base) {
    if (!t.id || seen.has(t.id)) continue;
    seen.add(t.id);

    const label = t.name_ko
      ? `${t.name_ko}${t.city ? ' · ' + t.city : ''}`
      : `${t.name}${t.city ? ' · ' + t.city : ''}`;

    final.push({
      id: t.id,
      label,
      city: t.city,
      country: t.country,
      value: t.name,
    });
    if (final.length >= limit) break;
  }

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
}

// shortlist 함수는 더 이상 사용하지 않으므로 제거합니다.
// function shortlist(t: string): Terminal[] {
//   const q = t.toLowerCase();
//   return (terminals as Terminal[])
//     .filter(x => (x.name||'').toLowerCase().includes(q) || (x.city||'').toLowerCase().includes(q))
//     .slice(0, 6);
// }

export function handleAskTerminal(message: string, originHint?: string): ChatMessage[] {
  // message에서 countryKor, cityKorHint, toInput 추출 로직 (예시)
  const countryKor = null; // message에서 국가명 추출 로직 필요
  const cityKorHint = null; // message에서 도시 힌트 추출 로직 필요
  const toInput = message; // 전체 메시지를 도착지 입력값으로 사용 (조정 필요)

  const relatedPorts = getRelatedPorts({
    countryKor,
    cityKorHint,
    toInput,
    limit: 6,
  });

  const msgId = () => Date.now().toString() + Math.random().toString(36).slice(2);

  if (!relatedPorts.length) {
    return [{ 
      id: msgId(),
      role: 'assistant',
      type: 'text', 
      text: '원하는 터미널명을 조금 더 구체적으로 알려주세요. (예: 포트 에버글레이즈)' 
    }];
  }

  const buttonsText = relatedPorts.map(t => `• ${t.label}`).join('\n');
  return [
    { 
      id: msgId(),
      role: 'assistant',
      type: 'text', 
      text: `어느 터미널로 가실까요?\n아래에서 선택해 주세요.\n\n${buttonsText}` 
    },
    {
      id: msgId(),
      role: 'assistant',
      type: 'map-links',
      title: '바로 길찾기',
      links: relatedPorts.map(t => {
        const q = t.value;
        const href = originHint
          ? gmDirUrl({ origin: originHint, destination: q, mode: 'driving' })
          : buildSearchUrl(q);
        return { label: `🚗 ${t.label}`, href, kind: 'directions' };
      }),
      ports: relatedPorts.map(t => ({
        id: t.id,
        name: t.value,
        name_ko: t.label,
        lat: (terminalsData as any[]).find(term => term.id === t.id)?.lat || 0, // terminalsData에서 lat, lng 가져오기
        lng: (terminalsData as any[]).find(term => term.id === t.id)?.lng || 0,
        city: t.city,
        country: t.country,
      })), // ports 필드 추가
    },
    { 
      id: msgId(),
      role: 'assistant',
      type: 'text', 
      text: '버튼을 누르면 새 창에서 지도/네비가 열립니다.' 
    }
  ];
} 