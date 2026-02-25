/**
 * 크루즈가이드 앱 초기화 함수
 * 가이드 앱은 스케줄러 없음 (메인 앱에서 실행)
 */

let initialized = false;

export async function initializeApp() {
  if (initialized) return;

  try {
    console.log('[Init] 크루즈가이드 앱 초기화 시작...');
    initialized = true;
    console.log('[Init] 크루즈가이드 앱 초기화 완료 ✓');
  } catch (error) {
    console.error('[Init] 초기화 중 오류:', error);
  }
}

export function isInitialized(): boolean {
  return initialized;
}
