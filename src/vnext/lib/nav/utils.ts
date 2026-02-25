export function normalize(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·\.\-_/()]/g, '');
}

export function includesKo(itemText: string, q: string) {
  const a = normalize(itemText);
  const b = normalize(q);
  return a.includes(b);
}
