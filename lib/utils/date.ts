/**
 * 날짜 포맷팅 유틸리티
 * 일관된 날짜 표시를 위한 함수들
 */

/**
 * ISO 날짜 문자열을 한국 형식으로 변환
 * @param isoDate ISO 8601 날짜 문자열
 * @returns "YYYY.MM.DD HH:mm" 형식
 */
export function formatDateTime(isoDate: string | Date): string {
  const date = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;

  if (isNaN(date.getTime())) {
    return '-';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}.${month}.${day} ${hours}:${minutes}`;
}

/**
 * ISO 날짜 문자열을 날짜만 표시
 * @param isoDate ISO 8601 날짜 문자열
 * @returns "YYYY.MM.DD" 형식
 */
export function formatDate(isoDate: string | Date): string {
  const date = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;

  if (isNaN(date.getTime())) {
    return '-';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}.${month}.${day}`;
}

/**
 * ISO 날짜 문자열을 시간만 표시
 * @param isoDate ISO 8601 날짜 문자열
 * @returns "HH:mm" 형식
 */
export function formatTime(isoDate: string | Date): string {
  const date = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;

  if (isNaN(date.getTime())) {
    return '-';
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

/**
 * 상대적인 시간 표시 (방금 전, N분 전, N시간 전 등)
 * @param isoDate ISO 8601 날짜 문자열
 * @returns 상대 시간 문자열
 */
export function formatRelativeTime(isoDate: string | Date): string {
  const date = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;

  if (isNaN(date.getTime())) {
    return '-';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return '방금 전';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;

  return formatDate(date);
}

/**
 * 날짜 범위를 문자열로 변환
 * @param startDate 시작 날짜
 * @param endDate 종료 날짜
 * @returns "YYYY.MM.DD - YYYY.MM.DD" 형식
 */
export function formatDateRange(startDate: string | Date, endDate: string | Date): string {
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}
