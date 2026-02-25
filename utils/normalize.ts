export function normalize(s: string) {
  return (s || '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '') // 악센트 제거
    .replace(/\s+/g, '')            // 공백 제거
    .toLowerCase();
}

