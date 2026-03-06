/**
 * 크루즈가이드 앱 초기화 함수
 * 가이드 앱은 스케줄러 없음 (메인 앱에서 실행)
 */

import { logger } from '@/lib/logger';

let initialized = false;

export async function initializeApp() {
  if (initialized) return;

  try {
    logger.log('[Init] 크루즈가이드 앱 초기화 시작...');
    initialized = true;
    logger.log('[Init] 크루즈가이드 앱 초기화 완료');
  } catch (error) {
    logger.error('[Init] 초기화 중 오류:', error);
  }
}

export function isInitialized(): boolean {
  return initialized;
}
