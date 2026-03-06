// app/chat/components/TutorialCountdown.tsx
// 72시간 카운트다운 컴포넌트

'use client';

import { useState, useEffect } from 'react';
import { TestModeInfo } from '@/lib/test-mode-client';

interface TutorialCountdownProps {
  testModeInfo: TestModeInfo;
  onLogout?: () => void;
}

export default function TutorialCountdown({ testModeInfo, onLogout }: TutorialCountdownProps) {
  const [remainingTime, setRemainingTime] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    if (!testModeInfo.isTestMode || !testModeInfo.testModeEndAt) {
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const end = new Date(testModeInfo.testModeEndAt!);
      const diff = end.getTime() - now.getTime();

      if (diff <= 0) {
        setRemainingTime({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setRemainingTime({ hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [testModeInfo]);

  if (!testModeInfo.isTestMode || !remainingTime) {
    return null;
  }

  const isUrgent = remainingTime.hours < 12;

  return (
    <div
      className={`sticky top-0 z-50 text-white shadow-lg ${isUrgent ? 'bg-red-600' : 'bg-gradient-to-r from-purple-600 to-pink-600'}`}
      style={{ minHeight: '44px' }}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 gap-2" style={{ height: '44px' }}>
        {/* 왼쪽: 라벨 + 카운트다운 */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold whitespace-nowrap">
            {isUrgent ? '⚠️ 곧 만료' : '🎁 무료체험'}
          </span>
          <span className="font-mono bg-white/20 px-2 py-0.5 rounded text-sm font-bold tabular-nums">
            {String(remainingTime.hours).padStart(2, '0')}:
            {String(remainingTime.minutes).padStart(2, '0')}:
            {String(remainingTime.seconds).padStart(2, '0')}
          </span>
          <span className="text-xs opacity-80 hidden sm:inline whitespace-nowrap">남음</span>
        </div>
        {/* 오른쪽: 로그아웃 */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded border border-white/30 transition-colors whitespace-nowrap font-semibold"
            style={{ minHeight: '32px' }}
          >
            로그아웃
          </button>
        )}
      </div>
    </div>
  );
}

