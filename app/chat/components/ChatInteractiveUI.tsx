'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { getDdayMessage } from '@/lib/date-utils'; // D-Day 계산 함수 임포트
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

const DdayPushModal = dynamic(() => import('@/components/DdayPushModal'), {
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

const ReturnToShipBanner = dynamic(() => import('@/components/ReturnToShipBanner').then(mod => ({ default: mod.ReturnToShipBanner })), {
  ssr: false,
});

const AdminMessageModal = dynamic(() => import('@/components/AdminMessageModal'), {
  ssr: false,
});


const GenieAITutorial = dynamic(() => import('./GenieAITutorial'), {
  ssr: false,
});

// D-Day 메시지 타입 정의
type DdayMessage = {
  title: string;
  message: string;
};

type DdayMessages = {
  messages: Record<string, DdayMessage>;
};

// D-Day 메시지 데이터도 동적 임포트
let ddayMessages: DdayMessages | null = null;
const loadDdayMessages = async (): Promise<DdayMessages> => {
  if (!ddayMessages) {
    const ddayModule = await import('@/data/dday_messages.json');
    ddayMessages = ddayModule.default as DdayMessages;
  }
  return ddayMessages;
};

export default function ChatInteractiveUI() {
  const [mode, setMode] = useState<ChatInputMode>('general');
  const [showDdayModal, setShowDdayModal] = useState(false);
  const [ddayMessageData, setDdayMessageData] = useState<{title: string; message: string} | null>(null);
  const [hasShownDdayModal, setHasShownDdayModal] = useState(false);
  
  // 성능 최적화: ddayMessages 동적 로딩
  const [ddayMessagesData, setDdayMessagesData] = useState<DdayMessages | null>(null);
  
  useEffect(() => {
    loadDdayMessages()
      .then((data) => {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          setDdayMessagesData(data);
        } else {
          console.warn('[ChatInteractiveUI] Invalid ddayMessages data format');
          setDdayMessagesData({ messages: {} }); // 기본값
        }
      })
      .catch((error) => {
        console.error('[ChatInteractiveUI] Failed to load ddayMessages:', error);
        setDdayMessagesData({ messages: {} }); // 기본값
      });
  }, []);
  
  // 동적 사용자 및 여행 정보
  const [userName, setUserName] = useState<string>('');
  const [userId, setUserId] = useState<number | undefined>(undefined);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [trip, setTrip] = useState<{
    cruiseName: string;
    destination: string;
    startDate: string;
    startDateIso: string;
    endDate: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 여행 종료 상태
  const [tripExpired, setTripExpired] = useState(false);
  const [expiredMessage, setExpiredMessage] = useState<string>('');
  
  // 튜토리얼 상태
  const [showTutorial, setShowTutorial] = useState(false);
  
  // 어필리에이트 몰 URL (기본값: 본사몰)
  const [affiliateMallUrl, setAffiliateMallUrl] = useState<string>('/products');

  // 사용자 정보 및 활성 여행 로드
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // 4개 API 병렬 호출
        const [userResponse, tripResponse, accessResponse, affiliateResponse] = await Promise.all([
          fetch('/api/user/profile', { credentials: 'include' }),
          fetch('/api/trips/active', { credentials: 'include' }),
          fetch('/api/user/access-check', { credentials: 'include' }),
          fetch('/api/user/affiliate-mall-url', { credentials: 'include' }),
        ]);

        if (!userResponse.ok) throw new Error('Failed to load user profile');

        const [userData, tripData, accessData, affiliateData] = await Promise.all([
          userResponse.json(),
          tripResponse.ok ? tripResponse.json() : Promise.resolve(null),
          accessResponse.ok ? accessResponse.json() : Promise.resolve(null),
          affiliateResponse.ok ? affiliateResponse.json() : Promise.resolve(null),
        ]);

        // 사용자 프로필 처리
        setUserName(userData.user?.name || userData.data?.name || '');
        setUserId(userData.user?.id);
        setUserPhone(userData.user?.phone || userData.data?.phone || null);

        // 결제 고객용이므로 테스트 모드 아님 (항상 false)
        setIsTestMode(false);

        // 활성 여행 처리
        if (tripData?.data) {
          const trip = tripData.data;
          setTrip({
            cruiseName: trip.cruiseName || '크루즈 여행',
            destination: trip.Itinerary?.filter((it: any) => it.country).map((it: any) => it.country).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).join(', ') || '목적지 미정',
            startDate: new Date(trip.startDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) + '부터',
            startDateIso: trip.startDate,
            endDate: new Date(trip.endDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) + '까지',
          });
        }

        // 여행 종료 상태 처리
        if (accessData?.ok && accessData.status === 'expired') {
          setTripExpired(true);
          setExpiredMessage(accessData.message || '여행이 종료되었습니다. 새로운 여행을 등록해 주세요.');
        }

        // 어필리에이트 몰 URL 처리
        if (affiliateData?.ok && affiliateData.mallUrl) {
          setAffiliateMallUrl(affiliateData.mallUrl);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);
  
  // 튜토리얼 표시 여부 확인 (사용자 정보 로드 후)
  useEffect(() => {
    if (!userId || isLoading) return;
    
    // 튜토리얼 표시 여부 확인
    const storageKey = userId 
      ? `genie_ai_tutorial_seen_${userId}` 
      : 'genie_ai_tutorial_seen';
    const hasSeen = localStorage.getItem(storageKey);
    
    if (hasSeen !== 'true') {
      // 약간의 지연 후 튜토리얼 표시 (페이지 로드 완료 후)
      const timer = setTimeout(() => {
        setShowTutorial(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [userId, isLoading]);

  // D-Day 모달 로직 (trip 로드 후 실행)
  useEffect(() => {
    if (hasShownDdayModal || !trip) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parseDate = (dateStr: string): Date => {
      try {
        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);
        return date;
      } catch {
        return today;
      }
    };

    const startDateObj = parseDate(trip.startDateIso);

    // 테스트 사용자(전혜선)인 경우 D-day 고정
    const TEST_USER_PHONE = '01024958013';
    const FIXED_DDAY = 100;
    let diffDays: number;

    if (userPhone === TEST_USER_PHONE && today < startDateObj) {
      // 전혜선 계정이고 여행 시작 전인 경우 D-day 고정
      diffDays = FIXED_DDAY;
    } else if (today < startDateObj) {
      const diffTime = startDateObj.getTime() - today.getTime();
      diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } else {
      diffDays = 0;
    }

    if (today <= startDateObj) {
      const messages = ddayMessagesData?.messages;
      if (messages) {
        // 정확한 키 또는 가장 가까운 작은 키 찾기
        const numericKeys = Object.keys(messages)
          .map(Number)
          .filter(k => !isNaN(k))
          .sort((a, b) => b - a); // 내림차순 정렬
        const matchKey = numericKeys.find(k => k <= diffDays);
        const ddayKey = matchKey !== undefined ? matchKey.toString() : null;
        if (ddayKey && messages[ddayKey]) {
          setDdayMessageData(messages[ddayKey]);
          setShowDdayModal(true);
          setHasShownDdayModal(true);
        }
      }
    }
  }, [trip, hasShownDdayModal, userPhone, ddayMessagesData]);

  const onChangeTab = (newMode: ChatInputMode) => {
    setMode(newMode);
  };

  return (
    <>
      {/* 여행 종료 배너 */}
      {tripExpired && (
        <div className="mx-auto max-w-6xl w-full px-3 pt-4 pb-2">
          <div className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl shadow-lg p-6 border-2 border-red-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-3xl">⏰</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-1">
                    여행이 종료되었습니다
                  </h2>
                  <p className="text-white/90">
                    {expiredMessage}
                  </p>
                </div>
              </div>
              <Link
                href={affiliateMallUrl}
                className="px-6 py-3 bg-white text-red-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors shadow-md whitespace-nowrap"
              >
                새 여행 추가
              </Link>
            </div>
            <div className="mt-4 bg-white/10 rounded-lg p-3">
              <p className="text-sm text-center">
                새로운 여행을 등록하시면 크루즈닷을 다시 만나실 수 있습니다!
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* "배로 돌아가기" 카운트다운 배너 */}
      {!tripExpired && <ReturnToShipBanner />}
      
      
      {/* 오늘의 브리핑 - 컴팩트하게 */}
      {!tripExpired && (
        <div className="mx-auto max-w-6xl w-full px-3 pt-2 pb-1">
          <DailyBriefingCard />
        </div>
      )}
      
      {/* 채팅 탭 - 여행 종료 여부와 무관하게 항상 표시 */}
      <div className="mx-auto max-w-6xl w-full px-3 pb-2">
        <ChatTabs value={mode} onChange={onChangeTab} />
      </div>
      
      {/* 채팅창 - 화면의 80%+ 차지 (여행 종료 시 숨김) */}
      {!tripExpired && (
        <div className="mx-auto max-w-6xl w-full flex-1">
          <ChatClientShell mode={mode} />
        </div>
      )}
      
      {showDdayModal && ddayMessageData && (
        <DdayPushModal
          userId={"monica_user"} // 하드코딩된 사용자 ID 유지
          userName={userName}
          trip={trip || { cruiseName: '크루즈 여행', destination: '목적지 미정', startDate: '시작일 미정', startDateIso: '', endDate: '종료일 미정' }}
          message={{ d: getDdayMessage(trip?.startDateIso || trip?.startDate || '', trip?.endDate || '', userPhone), title: ddayMessageData.title, html: ddayMessageData.message }}
          onClose={() => setShowDdayModal(false)}
        />
      )}
      
      {/* 푸시 알림 권한 요청 프롬프트 */}
      <PushNotificationPrompt />
      
      {/* 관리자 메시지 팝업 */}
      <AdminMessageModal />
      
      {/* 지니 AI 튜토리얼 */}
      {showTutorial && (
        <GenieAITutorial
          onComplete={() => setShowTutorial(false)}
          userId={userId}
          isTestMode={isTestMode}
        />
      )}
    </>
  );
}

