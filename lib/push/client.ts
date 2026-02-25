// lib/push/client.ts
// 클라이언트 사이드 푸시 알림 구독 관리

'use client';

/**
 * Service Worker 등록
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Push Client] Service Worker not supported');
    return null;
  }

  // 관리자 페이지에서는 Service Worker를 등록하지 않음
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    console.log('[Push Client] Skipping Service Worker registration on admin pages');
    return null;
  }

  try {
    console.log('[Push Client] Service Worker 등록 시도: /sw.js');
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[Push Client] Service Worker registered:', registration.scope);
    
    // Service Worker가 활성화될 때까지 대기
    await navigator.serviceWorker.ready;
    console.log('[Push Client] Service Worker ready');
    
    return registration;
  } catch (error) {
    console.error('[Push Client] Service Worker registration failed:', error);
    if (error instanceof Error) {
      console.error('[Push Client] Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
    return null;
  }
}

/**
 * 푸시 알림 권한 요청
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('[Push Client] Notifications not supported');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    console.log('[Push Client] Permission result:', permission);
    return permission;
  } catch (error) {
    console.error('[Push Client] Permission request failed:', error);
    return 'denied';
  }
}

/**
 * 푸시 구독 생성
 */
export async function subscribeToPush(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  try {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!vapidPublicKey) {
      console.error('[Push Client] VAPID public key not configured');
      return null;
    }

    // URL-safe Base64를 Uint8Array로 변환
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey,
    });

    console.log('[Push Client] Subscribed to push:', subscription.endpoint);
    return subscription;
  } catch (error) {
    console.error('[Push Client] Failed to subscribe:', error);
    return null;
  }
}

/**
 * 서버에 구독 정보 저장
 */
export async function saveSubscriptionToServer(
  subscription: PushSubscription
): Promise<boolean> {
  try {
    // subscription.toJSON()은 { endpoint, keys: { p256dh, auth } } 형태로 변환
    const subscriptionJson = subscription.toJSON();
    
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(subscriptionJson), // 직접 subscription 객체 전송
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Push Client] Failed to save subscription:', response.status, errorData);
      return false;
    }

    const data = await response.json();
    console.log('[Push Client] Subscription saved to server:', data);
    return true;
  } catch (error) {
    console.error('[Push Client] Error saving subscription:', error);
    return false;
  }
}

/**
 * 푸시 알림 구독 해제
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      
      // 서버에서도 삭제
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: subscription.endpoint,
        }),
      });

      console.log('[Push Client] Unsubscribed from push');
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Push Client] Unsubscribe failed:', error);
    return false;
  }
}

/**
 * 현재 구독 상태 확인
 */
export async function checkPushSubscription(): Promise<PushSubscription | null> {
  try {
    console.log('[Push Client] checkPushSubscription 시작');
    
    if (!('serviceWorker' in navigator)) {
      console.warn('[Push Client] Service Worker not supported');
      return null;
    }

    // Service Worker가 등록되어 있는지 확인
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) {
      console.log('[Push Client] Service Worker가 등록되지 않음');
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    console.log('[Push Client] Service Worker ready:', registration.scope);
    
    const subscription = await registration.pushManager.getSubscription();
    console.log('[Push Client] 구독 정보:', subscription ? '있음' : '없음', subscription?.endpoint);
    return subscription;
  } catch (error) {
    console.error('[Push Client] Failed to check subscription:', error);
    return null;
  }
}

/**
 * 전체 구독 프로세스 (권한 요청 → 구독 → 서버 저장)
 */
export async function initializePushNotifications(): Promise<{
  success: boolean;
  permission?: NotificationPermission;
  subscription?: PushSubscription | null;
  error?: string;
  step?: string;
}> {
  try {
    // 1. Service Worker 등록
    console.log('[Push Client] Step 1: Service Worker 등록 시작...');
    const registration = await registerServiceWorker();
    if (!registration) {
      console.error('[Push Client] Service Worker 등록 실패');
      return { success: false, error: 'Service Worker 등록에 실패했습니다. 브라우저를 지원하지 않거나 네트워크 문제가 있을 수 있습니다.', step: 'service-worker' };
    }
    console.log('[Push Client] Step 1 완료: Service Worker 등록 성공');

    // 2. 권한 요청
    console.log('[Push Client] Step 2: 알림 권한 요청 시작...');
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.error('[Push Client] 알림 권한 거부됨:', permission);
      return { 
        success: false, 
        permission,
        error: permission === 'denied' 
          ? '알림 권한이 차단되었습니다. 브라우저 설정에서 알림을 허용해주세요.' 
          : '알림 권한 요청이 취소되었습니다.',
        step: 'permission'
      };
    }
    console.log('[Push Client] Step 2 완료: 알림 권한 획득');

    // 3. 기존 구독 확인
    console.log('[Push Client] Step 3: 기존 구독 확인 중...');
    let subscription = await checkPushSubscription();
    if (subscription) {
      console.log('[Push Client] 기존 구독 발견:', subscription.endpoint);
    }

    // 4. 구독이 없으면 새로 생성
    if (!subscription) {
      console.log('[Push Client] Step 4: 새 푸시 구독 생성 시작...');
      subscription = await subscribeToPush(registration);
      if (!subscription) {
        console.error('[Push Client] 푸시 구독 생성 실패');
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          return { 
            success: false, 
            permission,
            error: 'VAPID 키가 설정되지 않았습니다. 관리자에게 문의해주세요.',
            step: 'subscription'
          };
        }
        return { 
          success: false, 
          permission,
          error: '푸시 구독 생성에 실패했습니다. 브라우저가 푸시 알림을 지원하지 않을 수 있습니다.',
          step: 'subscription'
        };
      }
      console.log('[Push Client] Step 4 완료: 푸시 구독 생성 성공');
    }

    // 5. 서버에 저장 (실패해도 브라우저 구독은 성공한 것으로 처리)
    console.log('[Push Client] Step 5: 서버에 구독 정보 저장 시작...');
    const saved = await saveSubscriptionToServer(subscription);
    if (!saved) {
      console.warn('[Push Client] 서버 저장 실패, 하지만 브라우저 구독은 성공');
      // 서버 저장 실패는 경고만 하고 성공으로 처리 (브라우저 구독은 성공했으므로)
      return {
        success: true, // 브라우저 구독은 성공했으므로 true
        permission,
        subscription,
        error: '서버 저장에 실패했지만 알림은 활성화되었습니다. 나중에 프로필 설정에서 다시 시도해주세요.',
        step: 'server-save'
      };
    }
    console.log('[Push Client] Step 5 완료: 서버 저장 성공');

    return {
      success: true,
      permission,
      subscription,
    };
  } catch (error) {
    console.error('[Push Client] initializePushNotifications 전체 프로세스 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';
    return {
      success: false,
      error: `푸시 알림 설정 중 오류: ${errorMessage}`,
      step: 'unknown'
    };
  }
}

/**
 * URL-safe Base64를 Uint8Array로 변환
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

