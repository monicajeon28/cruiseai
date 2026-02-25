// components/marketing/LiveViewerCount.tsx
// 실시간 조회수 표시 (마케팅 효과)
// 7초마다 +15 또는 -30 랜덤 변동

'use client';

import { useState, useEffect } from 'react';
import { FiEye } from 'react-icons/fi';

interface LiveViewerCountProps {
  className?: string;
  minCount?: number;
  maxCount?: number;
}

export default function LiveViewerCount({
  className = '',
  minCount = 150,
  maxCount = 500
}: LiveViewerCountProps) {
  const [viewerCount, setViewerCount] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // 초기 랜덤 값 설정 (250~350)
  useEffect(() => {
    const initialCount = Math.floor(Math.random() * 101) + 250; // 250~350
    setViewerCount(initialCount);
  }, []);

  // 7초마다 변동
  useEffect(() => {
    if (viewerCount === null) return;

    const interval = setInterval(() => {
      setIsAnimating(true);

      setViewerCount(prev => {
        if (prev === null) return 287;

        // 랜덤: +15 또는 -30
        const isIncrease = Math.random() > 0.4; // 60% 확률로 증가
        const change = isIncrease ? 15 : -30;
        let newCount = prev + change;

        // 범위 제한
        if (newCount < minCount) newCount = minCount + Math.floor(Math.random() * 50);
        if (newCount > maxCount) newCount = maxCount - Math.floor(Math.random() * 50);

        return newCount;
      });

      // 애니메이션 효과 리셋
      setTimeout(() => setIsAnimating(false), 300);
    }, 7000);

    return () => clearInterval(interval);
  }, [viewerCount, minCount, maxCount]);

  if (viewerCount === null) return null;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className="relative">
        <FiEye className="w-4 h-4 text-red-500" />
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
      </div>
      <span className={`text-sm font-medium transition-all duration-300 ${
        isAnimating ? 'scale-110 text-red-600' : 'text-gray-700'
      }`}>
        <span className="font-bold">{viewerCount.toLocaleString()}</span>명이 같이 보고 있습니다
      </span>
    </div>
  );
}
