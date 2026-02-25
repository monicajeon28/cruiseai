import terminals from "@/data/terminals.json";
import locations from "@/data/locations.json";

export type Place = {
  id?: string;
  name: string;
  lat?: number;
  lng?: number;
  mapQuery?: string;
};

export function findTerminalCandidates(keyword: string): Place[] {
  const k = keyword.toLowerCase();
  return (terminals as any[]).filter(t =>
    [t.name, t.name_ko, ...(t.keywords_ko ?? [])]
      .filter(Boolean)
      .some((s: string) => s.toLowerCase().includes(k))
  ).map(t => ({ id: t.id, name: t.name_ko || t.name, lat: t.lat, lng: t.lng }));
}

export function resolveAliasOrPlace(keyword: string): Place | null {
  const a = (locations.aliases as any)[keyword] as string | undefined; // 별칭 → 정식명
  const key = a || keyword;

  // 1) terminals.json에서 먼저 탐색
  const fromTerminal = findTerminalCandidates(key)[0];
  if (fromTerminal) return fromTerminal;

  // 2) locations.json의 terminals/airports/stations에서 탐색
  for (const bucket of ["terminals", "airports", "stations"] as const) {
    const obj = (locations as any)[bucket] ?? {};
    if (obj[key]) {
      const v = obj[key];
      if (v.coordinates) {
        const [lat, lng] = String(v.coordinates).split(",").map(Number);
        return { name: v.name, lat, lng };
      }
      return { name: v.name, mapQuery: v.map_query };
    }
  }
  return null;
}



















