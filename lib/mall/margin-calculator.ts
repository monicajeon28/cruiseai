// lib/margin-calculator.ts
// 본사 마진/손익 계산 유틸리티

export interface SalesData {
  totalSales: number;           // 총 매출
  salesCount: number;           // 판매 건수
  refundAmount: number;         // 환불 금액
  refundCount: number;          // 환불 건수
}

export interface CommissionData {
  salesAgentCommission: number;    // 판매원 수당 총액
  mentorCommission: number;        // 멘토 수당 총액
  branchManagerCommission: number; // 대리점장 오버라이드 수당
  otherCommission: number;         // 기타 수당
}

export interface FixedCostData {
  officeRent: number;           // 사무실 월세
  electricity: number;          // 전기세
  water: number;                // 수도세
  internet: number;             // 인터넷/통신비
  aiPlatformFee: number;        // AI 플랫폼 비용
  serverCost: number;           // 서버/호스팅 비용
  insurance: number;            // 보험료
  otherFixed: number;           // 기타 고정비
}

export interface VariableCostData {
  marketingCost: number;        // 마케팅/광고비
  salesCost: number;            // 영업비
  travelCost: number;           // 출장비
  entertainmentCost: number;    // 접대비
  suppliesCost: number;         // 소모품비
  otherVariable: number;        // 기타 변동비
}

export interface MarginCalculationInput {
  sales: SalesData;
  commission: CommissionData;
  fixedCosts: FixedCostData;
  variableCosts: VariableCostData;
  period?: 'monthly' | 'yearly';
}

export interface MarginCalculationResult {
  // 매출 정보
  grossSales: number;              // 총 매출
  netSales: number;                // 순매출 (환불 제외)
  refundAmount: number;            // 환불 금액
  refundRate: number;              // 환불율 (%)

  // 수당 정보
  totalCommission: number;         // 총 수당 지출
  commissionRate: number;          // 수당 비율 (%)
  commissionBreakdown: {
    salesAgent: number;
    mentor: number;
    branchManager: number;
    other: number;
  };

  // 매출총이익
  grossProfit: number;             // 매출총이익 (순매출 - 수당)
  grossProfitMargin: number;       // 매출총이익률 (%)

  // 비용 정보
  totalFixedCosts: number;         // 총 고정비
  totalVariableCosts: number;      // 총 변동비
  totalOperatingCosts: number;     // 총 영업비용
  fixedCostBreakdown: FixedCostData;
  variableCostBreakdown: VariableCostData;

  // 영업이익
  operatingProfit: number;         // 영업이익 (매출총이익 - 비용)
  operatingProfitMargin: number;   // 영업이익률 (%)

  // 순이익 (최종)
  netProfit: number;               // 순이익
  netProfitMargin: number;         // 순이익률 (%)

  // 상태 판단
  isProfitable: boolean;           // 흑자 여부
  profitStatus: 'excellent' | 'good' | 'warning' | 'danger' | 'critical';
  statusMessage: string;

  // 분석 지표
  breakEvenSales: number;          // 손익분기 매출
  salesVsBreakEven: number;        // 손익분기 대비 매출 (%)
  costStructure: {
    commissionPercent: number;
    fixedPercent: number;
    variablePercent: number;
    profitPercent: number;
  };
}

/**
 * 손익 상태 판단
 */
function getProfitStatus(margin: number): {
  status: MarginCalculationResult['profitStatus'];
  message: string;
} {
  if (margin >= 30) {
    return { status: 'excellent', message: '매우 우수한 수익 구조입니다!' };
  }
  if (margin >= 15) {
    return { status: 'good', message: '양호한 수익 구조입니다.' };
  }
  if (margin >= 5) {
    return { status: 'warning', message: '수익 개선이 필요합니다.' };
  }
  if (margin >= 0) {
    return { status: 'danger', message: '수익이 거의 없습니다. 비용 점검 필요!' };
  }
  return { status: 'critical', message: '적자 상태입니다! 긴급 점검 필요!' };
}

/**
 * 마진 계산 메인 함수
 */
export function calculateMargin(input: MarginCalculationInput): MarginCalculationResult {
  const { sales, commission, fixedCosts, variableCosts } = input;

  // 1. 매출 계산
  const grossSales = sales.totalSales;
  const refundAmount = sales.refundAmount;
  const netSales = grossSales - refundAmount;
  const refundRate = grossSales > 0 ? (refundAmount / grossSales) * 100 : 0;

  // 2. 수당 계산
  const totalCommission =
    commission.salesAgentCommission +
    commission.mentorCommission +
    commission.branchManagerCommission +
    commission.otherCommission;
  const commissionRate = netSales > 0 ? (totalCommission / netSales) * 100 : 0;

  // 3. 매출총이익
  const grossProfit = netSales - totalCommission;
  const grossProfitMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  // 4. 고정비 계산
  const totalFixedCosts =
    fixedCosts.officeRent +
    fixedCosts.electricity +
    fixedCosts.water +
    fixedCosts.internet +
    fixedCosts.aiPlatformFee +
    fixedCosts.serverCost +
    fixedCosts.insurance +
    fixedCosts.otherFixed;

  // 5. 변동비 계산
  const totalVariableCosts =
    variableCosts.marketingCost +
    variableCosts.salesCost +
    variableCosts.travelCost +
    variableCosts.entertainmentCost +
    variableCosts.suppliesCost +
    variableCosts.otherVariable;

  // 6. 총 영업비용
  const totalOperatingCosts = totalFixedCosts + totalVariableCosts;

  // 7. 영업이익
  const operatingProfit = grossProfit - totalOperatingCosts;
  const operatingProfitMargin = netSales > 0 ? (operatingProfit / netSales) * 100 : 0;

  // 8. 순이익 (영업이익과 동일하게 처리, 필요시 세금 등 추가 가능)
  const netProfit = operatingProfit;
  const netProfitMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;

  // 9. 상태 판단
  const isProfitable = netProfit > 0;
  const { status: profitStatus, message: statusMessage } = getProfitStatus(netProfitMargin);

  // 10. 손익분기점 계산 (고정비 / 공헌이익률)
  const contributionMarginRate = netSales > 0
    ? (netSales - totalCommission - totalVariableCosts) / netSales
    : 0;
  const breakEvenSales = contributionMarginRate > 0
    ? totalFixedCosts / contributionMarginRate
    : 0;
  const salesVsBreakEven = breakEvenSales > 0 ? (netSales / breakEvenSales) * 100 : 0;

  // 11. 비용 구조 분석
  const totalCosts = totalCommission + totalOperatingCosts;
  const costStructure = {
    commissionPercent: netSales > 0 ? (totalCommission / netSales) * 100 : 0,
    fixedPercent: netSales > 0 ? (totalFixedCosts / netSales) * 100 : 0,
    variablePercent: netSales > 0 ? (totalVariableCosts / netSales) * 100 : 0,
    profitPercent: netProfitMargin,
  };

  return {
    grossSales,
    netSales,
    refundAmount,
    refundRate,
    totalCommission,
    commissionRate,
    commissionBreakdown: {
      salesAgent: commission.salesAgentCommission,
      mentor: commission.mentorCommission,
      branchManager: commission.branchManagerCommission,
      other: commission.otherCommission,
    },
    grossProfit,
    grossProfitMargin,
    totalFixedCosts,
    totalVariableCosts,
    totalOperatingCosts,
    fixedCostBreakdown: fixedCosts,
    variableCostBreakdown: variableCosts,
    operatingProfit,
    operatingProfitMargin,
    netProfit,
    netProfitMargin,
    isProfitable,
    profitStatus,
    statusMessage,
    breakEvenSales,
    salesVsBreakEven,
    costStructure,
  };
}

/**
 * 금액 포맷팅
 */
export function formatAmount(amount: number, showSign = false): string {
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : (showSign && amount > 0 ? '+' : '');

  if (absAmount >= 100000000) {
    return `${sign}${(absAmount / 100000000).toFixed(1)}억`;
  }
  if (absAmount >= 10000000) {
    return `${sign}${(absAmount / 10000).toFixed(0)}만`;
  }
  if (absAmount >= 10000) {
    return `${sign}${(absAmount / 10000).toFixed(1)}만`;
  }
  return `${sign}${absAmount.toLocaleString()}`;
}

/**
 * 상세 금액 포맷팅
 */
export function formatDetailAmount(amount: number): string {
  return `${amount.toLocaleString()}원`;
}

/**
 * 퍼센트 포맷팅
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * 상태별 색상
 */
export function getStatusColor(status: MarginCalculationResult['profitStatus']): {
  bg: string;
  text: string;
  border: string;
  icon: string;
} {
  switch (status) {
    case 'excellent':
      return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: '🚀' };
    case 'good':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: '👍' };
    case 'warning':
      return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', icon: '⚠️' };
    case 'danger':
      return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: '🔶' };
    case 'critical':
      return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: '🚨' };
    default:
      return { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', icon: '📊' };
  }
}

/**
 * 기본 고정비 템플릿
 */
export function getDefaultFixedCosts(): FixedCostData {
  return {
    officeRent: 0,
    electricity: 0,
    water: 0,
    internet: 0,
    aiPlatformFee: 0,
    serverCost: 0,
    insurance: 0,
    otherFixed: 0,
  };
}

/**
 * 기본 변동비 템플릿
 */
export function getDefaultVariableCosts(): VariableCostData {
  return {
    marketingCost: 0,
    salesCost: 0,
    travelCost: 0,
    entertainmentCost: 0,
    suppliesCost: 0,
    otherVariable: 0,
  };
}
