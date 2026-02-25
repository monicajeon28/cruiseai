// components/PersonalizedWelcome.tsx
'use client';

import { useEffect, useState } from 'react';

interface UserInfo {
  name: string;
  totalTripCount: number;
}

export default function PersonalizedWelcome() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const response = await fetch('/api/user/profile', { credentials: 'include' });
      const data = await response.json();

      if (data.ok && data.user) {
        setUserInfo({
          name: data.user.name || '여행자',
          totalTripCount: data.user.totalTripCount || 0,
        });
      }
    } catch (error) {
      console.error('Failed to load user info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !userInfo) {
    return null;
  }

  // 여행 횟수에 따른 메시지
  const getMessage = () => {
    if (userInfo.totalTripCount === 0) {
      return `${userInfo.name}님, 첫 번째 크루즈 여행을 준비하고 계시네요! 🎉`;
    } else if (userInfo.totalTripCount === 1) {
      return `${userInfo.name}님, 크루즈닷과 함께하는 두 번째 크루즈 여행이네요! 🚢`;
    } else if (userInfo.totalTripCount === 2) {
      return `${userInfo.name}님, 벌써 세 번째 크루즈 여행이네요! 🎊`;
    } else {
      return `${userInfo.name}님, 크루즈닷과 함께하는 ${userInfo.totalTripCount + 1}번째 크루즈 여행이네요! 🌟`;
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-4 shadow-lg text-white mb-4">
      <div className="flex items-center gap-3">
        <div className="text-4xl">👋</div>
        <div className="flex-1">
          <p className="text-lg md:text-xl font-bold leading-tight">
            {getMessage()}
          </p>
          {userInfo.totalTripCount > 0 && (
            <p className="text-sm text-blue-100 mt-1">
              지금까지 {userInfo.totalTripCount}번의 멋진 여행을 함께했어요!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

