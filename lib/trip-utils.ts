// app/lib/trip-utils.ts
export const formatDate = (d: Date | string) => {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const da = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
};

// “일본 () - 홋카이도 ()” 같은 비어있는 괄호 제거 + 공백 정리
export const cleanupDestination = (s: string) =>
  s
    .replace(/\([^()]*\)/g, (m) => (m.replace(/[^\s]/g, '').trim() === '' ? '' : m)) // 빈 괄호 () 날리기
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+-\s+$/,'')
    .trim();

// n박 n일
export const getNightsDays = (start: string | Date, end: string | Date) => {
  const s = new Date(start); const e = new Date(end);
  const diffDays = Math.ceil((e.setHours(0,0,0,0) - s.setHours(0,0,0,0)) / 86400000);
  const nights = Math.max(0, diffDays - 1);
  return { nights, days: diffDays, label: `${nights}박 ${diffDays}일` };
};

// 오늘 기준 D-Day (출발 기준, 여행 중이면 음수)
export const getDDay = (start: string | Date) => {
  const s = new Date(start); const t = new Date();
  s.setHours(0,0,0,0); t.setHours(0,0,0,0);
  return Math.ceil((s.getTime() - t.getTime()) / 86400000);
};

// 여행 중/종료 전 알림키(end-1, end-0) 계산
export const resolveDdayKey = (start: string | Date, end: string | Date) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const e = new Date(end); e.setHours(0,0,0,0);
  const daysToEnd = Math.ceil((e.getTime() - today.getTime()) / 86400000);
  if (daysToEnd === 1) return 'end-1';
  if (daysToEnd === 0) return 'end-0';
  return null;
};



