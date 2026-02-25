/**
 * 햅틱 피드백 유틸리티
 * 작업자 C (UX/기능 전문가) - 모바일 UX 개선
 */

/**
 * 햅틱 피드백 타입
 */
export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * 햅틱 피드백 실행
 * iOS, Android 모두 지원
 */
export function triggerHaptic(type: HapticType = 'medium') {
  // Vibration API 지원 확인
  if (!('vibrate' in navigator)) {
    return;
  }

  // 타입별 진동 패턴 (밀리초)
  const patterns: Record<HapticType, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 50, 10],      // 짧-긴-짧
    warning: [20, 100, 20],     // 중간-긴-중간
    error: [30, 100, 30, 100, 30], // 강-긴-강-긴-강
  };

  const pattern = patterns[type];

  try {
    if (Array.isArray(pattern)) {
      navigator.vibrate(pattern);
    } else {
      navigator.vibrate(pattern);
    }
  } catch (error) {
    // 진동 실패 시 무시
    console.debug('Haptic feedback not supported or failed');
  }
}

/**
 * 버튼 클릭 시 사용
 */
export function hapticClick() {
  triggerHaptic('light');
}

/**
 * 중요한 액션 시 사용
 */
export function hapticImpact() {
  triggerHaptic('medium');
}

/**
 * 성공 시 사용
 */
export function hapticSuccess() {
  triggerHaptic('success');
}

/**
 * 에러 시 사용
 */
export function hapticError() {
  triggerHaptic('error');
}

/**
 * 경고 시 사용
 */
export function hapticWarning() {
  triggerHaptic('warning');
}

