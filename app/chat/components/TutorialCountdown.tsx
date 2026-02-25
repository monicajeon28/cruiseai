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
    <div className={`sticky top-0 z-50 ${isUrgent ? 'bg-red-600' : 'bg-gradient-to-r from-purple-600 to-pink-600'} text-white py-4 px-4 shadow-lg`}>
      <div className="container mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl md:text-4xl">⏰</span>
            <span className="font-bold text-lg md:text-xl">테스트 모드</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-base md:text-lg">남은 시간:</span>
            <span className="font-mono text-xl md:text-2xl font-bold bg-white/20 px-5 py-2 rounded">
              {String(remainingTime.hours).padStart(2, '0')}:
              {String(remainingTime.minutes).padStart(2, '0')}:
              {String(remainingTime.seconds).padStart(2, '0')}
            </span>
          </div>
          {isUrgent && (
            <span className="text-base md:text-lg bg-white/20 px-4 py-2 rounded-full font-semibold">
              ⚠️ 곧 만료됩니다!
            </span>
          )}
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            className="bg-white/20 hover:bg-white/30 text-white font-bold py-3 px-5 md:px-6 rounded-lg flex items-center gap-2 transition-all duration-200 border-2 border-white/30 hover:border-white/50 text-base md:text-lg"
            style={{ minHeight: '56px' }}
          >
            <span className="text-xl">🚪</span>
            <span>로그아웃</span>
          </button>
        )}
      </div>
    </div>
  );
}

