'use client';

import { useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import { hapticImpact } from '@/lib/haptic';

/**
 * Pull-to-Refresh 컴포넌트
 * 작업자 C (UX/기능 전문가) - 모바일 UX 개선
 */

interface Props {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  threshold?: number; // 새로고침 트리거 거리 (px)
  disabled?: boolean;
}

export default function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  disabled = false
}: Props) {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;

    const container = containerRef.current;
    if (!container) return;

    // 스크롤이 최상단일 때만 활성화
    if (container.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || disabled || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startY.current;

    if (distance > 0) {
      // 과도한 당김 방지 (고무줄 효과)
      const dampedDistance = Math.min(distance * 0.5, threshold * 1.5);
      setPullDistance(dampedDistance);

      // threshold 도달 시 햅틱
      if (dampedDistance >= threshold && pullDistance < threshold) {
        hapticImpact();
      }
    }
  }, [isPulling, disabled, isRefreshing, threshold, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || disabled) return;

    setIsPulling(false);

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      hapticImpact();

      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh error:', error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, disabled, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPulling, pullDistance, disabled, isRefreshing, threshold, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min((pullDistance / threshold) * 100, 100);

  return (
    <div ref={containerRef} className="relative overflow-y-auto h-full">
      {/* Pull 인디케이터 */}
      {(isPulling || isRefreshing) && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200 ease-out z-50"
          style={{
            height: `${Math.max(pullDistance, isRefreshing ? 60 : 0)}px`,
            opacity: pullDistance > 0 || isRefreshing ? 1 : 0,
          }}
        >
          <div className="flex flex-col items-center gap-2 text-gray-600">
            {isRefreshing ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="text-sm font-medium">새로고침 중...</span>
              </>
            ) : (
              <>
                <div
                  className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center transition-transform"
                  style={{
                    transform: `rotate(${progress * 3.6}deg)`,
                    borderColor: progress >= 100 ? '#3b82f6' : '#d1d5db',
                  }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <span className="text-sm font-medium">
                  {progress >= 100 ? '손을 떼면 새로고침' : '아래로 당겨서 새로고침'}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 콘텐츠 */}
      <div
        className="transition-transform duration-200 ease-out"
        style={{
          transform: `translateY(${isPulling || isRefreshing ? Math.max(pullDistance, isRefreshing ? 60 : 0) : 0}px)`
        }}
      >
        {children}
      </div>
    </div>
  );
}

