export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server'
import terminalsData from '@/data/terminals.json'
import { normalizeCountry } from '@/lib/nav/country'
import { resolveTerminalByText, type POI, type Terminal, TERMINALS, norm, buildTokens } from '@/lib/terminals' // Import POI, buildTokens, and norm from lib/terminals

// Removed local POI type definition as it's now imported

const ALL_UNUSED: POI[] = terminalsData as unknown as POI[] // ALL_UNUSED로 변경하여 사용하지 않음

// Removed local POI type definition as it's now imported

// 전역 토큰 캐시 (더 이상 사용하지 않음)
// const TOKENS = new Map<string, string[]>();
// function tokensOf(p: POI) {
//   let t = TOKENS.get(p.id);
//   if (!t) { t = buildTokens(p); TOKENS.set(p.id, t); }
//   return t!;
// }

// 공항 감지: ID 필드로 확실하게 구분 (airport가 ID에 있으면 무조건 공항)
const isAirport = (p: POI) =>
  p.id.includes('airport')

// 크루즈 터미널 감지: 공항이 아닌 것 중에서만 (airport와 cruise는 상호배타적)
const isCruise = (p: POI) =>
  !isAirport(p) && (
    p.id.includes('cruise') ||
    p.id.includes('port') ||
    p.id.includes('terminal') ||
    /크루즈|터미널/i.test(p.name_ko)
  )

const isMilitary = (p: POI) =>
  /(naval|military|air\s?base|army|navy|marine|base)/i.test(p.name) ||
  /(군|軍|군항|군사|기지|해군|공군|육군|해병|항만사령)/.test(p.name_ko)

/** ★ 자유 텍스트(공항/도시/POI명/키워드)에서 국가 유추: 양방향 포함 + keywords 지원 */
function resolveCountryFromText(t: string): string | null {
  const q = (t || '').trim().toLowerCase()
  if (!q) return null

  const byName = normalizeCountry(q)
  if (byName) return byName

  for (const p of TERMINALS) { // ALL 대신 TERMINALS 사용
    const toks = buildTokens(p);               // ← buildTokens 재사용
    if (toks.some(tok => {
      const a = tok.toLowerCase();
      return a.includes(q) || q.includes(a);
    })) {
      return p.country;
    }
  }
  return null
}

function airportsByCountryStrict(qOrHint: string): POI[] {
  const cn =
    normalizeCountry(qOrHint) ||
    resolveCountryFromText(qOrHint) ||
    null
  if (!cn) return []

  let list = TERMINALS.filter(p => isAirport(p) && !isMilitary(p) && p.country === cn) // ALL 대신 TERMINALS 사용
  if (!list.length && cn === 'USA') {
    const MUST = ['jfk_airport', 'lax_airport', 'miami_airport', 'fll_airport', 'orlando_airport']
    const byId = new Map(TERMINALS.map(p => [p.id, p])) // ALL 대신 TERMINALS 사용
    list = MUST.map(id => byId.get(id)).filter(Boolean) as POI[]
  }
  return list.slice(0, 8)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const slot = (searchParams.get('slot') || 'origin') as 'origin' | 'dest' | 'from' | 'to'
  const q    = (searchParams.get('q')    || '').trim()
  const hint = (searchParams.get('hint') || '').trim()

  let items: { id: string; label: string; subtitle?: string }[] = []

  // slot 정규화 (from -> origin, to -> dest)
  const normalizedSlot = slot === 'from' ? 'origin' : slot === 'to' ? 'dest' : slot;

  if (normalizedSlot === 'origin') {
    // "미국 크루즈", "미국 포트", "일본 크루즈" 같은 패턴 감지
    const isCruiseQuery = /크루즈|터미널|포트|cruise|terminal|port/i.test(q);
    
    // 1) q에서 나라가 뽑히면
    // 국가명 추출: "미국 크루즈" -> "미국", "미국 포트" -> "미국"
    // 우선순위: 1) 첫 단어, 2) 패턴 매칭, 3) 역순 패턴, 4) 전체 문자열
    let cnQ: string | null = null;
    
    // 1순위: 첫 단어에서 국가 추출 시도 ("미국 크루즈" -> "미국", "일본 크루즈 터미널" -> "일본")
    const firstWord = q.trim().split(/\s+/)[0];
    cnQ = normalizeCountry(firstWord) || resolveCountryFromText(firstWord);
    if (cnQ) {
      console.log('[nav/suggest] ✅ Extracted country from first word:', { q, firstWord, cnQ });
    }
    
    // 2순위: 국가명 + 키워드 패턴에서 국가명 추출
    // "미국 크루즈", "미국 포트", "미국 터미널", "일본 크루즈 터미널" 같은 패턴에서 국가명 추출
    if (!cnQ) {
      const countryPattern = /^(.+?)\s+(크루즈|포트|터미널|cruise|port|terminal)(\s*터미널|\s*크루즈)?/i;
      const match = q.match(countryPattern);
      if (match && match[1]) {
        const countryPart = match[1].trim();
        const extractedCountry = normalizeCountry(countryPart) || resolveCountryFromText(countryPart);
        if (extractedCountry) {
          cnQ = extractedCountry;
          console.log('[nav/suggest] ✅ Extracted country from pattern:', { q, countryPart, cnQ });
        }
      }
    }
    
    // 3순위: 반대로도 시도: "크루즈 미국", "포트 미국", "터미널 일본" 등
    if (!cnQ) {
      const reversePattern = /(크루즈|포트|터미널|cruise|port|terminal)\s+(.+)$/i;
      const reverseMatch = q.match(reversePattern);
      if (reverseMatch && reverseMatch[2]) {
        const countryPart = reverseMatch[2].trim();
        // "일본 크루즈 터미널"에서 "크루즈 터미널" 제거
        const cleanCountryPart = countryPart.replace(/\s*(크루즈|터미널|cruise|terminal)(\s*(크루즈|터미널|cruise|terminal))?\s*$/i, '').trim();
        if (cleanCountryPart) {
          const extractedCountry = normalizeCountry(cleanCountryPart) || resolveCountryFromText(cleanCountryPart);
          if (extractedCountry) {
            cnQ = extractedCountry;
            console.log('[nav/suggest] ✅ Extracted country from reverse pattern:', { q, cleanCountryPart, cnQ });
          }
        }
      }
    }
    
    // 4순위: 전체 문자열에서 국가 추출 시도
    if (!cnQ) {
      cnQ = normalizeCountry(q) || resolveCountryFromText(q);
      if (cnQ) {
        console.log('[nav/suggest] ✅ Extracted country from full string:', { q, cnQ });
      }
    }
    
    // 최종 국가 추출 로그
    console.log('[nav/suggest] Country extraction result:', { q, cnQ, isCruiseQuery });
    
    if (cnQ) {
      if (isCruiseQuery) {
        // "미국 크루즈", "미국 포트", "일본 크루즈 터미널" 같은 경우: 크루즈 터미널만 반환 (모두 표시)
        const terminals = TERMINALS.filter(p => isCruise(p) && !isMilitary(p) && p.country === cnQ);
        items = terminals.map(p => {
          // 크루즈 터미널인데 라벨에 "크루즈 터미널" 명시가 없으면 추가 (50대 이상 사용자 배려)
          let label = p.name_ko || p.name;
          if (!label.includes('크루즈') && !label.includes('터미널') && !label.includes('cruise') && !label.includes('terminal')) {
            label = `${label} 크루즈 터미널`;
          }
          return { id: p.id, label, subtitle: p.city };
        });
        console.log('[nav/suggest] ✅ Country + cruise/port query - SUCCESS:', { 
          q, 
          cnQ, 
          terminalsCount: items.length,
          terminals: terminals.map(p => ({ id: p.id, name_ko: p.name_ko, name: p.name }))
        });
        
        // 크루즈 터미널이 없으면 일반 검색으로 fallback
        if (items.length === 0) {
          console.log('[nav/suggest] ⚠️ No terminals found for country, falling back to general search');
          cnQ = null; // fall through to general search
        } else {
          // 성공적으로 크루즈 터미널을 찾았으므로 여기서 반환
          const unique = Array.from(new Map(items.map(i => [i.id, i])).values()).slice(0, 20);
          console.log('[nav/suggest] ✅ Returning country cruise terminals:', unique.length);
          return NextResponse.json({ items: unique });
        }
      } else {
        // 국가명만 입력: 공항 + 크루즈 터미널 모두 반환 (모두 표시)
        const airports = TERMINALS.filter(p => isAirport(p) && !isMilitary(p) && p.country === cnQ);
        const terminals = TERMINALS.filter(p => isCruise(p) && !isMilitary(p) && p.country === cnQ);
        items = [
          ...airports.map(p => {
            // 공항인데 라벨에 "공항" 명시가 없으면 추가 (50대 이상 사용자 배려)
            let label = p.name_ko || p.name;
            if (!label.includes('공항') && !label.includes('Airport')) {
              label = `${label} 공항`;
            }
            return { id: p.id, label, subtitle: p.city };
          }),
          ...terminals.map(p => {
            // 크루즈 터미널인데 라벨에 "크루즈 터미널" 명시가 없으면 추가
            let label = p.name_ko || p.name;
            if (!label.includes('크루즈 터미널') && !label.includes('크루즈') && !label.includes('터미널')) {
              label = `${label} 크루즈 터미널`;
            }
            return { id: p.id, label, subtitle: p.city };
          }),
        ].slice(0, 12); // 최대 12개 (2줄에 6개씩)
        
        console.log('[nav/suggest] ✅ Country only query:', { 
          q, 
          cnQ, 
          airportsCount: airports.length,
          terminalsCount: terminals.length,
          totalItems: items.length
        });
      }
    } else if (!q) {
      // 출발지 비어있으면 주요 공항 + 주요 크루즈 터미널 제안 (모두 공항과 크루즈 터미널 포함)
      const majorAirports = TERMINALS.filter(p => isAirport(p) && !isMilitary(p)).filter(p =>
        ['인천국제공항', '김포국제공항', '김해국제공항', '나리타 국제공항', '하네다 공항',
         '홍콩 국제공항', '타이완 타오위안 국제공항', '존 F 케네디 국제공항', '로스앤젤레스 국제공항'].includes(p.name_ko)
      ).slice(0, 6);

      const majorTerminals = TERMINALS.filter(p => isCruise(p) && !isMilitary(p)).filter(p =>
        ['포트 커내버럴 크루즈 터미널', '포트마이애미', '포트 에버글레이즈',
         '브루클린 크루즈 터미널', '요코하마 크루즈 터미널'].includes(p.name_ko)
      ).slice(0, 6);

      items = [
        ...majorAirports.map(p => {
          // 공항은 그대로 표시 (이미 "공항"이 포함되어 있음)
          let label = p.name_ko || p.name;
          return { id: p.id, label, subtitle: p.city };
        }),
        ...majorTerminals.map(p => {
          // 크루즈 터미널인데 라벨에 "크루즈 터미널" 명시가 없으면 추가
          let label = p.name_ko || p.name;
          if (!label.includes('크루즈 터미널') && !label.includes('크루즈') && !label.includes('터미널')) {
            label = `${label} 크루즈 터미널`;
          }
          return { id: p.id, label, subtitle: p.city };
        }),
      ].slice(0, 12); // 최대 12개 (2줄에 6개씩)
      
      console.log('[nav/suggest] ✅ Initial suggestions (no query):', {
        airportsCount: majorAirports.length,
        terminalsCount: majorTerminals.length,
        totalItems: items.length
      });
    } else {
      // 2) 일반 검색: 공항 + 크루즈 터미널 모두 검색 (크루즈 터미널 이름 직접 검색 지원)
      const ql = q.toLowerCase().trim();
      const qnorm = norm(q); // 정규화된 검색어도 추가
      
      // "포트" 키워드가 있으면 크루즈 터미널 우선 검색
      const isPortQuery = ql.includes('포트') || ql.includes('port');
      const isCruiseNameQuery = isCruiseQuery || isPortQuery;
      
      const allPOIs = TERMINALS.filter(p => {
        if (isMilitary(p)) return false;
        // 공항 또는 크루즈 터미널만
        if (!isAirport(p) && !isCruise(p)) return false;
        
        // "포트" 검색 시 크루즈 터미널만 우선 (공항 제외)
        if (isPortQuery && !isCruise(p)) return false;
        
        // 여러 방식으로 매칭 시도
        const name_ko_lower = (p.name_ko || '').toLowerCase();
        const name_lower = (p.name || '').toLowerCase();
        const nameMatch = name_ko_lower.includes(ql) || name_lower.includes(ql);
        
        // 키워드 매칭 (keywords_ko 배열의 모든 키워드 확인)
        // "포트 커내버럴" 검색 시 "포트 커내버럴" 키워드와 매칭되도록 개선
        const keywordMatch = p.keywords_ko?.some(kw => {
          if (!kw) return false;
          const kwLower = kw.toLowerCase();
          // 정확히 포함되는지 확인
          if (kwLower.includes(ql) || ql.includes(kwLower)) return true;
          // 부분 일치도 확인 (예: "포트" -> "포트 커내버럴")
          const kwTokens = kwLower.split(/\s+/);
          const qTokens = ql.split(/\s+/);
          return kwTokens.some(kt => qTokens.some(qt => kt.includes(qt) || qt.includes(kt)));
        }) || false;
        
        const cityMatch = (p.city || '').toLowerCase().includes(ql);
        
        // 토큰 기반 검색 (정규화된 토큰 포함)
        const tokens = buildTokens(p).map(token => token.toLowerCase());
        const tokenMatch = tokens.some(tok => {
          const tokNorm = norm(tok);
          return tok.includes(ql) || ql.includes(tok) || tokNorm.includes(qnorm) || qnorm.includes(tokNorm);
        });
        
        const matched = nameMatch || keywordMatch || cityMatch || tokenMatch;
        
        // 디버그 로그 (포트로 시작하는 검색 시)
        if (ql.includes('포트') || ql.startsWith('포트')) {
          console.log('[nav/suggest] Port search - POI check:', {
            id: p.id,
            name_ko: p.name_ko,
            name: p.name,
            isCruise: isCruise(p),
            isAirport: isAirport(p),
            nameMatch,
            keywordMatch,
            cityMatch,
            tokenMatch,
            matched,
            keywords_ko: p.keywords_ko
          });
        }
        
        return matched;
      });
      
      // 매칭 점수로 정렬 (일치도가 높은 순서)
      const scored = allPOIs.map(p => {
        let score = 0;
        const name_ko_lower = (p.name_ko || '').toLowerCase();
        const name_lower = (p.name || '').toLowerCase();
        
        // 시작 부분 일치가 가장 높은 점수
        if (name_ko_lower.startsWith(ql) || name_lower.startsWith(ql)) score += 10;
        // 이름에 포함
        if (name_ko_lower.includes(ql) || name_lower.includes(ql)) score += 5;
        
        // 키워드 일치 (키워드가 검색어를 포함하거나, 검색어가 키워드를 포함하는 경우)
        const keywordMatched = p.keywords_ko?.some(kw => {
          if (!kw) return false;
          const kwLower = kw.toLowerCase();
          return kwLower.includes(ql) || ql.includes(kwLower) || 
                 kwLower.split(/\s+/).some(kt => ql.split(/\s+/).some(qt => kt.includes(qt) || qt.includes(kt)));
        });
        if (keywordMatched) score += 5; // 키워드 매칭 점수 증가
        
        // 크루즈 터미널 우선 표시 (크루즈 관련 검색 시)
        if (isCruiseNameQuery && isCruise(p)) score += 3;
        
        // 도시 일치
        if (p.city?.toLowerCase().includes(ql)) score += 1;
        
        return { poi: p, score };
      }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score);
      
      // 공항과 크루즈 터미널 모두 포함 (연관검색 결과 최대 12개 - 2줄에 6개씩)
      items = scored.map(({ poi: p }) => {
        let label = p.name_ko || p.name;
        // 공항과 크루즈 터미널은 상호배타적 (둘 다 추가되지 않도록 if-else 사용)
        if (isAirport(p)) {
          // 공항인데 라벨에 "공항" 명시가 없으면 추가 (50대 이상 사용자 배려)
          if (!label.includes('공항') && !label.includes('Airport')) {
            label = `${label} 공항`;
          }
        } else if (isCruise(p)) {
          // 크루즈 터미널인데 라벨에 "크루즈 터미널" 명시가 없으면 추가 (50대 이상 사용자 배려)
          if (!label.includes('크루즈 터미널') && !label.includes('크루즈') && !label.includes('터미널')) {
            label = `${label} 크루즈 터미널`;
          }
        }
        return { id: p.id, label, subtitle: p.city };
      }).slice(0, 12);
      
      // 디버그 로그 추가 (상세)
      console.log('[nav/suggest] ✅ General search - detailed:', { 
        q, 
        ql,
        qnorm,
        isPortQuery,
        isCruiseNameQuery,
        allPOIsCount: allPOIs.length,
        scoredCount: scored.length,
        itemsCount: items.length, 
        items: items.map(i => ({ id: i.id, label: i.label, subtitle: i.subtitle })),
        topScores: scored.slice(0, 5).map(({ poi: p, score }) => ({ name: p.name_ko, score, isCruise: isCruise(p) }))
      });
    }
  } else {
    // 목적지 (dest) - 공항과 크루즈 터미널 모두 포함
    const ql = q.toLowerCase().trim();
    const qnorm = norm(q);
    
    // "크루즈 터미널", "터미널", "포트" 같은 키워드 검색 감지
    const isCruiseQuery = /크루즈|터미널|포트|cruise|terminal|port/i.test(q);
    
    // 3) 목적지 힌트(출발지)가 있으면 그 나라 우선
    const cnHint = normalizeCountry(hint) || resolveCountryFromText(hint);
    
    console.log('[nav/suggest] Dest slot:', { q, ql, hint, cnHint, isCruiseQuery });
    
    if (!q) {
      // 도착지 비어있으면 공항과 크루즈 터미널 모두 제안 (출발지 국가 기준)
      const allPOIs = TERMINALS.filter(p => {
        if (isMilitary(p)) return false;
        if (!isAirport(p) && !isCruise(p)) return false;
        if (cnHint && p.country !== cnHint) return false;
        return true;
      });
      items = allPOIs.map(p => {
        let label = p.name_ko || p.name;
        // 공항과 크루즈 터미널은 상호배타적 (둘 다 추가되지 않도록 if-else 사용)
        if (isAirport(p)) {
          // 공항인데 라벨에 "공항" 명시가 없으면 추가 (50대 이상 사용자 배려)
          if (!label.includes('공항') && !label.includes('Airport')) {
            label = `${label} 공항`;
          }
        } else if (isCruise(p)) {
          // 크루즈 터미널인데 라벨에 "크루즈 터미널" 명시가 없으면 추가
          if (!label.includes('크루즈 터미널') && !label.includes('크루즈') && !label.includes('터미널')) {
            label = `${label} 크루즈 터미널`;
          }
        }
        return { id: p.id, label, subtitle: p.city };
      }).slice(0, 20);
    } else if (isCruiseQuery && cnHint) {
      // "크루즈 터미널" 검색 + 출발지 국가가 있으면: 해당 국가의 크루즈 터미널만 반환
      const terminals = TERMINALS.filter(p => isCruise(p) && !isMilitary(p) && p.country === cnHint);
      items = terminals.map(p => {
        // 크루즈 터미널인데 라벨에 "크루즈 터미널" 명시가 없으면 추가
        let label = p.name_ko || p.name;
        if (!label.includes('크루즈 터미널') && !label.includes('크루즈') && !label.includes('터미널')) {
          label = `${label} 크루즈 터미널`;
        }
        return { id: p.id, label, subtitle: p.city };
      }).slice(0, 20);
      
      console.log('[nav/suggest] ✅ Dest cruise query with hint country:', { 
        q, 
        cnHint, 
        terminalsCount: items.length,
        terminals: terminals.map(p => ({ id: p.id, name_ko: p.name_ko }))
      });
    } else if (isCruiseQuery && !cnHint) {
      // "크루즈 터미널" 검색 + 출발지 국가가 없으면: 모든 크루즈 터미널 반환
      const terminals = TERMINALS.filter(p => isCruise(p) && !isMilitary(p));
      items = terminals.map(p => {
        // 크루즈 터미널인데 라벨에 "크루즈 터미널" 명시가 없으면 추가
        let label = p.name_ko || p.name;
        if (!label.includes('크루즈 터미널') && !label.includes('크루즈') && !label.includes('터미널')) {
          label = `${label} 크루즈 터미널`;
        }
        return { id: p.id, label, subtitle: p.city };
      }).slice(0, 20);
      
      console.log('[nav/suggest] ✅ Dest cruise query without hint:', { 
        q, 
        terminalsCount: items.length
      });
    } else {
      // 일반 검색: 공항 + 크루즈 터미널 모두 검색
      const allPOIs = TERMINALS.filter(p => {
        if (isMilitary(p)) return false;
        if (!isAirport(p) && !isCruise(p)) return false;
        
        // 나라 힌트가 있으면 그 나라 우선 필터링
        if (cnHint && p.country !== cnHint) {
          // 나라가 다르면 키워드나 이름에 검색어가 강하게 매칭되어야 함
          const nameMatch = (p.name_ko || '').toLowerCase().includes(ql) || (p.name || '').toLowerCase().includes(ql);
          const keywordMatch = p.keywords_ko?.some(kw => {
            if (!kw) return false;
            const kwLower = kw.toLowerCase();
            return kwLower.includes(ql) || ql.includes(kwLower);
          }) || false;
          if (!nameMatch && !keywordMatch) return false;
        }
        
        // 여러 방식으로 매칭 시도
        const name_ko_lower = (p.name_ko || '').toLowerCase();
        const name_lower = (p.name || '').toLowerCase();
        const nameMatch = name_ko_lower.includes(ql) || name_lower.includes(ql);
        
        // 키워드 매칭
        const keywordMatch = p.keywords_ko?.some(kw => {
          if (!kw) return false;
          const kwLower = kw.toLowerCase();
          return kwLower.includes(ql) || ql.includes(kwLower);
        }) || false;
        
        const cityMatch = (p.city || '').toLowerCase().includes(ql);
        
        // 토큰 기반 검색
        const tokens = buildTokens(p).map(token => token.toLowerCase());
        const tokenMatch = tokens.some(tok => {
          const tokNorm = norm(tok);
          return tok.includes(ql) || ql.includes(tok) || tokNorm.includes(qnorm) || qnorm.includes(tokNorm);
        });
        
        return nameMatch || keywordMatch || cityMatch || tokenMatch;
      });
      
      // 매칭 점수로 정렬
      const scored = allPOIs.map(p => {
        let score = 0;
        const name_ko_lower = (p.name_ko || '').toLowerCase();
        const name_lower = (p.name || '').toLowerCase();
        
        // 시작 부분 일치가 가장 높은 점수
        if (name_ko_lower.startsWith(ql) || name_lower.startsWith(ql)) score += 10;
        // 이름에 포함
        if (name_ko_lower.includes(ql) || name_lower.includes(ql)) score += 5;
        // 키워드 일치
        if (p.keywords_ko?.some(kw => kw.toLowerCase().includes(ql))) score += 3;
        // 도시 일치
        if (p.city?.toLowerCase().includes(ql)) score += 1;
        
        // 나라 힌트와 일치하면 추가 점수
        if (cnHint && p.country === cnHint) score += 2;
        
        return { poi: p, score };
      }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score);
      
      items = scored.map(({ poi: p }) => {
        let label = p.name_ko || p.name;
        // 공항과 크루즈 터미널은 상호배타적 (둘 다 추가되지 않도록 if-else 사용)
        if (isAirport(p)) {
          // 공항인데 라벨에 "공항" 명시가 없으면 추가 (50대 이상 사용자 배려)
          if (!label.includes('공항') && !label.includes('Airport')) {
            label = `${label} 공항`;
          }
        } else if (isCruise(p)) {
          // 크루즈 터미널인데 라벨에 "크루즈 터미널" 명시가 없으면 추가
          if (!label.includes('크루즈 터미널') && !label.includes('크루즈') && !label.includes('터미널')) {
            label = `${label} 크루즈 터미널`;
          }
        }
        return { id: p.id, label, subtitle: p.city };
      }).slice(0, 20);
    }
  }

  const unique = Array.from(new Map(items.map(i => [i.id, i])).values()).slice(0, 20)
  
  // 에러 처리: 결과가 없을 때 사용자 친화적 메시지
  if (unique.length === 0 && q) {
    console.log('[nav/suggest] No results found:', { slot, q, hint });
  }
  
  return NextResponse.json({ items: unique })
}
