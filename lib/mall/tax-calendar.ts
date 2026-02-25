// lib/tax-calendar.ts
// 세무 일정 관리 및 알림 유틸리티

export interface TaxDeadline {
  id: string;
  type: 'withholding' | 'payment_statement' | 'vat' | 'corporate_tax' | 'income_tax';
  title: string;
  deadline: Date;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  actionUrl?: string;
  daysUntil: number;
}

/**
 * 날짜까지 남은 일수 계산
 */
function getDaysUntil(targetDate: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 심각도 결정
 */
function getSeverity(daysUntil: number): 'critical' | 'warning' | 'info' {
  if (daysUntil <= 3) return 'critical';
  if (daysUntil <= 7) return 'warning';
  return 'info';
}

/**
 * 다가오는 세무 기한 목록 조회
 */
export function getUpcomingDeadlines(): TaxDeadline[] {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();

  const deadlines: TaxDeadline[] = [];

  // 1. 원천세 신고 (매월 10일) - 전월분
  const withholdingDay = 10;
  let withholdingMonth = currentMonth;
  let withholdingYear = currentYear;

  // 이번 달 10일이 지났으면 다음 달로
  if (currentDay > withholdingDay) {
    withholdingMonth = currentMonth + 1;
    if (withholdingMonth > 11) {
      withholdingMonth = 0;
      withholdingYear++;
    }
  }

  const withholdingDeadline = new Date(withholdingYear, withholdingMonth, withholdingDay);
  const withholdingDays = getDaysUntil(withholdingDeadline);

  if (withholdingDays >= 0 && withholdingDays <= 30) {
    const prevMonth = withholdingMonth === 0 ? 12 : withholdingMonth;
    deadlines.push({
      id: `withholding-${withholdingYear}-${withholdingMonth + 1}`,
      type: 'withholding',
      title: `${prevMonth}월분 원천세 신고/납부`,
      deadline: withholdingDeadline,
      description: '전월 지급분에 대한 사업소득 원천세(3.3%) 신고 및 납부',
      severity: getSeverity(withholdingDays),
      actionUrl: 'https://www.hometax.go.kr',
      daysUntil: withholdingDays,
    });
  }

  // 2. 지급명세서 제출 (2월 말) - 전년도분
  if (currentMonth <= 1 || (currentMonth === 2 && currentDay <= 15)) {
    const paymentStatementYear = currentYear;
    // 윤년 고려: 2월 말일 계산
    const isLeapYear = (paymentStatementYear % 4 === 0 && paymentStatementYear % 100 !== 0) || (paymentStatementYear % 400 === 0);
    const febLastDay = isLeapYear ? 29 : 28;
    const paymentStatementDeadline = new Date(paymentStatementYear, 1, febLastDay); // 2월 말일
    const paymentDays = getDaysUntil(paymentStatementDeadline);

    if (paymentDays >= -7 && paymentDays <= 60) { // 7일 지났어도 표시
      deadlines.push({
        id: `payment-statement-${paymentStatementYear}`,
        type: 'payment_statement',
        title: `${paymentStatementYear - 1}년 지급명세서 제출`,
        deadline: paymentStatementDeadline,
        description: '전년도 사업소득 지급명세서 홈택스 제출 (미제출 시 가산세 2%)',
        severity: paymentDays <= 0 ? 'critical' : getSeverity(paymentDays),
        actionUrl: 'https://www.hometax.go.kr',
        daysUntil: paymentDays,
      });
    }
  }

  // 3. 부가세 신고 (1/4/7/10월 25일) - 분기별
  const vatMonths = [0, 3, 6, 9]; // 1월, 4월, 7월, 10월
  for (const vatMonth of vatMonths) {
    let vatYear = currentYear;
    let targetMonth = vatMonth;

    // 해당 분기의 25일 이후면 다음 분기로
    if (currentMonth > vatMonth || (currentMonth === vatMonth && currentDay > 25)) {
      const nextVatIndex = vatMonths.indexOf(vatMonth) + 1;
      if (nextVatIndex >= vatMonths.length) {
        targetMonth = 0;
        vatYear++;
      } else {
        targetMonth = vatMonths[nextVatIndex];
      }
    } else if (currentMonth < vatMonth) {
      targetMonth = vatMonth;
    }

    const vatDeadline = new Date(vatYear, targetMonth, 25);
    const vatDays = getDaysUntil(vatDeadline);

    if (vatDays >= 0 && vatDays <= 30) {
      const quarterNames = ['1기 예정', '1기 확정', '2기 예정', '2기 확정'];
      const quarterIndex = vatMonths.indexOf(targetMonth);

      deadlines.push({
        id: `vat-${vatYear}-${targetMonth + 1}`,
        type: 'vat',
        title: `부가세 ${quarterNames[quarterIndex]} 신고`,
        deadline: vatDeadline,
        description: '부가가치세 신고 (사업자인 경우에만 해당)',
        severity: getSeverity(vatDays),
        actionUrl: 'https://www.hometax.go.kr',
        daysUntil: vatDays,
      });
      break; // 가장 가까운 부가세 신고만 표시
    }
  }

  // 4. 법인세 신고 (3월 말) - 12월 결산 법인
  if (currentMonth >= 0 && currentMonth <= 2) {
    const corporateTaxDeadline = new Date(currentYear, 2, 31); // 3월 31일
    const corpDays = getDaysUntil(corporateTaxDeadline);

    if (corpDays >= 0 && corpDays <= 60) {
      deadlines.push({
        id: `corporate-tax-${currentYear}`,
        type: 'corporate_tax',
        title: `${currentYear - 1}년 법인세 신고`,
        deadline: corporateTaxDeadline,
        description: '12월 결산 법인 법인세 신고 및 납부',
        severity: getSeverity(corpDays),
        actionUrl: 'https://www.hometax.go.kr',
        daysUntil: corpDays,
      });
    }
  }

  // 5. 종합소득세 신고 (5월 말) - 개인사업자
  if (currentMonth >= 3 && currentMonth <= 4) {
    const incomeTaxDeadline = new Date(currentYear, 4, 31); // 5월 31일
    const incomeDays = getDaysUntil(incomeTaxDeadline);

    if (incomeDays >= 0 && incomeDays <= 60) {
      deadlines.push({
        id: `income-tax-${currentYear}`,
        type: 'income_tax',
        title: `${currentYear - 1}년 종합소득세 신고`,
        deadline: incomeTaxDeadline,
        description: '개인사업자 종합소득세 신고 및 납부',
        severity: getSeverity(incomeDays),
        actionUrl: 'https://www.hometax.go.kr',
        daysUntil: incomeDays,
      });
    }
  }

  // 날짜순 정렬
  return deadlines.sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * 세무 일정 타입별 아이콘
 */
export function getTaxDeadlineIcon(type: TaxDeadline['type']): string {
  switch (type) {
    case 'withholding':
      return '💰';
    case 'payment_statement':
      return '📋';
    case 'vat':
      return '🧾';
    case 'corporate_tax':
      return '🏢';
    case 'income_tax':
      return '👤';
    default:
      return '📅';
  }
}

/**
 * 심각도별 색상 클래스
 */
export function getSeverityColor(severity: TaxDeadline['severity']): {
  bg: string;
  text: string;
  border: string;
} {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
      };
    case 'warning':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
      };
    case 'info':
    default:
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
      };
  }
}

/**
 * D-Day 표시 문자열
 */
export function formatDaysUntil(days: number): string {
  if (days < 0) return `D+${Math.abs(days)} (기한 경과)`;
  if (days === 0) return 'D-Day (오늘!)';
  return `D-${days}`;
}
