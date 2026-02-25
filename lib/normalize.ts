export function normalizePlace(place: string): string {
  // 실제 장소 정규화 로직은 여기에 구현합니다.
  // 현재는 임시로 공백을 제거하고 소문자로 변환합니다.
  return place.trim().toLowerCase();
}

export function toDestArray(
  d?: string | string[] | null
): string[] {
  if (Array.isArray(d)) return d;
  if (typeof d === 'string') {
    // DB에 문자열로 들어온 경우: "일본, 도쿄도" → ["일본", "도쿄도"]
    return d.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}










