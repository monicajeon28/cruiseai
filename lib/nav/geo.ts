const map: Record<string,string> = {
  '홍콩':'HK', 'hong kong':'HK',
  '미국':'US', 'usa':'US', 'united states':'US',
  '일본':'JP', '오키나와':'JP-OKA',
  // 필요시 계속 보강
}

export function detectRegionCode(text: string|undefined) {
  if (!text) return undefined
  const t = text.toLowerCase()
  for (const k of Object.keys(map)) {
    if (t.includes(k)) return map[k]
  }
  return undefined
}













