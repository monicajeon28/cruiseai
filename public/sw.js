// public/sw.js
// Service Worker for Web Push Notifications

const CACHE_NAME = 'cruise-guide-v1';

// Service Worker 설치
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing...');
  self.skipWaiting(); // 즉시 활성화
});

// Service Worker 활성화
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activating...');
  event.waitUntil(self.clients.claim()); // 모든 클라이언트 제어
});

// 푸시 알림 수신
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  if (!event.data) {
    console.warn('[SW] Push event has no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('[SW] Push data:', data);

    const options = {
      body: data.body || '새로운 알림이 있습니다.',
      icon: data.icon || '/images/ai-cruise-logo.png',
      badge: data.badge || '/images/ai-cruise-logo.png',
      tag: data.tag || 'default',
      requireInteraction: data.requireInteraction || false,
      data: data.data || {},
      vibrate: [200, 100, 200], // 진동 패턴
      actions: [
        {
          action: 'open',
          title: '확인하기',
          icon: '/images/ai-cruise-logo.png'
        },
        {
          action: 'close',
          title: '닫기'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || '크루즈 가이드', options)
    );
  } catch (error) {
    console.error('[SW] Error parsing push data:', error);
  }
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();

  // 'open' 액션 또는 알림 본문 클릭 시
  if (event.action === 'open' || !event.action) {
    const urlToOpen = event.notification.data?.url || '/chat';
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // 이미 열린 창이 있으면 포커스
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.navigate(urlToOpen);
            return;
          }
        }
        
        // 열린 창이 없으면 새 창 열기
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  }
  
  // 'close' 액션은 이미 notification.close()로 처리됨
});

// 알림 닫힘 처리
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
});

// Fetch 이벤트 핸들러 제거 (no-op 경고 방지)
// 필요 시 캐싱 전략을 추가할 수 있지만, 현재는 기본 네트워크 요청을 사용합니다.

