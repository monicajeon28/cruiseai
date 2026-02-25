// lib/welcomepay.ts
// 웰컴페이먼츠 PG 연동 라이브러리

import crypto from 'crypto';

// ==========================================
// 환경 설정
// ==========================================

// 테스트/운영 환경 URL
export const WELCOMEPAY_CONFIG = {
  // PC Web - INIStdPay.js를 통한 결제 (Form Submit이 아님!)
  // 테스트: tstdpay, 운영: stdpay
  PC_SCRIPT_TEST_URL: 'https://tstdpay.paywelcome.co.kr/stdjs/INIStdPay.js',
  PC_SCRIPT_PROD_URL: 'https://stdpay.paywelcome.co.kr/stdjs/INIStdPay.js',
  PC_TEST_URL: 'https://tpay.paywelcome.co.kr/smart/wPayStd.jsp',
  PC_PROD_URL: 'https://pay.paywelcome.co.kr/smart/wPayStd.jsp',

  // Mobile Web - 순수 HTML Form Submit (Action URL로 직접 이동)
  MOBILE_TEST_URL: 'https://tmobile.paywelcome.co.kr',
  MOBILE_PROD_URL: 'https://mobile.paywelcome.co.kr',

  // 결제 수단별 경로 (Mobile용)
  MOBILE_PATHS: {
    CARD: '/smart/wcard/',      // 신용카드 (ISP/안심클릭)
    BANK: '/smart/bank/',       // 계좌이체
    VBANK: '/smart/vbank/',     // 가상계좌
    MOBILE: '/smart/mobile/',   // 휴대폰결제
  },
};

/**
 * PC 결제 스크립트 URL 반환 (테스트/운영 환경 분기)
 */
export function getPCScriptUrl(isProduction: boolean): string {
  return isProduction
    ? WELCOMEPAY_CONFIG.PC_SCRIPT_PROD_URL
    : WELCOMEPAY_CONFIG.PC_SCRIPT_TEST_URL;
}

// ==========================================
// 타입 정의
// ==========================================

export type PaymentMethod = 'CARD' | 'BANK' | 'VBANK' | 'MOBILE' | 'ALL';
export type EasyPayCode = 'KAKAOPAY' | 'TOSSPAY' | 'PAYCO' | 'LPAY' | 'NAVERPAY';

export interface WelcomePayConfig {
  mid: string;           // 가맹점 ID
  signKey: string;       // 서명키
  isProduction: boolean; // 운영환경 여부
}

export interface PaymentRequestParams {
  // 필수 항목
  orderId: string;       // 주문번호 (가맹점에서 생성)
  amount: number;        // 결제금액
  productName: string;   // 상품명
  buyerName: string;     // 구매자명
  buyerTel: string;      // 구매자 연락처

  // 선택 항목
  buyerEmail?: string;   // 구매자 이메일
  returnUrl?: string;    // 결제 완료 후 리턴 URL
  nextUrl?: string;      // 모바일 인증 후 URL (Mobile Only)
  notiUrl?: string;      // 노티 URL (서버 to 서버)

  // 결제 옵션
  payMethod?: PaymentMethod;      // 결제 수단
  easyPayCodes?: EasyPayCode[];   // 간편결제 코드 (복수 선택 가능)
  quotaBase?: string;             // 할부 개월 (예: "00:02:03:06:12" — 00=일시불, 나머지는 개월수)

  // 세금 관련
  taxAmount?: number;    // 과세금액
  taxFreeAmount?: number; // 비과세금액
  vatAmount?: number;    // 부가세

  // 가상계좌 옵션
  vbankExpireDate?: string; // 입금기한 (YYYYMMDD)
  vbankExpireTime?: string; // 입금기한 시간 (HHMM)

  // 메타데이터 (가맹점 정의 데이터)
  metadata?: Record<string, any>;
}

export interface SignatureData {
  mkey: string;        // SHA-256(signKey)
  timestamp: string;   // 타임스탬프
  signature: string;   // 최종 서명값
  oid: string;         // 주문번호
}

export interface MobilePaymentForm {
  P_MID: string;
  P_OID: string;
  P_AMT: string;
  P_UNAME: string;
  P_MNAME: string;
  P_NOTI: string;
  P_GOODS: string;
  P_MOBILE: string;
  P_EMAIL: string;
  P_NEXT_URL: string;
  P_RETURN_URL: string;
  P_NOTI_URL: string;
  P_TIMESTAMP: string;
  P_SIGNATURE: string;
  P_MKEY: string;
  P_CHARSET?: string;
  P_TAX?: string;
  P_TAXFREE?: string;
  P_RESERVED?: string;
  P_CARD_OPTION?: string;
  P_ONLY_EASYPAYCODE?: string;
  P_QUOTABASE?: string;
  P_VBANK_DT?: string;
  P_VBANK_TM?: string;
}

export interface PCPaymentForm {
  mid: string;
  oid: string;
  goodname: string;
  price: string;
  currency: string;  // 통화 (WON)
  buyername: string;
  buyertel: string;
  buyeremail: string;
  returnUrl: string;
  closeUrl: string;
  notiurl: string;
  timestamp: string;
  signature: string;
  mKey: string;
  charset: string;
  payViewType: string;  // 결제창 표시 방식: overlay (팝업 차단 방지)
  gopaymethod?: string;
  offerPeriod?: string;
  acceptmethod?: string;
  quotabase?: string;
  nointerest?: string;
  cardcode?: string;
  only_easypay?: string;
}

export interface PaymentResult {
  // 공통 응답
  P_STATUS: string;      // 결과코드 (00: 성공)
  P_RMESG1: string;      // 결과메시지
  P_TID: string;         // 거래번호
  P_TYPE: string;        // 결제수단 (CARD, BANK, VBANK, MOBILE)
  P_AUTH_DT: string;     // 승인일시
  P_MID: string;         // 가맹점 ID
  P_OID: string;         // 주문번호
  P_AMT: string;         // 결제금액
  P_UNAME: string;       // 구매자명
  P_MNAME: string;       // 가맹점명
  P_NOTI: string;        // 가맹점 데이터

  // 카드 결제 추가 정보
  P_CARD_ISSUER_CODE?: string;  // 카드 발급사 코드
  P_CARD_MEMBER_NUM?: string;   // 카드번호 (마스킹)
  P_CARD_PURCHASE_CODE?: string; // 매입사 코드
  P_CARD_INTEREST?: string;     // 무이자 여부
  P_CARD_CHECKFLAG?: string;    // 체크카드 여부
  P_AUTH_NO?: string;           // 승인번호
  P_FN_CD1?: string;            // 카드사 코드
  P_FN_NM?: string;             // 카드사명
  P_RMESG2?: string;            // 추가 메시지

  // 가상계좌 추가 정보
  P_VACT_NUM?: string;          // 가상계좌 번호
  P_VACT_DATE?: string;         // 입금기한 날짜
  P_VACT_TIME?: string;         // 입금기한 시간
  P_VACT_NAME?: string;         // 예금주명
  P_VACT_BANK_CODE?: string;    // 은행코드

  // 계좌이체 추가 정보
  // (P_FN_CD1, P_FN_NM 사용)

  // 휴대폰 결제 추가 정보
  P_HPP_CORP?: string;          // 통신사
  P_HPP_NUM?: string;           // 휴대폰번호 (마스킹)
}

// ==========================================
// 유틸리티 함수
// ==========================================

/**
 * 타임스탬프 생성 (밀리초)
 */
export function getTimestamp(): string {
  return Date.now().toString();
}

/**
 * SHA-256 해시 생성
 */
export function sha256Hash(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * URL을 HTTPS로 강제 변환
 * 매뉴얼 1.21 주의사항: P_NEXT_URL은 반드시 https:// 프로토콜이어야 함
 */
export function ensureHttps(url: string): string {
  if (!url) return url;
  // http://로 시작하면 https://로 변환
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  // 프로토콜이 없으면 https:// 추가
  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    return `https://${url}`;
  }
  return url;
}

/**
 * Mobile용 Signature 생성 (웰컴페이먼츠 방식)
 *
 * 순서: mkey, P_AMT, P_OID, P_TIMESTAMP (순서 중요!)
 * signature = SHA-256("mkey={mkey}&P_AMT={금액}&P_OID={주문번호}&P_TIMESTAMP={타임스탬프}")
 * mkey = SHA-256(signKey)
 *
 * 주의: 마지막에 &를 붙이지 않음
 */
export function generateMobileSignature(
  signKey: string,
  amount: number,
  orderId: string,
  timestamp: string
): SignatureData {
  // 1. mkey 생성 (signKey를 SHA-256 해시)
  const mkey = sha256Hash(signKey);

  // 2. signature 생성을 위한 문자열 (Mobile용: mkey, P_AMT, P_OID, P_TIMESTAMP 순서)
  const signString = `mkey=${mkey}&P_AMT=${amount}&P_OID=${orderId}&P_TIMESTAMP=${timestamp}`;

  // 3. 최종 signature (SHA-256)
  const signature = sha256Hash(signString);

  return {
    mkey,
    timestamp,
    signature,
    oid: orderId,
  };
}

/**
 * @deprecated Use generateMobileSignature instead
 */
export function generateSignature(
  signKey: string,
  amount: number,
  orderId: string,
  timestamp: string
): SignatureData {
  return generateMobileSignature(signKey, amount, orderId, timestamp);
}

/**
 * PC Web Signature 생성 (웰컴페이먼츠 표준)
 *
 * 순서: mKey, oid, price, timestamp (알파벳순, 순서 중요!)
 * signature = SHA-256("mKey={mkey}&oid={주문번호}&price={금액}&timestamp={타임스탬프}")
 * mKey = SHA-256(signKey)
 *
 * 참고: 웰컴페이먼츠 PC_Web_manual_v.1.10.13 Page 16
 */
export function generatePCSignature(
  signKey: string,
  amount: number,
  orderId: string,
  timestamp: string
): SignatureData {
  const mkey = sha256Hash(signKey);

  // PC용 signature 문자열: mKey, oid, price, timestamp 순서 (알파벳순)
  const signString = `mKey=${mkey}&oid=${orderId}&price=${amount}&timestamp=${timestamp}`;
  const signature = sha256Hash(signString);

  return {
    mkey,
    timestamp,
    signature,
    oid: orderId,
  };
}

/**
 * PC 결제 승인요청용 Signature 생성 (웰컴페이먼츠 매뉴얼 Page 26)
 *
 * 승인요청 시 signature 생성 대상(Target):
 * - authToken (인증 결과 수신 후 생성된 토큰 값)
 * - timestamp (타임스탬프)
 *
 * 형식: authToken={토큰값}&timestamp={타임스탬프}
 * signature = SHA-256(위 문자열)
 *
 * 주의: 결제요청 signature와 다름! (결제요청은 mKey, oid, price, timestamp 사용)
 */
export function generateApprovalSignature(
  authToken: string,
  timestamp: string
): string {
  // 승인요청용 signature 문자열: authToken, timestamp 순서
  const signString = `authToken=${authToken}&timestamp=${timestamp}`;
  const signature = sha256Hash(signString);

  return signature;
}

// ==========================================
// 결제 폼 데이터 생성
// ==========================================

/**
 * 모바일 결제 폼 데이터 생성
 */
export function createMobilePaymentForm(
  config: WelcomePayConfig,
  params: PaymentRequestParams
): MobilePaymentForm {
  const timestamp = getTimestamp();
  // 중요: signature 생성에 사용된 timestamp와 폼의 P_TIMESTAMP가 반드시 동일해야 함
  const signatureData = generateMobileSignature(
    config.signKey,
    params.amount,
    params.orderId,
    timestamp
  );
  const { signature, mkey } = signatureData;
  // signatureData.timestamp === timestamp 임을 보장 (동일 변수 사용)

  // P_RESERVED 옵션 구성
  const reservedOptions: string[] = [
    'twotrs_isp=Y',      // ISP 2트랜잭션
    'block_isp=Y',       // ISP 팝업 차단 방지
    'twotrs_isp_noti=N', // ISP 노티 미발송
    'apprun_check=Y',    // 앱 설치 체크
  ];

  // 간편결제 코드 설정
  let easyPayOption = '';
  if (params.easyPayCodes && params.easyPayCodes.length > 0) {
    easyPayOption = params.easyPayCodes.join(':');
  }

  const form: MobilePaymentForm = {
    P_MID: config.mid,
    P_OID: params.orderId,
    P_AMT: params.amount.toString(),
    P_UNAME: params.buyerName,
    P_MNAME: '크루즈가이드',
    P_NOTI: params.metadata ? JSON.stringify(params.metadata) : '',
    P_GOODS: params.productName,
    P_MOBILE: params.buyerTel,
    P_EMAIL: params.buyerEmail || '',
    // 매뉴얼 1.21 주의사항: P_NEXT_URL은 반드시 https:// 프로토콜이어야 함
    // 모바일 결제 콜백 URL 하드코딩
    P_NEXT_URL: 'https://www.cruisedot.co.kr/api/payment/callback',
    P_RETURN_URL: 'https://www.cruisedot.co.kr/api/payment/return',
    P_NOTI_URL: 'https://www.cruisedot.co.kr/api/payment/notify',
    P_TIMESTAMP: timestamp,
    P_SIGNATURE: signature,
    P_MKEY: mkey,
    // 중요 (매뉴얼 1.13 주의사항):
    // - 요청(Request): 반드시 EUC-KR 인코딩으로 전송 (Form acceptCharset="euc-kr")
    // - P_CHARSET: 응답(Response) 수신 시 인코딩 설정 (utf8 = UTF-8로 응답 수신)
    P_CHARSET: 'utf8',
    P_RESERVED: reservedOptions.join('&') + '&',
  };

  // 선택 옵션 추가
  if (params.taxAmount !== undefined) {
    form.P_TAX = params.taxAmount.toString();
  }
  if (params.taxFreeAmount !== undefined) {
    form.P_TAXFREE = params.taxFreeAmount.toString();
  }
  if (easyPayOption) {
    form.P_ONLY_EASYPAYCODE = easyPayOption;
  }
  if (params.quotaBase) {
    form.P_QUOTABASE = params.quotaBase;
  }
  if (params.vbankExpireDate) {
    form.P_VBANK_DT = params.vbankExpireDate;
  }
  if (params.vbankExpireTime) {
    form.P_VBANK_TM = params.vbankExpireTime;
  }

  return form;
}

/**
 * PC 결제 폼 데이터 생성
 */
export function createPCPaymentForm(
  config: WelcomePayConfig,
  params: PaymentRequestParams
): PCPaymentForm {
  const timestamp = getTimestamp();
  // 중요: signature 생성에 사용된 timestamp와 폼의 timestamp가 반드시 동일해야 함
  const signatureData = generatePCSignature(
    config.signKey,
    params.amount,
    params.orderId,
    timestamp
  );
  const { signature, mkey } = signatureData;
  // signatureData.timestamp === timestamp 임을 보장 (동일 변수 사용)

  // 결제수단 설정
  let gopaymethod = '';
  if (params.payMethod) {
    switch (params.payMethod) {
      case 'CARD':
        gopaymethod = 'Card';
        break;
      case 'BANK':
        gopaymethod = 'DirectBank';
        break;
      case 'VBANK':
        gopaymethod = 'VBank';
        break;
      case 'MOBILE':
        gopaymethod = 'HPP';
        break;
      case 'ALL':
      default:
        gopaymethod = '';
    }
  }

  // acceptmethod 구성 (PC용 옵션)
  const acceptOptions: string[] = [
    'HPP(1)',            // 휴대폰 결제 옵션
    'below1000',         // 1000원 미만 결제 허용
    'NOINT(3:6:12)',     // 3, 6, 12개월 무이자
  ];

  // 간편결제 설정
  let onlyEasypay = '';
  if (params.easyPayCodes && params.easyPayCodes.length > 0) {
    onlyEasypay = params.easyPayCodes.join(':');
  }

  const form: PCPaymentForm = {
    mid: config.mid,
    oid: params.orderId,
    goodname: params.productName,
    price: params.amount.toString(),
    currency: 'WON',                  // 통화 (필수)
    buyername: params.buyerName,
    buyertel: params.buyerTel,
    buyeremail: params.buyerEmail || '',
    returnUrl: params.returnUrl || '',
    closeUrl: params.returnUrl || '', // 닫기 버튼 클릭시 URL
    notiurl: params.notiUrl || '',    // 결제 완료 노티 URL
    timestamp,
    signature,
    mKey: mkey,
    charset: 'UTF-8',                 // 인코딩 방식
    payViewType: 'overlay',           // 결제창 표시 방식: overlay (Iframe 팝업 - 매뉴얼 정석)
  };

  // 선택 옵션 추가
  if (gopaymethod) {
    form.gopaymethod = gopaymethod;
  }
  if (acceptOptions.length > 0) {
    form.acceptmethod = acceptOptions.join(':');
  }
  if (params.quotaBase) {
    form.quotabase = params.quotaBase;
  }
  if (onlyEasypay) {
    form.only_easypay = onlyEasypay;
  }
  // 무이자 할부는 acceptmethod의 NOINT(3:6:12)로 설정되므로 별도 nointerest 필드 불필요

  return form;
}

// ==========================================
// URL 생성
// ==========================================

/**
 * 모바일 결제 URL 생성
 */
export function getMobilePaymentUrl(
  config: WelcomePayConfig,
  payMethod: PaymentMethod = 'CARD'
): string {
  const baseUrl = config.isProduction
    ? WELCOMEPAY_CONFIG.MOBILE_PROD_URL
    : WELCOMEPAY_CONFIG.MOBILE_TEST_URL;

  const path = WELCOMEPAY_CONFIG.MOBILE_PATHS[payMethod] || WELCOMEPAY_CONFIG.MOBILE_PATHS.CARD;

  return baseUrl + path;
}

/**
 * PC 결제 URL 생성
 */
export function getPCPaymentUrl(config: WelcomePayConfig): string {
  return config.isProduction
    ? WELCOMEPAY_CONFIG.PC_PROD_URL
    : WELCOMEPAY_CONFIG.PC_TEST_URL;
}

// ==========================================
// 결과 검증
// ==========================================

/**
 * 결제 결과 성공 여부 확인
 */
export function isPaymentSuccess(status: string): boolean {
  return status === '00' || status === '0000';
}

/**
 * 가상계좌 입금대기 여부 확인
 */
export function isVBankWaiting(result: PaymentResult): boolean {
  return result.P_TYPE === 'VBANK' && isPaymentSuccess(result.P_STATUS);
}

// ==========================================
// 카드사 코드 매핑
// ==========================================

export const CARD_CODES: Record<string, string> = {
  '01': '외환카드',
  '03': '롯데카드',
  '04': '현대카드',
  '06': '국민카드',
  '11': 'BC카드',
  '12': '삼성카드',
  '14': '신한카드',
  '15': '한미카드',
  '16': 'NH카드',
  '17': '하나SK카드',
  '21': '해외비자',
  '22': '해외마스터',
  '23': 'JCB',
  '24': '해외아멕스',
  '25': '해외다이너스',
};

export const BANK_CODES: Record<string, string> = {
  '02': '산업은행',
  '03': '기업은행',
  '04': '국민은행',
  '05': '외환은행',
  '07': '수협은행',
  '11': '농협은행',
  '20': '우리은행',
  '23': 'SC은행',
  '27': '한국씨티은행',
  '31': '대구은행',
  '32': '부산은행',
  '34': '광주은행',
  '35': '제주은행',
  '37': '전북은행',
  '39': '경남은행',
  '45': '새마을금고',
  '48': '신협',
  '71': '우체국',
  '81': '하나은행',
  '88': '신한은행',
  '89': '케이뱅크',
  '90': '카카오뱅크',
  '92': '토스뱅크',
};

// ==========================================
// 환경 변수에서 설정 로드
// ==========================================

export function getWelcomePayConfig(): WelcomePayConfig {
  // 운영 MID 고정 (wpcrdot200)
  const mid = process.env.WELCOMEPAY_MID || process.env.PG_MID_AUTH || 'wpcrdot200';
  // SignKey는 환경변수에서 가져오거나 기본값 사용
  const signKey = process.env.WELCOMEPAY_SIGNKEY || process.env.PG_SIGNKEY || '';

  // ⚠️ 운영 모드 고정 - 항상 운영 URL 사용
  // 테스트 모드가 필요하면 환경변수 WELCOMEPAY_PRODUCTION=false 설정
  const isProduction = process.env.WELCOMEPAY_PRODUCTION !== 'false';

  return {
    mid,
    signKey,
    isProduction,
  };
}

/**
 * 비인증(키인) 결제용 설정
 */
export function getWelcomePayNonAuthConfig(): WelcomePayConfig {
  const mid = process.env.WELCOMEPAY_MID_NON_AUTH || process.env.PG_MID_NON_AUTH || 'welcometst';
  const signKey = process.env.WELCOMEPAY_SIGNKEY_NON_AUTH || process.env.PG_SIGNKEY_NON_AUTH || '';
  // 운영환경: WELCOMEPAY_PRODUCTION=true 일 때만 운영 URL 사용
  const isProduction = process.env.WELCOMEPAY_PRODUCTION === 'true';

  return {
    mid,
    signKey,
    isProduction,
  };
}
