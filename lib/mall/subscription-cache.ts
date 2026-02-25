/**
 * 정액제 판매원 수당 확인 캐싱 유틸리티
 * 메모리 기반 간단한 캐시 (향후 Redis로 확장 가능)
 */

interface CacheEntry {
  value: boolean;
  timestamp: number;
}

// 간단한 메모리 캐시 (TTL: 5분)
const commissionCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * 수당 확인 결과 캐시에서 가져오기
 */
export function getCachedCommissionStatus(mallUserId: string): boolean | null {
  const entry = commissionCache.get(mallUserId);
  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    // 캐시 만료
    commissionCache.delete(mallUserId);
    return null;
  }

  return entry.value;
}

/**
 * 수당 확인 결과 캐시에 저장
 */
export function setCachedCommissionStatus(mallUserId: string, hasCommission: boolean): void {
  commissionCache.set(mallUserId, {
    value: hasCommission,
    timestamp: Date.now(),
  });
}

/**
 * 캐시 초기화 (테스트용)
 */
export function clearCommissionCache(): void {
  commissionCache.clear();
}
