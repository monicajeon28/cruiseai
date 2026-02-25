'use client';

import { useEffect, useState } from 'react';

interface UsePushNotificationsReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<void>;
}

/**
 * 웹 푸시 알림을 관리하는 커스텀 훅
 */
export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 브라우저 지원 확인
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      checkSubscriptionStatus();
    }
  }, []);

  /**
   * 현재 구독 상태 확인
   */
  const checkSubscriptionStatus = async () => {
    try {
      if (!('serviceWorker' in navigator)) {
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error('[Push] 구독 상태 확인 오류:', err);
    }
  };

  /**
   * 알림 권한 요청 및 구독
   */
  const requestPermission = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Service Worker 등록
      if (!('serviceWorker' in navigator)) {
        throw new Error('브라우저가 서비스 워커를 지원하지 않습니다');
      }

      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      console.log('[Push] Service Worker 등록 완료:', registration);

      // 2. 알림 권한 요청
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('알림 권한이 거부되었습니다');
      }

      // 3. 푸시 구독
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error('VAPID 공개 키가 설정되지 않았습니다');
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      console.log('[Push] 푸시 구독 완료:', subscription);

      // 4. 서버에 구독 정보 저장 (실패해도 구독은 성공한 것으로 처리)
      try {
        const subscriptionJson = subscription.toJSON();
        const response = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscriptionJson),
        });

        if (!response.ok) {
          console.warn('[Push] 서버에 구독 정보 저장 실패, 하지만 브라우저 구독은 성공:', response.status);
          // 서버 저장 실패는 경고만 하고 계속 진행 (브라우저 구독은 성공했으므로)
        } else {
          console.log('[Push] 서버에 구독 정보 저장 완료');
        }
      } catch (saveError) {
        console.warn('[Push] 서버에 구독 정보 저장 중 오류 발생, 하지만 브라우저 구독은 성공:', saveError);
        // 서버 저장 실패는 경고만 하고 계속 진행
      }

      // 브라우저 구독이 성공했으면 isSubscribed를 true로 설정
      setIsSubscribed(true);
      console.log('[Push] 알림 구독이 완료되었습니다');
      
      // 구독 상태를 다시 확인하여 확실히 업데이트
      await checkSubscriptionStatus();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다';
      setError(errorMsg);
      console.error('[Push] 오류:', errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isSupported,
    isSubscribed,
    isLoading,
    error,
    requestPermission,
  };
}

/**
 * Base64 URL을 Uint8Array로 변환 (VAPID 키 처리용)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
