// 강조: **굵게**, !!빨간!!, ==형광펜==
export function renderEmphasis(text: string) {
  let s = text
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/!!(.+?)!!/g, '<span class="text-red-600 font-extrabold">$1</span>')
    .replace(/==(.+?)==/g, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
  // 줄바꿈
  s = s.replace(/\n/g, '<br/>');
  // 이모지 → 그대로 표기 (별도 처리 불필요)
  return s;
}

export function formatDateK(dateInput: string | Date): string {
  const date = new Date(dateInput);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}년 ${month}월 ${day}일`;
}

/**
 * "HH:MM" 형식의 시간 문자열을 [hours, minutes]로 파싱합니다.
 * @param timeStr - "14:30" 형식의 시간 문자열
 * @returns [hours, minutes]
 */
export function parseTime(timeStr: string): [number, number] {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return [hours, minutes];
}

/**
 * 경로에 따라 "어필리에이트" 용어를 적절히 번역합니다.
 * 관리자 패널(/admin)에서는 "어필리에이트"를 그대로 사용하고,
 * 대리점장/판매원몰(/partner)에서는 "공유"로 표시합니다.
 * @param pathname - 현재 경로 (예: "/admin/affiliate/profiles" 또는 "/partner/123/dashboard")
 * @returns "어필리에이트" 또는 "공유"
 */
export function getAffiliateTerm(pathname?: string): string {
  // 경로가 없거나 관리자 패널이면 "어필리에이트" 반환
  if (!pathname || pathname.startsWith('/admin')) {
    return '어필리에이트';
  }
  // 그 외 (대리점장/판매원몰)에서는 "공유" 반환
  return '공유';
}


/**
 * Google Drive 이미지 URL이나 관리자 프록시 URL을 공용 이미지 프록시 URL로 변환합니다.
 * @param url - 원본 이미지 URL
 * @returns 변환된 공용 프록시 URL
 */
export const getProxyImageUrl = (url: string | null | undefined) => {
  if (!url) return '';

  // 이미 공용 프록시 URL이거나 로컬 경로인 경우 그대로 반환
  if (url.startsWith('/api/public/image-proxy') || url.startsWith('/')) return url;

  // Google Drive URL인 경우 ID 추출하여 프록시 URL로 변환
  if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
    const fileIdMatch = url.match(/[-\w]{25,}/);
    if (fileIdMatch) {
      return `/api/public/image-proxy?fileId=${fileIdMatch[0]}`;
    }
  }

  // 관리자 프록시 URL인 경우 공용 프록시로 변환
  if (url.includes('/api/admin/mall/google-drive-image')) {
    // URL 객체 사용 대신 정규식이나 문자열 파싱으로 fileId 추출 (SSR 안전성 확보)
    const match = url.match(/[?&]fileId=([^&]+)/);
    if (match && match[1]) {
      return `/api/public/image-proxy?fileId=${match[1]}`;
    }
  }

  return url;
};
