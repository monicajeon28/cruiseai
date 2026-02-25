// 안전 파싱: 목적지가 배열(JSON 문자열)이면 " · "로 조인, 아니면 원문
export function prettyDestination(dest: string) {
  try {
    const arr = JSON.parse(dest);
    if (Array.isArray(arr)) return arr.join(' · ');
  } catch {}
  return dest ?? '';
}

// 밤/낮 계산: n박 n+1일 + 전체기간 문구
export function formatNightsDays(startISO: string, endISO: string) {
  const s = new Date(startISO);
  const e = new Date(endISO);
  const diffMs = e.getTime() - s.getTime();
  const days = Math.round(diffMs / (1000*60*60*24)) + 1;  // 양끝 포함
  const nights = Math.max(days - 1, 0);
  return { nights, days };
}

export function formatDateK(dateISO: string) {
  const d = new Date(dateISO);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// 테스트용 사용자 전화번호 (D-day 고정)
const TEST_USER_PHONE = '01024958013';
const FIXED_DDAY = 100;

// 출발 기준 D-DAY 계산 (오늘 자정 기준)
export function calcDday(startISO: string, userPhone?: string | null) {
  // 테스트 사용자인 경우 D-day 고정
  if (userPhone === TEST_USER_PHONE) {
    return FIXED_DDAY;
  }

  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(startISO); start.setHours(0,0,0,0);
  const diff = Math.ceil((start.getTime() - today.getTime()) / (1000*60*60*24));
  return diff; // 2면 D-2, 0이면 당일, -1이면 여행 2일차 ...
}

// 메시지 플레이스홀더 채우기
export function fill(text: string, name: string, cruise: string, dest: string) {
  const safe = text ?? '';
  return safe
    .replaceAll('[고객명]', name ?? '')
    .replaceAll('[크루즈명]', cruise ?? '')
    .replaceAll('[목적지]', dest ?? '');
}

export const calculateDday = (startDate: Date, userPhone?: string | null): number | null => {
  // 테스트 사용자인 경우 D-day 고정
  if (userPhone === TEST_USER_PHONE) {
    return FIXED_DDAY;
  }

  if (!startDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  startDate.setHours(0, 0, 0, 0);

  const diffTime = startDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}; 