// lib/cache.ts
// 인메모리 캐시 (비용 0원)
// 자주 조회되는 데이터를 메모리에 캐싱하여 DB 부하 감소

import { logger } from './logger';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class InMemoryCache {
  private store: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private maxSize: number = 1000; // 최대 캐시 항목 수

  constructor() {
    // 5분마다 만료된 항목 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * 캐시에 데이터 저장
   * @param key - 캐시 키
   * @param data - 저장할 데이터
   * @param ttlMs - Time to live (밀리초), 기본 5분
   */
  set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
    // 캐시 크기 제한
    if (this.store.size >= this.maxSize) {
      // 가장 오래된 항목 삭제
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * 캐시에서 데이터 가져오기
   * @param key - 캐시 키
   * @returns 캐시된 데이터 또는 null
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  /**
   * 캐시 항목 삭제
   * @param key - 캐시 키
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * 패턴으로 캐시 삭제
   * @param pattern - 키 패턴 (예: "rag:*")
   */
  deletePattern(pattern: string): number {
    let deletedCount = 0;
    const regex = new RegExp(pattern.replace('*', '.*'));
    
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  /**
   * 모든 캐시 삭제
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * 만료된 항목 정리
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt < now) {
        this.store.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug(`[Cache] 만료된 항목 ${cleanedCount}개 정리 완료`);
    }
  }

  /**
   * 캐시 통계
   */
  getStats() {
    return {
      size: this.store.size,
      maxSize: this.maxSize,
    };
  }

  /**
   * 정리 타이머 중지 (테스트용)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// 글로벌 인스턴스
export const inMemoryCache = new InMemoryCache();


