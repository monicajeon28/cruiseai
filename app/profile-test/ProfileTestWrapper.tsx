'use client';

import { useEffect, useState } from 'react';
import TutorialCountdown from '@/app/chat/components/TutorialCountdown';
import { checkTestModeClient, TestModeInfo } from '@/lib/test-mode-client';
import { clearAllLocalStorage } from '@/lib/csrf-client';

export default function ProfileTestWrapper({ children }: { children: React.ReactNode }) {
  const [testModeInfo, setTestModeInfo] = useState<TestModeInfo | null>(null);

  useEffect(() => {
    // 테스트 모드 정보 로드
    const loadTestModeInfo = async () => {
      const info = await checkTestModeClient();
      setTestModeInfo(info);
    };
    loadTestModeInfo();
  }, []);

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        clearAllLocalStorage();
        window.location.href = '/login-test';
      } else {
        console.error('로그아웃 실패');
        alert('로그아웃에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('로그아웃 요청 중 오류 발생:', error);
      alert('로그아웃 중 오류가 발생했습니다.');
    }
  };

  return (
    <>
      {/* 72시간 카운트다운 배너 (상단 고정) */}
      {testModeInfo && testModeInfo.isTestMode && (
        <TutorialCountdown testModeInfo={testModeInfo} onLogout={handleLogout} />
      )}
      {children}
    </>
  );
}

