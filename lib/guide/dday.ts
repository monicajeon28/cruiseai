import 'server-only';

export type DdayParams = {
  startDateISO: string;
  customerName?: string;
  cruiseName?: string;
};

// 테스트용 사용자 전화번호 (D-day 고정)
const TEST_USER_PHONE = '01024958013';
const FIXED_DDAY = 100;

/**
 * 출발일 기준 D-day 메시지 생성 (서버 전용)
 */
export async function getDdayMessage({
  startDateISO,
  customerName,
  cruiseName,
  customerPhone,
}: DdayParams & { customerPhone?: string | null }): Promise<string> {
  // 테스트 사용자인 경우 D-day 고정
  if (customerPhone === TEST_USER_PHONE) {
    const name = customerName ? `${customerName}님, ` : '';
    const ship = cruiseName ? ` ${cruiseName}` : '';
    return `${name}크루즈${ship}까지 D-${FIXED_DDAY}`;
  }

  // 안전 파싱
  const start = new Date(startDateISO);
  if (isNaN(start.getTime())) {
    const name = customerName ? `${customerName}님, ` : '';
    return `${name}출발일 정보를 확인할 수 없어요.`;
  }

  // 날짜 차이(자정 기준)
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((start.getTime() - today.getTime()) / 86400000);

  const name = customerName ? `${customerName}님, ` : '';
  const ship = cruiseName ? ` ${cruiseName}` : '';

  if (diffDays > 0) return `${name}크루즈${ship}까지 D-${diffDays}`;
  if (diffDays === 0) return `${name}오늘 출발하는 날이에요!`;
  return `${name}즐거운 여행이었길 바라요! (D+${Math.abs(diffDays)})`;
}
