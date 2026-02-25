'use client';

import { useEffect } from 'react';

/**
 * PWA Setup 컴포넌트
 * 페이지 로드 시 Service Worker를 등록하여 PWA 설치 조건을 만족시킵니다.
 */
export default function PWASetup() {
  useEffect(() => {
    // Service Worker 등록 (페이지 로드 시 즉시)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[PWA Setup] Service Worker 등록 완료:', registration.scope);
        })
        .catch((error) => {
          console.warn('[PWA Setup] Service Worker 등록 실패:', error);
        });
    }
  }, []);

  return null; // UI 없음
}


