// components/PushNotificationPrompt.tsx
'use client';

import { useEffect, useState } from 'react';
import { initializePushNotifications, checkPushSubscription } from '@/lib/push/client';

export default function PushNotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    // 알림 권한 상태 및 구독 상태 확인
    const checkStatus = async () => {
      if ('Notification' in window) {
        const currentPermission = Notification.permission;
        setPermission(currentPermission);

        // 이미 구독되어 있으면 프롬프트 표시 안 함
        if (currentPermission === 'granted') {
          try {
            const subscription = await checkPushSubscription();
            if (subscription) {
              console.log('[Push Prompt] 이미 구독되어 있음, 프롬프트 숨김');
              return;
            }
          } catch (error) {
            console.log('[Push Prompt] 구독 상태 확인 실패:', error);
          }
        }

        // 권한이 없으면 프롬프트 표시 (단, 이전에 거부한 적 없으면)
        const dismissed = localStorage.getItem('push-prompt-dismissed');
        if (currentPermission === 'default' && !dismissed) {
          // 페이지 로드 후 3초 뒤에 표시
          const timer = setTimeout(() => {
            setShowPrompt(true);
          }, 3000);

          return () => clearTimeout(timer);
        }
      }
    };

    checkStatus();
  }, []);

  const handleEnable = async () => {
    setLoading(true);

    try {
      // HTTPS 확인 (프로덕션 환경)
      if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && !window.location.hostname.includes('localhost')) {
        alert('푸시 알림은 HTTPS 환경에서만 작동합니다.\n\n현재 HTTP로 접속 중입니다. HTTPS로 접속해주세요.');
        setLoading(false);
        return;
      }

      // 브라우저 지원 확인
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('이 브라우저는 푸시 알림을 지원하지 않습니다.\n\nChrome, Edge, Firefox, Safari (iOS 16.4+)를 사용해주세요.');
        setLoading(false);
        return;
      }

      console.log('[Push Prompt] 푸시 알림 초기화 시작...');
      console.log('[Push Prompt] 현재 URL:', window.location.href);
      console.log('[Push Prompt] 프로토콜:', window.location.protocol);
      
      // 전체 푸시 알림 초기화 프로세스 실행
      // (Service Worker 등록 → 권한 요청 → 구독 생성 → 서버 저장)
      const result = await initializePushNotifications();
      
      console.log('[Push Prompt] 초기화 결과:', result);
      
      if (result.success) {
        setPermission('granted');
        // 성공 시 프롬프트 닫기
        setShowPrompt(false);
        localStorage.setItem('push-enabled', 'true');
        
        // 서버 저장 실패 경고가 있으면 표시
        if (result.error && result.step === 'server-save') {
          // 브라우저 구독은 성공했지만 서버 저장 실패
          console.warn('[Push Prompt] 서버 저장 실패, 하지만 알림은 활성화됨');
        }
        
        // 성공 알림 (팝업 메시지)
        try {
          const notification = new Notification('🚢 크루즈닷', {
            body: '푸시 알림이 활성화되었습니다! 중요한 일정을 놓치지 않으실 수 있습니다.',
            icon: '/images/ai-cruise-logo.png',
            badge: '/images/ai-cruise-logo.png',
            tag: 'push-enabled',
          });
          
          // 알림이 자동으로 닫히도록 5초 후 닫기
          setTimeout(() => {
            notification.close();
          }, 5000);
        } catch (notifError) {
          // 알림 표시 실패는 무시 (권한은 받았으므로)
          console.log('[Push Prompt] 알림 권한은 받았지만 표시 실패:', notifError);
        }
      } else if (result.permission === 'denied') {
        setPermission('denied');
        setShowPrompt(false);
        localStorage.setItem('push-prompt-dismissed', 'true');
        alert('알림 권한이 차단되었습니다.\n\n브라우저 설정에서 알림을 허용해주세요:\n설정 > 개인정보 보호 > 알림');
      } else {
        // 초기화 실패
        console.error('[Push Prompt] 푸시 알림 초기화 실패:', result);
        const errorMessage = result.error || '알 수 없는 오류가 발생했습니다';
        const stepInfo = result.step ? `\n\n실패 단계: ${result.step}` : '';
        alert(`푸시 알림 설정에 실패했습니다.\n\n${errorMessage}${stepInfo}\n\n브라우저 콘솔(F12)에서 자세한 로그를 확인할 수 있습니다.\n\n나중에 프로필 > 설정에서 다시 시도해주세요.`);
      }
    } catch (error) {
      console.error('[Push Prompt] Error:', error);
      
      // 사용자 친화적 에러 메시지
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      alert(`알림 설정 중 오류가 발생했습니다.\n\n${errorMessage}\n\n브라우저 콘솔(F12)에서 자세한 로그를 확인할 수 있습니다.\n\n나중에 프로필 > 설정에서 다시 시도해주세요.`);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('push-prompt-dismissed', 'true');
  };

  // 프롬프트는 showPrompt가 false일 때만 숨김
  // 주의: 프롬프트가 사라져도 DailyBriefingCard의 일정은 계속 표시됩니다
  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-0 right-0 z-40 px-4">
      <div className="mx-auto max-w-md bg-white rounded-2xl shadow-2xl border-2 border-blue-500 p-5">
        {/* 헤더 */}
        <div className="flex items-start gap-3 mb-4">
          <div className="text-4xl">🔔</div>
          <div className="flex-1">
            <h3 className="text-lg md:text-xl font-extrabold text-gray-900 mb-1">
              푸시 알림 활성화
            </h3>
            <p className="text-sm md:text-base text-gray-700 leading-relaxed">
              승선 시간, 하선 시간, 출항 경고 등<br />
              <strong className="text-red-600">중요한 일정을 놓치지 않도록</strong><br />
              푸시 알림을 켜주세요!
            </p>
            <p className="text-xs text-gray-500 mt-2">
              * 알림 설정은 프로필 &gt; 설정에서도 가능합니다
            </p>
          </div>
        </div>

        {/* 알림 혜택 */}
        <div className="bg-blue-50 rounded-xl p-3 mb-4">
          <ul className="text-sm text-blue-900 space-y-1">
            <li>✅ 승선 3시간 전 알림</li>
            <li>✅ 기항지 도착 1시간 전 알림</li>
            <li>⚠️ <strong>출항 1시간 전 긴급 알림</strong></li>
            <li>📅 D-Day 준비 알림</li>
          </ul>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={handleEnable}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '설정 중...' : '알림 켜기'}
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-3 text-gray-600 hover:text-gray-800 text-sm font-medium"
          >
            나중에
          </button>
        </div>

        {/* 안내 */}
        <p className="text-xs text-gray-500 text-center mt-3">
          언제든지 설정에서 알림을 끄실 수 있습니다
        </p>
      </div>
    </div>
  );
}

