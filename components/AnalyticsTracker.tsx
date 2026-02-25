'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageView, trackFeature } from '@/lib/analytics';

/**
 * 사용자 활동 추적 컴포넌트
 * 기존 기능은 건드리지 않고 추적만 추가
 */
export default function AnalyticsTracker() {
  const pathname = usePathname();

  // 페이지 방문 추적
  useEffect(() => {
    if (pathname) {
      trackPageView(pathname);
    }
  }, [pathname]);

  return null; // UI 렌더링 없음
}























