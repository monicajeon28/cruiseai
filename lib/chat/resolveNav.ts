// lib/chat/resolveNav.ts
import { buildTransitUrl, buildDrivingUrl, buildMapUrl } from '../../src/lib/nav/urls'
import { suggestAirports, suggestCruiseTerminals, normalizeCountryOrCityToken, resolveTerminalByText, type Terminal } from '../../src/lib/terminals' // findOrigins, findDestinations 대신 suggestAirports, suggestCruiseTerminals로 변경

// ✅ 응답 타입을 세분화
export type NavAPIResult =
  | { kind: 'need-origin'; message: string; originCandidates: Terminal[]; includeCurrent: boolean; destCandidate?: Terminal }
  | { kind: 'need-dest'; message: string; destCandidates: Terminal[]; includeCurrent: boolean; origin: Terminal }
  | { kind: 'ready'; origin: Terminal; dest: Terminal; links: { transit: string; driving: string; map: string } }

type Params = {
  text: string
  pick?: { originId?: string; destId?: string } // 버튼 선택 반영
}

export async function resolveNavQuery({ text, pick }: Params): Promise<NavAPIResult> {
  const { originToken, destToken, isNearby } = parseText(text) // 네이티브 파서(기존 normalize + 토큰 분리)

  // 1) 사용자가 버튼으로 origin/dest 를 지정했다면 우선 반영
  let origin: Terminal | undefined
  let dest: Terminal | undefined

  if (pick?.originId) origin = resolveTerminalByText(pick.originId) || undefined // resolveTerminalByText로 변경
  if (pick?.destId) dest = resolveTerminalByText(pick.destId) || undefined

  // 2) 문장에서 토큰을 찾아 후보군 생성
  const originCandidates: Terminal[] = [];
  const destCandidates: Terminal[] = [];

  const originCtx = normalizeCountryOrCityToken(originToken || destToken || '');
  const destCtx = normalizeCountryOrCityToken(destToken || originToken || '');

  if (originToken) {
    originCandidates.push(...suggestAirports(originCtx, 8));
  }
  if (destToken) {
    destCandidates.push(...(suggestCruiseTerminals(destCtx, 12) as unknown as Terminal[]));
  }

  // 3) 모호 처리 – 절대로 기본값으로 `현위치`를 끼워 넣지 않는다
  //    (단, "근처~" 형태일 때만 includeCurrent = true 로 버튼에 노출)
  const includeCurrent = isNearby === true

  // (A) 출발지가 확정되지 않았고 후보가 2개 이상 또는 0개면 버튼으로 고르게
  if (!origin) {
    if (originCandidates.length === 1) {
      origin = originCandidates[0]
    } else {
      // 현 위치 칩은 이제 suggestAirports에서 직접 추가되지 않으므로, 여기서 조건부 추가
      // 이 로직은 `app/api/nav/suggest`로 이동했으므로 여기서는 제거
      return {
        kind: 'need-origin',
        message: '어디에서 출발하시나요? 출발지를 선택해 주세요.',
        originCandidates,
        includeCurrent,
        destCandidate: destCandidates.length === 1 ? destCandidates[0] : undefined,
      }
    }
  }

  // (B) 도착지가 확정되지 않았으면 버튼으로 고르게
  if (!dest) {
    if (destCandidates.length === 1) {
      dest = destCandidates[0]
    } else {
      return {
        kind: 'need-dest',
        message: '어디로 가시나요? 도착지를 선택해 주세요.',
        destCandidates,
        includeCurrent,
        origin: origin!,
      }
    }
  }

  // (C) 둘 다 확정 → 링크 생성
  const originQ = origin!.name_ko; // Terminal 객체에서 name_ko 사용
  const destQ = dest!.name_ko;   // Terminal 객체에서 name_ko 사용
  return {
    kind: 'ready',
    origin: origin!,
    dest: dest!,
    links: {
      transit: buildTransitUrl(originQ, destQ),
      driving: buildDrivingUrl(originQ, destQ),
      map: buildMapUrl(destQ),
    },
  }
}

// --- 유틸 예시 (기존 구조에 맞춰서 구현) --- //
function parseText(text: string) {
  // "홍콩 공항 -> 카이탁 크루즈 터미널" / "미국 공항 어떻게 가" / "근처 맛집" 등
  const t = text.trim()
  const isNearby = /근처|주변/.test(t)
  // 간단 분리
  const arrow = /->|→|에서|부터/.test(t) && /(->|→)/.test(t)
  let originToken: string | undefined
  let destToken: string | undefined
  if (arrow) {
    const [a, b] = t.split(/->|→/).map(s => s.trim())
    originToken = a
    destToken = b
  } else {
    // "미국 크루즈 터미널 어떻게 가" 처럼 도착만 있을 때
    destToken = t
  }
  return { originToken, destToken, isNearby }
}
