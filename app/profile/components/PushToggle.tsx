// app/profile/components/PushToggle.tsx
'use client';

import { useState, useEffect } from 'react';
import { initializePushNotifications, unsubscribeFromPush, checkPushSubscription } from '@/lib/push/client';

export default function PushToggle() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    console.log('[PushToggle] 컴포넌트 마운트, 상태 체크 시작');
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      console.log('[PushToggle] checkStatus 시작');
      if ('Notification' in window) {
        const currentPermission = Notification.permission;
        console.log('[PushToggle] 현재 알림 권한:', currentPermission);
        setPermission(currentPermission);
        
        if (currentPermission === 'granted') {
          console.log('[PushToggle] 권한이 granted, 구독 상태 확인 중...');
          try {
            const subscription = await checkPushSubscription();
            console.log('[PushToggle] 구독 상태:', subscription ? '구독됨' : '구독 안 됨', subscription);
            setIsEnabled(!!subscription);
          } catch (subError) {
            console.error('[PushToggle] 구독 확인 오류:', subError);
            setIsEnabled(false);
          }
        } else {
          console.log('[PushToggle] 권한이 granted가 아님:', currentPermission);
          setIsEnabled(false);
        }
      } else {
        console.warn('[PushToggle] 브라우저가 알림을 지원하지 않음');
      }
    } catch (error) {
      console.error('[PushToggle] Status check error:', error);
      setIsEnabled(false);
    } finally {
      console.log('[PushToggle] checkStatus 완료, isLoading = false');
      setIsLoading(false);
    }
  };

  const handleToggle = async () => {
    console.log('[PushToggle] handleToggle 호출됨, 현재 상태:', { isEnabled, isLoading, permission });
    
    if (isLoading) {
      console.warn('[PushToggle] 이미 로딩 중이므로 무시');
      return;
    }
    
    if (permission === 'denied') {
      console.warn('[PushToggle] 권한이 denied 상태이므로 무시');
      alert('알림 권한이 차단되었습니다.\n브라우저 설정 > 사이트 설정 > 알림에서 허용해주세요.');
      return;
    }

    setIsLoading(true);
    console.log('[PushToggle] 로딩 시작...');

    try {
      if (isEnabled) {
        console.log('[PushToggle] 구독 해제 시도...');
        // 구독 해제
        const success = await unsubscribeFromPush();
        console.log('[PushToggle] 구독 해제 결과:', success);
        if (success) {
          setIsEnabled(false);
        } else {
          alert('구독 해제에 실패했습니다. 다시 시도해주세요.');
        }
      } else {
        console.log('[PushToggle] 구독 활성화 시도...');
        // 구독
        const result = await initializePushNotifications();
        console.log('[PushToggle] 구독 활성화 결과:', result);
        if (result.success) {
          setIsEnabled(true);
          setPermission('granted');
          console.log('[PushToggle] 구독 성공!');
        } else if (result.permission === 'denied') {
          setPermission('denied');
          console.error('[PushToggle] 권한이 denied로 변경됨');
          alert('알림 권한이 차단되었습니다.\n브라우저 설정 > 사이트 설정 > 알림에서 허용해주세요.');
        } else {
          console.error('[PushToggle] 구독 실패:', result);
          alert('알림 설정에 실패했습니다. 다시 시도해주세요.');
        }
      }
    } catch (error) {
      console.error('[PushToggle] Error:', error);
      alert('알림 설정 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      console.log('[PushToggle] 로딩 완료, isLoading = false');
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

  console.log('[PushToggle] 렌더링:', { isEnabled, isLoading, permission });

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

