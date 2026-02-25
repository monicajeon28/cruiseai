export function parseISO(d: string) {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  return x;
}

export function toISO(raw?: string) {
  if (!raw) return '';
  const s = raw.trim().replace(/[./]/g, '-');
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return '';
  const y = m[1], mo = m[2].padStart(2, '0'), d = m[3].padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

export function safeDate(raw?: string) {
  if (!raw) return undefined;
  const iso = toISO(raw);
  const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return undefined;
  const d = new Date(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`);
  return isNaN(d.getTime()) ? undefined : d;
}

export function fmt(d?: string | Date) {
  const dt = typeof d === 'string' ? safeDate(d) : d;
  if (!dt) return '—';
  return formatDate(dt);
}

export const formatDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });

export function diffDays(fromISO: string, toISO: string) {
  const a = parseISO(fromISO);
  const b = parseISO(toISO);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function dd(target?: Date) {
  if (!target) return NaN;
  const a = new Date(); a.setHours(0,0,0,0);
  const b = new Date(target); b.setHours(0,0,0,0);
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
}

export function todayISO() {
  const t = new Date(); t.setHours(0,0,0,0);
  return t.toISOString().slice(0,10);
}

export const dDiff = (iso?: string, base = new Date()) => {
  if (!iso) return null; // Handle undefined iso input
  const a = new Date(iso); a.setHours(0,0,0,0)
  const b = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  return Math.round((a.getTime()-b.getTime())/86400000)
}



