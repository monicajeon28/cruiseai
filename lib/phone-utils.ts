/**
 * 전화번호 정규화 유틸리티
 *
 * 다양한 형식의 전화번호를 통일된 형식으로 변환하여 중복 방지
 *
 * @example
 * normalizePhone("010-1234-5678") // "01012345678"
 * normalizePhone("010 1234 5678") // "01012345678"
 * normalizePhone("01012345678")   // "01012345678"
 */

/**
 * 전화번호를 숫자만 남기고 정규화
 * DB 저장 시 사용 - 중복 방지용
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;

  // 숫자만 추출
  const normalized = phone.replace(/\D/g, '');

  // 빈 문자열 체크
  if (!normalized) return null;

  // 한국 휴대폰 번호 검증 (010, 011, 016, 017, 018, 019로 시작하는 11자리)
  if (/^01[0-9]{9}$/.test(normalized)) {
    return normalized;
  }

  // 일반 전화번호 (02, 031, 032 등으로 시작)
  if (/^0\d{8,10}$/.test(normalized)) {
    return normalized;
  }

  // 그 외 숫자만 있으면 그대로 반환
  return normalized;
}

/**
 * 전화번호를 표시용 형식으로 변환
 * 화면 표시용 - 판매원/대리점장/관리자 모두 전체 번호 표시
 *
 * @example
 * formatPhone("01012345678") // "010-1234-5678"
 */
export function formatPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;

  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  // 휴대폰 번호 (11자리)
  if (/^01[0-9]{9}$/.test(normalized)) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  }

  // 서울 전화번호 (02-XXXX-XXXX, 02-XXX-XXXX)
  if (normalized.startsWith('02')) {
    if (normalized.length === 9) {
      return `02-${normalized.slice(2, 5)}-${normalized.slice(5)}`;
    } else if (normalized.length === 10) {
      return `02-${normalized.slice(2, 6)}-${normalized.slice(6)}`;
    }
  }

  // 그 외 지역번호 (031-XXX-XXXX, 032-XXX-XXXX 등)
  if (normalized.length === 10) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  } else if (normalized.length === 11) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  }

  // 형식을 모르면 그대로 반환
  return normalized;
}

/**
 * 전화번호 유효성 검증
 */
export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;

  const normalized = normalizePhone(phone);
  if (!normalized) return false;

  // 최소 8자리 이상 (일반 전화번호)
  if (normalized.length < 8) return false;

  // 0으로 시작해야 함
  if (!normalized.startsWith('0')) return false;

  return true;
}

/**
 * 휴대폰 번호 유효성 검증 (010, 011, 016, 017, 018, 019)
 */
export function isValidMobilePhone(phone: string | null | undefined): boolean {
  if (!phone) return false;

  const normalized = normalizePhone(phone);
  if (!normalized) return false;

  // 한국 휴대폰 번호 검증 (010, 011, 016, 017, 018, 019로 시작하는 11자리)
  return /^01[0-9]{9}$/.test(normalized);
}

/**
 * 전화번호 마스킹 (로그/분석용 - 고객 관리 화면에서는 사용 안 함)
 *
 * @example
 * maskPhone("01012345678") // "010****5678"
 */
export function maskPhoneForLog(phone: string | null | undefined): string | null {
  if (!phone) return null;

  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  if (normalized.length < 8) return phone;

  // 앞 3자리와 뒤 4자리만 표시
  const start = normalized.slice(0, 3);
  const end = normalized.slice(-4);
  const middle = '*'.repeat(normalized.length - 7);

  return `${start}${middle}${end}`;
}
