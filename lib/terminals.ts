import data from '@/data/terminals.json';

export type POI = {
  id: string; name: string; name_ko: string; keywords_ko?: string[];
  lat: number; lng: number; city: string; country: string;
};
export type Terminal = POI

export const TERMINALS: POI[] = data as POI[];

export const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()\-_/.,]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, ''); // zero-width 제거

export function resolveTerminalByText(text?: string): POI | null {
  const q = norm(text || '');
  if (!q) return null;

  // 1) 완전 포함(양방향) + keywords 포함
  let best: { p: POI; score: number } | null = null;

  for (const p of TERMINALS) {
    const toks = [
      p.name_ko, p.name, p.city, ...(p.keywords_ko || []),
    ].map(norm);

    let s = 0;
    for (const t of toks) {
      if (!t) continue;
      if (t.includes(q) || q.includes(t)) s += 2;
    }

    if (s > 0 && (!best || s > best.score)) best = { p, score: s };
  }
  return best?.p || null;
}

export function buildTokens(p: POI): string[] {
  return [
    norm(p.name_ko),
    norm(p.name),
    norm(p.city),
    norm(p.country),
    ...(p.keywords_ko || []).map(norm),
  ].filter(Boolean);
}
