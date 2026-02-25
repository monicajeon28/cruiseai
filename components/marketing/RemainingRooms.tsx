// components/marketing/RemainingRooms.tsx
// 남은 객실 수 표시 (마케팅 효과)
// 5~8개 랜덤 시작, 1분마다 1개씩 차감

'use client';

import { useState, useEffect, useMemo } from 'react';

interface RemainingRoomsProps {
  roomId: string; // 각 객실별 고유값
  className?: string;
}

export default function RemainingRooms({
  roomId,
  className = ''
}: RemainingRoomsProps) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);

  // roomId 기반 시드로 일관된 초기값 생성 (5~8개)
  const initialCount = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < roomId.length; i++) {
      hash = ((hash << 5) - hash) + roomId.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash % 4) + 5; // 5~8
  }, [roomId]);

  // 초기값 설정
  useEffect(() => {
    setRemaining(initialCount);
  }, [initialCount]);

  // 1분마다 1개씩 차감
  useEffect(() => {
    if (remaining === null) return;

    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev === null || prev <= 1) {
          setIsUrgent(true);
          return 1; // 최소 1개 유지
        }
        if (prev <= 3) setIsUrgent(true);
        return prev - 1;
      });
    }, 60000); // 1분

    return () => clearInterval(interval);
  }, [remaining]);

  if (remaining === null) return null;

  // 긴급도에 따른 스타일
  const urgencyStyle = remaining <= 2
    ? 'text-red-600 bg-red-50 border-red-200'
    : remaining <= 4
    ? 'text-orange-600 bg-orange-50 border-orange-200'
    : 'text-blue-600 bg-blue-50 border-blue-200';

  const urgencyEmoji = remaining <= 2 ? '🔥' : remaining <= 4 ? '⚡' : '📦';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${urgencyStyle} ${className} ${
      isUrgent ? 'animate-pulse' : ''
    }`}>
      <span>{urgencyEmoji}</span>
      {remaining <= 1 ? (
        <span>마감 임박!</span>
      ) : (
        <span>남은 객실 {remaining}개</span>
      )}
    </span>
  );
}
