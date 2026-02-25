// lib/tax-calculator.ts
// 캐시노트 스타일 세금 자동 계산 유틸리티

export interface TaxCalculationInput {
  // 수당 입력 방식
  monthlyCommission?: number;       // 월 수당 (원)
  annualCommission?: number;        // 연간 수당 (원)
  commissionHistory?: number[];     // 월별 수당 내역 (배열)

  // 공제 항목
  hasSimplifiedDeduction?: boolean; // 단순경비율 적용 여부 (기본: true)
  customDeductionRate?: number;     // 직접 입력한 경비율 (%)
  additionalDeductions?: number;    // 추가 공제 금액 (원)
}

export interface TaxCalculationResult {
  // 수입 정보
  grossIncome: number;              // 총 수입
  monthlyAverage: number;           // 월평균 수입

  // 원천징수 (이미 납부됨)
  withholdingTax: number;           // 3.3% 원천징수액
  withholdingIncomeTax: number;     // 소득세 3%
  withholdingLocalTax: number;      // 지방소득세 0.3%

  // 경비 공제
  deductionRate: number;            // 적용 경비율 (%)
  deductionAmount: number;          // 경비 공제액

  // 과세표준
  taxableIncome: number;            // 과세표준 (총수입 - 경비)

  // 종합소득세 계산
  incomeTaxBracket: string;         // 적용 세율 구간
  incomeTaxRate: number;            // 적용 세율 (%)
  calculatedIncomeTax: number;      // 산출 세액
  localIncomeTax: number;           // 지방소득세 (산출세액의 10%)
  totalTaxDue: number;              // 총 납부해야 할 세금

  // 정산 결과
  alreadyPaid: number;              // 이미 납부한 원천징수액
  additionalPayment: number;        // 추가 납부 예상액 (+ 납부 / - 환급)
  isRefund: boolean;                // 환급 여부

  // 실수령 정보
  netIncomeAfterTax: number;        // 세후 실수령액 (연간)
  monthlyNetIncome: number;         // 월평균 실수령액
  effectiveTaxRate: number;         // 실효세율 (%)
}

// 2024년 기준 종합소득세 세율표
const TAX_BRACKETS = [
  { min: 0, max: 14000000, rate: 6, deduction: 0 },
  { min: 14000000, max: 50000000, rate: 15, deduction: 1260000 },
  { min: 50000000, max: 88000000, rate: 24, deduction: 5760000 },
  { min: 88000000, max: 150000000, rate: 35, deduction: 15440000 },
  { min: 150000000, max: 300000000, rate: 38, deduction: 19940000 },
  { min: 300000000, max: 500000000, rate: 40, deduction: 25940000 },
  { min: 500000000, max: 1000000000, rate: 42, deduction: 35940000 },
  { min: 1000000000, max: Infinity, rate: 45, deduction: 65940000 },
];

// 사업소득 단순경비율 (여행업 관련 - 940909)
// 기준경비율: 약 10.5%, 단순경비율: 약 64.1%
const SIMPLE_DEDUCTION_RATES = {
  under2400: 64.1,   // 2,400만원 미만
  over2400: 10.5,    // 2,400만원 이상 (기준경비율)
};

/**
 * 경비율 결정
 */
function getDeductionRate(annualIncome: number, useSimplified: boolean): number {
  if (!useSimplified) {
    return SIMPLE_DEDUCTION_RATES.over2400; // 기준경비율
  }

  // 단순경비율 적용 가능 여부 (연 수입 2,400만원 미만)
  if (annualIncome < 24000000) {
    return SIMPLE_DEDUCTION_RATES.under2400;
  }

  // 2,400만원 이상은 기준경비율 적용
  return SIMPLE_DEDUCTION_RATES.over2400;
}

/**
 * 종합소득세 세율 구간 찾기
 */
function findTaxBracket(taxableIncome: number) {
  return TAX_BRACKETS.find(
    bracket => taxableIncome > bracket.min && taxableIncome <= bracket.max
  ) || TAX_BRACKETS[0];
}

/**
 * 종합소득세 계산
 */
function calculateIncomeTax(taxableIncome: number): { tax: number; rate: number; bracket: string } {
  if (taxableIncome <= 0) {
    return { tax: 0, rate: 0, bracket: '비과세' };
  }

  const bracket = findTaxBracket(taxableIncome);
  const tax = Math.floor((taxableIncome * bracket.rate / 100) - bracket.deduction);

  const bracketNames: Record<number, string> = {
    6: '1,400만원 이하 (6%)',
    15: '1,400만원~5,000만원 (15%)',
    24: '5,000만원~8,800만원 (24%)',
    35: '8,800만원~1.5억원 (35%)',
    38: '1.5억원~3억원 (38%)',
    40: '3억원~5억원 (40%)',
    42: '5억원~10억원 (42%)',
    45: '10억원 초과 (45%)',
  };

  return {
    tax: Math.max(0, tax),
    rate: bracket.rate,
    bracket: bracketNames[bracket.rate] || `${bracket.rate}%`,
  };
}

/**
 * 세금 계산 메인 함수
 */
export function calculateTax(input: TaxCalculationInput): TaxCalculationResult {
  // 1. 연간 총 수입 계산
  let annualIncome = 0;

  if (input.annualCommission) {
    annualIncome = input.annualCommission;
  } else if (input.monthlyCommission) {
    annualIncome = input.monthlyCommission * 12;
  } else if (input.commissionHistory && input.commissionHistory.length > 0) {
    annualIncome = input.commissionHistory.reduce((sum, m) => sum + m, 0);
    // 12개월 미만인 경우 연간 추정
    if (input.commissionHistory.length < 12) {
      const monthlyAvg = annualIncome / input.commissionHistory.length;
      annualIncome = monthlyAvg * 12;
    }
  }

  const monthlyAverage = annualIncome / 12;

  // 2. 원천징수액 계산 (이미 납부됨)
  const withholdingTax = Math.floor(annualIncome * 0.033);
  const withholdingIncomeTax = Math.floor(annualIncome * 0.03);
  const withholdingLocalTax = Math.floor(annualIncome * 0.003);

  // 3. 경비 공제 계산
  const useSimplified = input.hasSimplifiedDeduction !== false;
  const deductionRate = input.customDeductionRate || getDeductionRate(annualIncome, useSimplified);
  let deductionAmount = Math.floor(annualIncome * deductionRate / 100);

  // 추가 공제
  if (input.additionalDeductions) {
    deductionAmount += input.additionalDeductions;
  }

  // 4. 과세표준 계산
  const taxableIncome = Math.max(0, annualIncome - deductionAmount);

  // 5. 종합소득세 계산
  const { tax: calculatedIncomeTax, rate: incomeTaxRate, bracket: incomeTaxBracket } =
    calculateIncomeTax(taxableIncome);

  // 6. 지방소득세 (종합소득세의 10%)
  const localIncomeTax = Math.floor(calculatedIncomeTax * 0.1);

  // 7. 총 납부해야 할 세금
  const totalTaxDue = calculatedIncomeTax + localIncomeTax;

  // 8. 정산 (추가 납부 또는 환급)
  const alreadyPaid = withholdingTax;
  const additionalPayment = totalTaxDue - alreadyPaid;
  const isRefund = additionalPayment < 0;

  // 9. 실수령액 계산
  const netIncomeAfterTax = annualIncome - totalTaxDue;
  const monthlyNetIncome = netIncomeAfterTax / 12;
  const effectiveTaxRate = annualIncome > 0 ? (totalTaxDue / annualIncome) * 100 : 0;

  return {
    grossIncome: annualIncome,
    monthlyAverage,
    withholdingTax,
    withholdingIncomeTax,
    withholdingLocalTax,
    deductionRate,
    deductionAmount,
    taxableIncome,
    incomeTaxBracket,
    incomeTaxRate,
    calculatedIncomeTax,
    localIncomeTax,
    totalTaxDue,
    alreadyPaid,
    additionalPayment,
    isRefund,
    netIncomeAfterTax,
    monthlyNetIncome,
    effectiveTaxRate,
  };
}

/**
 * 금액 포맷팅 (원 단위)
 */
export function formatCurrency(amount: number): string {
  const absAmount = Math.abs(amount);

  if (absAmount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억원`;
  }
  if (absAmount >= 10000) {
    return `${Math.floor(amount / 10000).toLocaleString()}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

/**
 * 상세 금액 포맷팅 (쉼표 포함)
 */
export function formatDetailedCurrency(amount: number): string {
  return `${amount.toLocaleString()}원`;
}

/**
 * 세율 구간별 색상
 */
export function getTaxBracketColor(rate: number): { bg: string; text: string } {
  if (rate <= 6) return { bg: 'bg-green-50', text: 'text-green-700' };
  if (rate <= 15) return { bg: 'bg-emerald-50', text: 'text-emerald-700' };
  if (rate <= 24) return { bg: 'bg-yellow-50', text: 'text-yellow-700' };
  if (rate <= 35) return { bg: 'bg-orange-50', text: 'text-orange-700' };
  return { bg: 'bg-red-50', text: 'text-red-700' };
}

/**
 * 5월 종합소득세 신고까지 남은 일수
 */
export function getDaysUntilTaxFiling(): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  let filingDeadline = new Date(currentYear, 4, 31); // 5월 31일

  // 이미 지났으면 내년
  if (now > filingDeadline) {
    filingDeadline = new Date(currentYear + 1, 4, 31);
  }

  const diffTime = filingDeadline.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 월별 수당에서 세금 요약 계산
 */
export function calculateMonthlyTaxSummary(monthlyCommission: number): {
  gross: number;
  withholding: number;
  net: number;
} {
  const withholding = Math.floor(monthlyCommission * 0.033);
  return {
    gross: monthlyCommission,
    withholding,
    net: monthlyCommission - withholding,
  };
}
