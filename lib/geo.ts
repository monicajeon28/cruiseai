export type NavMode = "driving" | "transit" | "walking";

export type Place = {
  text: string;               // 표시용 텍스트
  lat?: number; lon?: number; // 좌표(있으면 사용)
};

export function gmapsSearch(q: string) {
  return `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
}

export function gmapsDir(origin?: Place, dest?: Place, mode: NavMode = "driving") {
  const params = new URLSearchParams();
  if (origin?.lat && origin?.lon) params.set("origin", `${origin.lat},${origin.lon}`);
  else if (origin?.text) params.set("origin", origin.text);

  if (dest?.lat && dest?.lon) params.set("destination", `${dest.lat},${dest.lon}`);
  else if (dest?.text) params.set("destination", dest.text);

  params.set("travelmode", mode);
  return `https://www.google.com/maps/dir/?api=1&${params.toString()}`;
}

// “하네다에서 오산바시까지 …” 같은 패턴 파싱(있으면 반환)
export function resolveFromTo(text: string):
  | { origin: Place; dest: Place; originText: string; destText: string }
  | null {
  const m = text.match(/(.+?)에서\s+(.+?)까지/);
  if (!m) return null;
  const originText = m[1].trim();
  const destText   = m[2].trim();
  return { origin: { text: originText }, dest: { text: destText }, originText, destText };
}

// 단일 장소 추출(대략)
export function resolvePlace(text: string): Place | null {
  // 실제 구현이 있으면 교체. 우선 간단히:
  const m = text.match(/([A-Za-z가-힣0-9\s]+)(터미널|공항|항|역|센터)?/);
  if (!m) return null;
  const t = m[1].trim();
  if (!t) return null;
  return { text: t };
}

// 나라 단위 후보(칩) 제공 — 간단 더미
export function suggestTerminalsByCountry(text: string): Array<{ text: string }> {
  const hits: string[] = [];
  if (/미국|USA|US/i.test(text)) hits.push("미국 크루즈 터미널");
  if (/일본|Japan/i.test(text)) hits.push("일본 크루즈 터미널");
  if (/홍콩|Hong\s*Kong/i.test(text)) hits.push("홍콩 크루즈 터미널");
  return hits.map((x) => ({ text: x }));
}

// 홍콩 특수 후보(두 개 이상 리턴되면 선택 칩/링크 구성)
export function hongKongCruiseCandidates(_text: string):
  Array<{ label: string; place: Place }> {
  if (!/홍콩|Hong\s*Kong/i.test(_text)) return [];
  return [
    { label: "카오룽(오션터미널)", place: { text: "Ocean Terminal, Hong Kong" } },
    { label: "카이탁(크루즈터미널)", place: { text: "Kai Tak Cruise Terminal, Hong Kong" } },
  ];
}

// 목적지에 따른 추천 출발지(간단 더미: 공항/도시 고정)
export function originPlaceFor(_dest: Place | { text: string }): Place | undefined {
  return { text: "Hong Kong International Airport" };
}


