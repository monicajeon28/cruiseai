'use client';

import { useState, useEffect } from 'react';
import { FiDollarSign, FiList, FiPieChart, FiChevronLeft } from 'react-icons/fi';
import { useRouter, usePathname } from 'next/navigation';
import CurrencyCalculator from './components/CurrencyCalculator';
import ExpenseTracker from './components/ExpenseTracker';
import Statistics from './components/Statistics';
import { trackFeature } from '@/lib/analytics';
import TutorialCountdown from '@/app/chat/components/TutorialCountdown';
import { checkTestModeClient, TestModeInfo, getCorrectPath } from '@/lib/test-mode-client';
import { clearAllLocalStorage } from '@/lib/csrf-client';

type Tab = 'calculator' | 'expenses' | 'statistics';

export default function WalletPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<Tab>('calculator');
  const [testModeInfo, setTestModeInfo] = useState<TestModeInfo | null>(null);

  useEffect(() => {
    // 테스트 모드 정보 로드 및 경로 보호
    const loadTestModeInfo = async () => {
      const info = await checkTestModeClient();
      setTestModeInfo(info);
      
      // 경로 보호: 일반 사용자는 /wallet로 리다이렉트
      const correctPath = getCorrectPath(pathname || '/wallet-test', info);
      if (correctPath !== pathname) {
        router.replace(correctPath);
      }
    };
    loadTestModeInfo();
  }, [pathname, router]);

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        clearAllLocalStorage();
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

  // 기능 사용 추적
  useEffect(() => {
    trackFeature('wallet');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      {/* 72시간 카운트다운 배너 (상단 고정) */}
      {testModeInfo && testModeInfo.isTestMode && (
        <TutorialCountdown testModeInfo={testModeInfo} onLogout={handleLogout} />
      )}

      {/* 헤더 - 튜토리얼 스타일 */}
      <div className="bg-white/95 backdrop-blur shadow-md border-b-2 border-purple-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/tools-test')}
              className="p-2 hover:bg-purple-50 rounded-lg transition-colors border-2 border-purple-200"
              aria-label="도구함으로 돌아가기"
            >
              <FiChevronLeft className="w-7 h-7 text-purple-600" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-2xl">💰</span>
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 bg-clip-text text-transparent leading-tight">
                    여행 가계부
                  </h1>
                  <p className="text-base md:text-lg text-gray-600 leading-relaxed">72시간 동안 모든 기능을 무료로 체험해보세요!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 - 튜토리얼 스타일 */}
      <div className="bg-white/95 backdrop-blur border-b-2 border-purple-200 sticky top-0 z-10 shadow-md">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-2 py-3">
            <button
              onClick={() => setActiveTab('calculator')}
              className={`flex-1 flex flex-col items-center justify-center py-4 rounded-xl transition-all border-2 ${
                activeTab === 'calculator'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg border-blue-600'
                  : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 border-gray-200'
              }`}
            >
              <FiDollarSign className="w-8 h-8 md:w-10 md:h-10 mb-2" />
              <span className="text-base md:text-lg font-semibold">환율 계산기</span>
            </button>

            <button
              onClick={() => setActiveTab('expenses')}
              className={`flex-1 flex flex-col items-center justify-center py-5 md:py-6 rounded-xl transition-all border-2 ${
                activeTab === 'expenses'
                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg border-green-600'
                  : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 hover:bg-gradient-to-r hover:from-green-50 hover:to-green-100 border-gray-200'
              }`}
            >
              <FiList className="w-8 h-8 md:w-10 md:h-10 mb-2" />
              <span className="text-base md:text-lg font-semibold">지출 기록</span>
            </button>

            <button
              onClick={() => setActiveTab('statistics')}
              className={`flex-1 flex flex-col items-center justify-center py-5 md:py-6 rounded-xl transition-all border-2 ${
                activeTab === 'statistics'
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg border-purple-600'
                  : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100 border-gray-200'
              }`}
            >
              <FiPieChart className="w-8 h-8 md:w-10 md:h-10 mb-2" />
              <span className="text-base md:text-lg font-semibold">통계</span>
            </button>
          </div>
        </div>
      </div>

      {/* 튜토리얼 안내 섹션 */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 border-2 border-purple-300 rounded-2xl p-6 md:p-8 shadow-lg mb-6">
          <div className="flex items-start gap-5">
            <div className="text-6xl md:text-7xl">💡</div>
            <div className="flex-1">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-5 leading-tight">
                여행 가계부 사용법
              </h2>
              
              {activeTab === 'calculator' && (
                <div className="space-y-4">
                  <div className="bg-white/80 rounded-lg p-5 md:p-6 border-2 border-blue-200">
                    <h3 className="font-bold text-blue-700 text-xl md:text-2xl mb-3 flex items-center gap-3 leading-tight">
                      <FiDollarSign className="text-2xl md:text-3xl" />
                      환율 계산기
                    </h3>
                    <p className="text-base md:text-lg text-gray-700 mb-4 leading-relaxed">
                      여행지 통화를 원화(₩)로 변환하거나, 원화를 현지 통화로 변환할 수 있습니다.
                    </p>
                    <ul className="space-y-3 text-base md:text-lg text-gray-600 leading-relaxed">
                      <li className="flex items-start gap-3">
                        <span className="text-blue-600 font-bold text-xl flex-shrink-0">•</span>
                        <span>현지 통화 금액을 입력하면 자동으로 원화로 변환됩니다</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-blue-600 font-bold text-xl flex-shrink-0">•</span>
                        <span>원화 금액을 입력하면 현지 통화로 변환됩니다</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-blue-600 font-bold text-xl flex-shrink-0">•</span>
                        <span>실시간 환율 정보를 제공합니다</span>
                      </li>
                    </ul>
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                      <p className="text-base md:text-lg text-blue-800 leading-relaxed">
                        <span className="font-bold">예시:</span> 일본에서 1,000엔을 사용했다면, 자동으로 원화로 변환되어 표시됩니다.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'expenses' && (
                <div className="space-y-4">
                  <div className="bg-white/80 rounded-lg p-5 md:p-6 border-2 border-green-200">
                    <h3 className="font-bold text-green-700 text-xl md:text-2xl mb-3 flex items-center gap-3 leading-tight">
                      <FiList className="text-2xl md:text-3xl" />
                      지출 기록
                    </h3>
                    <p className="text-base md:text-lg text-gray-700 mb-4 leading-relaxed">
                      여행 중 발생한 모든 지출을 카테고리별로 기록하고 관리할 수 있습니다.
                    </p>
                    <ul className="space-y-3 text-base md:text-lg text-gray-600 leading-relaxed">
                      <li className="flex items-start gap-3">
                        <span className="text-green-600 font-bold text-xl flex-shrink-0">•</span>
                        <span>식사, 쇼핑, 교통, 관광, 숙박 등 카테고리별로 분류합니다</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-green-600 font-bold text-xl flex-shrink-0">•</span>
                        <span>현지 통화와 원화를 동시에 기록할 수 있습니다</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-green-600 font-bold text-xl flex-shrink-0">•</span>
                        <span>모든 지출 내역이 자동으로 저장됩니다</span>
                      </li>
                    </ul>
                    <div className="mt-4 p-4 bg-green-50 rounded-lg border-2 border-green-200">
                      <p className="text-base md:text-lg text-green-800 leading-relaxed">
                        <span className="font-bold">예시:</span> 점심 식사 5,000엔을 &quot;식사&quot; 카테고리로 기록하면, 자동으로 원화로 변환되어 총 지출에 반영됩니다.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'statistics' && (
                <div className="space-y-4">
                  <div className="bg-white/80 rounded-lg p-5 md:p-6 border-2 border-purple-200">
                    <h3 className="font-bold text-purple-700 text-xl md:text-2xl mb-3 flex items-center gap-3 leading-tight">
                      <FiPieChart className="text-2xl md:text-3xl" />
                      통계
                    </h3>
                    <p className="text-base md:text-lg text-gray-700 mb-4 leading-relaxed">
                      여행 중 지출 내역을 시각적으로 분석하고 확인할 수 있습니다.
                    </p>
                    <ul className="space-y-3 text-base md:text-lg text-gray-600 leading-relaxed">
                      <li className="flex items-start gap-3">
                        <span className="text-purple-600 font-bold text-xl flex-shrink-0">•</span>
                        <span>카테고리별 지출 비율을 파이 차트로 확인합니다</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-purple-600 font-bold text-xl flex-shrink-0">•</span>
                        <span>일별 지출 추이를 그래프로 확인합니다</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-purple-600 font-bold text-xl flex-shrink-0">•</span>
                        <span>총 지출 금액과 평균 일일 지출을 확인합니다</span>
                      </li>
                    </ul>
                    <div className="mt-4 p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                      <p className="text-base md:text-lg text-purple-800 leading-relaxed">
                        <span className="font-bold">팁:</span> 통계를 통해 어느 카테고리에 가장 많은 지출이 있었는지 확인하고, 다음 여행 예산을 계획하는 데 활용하세요!
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="max-w-6xl mx-auto px-4 pb-6">
        {activeTab === 'calculator' && <CurrencyCalculator />}
        {activeTab === 'expenses' && <ExpenseTracker />}
        {activeTab === 'statistics' && <Statistics />}
      </div>
    </div>
  );
}
