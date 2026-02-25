// app/chat/components/TutorialChatPage.tsx
// 튜토리얼 버전 채팅 페이지 (기존 코드 수정 없이 완전히 별도로 구현)
// 마케팅적 요소, 세일즈 요소가 극적으로 표현된 버전

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TestModeInfo } from '@/lib/test-mode-client';
import TestChatInteractiveUI from './TestChatInteractiveUI'; // 테스트 고객 전용 컴포넌트
import TutorialWelcomePopup from './TutorialWelcomePopup';
import TutorialCountdown from './TutorialCountdown';
import TutorialFeatureGuide from './TutorialFeatureGuide';
import { clearAllLocalStorage } from '@/lib/csrf-client';
import PWAInstallButtonMall from '@/components/PWAInstallButtonMall';

interface TutorialChatPageProps {
  testModeInfo: TestModeInfo;
}

export default function TutorialChatPage({ testModeInfo }: TutorialChatPageProps) {
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showFeatureGuide, setShowFeatureGuide] = useState(false);
  const [currentGuideStep, setCurrentGuideStep] = useState(0);
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);

  // 3가지 대화 기능 메시지
  const chatFeatures = [
    {
      title: '크루즈닷 가자',
      description: '클릭만 해도 원하는 관광지, 맛집을 찾아드려요',
      example: '클릭만 하면 바로 추천!',
    },
    {
      title: '크루즈닷 보여줘',
      description: '"오키나와 보여줘"라고만 입력해도 오키나와를 다 보여줘요',
      example: '예: "오키나와 보여줘"',
      bonus: '보너스! 크루즈닷 만의 실제 여행 후 경험 컨텐츠도 보여드려요',
    },
    {
      title: '일반',
      description: '정확한 크루즈 정보를 알려드려요',
      example: '예: "코스타세레나는 몇 톤이야?"',
    },
  ];

  // 3초마다 기능 메시지 자동 변경
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeatureIndex((prev) => (prev + 1) % chatFeatures.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [chatFeatures.length]);

  useEffect(() => {
    // 환영 팝업 표시 (페이지 진입 시마다 항상 표시)
    setShowWelcome(true);
  }, []);

  const handleWelcomeClose = () => {
    setShowWelcome(false);
    // 기능 안내 팝업 비활성화 - 사용자 요청에 따라 제거
    // setTimeout(() => {
    //   setShowFeatureGuide(true);
    // }, 500);
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        // 사용자 관련 모든 localStorage 데이터 정리
        clearAllLocalStorage();
        // 로그아웃 후 로그인 페이지로 이동
        window.location.href = '/login-test';
      } else {
        console.error('로그아웃 실패');
        alert('로그아웃에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('로그아웃 요청 중 오류 발생:', error);
      alert('로그아웃 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      {/* 72시간 카운트다운 배너 (상단 고정) - 로그아웃 버튼 포함 */}
      <TutorialCountdown testModeInfo={testModeInfo} onLogout={handleLogout} />

      {/* 환영 팝업 */}
      {showWelcome && (
        <TutorialWelcomePopup
          onClose={handleWelcomeClose}
          remainingHours={testModeInfo.remainingHours || 72}
        />
      )}

      {/* 기능 안내 팝업 - 비활성화됨 */}
      {/* {showFeatureGuide && (
        <TutorialFeatureGuide
          currentStep={currentGuideStep}
          onNext={() => setCurrentGuideStep(prev => prev + 1)}
          onPrev={() => setCurrentGuideStep(prev => prev - 1)}
          onClose={() => setShowFeatureGuide(false)}
          totalSteps={5}
        />
      )} */}

      {/* 튜토리얼 버전 메인 콘텐츠 */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* 헤더 */}
        <div className="text-center mb-8 px-4">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 bg-clip-text text-transparent mb-4 leading-tight">
            🎉 크루즈닷AI 체험하기
          </h1>
          <p className="text-lg md:text-xl text-gray-700 font-medium leading-relaxed">
            72시간 동안 모든 기능을 무료로 체험해보세요!
          </p>
        </div>

        {/* 마케팅 카드들 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 mb-8 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border-2 border-purple-200 transform hover:scale-105 transition-all">
            <div className="text-5xl md:text-6xl mb-4">💬</div>
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 leading-tight">AI 채팅 상담</h3>
            <p className="text-base md:text-lg text-gray-600 leading-relaxed">
              크루즈 여행에 대한 모든 질문을 AI 크루즈닷에게 물어보세요! 실시간으로 답변해드립니다.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border-2 border-blue-200 transform hover:scale-105 transition-all">
            <div className="text-5xl md:text-6xl mb-4">✅</div>
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 leading-tight">스마트 체크리스트</h3>
            <p className="text-base md:text-lg text-gray-600 leading-relaxed">
              여행 준비물을 놓치지 않도록 체크리스트로 관리하세요. 알림 기능까지 제공됩니다!
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border-2 border-green-200 transform hover:scale-105 transition-all">
            <div className="text-5xl md:text-6xl mb-4">🗺️</div>
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 leading-tight">실시간 여행 지도</h3>
            <p className="text-base md:text-lg text-gray-600 leading-relaxed">
              크루즈 경로와 방문지 정보를 지도에서 한눈에 확인하세요. GPS 기반 안내도 제공됩니다!
            </p>
          </div>
        </div>

        {/* 실제 채팅 인터페이스 - TestChatInteractiveUI 사용 (테스트 고객 전용, 완전 분리) */}
        <div className="bg-white rounded-3xl shadow-2xl p-5 md:p-6 border-4 border-purple-300 mx-4">
          <div className="text-center mb-6">
            <div className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-full font-bold text-lg md:text-xl mb-4">
              ✨ 지금 바로 AI 크루즈닷과 대화해보세요!
            </div>
            <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 rounded-xl p-6 md:p-8 border-2 border-purple-200 transition-all duration-500">
              <div className="text-4xl md:text-5xl mb-4 animate-pulse">
                {currentFeatureIndex === 0 && '🚶'}
                {currentFeatureIndex === 1 && '📸'}
                {currentFeatureIndex === 2 && '💬'}
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 leading-tight">
                &quot;{chatFeatures[currentFeatureIndex].title}&quot;
              </h3>
              <p className="text-gray-700 mb-3 text-lg md:text-xl leading-relaxed">
                {chatFeatures[currentFeatureIndex].description}
              </p>
              {chatFeatures[currentFeatureIndex].bonus && (
                <p className="text-base md:text-lg text-purple-600 font-semibold mb-3 leading-relaxed">
                  ✨ {chatFeatures[currentFeatureIndex].bonus}
                </p>
              )}
              <p className="text-gray-600 italic text-base md:text-lg leading-relaxed">
                💡 {chatFeatures[currentFeatureIndex].example}
              </p>
              {/* 진행 표시 점들 */}
              <div className="flex justify-center gap-2 mt-5">
                {chatFeatures.map((_, index) => (
                  <div
                    key={index}
                    className={`h-3 rounded-full transition-all duration-300 ${
                      index === currentFeatureIndex
                        ? 'bg-purple-600 w-8'
                        : 'bg-gray-300 w-3'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* TestChatInteractiveUI 사용 - 테스트 고객 전용 (완전 분리) */}
          <TestChatInteractiveUI />
          
          {/* 크루즈몰 바탕화면 추가하기 (카카오톡 채널 버튼 아래) */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-center mb-4">
              <p className="text-base md:text-lg text-gray-700 font-semibold mb-3">
                크루즈몰을 바탕화면에 추가하면 더 빠르게 접근할 수 있습니다
              </p>
              <div className="max-w-md mx-auto">
                <PWAInstallButtonMall />
              </div>
            </div>
          </div>
        </div>

        {/* CTA 섹션 */}
        <div className="mt-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 md:p-8 text-white text-center mx-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 leading-tight">
            🎁 지금 체험하고, 실제 여행에서 활용하세요!
          </h2>
          <p className="text-lg md:text-xl mb-6 leading-relaxed">
            이 모든 기능을 실제 크루즈 여행에서 사용할 수 있습니다.
            <br className="hidden md:block" />
            <span className="md:hidden"> </span>
            체험 기간 동안 모든 기능을 자유롭게 사용해보세요!
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-4">
              <div className="font-bold text-lg md:text-xl">💬 AI 채팅</div>
              <div className="text-sm md:text-base">24시간 상담 가능</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-4">
              <div className="font-bold text-lg md:text-xl">✅ 체크리스트</div>
              <div className="text-sm md:text-base">준비물 관리</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-4">
              <div className="font-bold text-lg md:text-xl">🗺️ 여행 지도</div>
              <div className="text-sm md:text-base">실시간 경로 안내</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-4">
              <div className="font-bold text-lg md:text-xl">💰 가계부</div>
              <div className="text-sm md:text-base">지출 관리</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

