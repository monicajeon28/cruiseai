// lib/payapp.ts
// PayApp API 연동 라이브러리

const PAYAPP_API_URL = 'https://api.payapp.kr/oapi/apiLoad.html';

export interface PayAppConfig {
  userid: string;
  linkkey: string;
  linkval: string;
}

export interface PayAppRequestParams {
  cmd: string;
  userid: string;
  goodname: string;
  price: number;
  recvphone: string;
  memo?: string;
  reqaddr?: number;
  feedbackurl?: string;
  var1?: string;
  var2?: string;
  smsuse?: string;
  vccode?: string;
  returnurl?: string;
  openpaytype?: string;
  checkretry?: string;
  redirectpay?: string;
  skip_cstpage?: string;
  amount_taxable?: number;
  amount_taxfree?: number;
  amount_vat?: number;
}

export interface PayAppResponse {
  state: string;
  errorMessage?: string;
  errno?: string;
  mul_no?: string;
  payurl?: string;
  qrurl?: string;
}

/**
 * PayApp REST API 호출
 */
export async function payappApiPost(params: PayAppRequestParams): Promise<PayAppResponse> {
  try {
    // 파라메터를 URL 인코딩된 문자열로 변환
    const postData = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        postData.append(key, String(value));
      }
    });

    const response = await fetch(PAYAPP_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: postData.toString(),
    });

    if (!response.ok) {
      throw new Error(`PayApp API 호출 실패: ${response.status}`);
    }

    const responseText = await response.text();
    console.log('[PayApp] API 응답 원문:', responseText);

    const parseData: Record<string, string> = {};

    // URL 인코딩된 응답 파싱
    responseText.split('&').forEach((pair) => {
      const [key, value] = pair.split('=');
      if (key && value) {
        parseData[key] = decodeURIComponent(value);
      }
    });

    console.log('[PayApp] 파싱된 응답:', parseData);
    return parseData as unknown as PayAppResponse;
  } catch (error: any) {
    console.error('[PayApp] API 호출 오류:', error);
    return {
      state: '0',
      errorMessage: error?.message || 'PayApp API 호출 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 계약서 타입별 결제 금액 반환
 */
export function getContractPrice(contractType: string): number {
  switch (contractType) {
    case 'SALES_AGENT':
      return 3300000; // 판매원: 330만원
    case 'BRANCH_MANAGER':
      return 7500000; // 대리점장: 750만원
    case 'CRUISE_STAFF':
      return 5400000; // 크루즈스탭: 540만원
    case 'PRIMARKETER':
      return 1000000; // 프리마케터: 100만원
    case 'SUBSCRIPTION_AGENT':
      return 100000; // 정액제 판매원: 10만원
    default:
      return 0;
  }
}

/**
 * 계약서 타입별 상품명 반환
 */
export function getContractGoodName(contractType: string): string {
  switch (contractType) {
    case 'SALES_AGENT':
      return '판매원 계약서';
    case 'BRANCH_MANAGER':
      return '대리점장 계약서';
    case 'CRUISE_STAFF':
      return '크루즈스탭 계약서';
    case 'PRIMARKETER':
      return '프리마케터 계약서';
    case 'SUBSCRIPTION_AGENT':
      return '정액제 판매원 1개월 구독';
    default:
      return '계약서';
  }
}

// ============================================
// 랜딩페이지 결제용 함수들 (PayApp)
// ============================================

// 환경변수에서 PayApp 설정 가져오기
const getPayAppConfig = () => ({
  userid: process.env.PAYAPP_USERID || '',
  linkkey: process.env.PAYAPP_LINKKEY || '',
  linkval: process.env.PAYAPP_LINKVAL || '',
});

export interface LandingPaymentParams {
  goodname: string;       // 상품명
  price: number;          // 결제금액 (1000원 이상)
  recvphone: string;      // 수신자 휴대폰번호
  memo?: string;          // 메모
  var1?: string;          // 임의변수1 (주문번호 등)
  var2?: string;          // 임의변수2 (랜딩페이지 ID 등)
  feedbackurl: string;    // 웹훅 URL
  returnurl?: string;     // 결제완료 후 이동 URL
  smsuse?: 'y' | 'n';     // SMS 발송 여부
  openpaytype?: string;   // 결제수단 (card, phone, kakaopay 등)
}

export interface PayAppFeedbackData {
  userid: string;
  linkkey: string;
  linkval: string;
  goodname: string;
  price: string;
  recvphone: string;
  memo?: string;
  reqaddr?: string;
  reqdate?: string;
  pay_memo?: string;
  pay_addr?: string;
  pay_date?: string;
  pay_type?: string;      // 1:신용카드, 2:휴대전화, 4:대면결제, 6:계좌이체, 7:가상계좌 등
  pay_state?: string;     // 4:결제완료, 8/32:요청취소, 9/64:승인취소, 10:결제대기
  var1?: string;
  var2?: string;
  mul_no?: string;
  payurl?: string;
  csturl?: string;
  card_name?: string;
  canceldate?: string;
  feedbacktype?: string;
}

// pay_state 코드 의미
export const PAY_STATE = {
  REQUESTED: '1',          // 결제요청
  PAID: '4',               // 결제완료
  CANCELLED_REQUEST: '8',  // 요청취소
  CANCELLED_APPROVAL: '9', // 승인취소
  WAITING: '10',           // 결제대기
  CANCELLED_REQUEST_2: '32',
  CANCELLED_APPROVAL_2: '64',
  PARTIAL_CANCELLED: '70', // 부분취소
  PARTIAL_CANCELLED_2: '71',
} as const;

// pay_type 코드 의미
export const PAY_TYPE = {
  CARD: '1',               // 신용카드
  PHONE: '2',              // 휴대전화
  FACE_TO_FACE: '4',       // 대면결제
  BANK_TRANSFER: '6',      // 계좌이체
  VIRTUAL_ACCOUNT: '7',    // 가상계좌
  KAKAOPAY: '15',          // 카카오페이
  NAVERPAY: '16',          // 네이버페이
  REGISTERED: '17',        // 등록결제
  SMILEPAY: '21',          // 스마일페이
  WECHATPAY: '22',         // 위챗페이
  APPLEPAY: '23',          // 애플페이
  MYACCOUNT: '24',         // 내통장결제
} as const;

/**
 * 랜딩페이지 결제 요청
 */
export async function requestLandingPayment(params: LandingPaymentParams): Promise<PayAppResponse> {
  const config = getPayAppConfig();

  const requestParams: PayAppRequestParams = {
    cmd: 'payrequest',
    userid: config.userid,
    goodname: params.goodname,
    price: params.price,
    recvphone: params.recvphone,
    feedbackurl: params.feedbackurl,
    checkretry: 'y',
    smsuse: params.smsuse || 'n',
  };

  if (params.memo) requestParams.memo = params.memo;
  if (params.var1) requestParams.var1 = params.var1;
  if (params.var2) requestParams.var2 = params.var2;
  if (params.returnurl) requestParams.returnurl = params.returnurl;
  if (params.openpaytype) requestParams.openpaytype = params.openpaytype;

  console.log('[PayApp] 랜딩페이지 결제 요청:', { goodname: params.goodname, price: params.price });

  const result = await payappApiPost(requestParams);

  if (result.state === '1') {
    console.log('[PayApp] 결제 요청 성공:', { mul_no: result.mul_no, payurl: result.payurl });
  } else {
    console.error('[PayApp] 결제 요청 실패:', result.errorMessage);
  }

  return result;
}

/**
 * 결제 취소 (요청 취소 또는 승인 취소)
 */
export async function cancelLandingPayment(params: {
  mul_no: string;
  cancelmode?: 'ready';   // ready: 결제요청 상태만 취소
  partcancel?: '0' | '1'; // 0: 전체취소, 1: 부분취소
  cancelprice?: number;   // 부분취소 금액
}): Promise<PayAppResponse> {
  const config = getPayAppConfig();

  const requestParams: any = {
    cmd: 'paycancel',
    userid: config.userid,
    linkkey: config.linkkey,
    mul_no: params.mul_no,
  };

  if (params.cancelmode) requestParams.cancelmode = params.cancelmode;
  if (params.partcancel) requestParams.partcancel = params.partcancel;
  if (params.cancelprice) requestParams.cancelprice = params.cancelprice;

  console.log('[PayApp] 결제 취소 요청:', { mul_no: params.mul_no });

  const result = await payappApiPost(requestParams);

  if (result.state === '1') {
    console.log('[PayApp] 결제 취소 성공');
  } else {
    console.error('[PayApp] 결제 취소 실패:', result.errorMessage);
  }

  return result;
}

/**
 * Webhook 데이터 검증
 */
export function validatePayAppFeedback(data: PayAppFeedbackData): boolean {
  const config = getPayAppConfig();

  const isValidUserId = data.userid === config.userid;
  const isValidLinkKey = data.linkkey === config.linkkey;
  const isValidLinkVal = data.linkval === config.linkval;

  if (!isValidUserId || !isValidLinkKey || !isValidLinkVal) {
    console.error('[PayApp] Webhook 검증 실패:', {
      userid: isValidUserId,
      linkkey: isValidLinkKey,
      linkval: isValidLinkVal,
    });
    return false;
  }

  return true;
}

/**
 * 결제 상태 변환
 */
export function getPaymentStatus(payState: string): string {
  switch (payState) {
    case PAY_STATE.PAID:
      return 'paid';
    case PAY_STATE.CANCELLED_REQUEST:
    case PAY_STATE.CANCELLED_REQUEST_2:
      return 'cancelled';
    case PAY_STATE.CANCELLED_APPROVAL:
    case PAY_STATE.CANCELLED_APPROVAL_2:
      return 'refunded';
    case PAY_STATE.PARTIAL_CANCELLED:
    case PAY_STATE.PARTIAL_CANCELLED_2:
      return 'partial_refunded';
    case PAY_STATE.WAITING:
      return 'waiting';
    case PAY_STATE.REQUESTED:
      return 'requested';
    default:
      return 'unknown';
  }
}

/**
 * 결제 수단명 변환
 */
export function getPayTypeName(payType: string): string {
  const typeNames: Record<string, string> = {
    [PAY_TYPE.CARD]: '신용카드',
    [PAY_TYPE.PHONE]: '휴대전화',
    [PAY_TYPE.FACE_TO_FACE]: '대면결제',
    [PAY_TYPE.BANK_TRANSFER]: '계좌이체',
    [PAY_TYPE.VIRTUAL_ACCOUNT]: '가상계좌',
    [PAY_TYPE.KAKAOPAY]: '카카오페이',
    [PAY_TYPE.NAVERPAY]: '네이버페이',
    [PAY_TYPE.REGISTERED]: '등록결제',
    [PAY_TYPE.SMILEPAY]: '스마일페이',
    [PAY_TYPE.WECHATPAY]: '위챗페이',
    [PAY_TYPE.APPLEPAY]: '애플페이',
    [PAY_TYPE.MYACCOUNT]: '내통장결제',
  };

  return typeNames[payType] || '기타';
}
