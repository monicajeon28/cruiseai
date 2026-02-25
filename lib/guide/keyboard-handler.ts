/**
 * iOS 키보드 가림 문제 해결 유틸리티
 * 작업자 C (UX/기능 전문가) - 모바일 UX 개선
 */

import { useEffect } from 'react';

/**
 * iOS에서 키보드가 나타날 때 입력창을 위로 이동
 */
export function useKeyboardHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFocus = (e: FocusEvent) => {
    const target = e.target as HTMLElement;

    // iOS 감지
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isIOS) return;

    // 입력 요소가 아니면 무시
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;

    // 키보드 높이 추정 (iOS는 약 300px)
    const keyboardHeight = 300;

    setTimeout(() => {
      const rect = target.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const inputBottom = rect.bottom;

      // 입력창이 키보드에 가려지는지 확인
      if (inputBottom > viewportHeight - keyboardHeight) {
        const scrollAmount = inputBottom - (viewportHeight - keyboardHeight) + 20; // 여유 20px
        window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      }
    }, 300); // 키보드 애니메이션 후
  };

    const handleBlur = () => {
      // 키보드 숨김 시 스크롤 복원 (선택사항)
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    };

    // 이벤트 리스너 등록
    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    return () => {
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
    };
  }, []);
}

/**
 * Viewport 높이 동적 조정 (CSS 변수)
 * iOS에서 주소창/탭바로 인한 높이 변화 대응
 */
export function setViewportHeight() {
  if (typeof window === 'undefined') return;

  const updateHeight = () => {
    // 실제 viewport 높이를 CSS 변수로 설정
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };

  updateHeight();
  window.addEventListener('resize', updateHeight);
  window.addEventListener('orientationchange', updateHeight);

  return () => {
    window.removeEventListener('resize', updateHeight);
    window.removeEventListener('orientationchange', updateHeight);
  };
}

// React Hook 버전
export function useViewportHeight() {
  useEffect(() => {
    return setViewportHeight();
  }, []);
}

