/**
 * 사용자 활동 추적 유틸리티
 * 기존 기능은 건드리지 않고 추적만 추가
 */

type TrackOptions = {
  action: string;
  page?: string;
  metadata?: Record<string, any>;
};

/**
 * 사용자 활동 추적
 * 실패해도 사용자 경험에 영향 없도록 에러 무시
 */
export async function trackActivity(options: TrackOptions): Promise<void> {
  try {
    const page = options.page || (typeof window !== 'undefined' ? window.location.pathname : '');
    
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action: options.action,
        page,
        metadata: options.metadata || null,
      }),
    });
  } catch (error) {
    // 추적 실패는 무시 (사용자 경험에 영향 없음)
    console.debug('[Analytics] Tracking failed (ignored):', error);
  }
}

/**
 * 페이지 방문 추적
 */
export function trackPageView(page: string): void {
  if (typeof window === 'undefined') return;
  
  trackActivity({
    action: 'page_view',
    page,
  });
}

/**
 * 기능 사용 추적
 */
export function trackFeature(feature: string, metadata?: Record<string, any>): void {
  if (typeof window === 'undefined') return;
  
  trackActivity({
    action: feature,
    page: window.location.pathname,
    metadata,
  });
}























