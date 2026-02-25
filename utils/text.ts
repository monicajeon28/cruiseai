import { normalizePlace } from "@/lib/normalize";

export const hasAny = (s: string, words: string[]) =>
  words.some(w => s.includes(normalizePlace(w))); 