'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 온보딩 페이지 접근 차단
 * 크루즈가이드 지니에서는 온보딩 페이지를 고객이 볼 수 없도록 완전히 차단합니다.
 * 모든 접근을 크루즈몰 메인 페이지로 리다이렉트합니다.
 */
export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    // 즉시 크루즈몰 메인 페이지로 리다이렉트
    // window.location.href를 사용하여 완전한 페이지 새로고침으로 리다이렉트
    window.location.href = '/';
  }, []);

  // 리다이렉트 중 표시
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-lg text-gray-800">페이지 이동 중...</p>
      </div>
    </div>
  );
}

