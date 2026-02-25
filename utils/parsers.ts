export function normalizePlace(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

export function parsePlaceQuery(text: string) {
  // "홍콩공항에서 카이탁 크루즈 터미널까지"
  const m = text.match(/(.+?)\s*에서\s*(.+?)\s*까지/i);
  return m ? { from: m[1].trim(), to: m[2].trim() } : null;
}

// 단일 목적지 네비 ("뉴욕 맨해튼 크루즈터미널 어떻게 가?")
export function parseSingleDestNav(q: string): string | null {
  const m = q.trim().match(/(.+?)(?:으로|로)?\s*어떻게\s*가\??$/);
  return m ? m[1].trim() : null;
} 