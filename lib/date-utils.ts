// 테스트용 사용자 전화번호 (D-day 고정)
const TEST_USER_PHONE = '01024958013';
const FIXED_DDAY = 100;

export function getDdayMessage(
  startDateStr: string | Date | null | undefined, 
  endDateStr: string | Date | null | undefined,
  userPhone?: string | null
): string {
  // 테스트 사용자인 경우 D-day 고정
  if (userPhone === TEST_USER_PHONE) {
    return `D-${FIXED_DDAY}일 남았습니다. ❤️`;
  }

  // 날짜가 없으면 기본 메시지 반환
  if (!startDateStr || (typeof startDateStr === 'string' && startDateStr.trim() === '')) {
    return '여행 날짜 정보를 확인할 수 없습니다.';
  }
  if (!endDateStr || (typeof endDateStr === 'string' && endDateStr.trim() === '')) {
    return '여행 날짜 정보를 확인할 수 없습니다.';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // 오늘 날짜의 자정을 기준으로 설정

  const parseDate = (dateInput: string | Date | null | undefined): Date => {
    // Date 객체인 경우
    if (dateInput instanceof Date) {
      const date = new Date(dateInput);
      if (!isNaN(date.getTime())) {
        date.setHours(0, 0, 0, 0);
        return date;
      }
      throw new Error('Invalid date object');
    }

    // 문자열 처리
    const dateStr = String(dateInput || '');
    if (!dateStr || dateStr.trim() === '' || dateStr === 'null' || dateStr === 'undefined') {
      throw new Error('Invalid date format: date string is empty');
    }

    // ISO 형식 (YYYY-MM-DD) 파싱 시도
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1]);
      const month = parseInt(isoMatch[2]) - 1; // 월은 0부터 시작
      const day = parseInt(isoMatch[3]);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        date.setHours(0, 0, 0, 0);
        return date;
      }
    }

    // "2025년 10월 19일" 형식의 문자열 파싱
    const parts = dateStr.match(/(\d{4})년 (\d{1,2})월 (\d{1,2})일/);
    if (parts) {
      const year = parseInt(parts[1]);
      const month = parseInt(parts[2]) - 1; // 월은 0부터 시작
      const day = parseInt(parts[3]);
      const date = new Date(year, month, day);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    // 일반 Date 생성자 시도
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      date.setHours(0, 0, 0, 0);
      return date;
    }

    throw new Error(`Invalid date format: "${dateStr}"`);
  };

  try {
    const startDate = parseDate(startDateStr);
    const endDate = parseDate(endDateStr);

    // 오늘이 시작일 이전인 경우 (D-Day 계산)
    if (today < startDate) {
      const diffTime = startDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `D-${diffDays}일 남았습니다. ❤️`;
    }

    // 오늘이 시작일이거나 여행 중인 경우 (여행 N일차 계산)
    if (today >= startDate && today <= endDate) {
      const diffTime = today.getTime() - startDate.getTime();
      const tripDay = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return `여행 ${tripDay}일차 ❤️`;
    }

    // 오늘이 종료일 이후인 경우
    return `여행이 종료되었습니다.`;
  } catch (error) {
    console.error('[getDdayMessage] Date parsing error:', error, { startDateStr, endDateStr });
    return '여행 날짜 정보를 확인할 수 없습니다.';
  }
}
