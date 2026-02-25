const ALIGO_BASE_URL = 'https://apis.aligo.in';

export type AligoMessageType = 'SMS' | 'LMS' | 'MMS';

export interface AligoSendParams {
  receiver: string;
  msg: string;
  sender?: string;
  msgType?: AligoMessageType;
  title?: string;
  destination?: string;
  rdate?: string;
  rtime?: string;
  testMode?: boolean;
}

export interface AligoSendResponse {
  result_code: string;
  message?: string;
  message_id?: string;
  msg_id?: string;
  success_cnt?: string;
  error_cnt?: string;
  [key: string]: unknown;
}

export interface AligoRemainResponse {
  result_code: string;
  message?: string;
  SMS_CNT?: string;
  LMS_CNT?: string;
  MMS_CNT?: string;
  cash?: string;
  [key: string]: unknown;
}

function getAuthConfig() {
  const apiKey = process.env.ALIGO_API_KEY;
  const userId = process.env.ALIGO_USER_ID;

  if (!apiKey || !userId) {
    throw new Error('알리고 API 인증 정보가 설정되어 있지 않습니다. (ALIGO_API_KEY, ALIGO_USER_ID)');
  }

  return { apiKey, userId };
}

function resolveSender(customSender?: string) {
  const sender = customSender || process.env.ALIGO_SENDER_PHONE;

  if (!sender) {
    throw new Error('알리고 발신번호가 설정되어 있지 않습니다. (ALIGO_SENDER_PHONE)');
  }

  return sender;
}

async function postForm<T extends Record<string, unknown>>(path: string, params: Record<string, string>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${ALIGO_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: new URLSearchParams(params),
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`알리고 API 요청이 실패했습니다. (${response.status}) ${text}`);
    }

    const data = (await response.json()) as T;
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('알리고 API 요청이 시간 초과되었습니다.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendSms(params: AligoSendParams): Promise<AligoSendResponse> {
  const { apiKey, userId } = getAuthConfig();
  const sender = resolveSender(params.sender);

  const payload: Record<string, string> = {
    key: apiKey,
    user_id: userId,
    sender,
    receiver: params.receiver,
    msg: params.msg,
    msg_type: (params.msgType || 'SMS').toUpperCase(),
  };

  if (params.title) payload.title = params.title;
  if (params.destination) payload.destination = params.destination;
  if (params.rdate) payload.rdate = params.rdate;
  if (params.rtime) payload.rtime = params.rtime;
  if (params.testMode) payload.testmode_yn = 'Y';

  return postForm<AligoSendResponse>('/send/', payload);
}

export async function fetchRemain(): Promise<AligoRemainResponse> {
  const { apiKey, userId } = getAuthConfig();

  const payload: Record<string, string> = {
    key: apiKey,
    user_id: userId,
  };

  return postForm<AligoRemainResponse>('/remain/', payload);
}

export function parseCashValue(remain: AligoRemainResponse | null | undefined): number | null {
  if (!remain) return null;
  const raw = typeof remain.cash === 'string' ? parseFloat(remain.cash) : Number(remain.cash ?? NaN);
  return Number.isFinite(raw) ? raw : null;
}
