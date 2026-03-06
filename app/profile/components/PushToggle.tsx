// app/profile/components/PushToggle.tsx
'use client';

import { useState, useEffect } from 'react';
import { initializePushNotifications, unsubscribeFromPush, checkPushSubscription } from '@/lib/push/client';
import { showError } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';

export default function PushToggle() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      if ('Notification' in window) {
        const currentPermission = Notification.permission;
        setPermission(currentPermission);

        if (currentPermission === 'granted') {
          try {
            const subscription = await checkPushSubscription();
            setIsEnabled(!!subscription);
          } catch (subError) {
            logger.error('[PushToggle] 구독 확인 오류:', subError);
            setIsEnabled(false);
          }
        } else {
          setIsEnabled(false);
        }
      }
    } catch (error) {
      logger.error('[PushToggle] Status check error:', error);
      setIsEnabled(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async () => {
    if (isLoading) return;

    if (permission === 'denied') {
      showError('알림 권한이 차단되어 있습니다. 브라우저 설정에서 허용해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      if (isEnabled) {
        const success = await unsubscribeFromPush();
        if (success) {
          setIsEnabled(false);
        } else {
          showError('구독 해제에 실패했습니다. 다시 시도해주세요.');
        }
      } else {
        const result = await initializePushNotifications();
        if (result.success) {
          setIsEnabled(true);
          setPermission('granted');
        } else if (result.permission === 'denied') {
          setPermission('denied');
          logger.error('[PushToggle] 권한이 denied로 변경됨');
          showError('알림 권한이 차단되어 있습니다. 브라우저 설정에서 허용해주세요.');
        } else {
          logger.error('[PushToggle] 구독 실패:', result);
          showError('알림 설정에 실패했습니다. 다시 시도해주세요.');
        }
      }
    } catch (error) {
      logger.error('[PushToggle] Error:', error);
      showError('알림 설정 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 브라우저가 알림을 지원하지 않는 경우
  if (!('Notification' in window)) {
    return (
      <div className="p-4 bg-gray-100 rounded-xl border">
        <p className="text-sm text-gray-600">
          이 브라우저는 알림 기능을 지원하지 않습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-5 bg-white/90 backdrop-blur rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🔔</span>
          <h3 className="text-lg font-bold text-gray-800">여행 일정 알림</h3>
        </div>
        <p className="text-sm text-gray-600">
          {permission === 'denied'
            ? '알림이 차단되었습니다. 브라우저 설정에서 허용해주세요.'
            : '승선/하선 시간, 출항 경고 등 중요한 일정을 알려드립니다'}
        </p>
      </div>

      <button
        onClick={handleToggle}
        disabled={isLoading || permission === 'denied'}
        className={`relative inline-flex h-9 w-16 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md ${
          isEnabled ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-gray-200'
        }`}
        role="switch"
        aria-checked={isEnabled}
        aria-label="여행 일정 알림"
      >
        {isLoading ? (
          <span className="pointer-events-none inline-block h-8 w-8 transform rounded-full bg-white shadow-lg ring-0 flex items-center justify-center">
            <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          </span>
        ) : (
          <span
            className={`pointer-events-none inline-block h-8 w-8 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
              isEnabled ? 'translate-x-7' : 'translate-x-0'
            }`}
          />
        )}
      </button>
    </div>
  );
}
