export const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

export const trimTo = (s: string|number, max: number) => {
  const str = String(s);
  if (str.length <= max) return str;
  return str.slice(0, max-1) + '…';
}

export const makeUUID = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

export function isEmpty(v: any): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

export function safeEq(a: string|null|undefined, b: string|null|undefined): boolean {
  return (a?.trim() ?? '') === (b?.trim() ?? '');
}
