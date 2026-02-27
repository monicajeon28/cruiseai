// app/chat/components/TestChatInteractiveUI.tsx
// 테스트 고객 전용 채팅 UI (3일 체험 고객용)
// customerStatus: 'test', customerSource: 'test-guide'
// 완전히 독립적으로 관리되는 컴포넌트

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ChatInputMode } from '@/lib/types';

// 성능 최적화: 큰 컴포넌트들을 동적 임포트
const ChatClientShell = dynamic(() => import('./ChatClientShell'), {
  loading: () => (
    <div className="animate-pulse space-y-4 p-4">
      <div className="h-32 bg-gray-200 rounded"></div>
      <div className="h-64 bg-gray-200 rounded"></div>
    </div>
  ),
  ssr: false,
});

const ChatTabs = dynamic(() => import('@/components/chat/ChatTabs').then(mod => ({ default: mod.ChatTabs })), {
  ssr: false,
});

const DailyBriefingCard = dynamic(() => import('./DailyBriefingCard'), {
  loading: () => <div className="animate-pulse h-32 bg-gray-200 rounded"></div>,
  ssr: false,
});

const PushNotificationPrompt = dynamic(() => import('@/components/PushNotificationPrompt'), {
  ssr: false,
});

const AdminMessageModal = dynamic(() => import('@/components/AdminMessageModal'), {
  ssr: false,
});


const GenieAITutorial = dynamic(() => import('./GenieAITutorial'), {
  ssr: false,
});

export default function TestChatInteractiveUI() {
  const [mode, setMode] = useState<ChatInputMode>('general');
  
  // 동적 사용자 및 여행 정보
  const [userName, setUserName] = useState<string>('');
  const [userId, setUserId] = useState<number | undefined>(undefined);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [trip, setTrip] = useState<{
    cruiseName: string;
    destination: string;
    startDate: string;
    endDate: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 여행 종료 상태 (테스트 모드는 72시간 후 종료)
  const [tripExpired, setTripExpired] = useState(false);
  const [expiredMessage, setExpiredMessage] = useState<string>('');
  
  // 튜토리얼 상태
  const [showTutorial, setShowTutorial] = useState(false);
  
  // 어필리에이트 몰 URL (기본값: 본사몰)
  const [affiliateMallUrl, setAffiliateMallUrl] = useState<string>('/products');

  // 사용자 정보 및 활성 여행 로드 (테스트 모드 전용)
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // 사용자 프로필 조회
        const userResponse = await fetch('/api/user/profile', { credentials: 'include' });
        if (!userResponse.ok) throw new Error('Failed to load user profile');
        const userData = await userResponse.json();
        setUserName(userData.user?.name || userData.data?.name || '');
        setUserId(userData.user?.id);
        setUserPhone(userData.user?.phone || userData.data?.phone || null);

        // 테스트 모드 정보 확인
        const testModeResponse = await fetch('/api/user/test-mode', { credentials: 'include' });
        if (testModeResponse.ok) {
          const testModeData = await testModeResponse.json();
          if (testModeData.ok && testModeData.isTestMode) {
            // 테스트 모드가 종료되었는지 확인
            if (testModeData.remainingHours !== null && testModeData.remainingHours <= 0) {
              setTripExpired(true);
              setExpiredMessage('3일 체험 기간이 종료되었습니다. 정식 서비스를 이용하시려면 크루즈몰에서 구매해주세요.');
            }
          }
        }

        // 활성 여행 조회 (테스트 모드는 SAMPLE-MED-001 상품)
        const tripResponse = await fetch('/api/trips/active');
        if (tripResponse.ok) {
          const tripData = await tripResponse.json();
          if (tripData.data) {
            const trip = tripData.data;
            setTrip({
              cruiseName: trip.cruiseName || '크루즈 여행',
              destination: trip.itineraries?.map((it: any) => it.country).join(', ') || '목적지 미정',
              startDate: new Date(trip.startDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) + '부터',
              endDate: new Date(trip.endDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) + '까지',
            });
          }
        }
        
        // 여행 종료 상태 확인 (테스트 모드 전용)
        const accessResponse = await fetch('/api/user/access-check', { credentials: 'include' });
        if (accessResponse.ok) {
          const accessData = await accessResponse.json();
          if (accessData.ok && accessData.status === 'expired') {
            setTripExpired(true);
            setExpiredMessage(accessData.message || '3일 체험 기간이 종료되었습니다. 정식 서비스를 이용하시려면 크루즈몰에서 구매해주세요.');
          }
        }
        
        // 어필리에이트 몰 URL 확인
        const affiliateResponse = await fetch('/api/user/affiliate-mall-url', { credentials: 'include' });
        if (affiliateResponse.ok) {
          const affiliateData = await affiliateResponse.json();
          if (affiliateData.ok && affiliateData.mallUrl) {
            setAffiliateMallUrl(affiliateData.mallUrl);
          }
        }
      } catch (error) {
        console.error('[TestChatInteractiveUI] Error loading user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);
  
  // 튜토리얼 표시 여부 확인 (사용자 정보 로드 후)
  useEffect(() => {
    if (!userId || isLoading) return;
    
    // 튜토리얼 표시 여부 확인 (테스트 모드 전용 키 사용)
    const storageKey = userId 
      ? `genie_ai_tutorial_seen_test_${userId}` 
      : 'genie_ai_tutorial_seen_test';
    const hasSeen = localStorage.getItem(storageKey);
    
    if (hasSeen !== 'true') {
      // 약간의 지연 후 튜토리얼 표시 (페이지 로드 완료 후)
      const timer = setTimeout(() => {
        setShowTutorial(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [userId, isLoading]);

  const onChangeTab = (newMode: ChatInputMode) => {
    setMode(newMode);
  };

  return (
    <>
      {/* 여행 종료 배너 (테스트 모드 전용 메시지) */}
      {tripExpired && (
        <div className="mx-auto max-w-6xl w-full px-3 pt-4 pb-2">
          <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl shadow-lg p-6 border-2 border-purple-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-3xl">⏰</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-1">
                    3일 체험 기간이 종료되었습니다
                  </h2>
                  <p className="text-white/90">
                    {expiredMessage}
                  </p>
                </div>
              </div>
              <Link
                href={affiliateMallUrl}
                className="px-6 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors shadow-md whitespace-nowrap"
              >
                정식 서비스 구매하기
              </Link>
            </div>
            <div className="mt-4 bg-white/10 rounded-lg p-3">
              <p className="text-sm text-center">
                크루즈몰에서 구매하시면 크루즈닷을 계속 만나실 수 있습니다!
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* ReturnToShipBanner는 테스트 모드에서는 표시하지 않음 */}
      {/* (테스트 고객은 실제 크루즈 여행 중이 아니므로 "배로 돌아가기" 배너 불필요) */}
      
      
      {/* 오늘의 브리핑 - 컴팩트하게 */}
      {!tripExpired && (
        <div className="mx-auto max-w-6xl w-full px-3 pt-2 pb-1">
          <DailyBriefingCard />
        </div>
      )}
      
      {/* 채팅 탭 */}
      {!tripExpired && (
        <div className="mx-auto max-w-6xl w-full px-3 pb-2">
          <ChatTabs value={mode} onChange={onChangeTab} />
        </div>
      )}
      
      {/* 채팅창 - 화면의 80%+ 차지 (여행 종료 시 숨김) */}
      {!tripExpired && (
        <div className="mx-auto max-w-6xl w-full flex-1">
          <ChatClientShell mode={mode} />
        </div>
      )}
      
      {/* 푸시 알림 권한 요청 프롬프트 */}
      <PushNotificationPrompt />
      
      {/* 관리자 메시지 팝업 */}
      <AdminMessageModal />
      
      {/* DdayPushModal은 테스트 모드에서는 표시하지 않음 */}
      {/* (테스트 고객은 샘플 여행 정보를 사용하므로 D-Day 모달이 의미 없음) */}
      
      {/* 지니 AI 튜토리얼 (테스트 모드 전용) */}
      {showTutorial && (
        <GenieAITutorial
          onComplete={() => setShowTutorial(false)}
          userId={userId}
          isTestMode={true} // 테스트 모드는 항상 true
        />
      )}
    </>
  );
}

