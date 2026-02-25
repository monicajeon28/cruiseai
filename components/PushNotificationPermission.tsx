'use client';

import { useEffect, useState } from 'react';
import { usePushNotifications } from '@/lib/hooks/usePushNotifications';
import { FiX } from 'react-icons/fi';

/**
 * 푸시 알림 권한 요청 배너
 * 로그인 페이지에서는 ConditionalPushNotification에서 렌더링되지 않음
 */
export function PushNotificationPermission() {
  const { isSupported, isSubscribed, isLoading, error, requestPermission } =
    usePushNotifications();
  const [dismissed, setDismissed] = useState(false);

  // 마운트 시 localStorage에서 해제 상태 확인
  useEffect(() => {
    const isDismissed = localStorage.getItem('push-permission-dismissed');
    if (isDismissed) {
      setDismissed(true);
    }
  }, []);

  if (!isSupported || isSubscribed || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('push-permission-dismissed', 'true');
  };

  const handleEnable = async () => {
    try {
      await requestPermission();
      // 성공 후 구독 상태를 다시 확인하여 프롬프트가 사라지도록 함
      // (usePushNotifications 훅이 자동으로 상태를 업데이트하므로 추가 작업 불필요)
    } catch (error) {
      console.error('[PushNotificationPermission] 알림 활성화 오류:', error);
      // 에러는 usePushNotifications 훅에서 이미 처리됨
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-4 sm:px-6">
      <div className="max-w-6xl mx-auto flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-bold text-lg mb-1">📢 중요한 여행 알림을 받아보세요</h3>
          <p className="text-sm opacity-90">
            승선 안내, 하선 준비, 출항 경고 등 여행 중 필수 정보를 실시간으로 알려드립니다.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={handleEnable}
            disabled={isLoading}
            className="px-6 py-2 bg-white text-blue-600 font-bold rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
          >
            {isLoading ? '처리 중...' : '알림 켜기'}
          </button>
          <button
            onClick={handleDismiss}
            className="p-2 hover:bg-blue-400 rounded-lg transition-colors"
            aria-label="닫기"
          >
            <FiX size={20} />
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs mt-2 text-blue-100">⚠️ {error}</p>
      )}
    </div>
  );
}
