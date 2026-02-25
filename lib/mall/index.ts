// lib/mall/index.ts
// 판매몰 전용 배럴 exports
// 사용법: import { getWelcomePayConfig } from '@/lib/mall'
//
// 포함: 결제(WelcomePay/PayApp), 가격/마진/세금 계산, 구독 관리, 인증서
// 주의: 기존 import 경로('@/lib/welcomepay' 등)는 그대로 유지됩니다.

// ============================================================================
// 결제 - WelcomePay
// ============================================================================
export {
  WELCOMEPAY_CONFIG,
  getPCScriptUrl,
  getTimestamp,
  sha256Hash,
  ensureHttps,
  generateMobileSignature,
  generateSignature,
  generatePCSignature,
  generateApprovalSignature,
  createMobilePaymentForm,
  createPCPaymentForm,
  getMobilePaymentUrl,
  getPCPaymentUrl,
  isPaymentSuccess,
  isVBankWaiting,
  CARD_CODES,
  BANK_CODES,
  getWelcomePayConfig,
  getWelcomePayNonAuthConfig,
} from './welcomepay';
export type {
  PaymentMethod,
  EasyPayCode,
  WelcomePayConfig,
  PaymentRequestParams,
  SignatureData,
  MobilePaymentForm,
  PCPaymentForm,
  PaymentResult,
} from './welcomepay';

// ============================================================================
// 결제 - PayApp (랜딩 페이지 결제)
// ============================================================================
export {
  payappApiPost,
  getContractPrice,
  getContractGoodName,
  requestLandingPayment,
  cancelLandingPayment,
  validatePayAppFeedback,
  PAY_STATE,
  PAY_TYPE,
} from './payapp';
export type {
  PayAppConfig,
  PayAppRequestParams,
  PayAppResponse,
  LandingPaymentParams,
  PayAppFeedbackData,
} from './payapp';

// ============================================================================
// 가격 계산
// ============================================================================
export {
  getCurrentPrice,
  getPriceAtDate,
  calculateDiscountRate,
  calculateNetRevenue,
  calculateCommissionDistribution,
  syncCommissionTiers,
  formatPrice,
  getDiscountBadge,
} from './pricing-utils';
export type {
  CurrentPriceResult,
  CommissionDistribution,
} from './pricing-utils';

// ============================================================================
// 마진 계산
// ============================================================================
export {
  calculateMargin,
  formatAmount,
  formatDetailAmount,
  formatPercent,
  getStatusColor,
  getDefaultFixedCosts,
  getDefaultVariableCosts,
} from './margin-calculator';
export type {
  SalesData,
  CommissionData,
  FixedCostData,
  VariableCostData,
  MarginCalculationInput,
  MarginCalculationResult,
} from './margin-calculator';

// ============================================================================
// 세금 계산
// ============================================================================
export {
  calculateTax,
  formatCurrency,
  formatDetailedCurrency,
  getTaxBracketColor,
  getDaysUntilTaxFiling,
  calculateMonthlyTaxSummary,
} from './tax-calculator';
export type {
  TaxCalculationInput,
  TaxCalculationResult,
} from './tax-calculator';

export * from './tax-calendar';

// ============================================================================
// 구독 관리
// ============================================================================
export {
  getSubscriptionInfo,
  isInTrial,
  canUseFeature,
  getFeatureType,
  getFeatureRestrictionMessage,
} from '../subscription-limits';
export type { SubscriptionInfo } from '../subscription-limits';

export * from '../subscription-limits-client';

export {
  getCachedCommissionStatus,
  setCachedCommissionStatus,
  clearCommissionCache,
} from './subscription-cache';

// ============================================================================
// 어드민 권한
// ============================================================================
export {
  getMallAdminFeatureSettings,
  isMallAdmin,
} from './mall-admin-permissions';
export type { MallAdminFeatureSettings } from './mall-admin-permissions';

// ============================================================================
// 인증서 / 구매 확인서
// ============================================================================
export * from './purchase-certificate';
export { generateCertificatePng, testCertificateGeneration } from './certificate-generator';

// ============================================================================
// 재구매
// ============================================================================
export * from '../rePurchase/trigger';

// ============================================================================
// 랜딩 페이지
// ============================================================================
export {
  getLandingBaseOrigin,
  normalizeLandingImageUrl,
  normalizeLandingHtmlContent,
} from '../landing-html';

// ============================================================================
// 업로드 큐
// ============================================================================
export { uploadQueue } from './upload-queue';
