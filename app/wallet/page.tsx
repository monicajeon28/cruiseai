'use client';

import { useState, useEffect } from 'react';
import { FiDollarSign, FiList, FiPieChart, FiChevronLeft } from 'react-icons/fi';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import CurrencyCalculator from './components/CurrencyCalculator';
import ExpenseTracker from './components/ExpenseTracker';
import Statistics from './components/Statistics';
import { trackFeature } from '@/lib/analytics';
import TutorialCountdown from '@/app/chat/components/TutorialCountdown';
import { checkTestModeClient, TestModeInfo, getCorrectPath } from '@/lib/test-mode-client';
import { clearAllLocalStorage } from '@/lib/csrf-client';

type Tab = 'calculator' | 'expenses' | 'statistics';

type WalletExpense = {
  id: number | string;
  tripId: number;
  day: number;
  date: string;
  category: string;
  amount: number;
  currency: string;
  amountInKRW: number;
  description: string;
  createdAt: string;
};

export default function WalletPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<Tab>('calculator');
  const [testModeInfo, setTestModeInfo] = useState<TestModeInfo | null>(null);
  const [sharedExpenses, setSharedExpenses] = useState<WalletExpense[]>([]);

  useEffect(() => {
    // 테스트 모드 정보 로드 및 경로 보호
    const loadTestModeInfo = async () => {
      const info = await checkTestModeClient();
      setTestModeInfo(info);

      // 경로 보호: 테스트 모드 사용자는 /wallet-test로 리다이렉트
      const correctPath = getCorrectPath(pathname || '/wallet', info);
      if (correctPath !== pathname) {
        router.replace(correctPath);
      }
    };
    loadTestModeInfo();
  }, [pathname, router]);

  // 지출 데이터 1회 로드 → ExpenseTracker + Statistics 공유 (탭 전환 API 중복 제거)
  useEffect(() => {
    const loadSharedExpenses = async () => {
      try {
        const res = await fetch('/api/wallet/expenses', { credentials: 'include' });
        const data = await res.json();
        if (data.success && Array.isArray(data.expenses)) {
          setSharedExpenses(data.expenses);
        }
      } catch { }
    };
    loadSharedExpenses();
  }, []);

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        clearAllLocalStorage();
        window.location.href = '/login';
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
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* 72시간 카운트다운 배너 (상단 고정) */}
      {testModeInfo && testModeInfo.isTestMode && (
        <TutorialCountdown testModeInfo={testModeInfo} onLogout={handleLogout} />
      )}

      {/* 헤더 - 튜토리얼 스타일 */}
      <div className="bg-white/95 backdrop-blur shadow-md border-b-2 border-[#051C2C]/10">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/chat"
              className="p-2 hover:bg-[#FDB931]/10 rounded-lg transition-colors border-2 border-[#FDB931]/30"
              aria-label="뒤로가기"
            >
              <FiChevronLeft className="w-6 h-6 text-[#051C2C]" />
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 md:w-12 md:h-12 bg-gradient-to-br from-[#FDB931] to-[#E1A21E] rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-lg md:text-2xl">💰</span>
                </div>
                <div>
                  <h1 className="text-xl md:text-3xl font-extrabold text-[#051C2C] leading-tight">
                    <span className="text-[#FDB931]">여행</span> 가계부
                  </h1>
                  <p className="text-xs md:text-base text-gray-600 leading-relaxed">
                    {testModeInfo && testModeInfo.isTestMode
                      ? '72시간 무료 체험 중'
                      : '여행 중 지출을 쉽게 관리하세요!'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 - 튜토리얼 스타일 */}
      <div className="bg-white/95 backdrop-blur border-b-2 border-[#051C2C]/10 sticky top-0 z-10 shadow-md">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-2 py-3">
            <button
              onClick={() => setActiveTab('calculator')}
              className={`flex-1 flex flex-col items-center justify-center py-3 min-h-[44px] rounded-xl transition-all border-2 ${activeTab === 'calculator'
                ? 'bg-gradient-to-r from-[#FDB931] to-[#E1A21E] text-[#051C2C] shadow-lg border-[#FDB931]'
                : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 hover:bg-gradient-to-r hover:from-[#FDB931]/10 hover:to-[#FDB931]/5 border-gray-200'
                }`}
            >
              <FiDollarSign className="w-5 h-5 md:w-6 md:h-6 mb-1" />
              <span className="text-xs md:text-sm font-semibold">환율</span>
            </button>

            <button
              onClick={() => setActiveTab('expenses')}
              className={`flex-1 flex flex-col items-center justify-center py-3 min-h-[44px] rounded-xl transition-all border-2 ${activeTab === 'expenses'
                ? 'bg-gradient-to-r from-[#FDB931] to-[#E1A21E] text-[#051C2C] shadow-lg border-[#FDB931]'
                : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 hover:bg-gradient-to-r hover:from-[#FDB931]/10 hover:to-[#FDB931]/5 border-gray-200'
                }`}
            >
              <FiList className="w-5 h-5 md:w-6 md:h-6 mb-1" />
              <span className="text-xs md:text-sm font-semibold">지출</span>
            </button>

            <button
              onClick={() => setActiveTab('statistics')}
              className={`flex-1 flex flex-col items-center justify-center py-3 min-h-[44px] rounded-xl transition-all border-2 ${activeTab === 'statistics'
                ? 'bg-gradient-to-r from-[#FDB931] to-[#E1A21E] text-[#051C2C] shadow-lg border-[#FDB931]'
                : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 hover:bg-gradient-to-r hover:from-[#FDB931]/10 hover:to-[#FDB931]/5 border-gray-200'
                }`}
            >
              <FiPieChart className="w-5 h-5 md:w-6 md:h-6 mb-1" />
              <span className="text-xs md:text-sm font-semibold">통계</span>
            </button>
          </div>
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="max-w-6xl mx-auto px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)]">
        {activeTab === 'calculator' && <CurrencyCalculator />}
        {activeTab === 'expenses' && <ExpenseTracker />}
        {activeTab === 'statistics' && <Statistics sharedExpenses={sharedExpenses} />}
      </div>
    </div>
  );
}
