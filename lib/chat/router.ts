export type BlockId = 'GO_TW_HK' | 'GO_JP_JP' | 'GO_KR_KR' | 'NONE';

export function routeByText(text: string): BlockId {
  const t = text.toLowerCase();
  if ((/대만|taiwan/.test(t)) && (/홍콩|kai tak|카이탁/.test(t))) return 'GO_TW_HK';
  if ((/일본|japan|요코하마|오산바시/.test(t))) return 'GO_JP_JP';
  if ((/한국|korea|인천|부산|제주/.test(t)))   return 'GO_KR_KR';
  return 'NONE';
}

