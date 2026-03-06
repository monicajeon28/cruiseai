'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { FiTrendingUp, FiPieChart, FiDollarSign, FiTarget, FiAlertCircle, FiCheckCircle, FiX } from 'react-icons/fi';
import { showError } from '@/components/ui/Toast';

type Expense = {
  id: number | string; // localStorage용 문자열 ID 지원
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

type CategoryStat = {
  category: string;
  total: number;
  percentage: number;
  icon: string;
  color: string;
  colorHex: string;
};

const CATEGORY_INFO: Record<string, { icon: string; color: string; colorHex: string; label: string }> = {
  '식사': { icon: '🍽️', color: 'bg-orange-500', colorHex: '#F97316', label: '식사' },
  '쇼핑': { icon: '🛍️', color: 'bg-pink-500', colorHex: '#EC4899', label: '쇼핑' },
  '교통': { icon: '🚕', color: 'bg-yellow-500', colorHex: '#EAB308', label: '교통' },
  '관광': { icon: '🎭', color: 'bg-purple-500', colorHex: '#A855F7', label: '관광' },
  '숙박': { icon: '🏨', color: 'bg-blue-500', colorHex: '#3B82F6', label: '숙박' },
  '기타': { icon: '💰', color: 'bg-gray-500', colorHex: '#6B7280', label: '기타' },
};

const STORAGE_KEY = 'travel-budget';
const EXPENSES_STORAGE_KEY = 'expense-tracker-items'; // ExpenseTracker와 동일한 키 사용

// 통화 코드와 국가명 매핑
const CURRENCY_COUNTRY_MAP: Record<string, string> = {
  'KRW': '한국',
  'USD': '미국',
  'JPY': '일본',
  'CNY': '중국',
  'TWD': '대만',
  'HKD': '홍콩',
  'SGD': '싱가포르',
  'THB': '태국',
  'VND': '베트남',
  'PHP': '필리핀',
  'MYR': '말레이시아',
  'IDR': '인도네시아',
  'EUR': '유럽',
  'GBP': '영국',
  'CHF': '스위스',
  'AUD': '호주',
  'NZD': '뉴질랜드',
  'CAD': '캐나다',
  'RUB': '러시아',
  'TRY': '터키',
  'AED': 'UAE',
};

interface StatisticsProps {
  sharedExpenses?: Expense[]; // wallet/page.tsx에서 1회 로드 후 전달 (탭 전환 API 제거)
}

export default function Statistics({ sharedExpenses }: StatisticsProps = {}) {
  const [expenses, setExpenses] = useState<Expense[]>(sharedExpenses ?? []);
  const [loading, setLoading] = useState(!sharedExpenses);
  const [budget, setBudget] = useState<number | null>(null);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  useEffect(() => {
    if (sharedExpenses) {
      // 부모에서 데이터 전달받은 경우 API 호출 건너뜀
      setExpenses(sharedExpenses);
      setLoading(false);
    } else {
      loadExpenses();
    }
    loadBudget();
  }, [sharedExpenses]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wallet/expenses', { credentials: 'include' });
      const data = await res.json();

      if (data.success && Array.isArray(data.expenses)) {
        setExpenses(data.expenses);
      } else {
        // localStorage에서 로드 시도
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem(EXPENSES_STORAGE_KEY);
          if (saved) {
            try {
              const localExpenses = JSON.parse(saved);
              if (Array.isArray(localExpenses)) {
                setExpenses(localExpenses);
                logger.debug('[Statistics] Loaded from localStorage:', localExpenses.length, 'items');
              }
            } catch (e) {
              logger.error('[Statistics] Error parsing localStorage:', e);
            }
          }
        }
      }
    } catch (error) {
      logger.error('[Statistics] Error loading expenses:', error);
      // localStorage에서 로드 시도
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(EXPENSES_STORAGE_KEY);
        if (saved) {
          try {
            const localExpenses = JSON.parse(saved);
            if (Array.isArray(localExpenses)) {
              setExpenses(localExpenses);
              logger.debug('[Statistics] Loaded from localStorage (fallback):', localExpenses.length, 'items');
            }
          } catch (e) {
            logger.error('[Statistics] Error parsing localStorage:', e);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loadBudget = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setBudget(parsed);
          setBudgetInput(parsed.toString());
        } catch (e) {
          logger.error('[Statistics] Error loading budget:', e);
        }
      }
    }
  };

  const saveBudget = () => {
    const budgetNum = parseFloat(budgetInput);
    if (isNaN(budgetNum) || budgetNum <= 0) {
      showError('올바른 예산 금액을 입력해주세요.');
      return;
    }
    setBudget(budgetNum);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(budgetNum));
    }
    setIsEditingBudget(false);
  };

  const cancelEditBudget = () => {
    setBudgetInput(budget?.toString() || '');
    setIsEditingBudget(false);
  };

  // 총 지출 계산
  const totalExpense = expenses.reduce((sum, exp) => sum + exp.amountInKRW, 0);

  // 카테고리별 통계
  const categoryStats: CategoryStat[] = Object.keys(CATEGORY_INFO).map((category) => {
    const categoryExpenses = expenses.filter(exp => exp.category === category);
    const total = categoryExpenses.reduce((sum, exp) => sum + exp.amountInKRW, 0);
    const percentage = totalExpense > 0 ? (total / totalExpense) * 100 : 0;

    return {
      category,
      total,
      percentage,
      icon: CATEGORY_INFO[category].icon,
      color: CATEGORY_INFO[category].color,
      colorHex: CATEGORY_INFO[category].colorHex,
    };
  }).filter(stat => stat.total > 0)
    .sort((a, b) => b.total - a.total);

  // 통화별 지출 통계
  const currencyStats = expenses.reduce((acc, exp) => {
    if (!acc[exp.currency]) {
      acc[exp.currency] = { total: 0, count: 0, totalInKRW: 0 };
    }
    acc[exp.currency].total += exp.amount;
    acc[exp.currency].totalInKRW += exp.amountInKRW;
    acc[exp.currency].count += 1;
    return acc;
  }, {} as Record<string, { total: number; count: number; totalInKRW: number }>);

  // Day별 지출 통계 (먼저 계산)
  const expensesByDay = expenses.reduce((acc, exp) => {
    if (!acc[exp.day]) {
      acc[exp.day] = 0;
    }
    acc[exp.day] += exp.amountInKRW;
    return acc;
  }, {} as Record<number, number>);

  const dayStats = Object.entries(expensesByDay)
    .map(([day, total]) => ({ day: Number(day), total }))
    .sort((a, b) => a.day - b.day);

  const maxDayTotal = Math.max(...dayStats.map(d => d.total), 1);

  // 예산 관련 계산
  const remainingBudget = budget ? budget - totalExpense : null;
  const budgetUsagePercentage = budget ? (totalExpense / budget) * 100 : null;

  // 일평균 지출 및 예상 총 지출
  const averageDailyExpense = dayStats.length > 0 ? totalExpense / dayStats.length : 0;
  
  // 여행 기간 계산 (간단히 최대 Day 기준)
  const maxDay = Math.max(...dayStats.map(d => d.day), 1);
  const estimatedTotalExpense = averageDailyExpense * maxDay;


  // 원형 차트를 위한 SVG 생성 함수
  const renderCircularChart = (stats: CategoryStat[]) => {
    let cumulativePercentage = 0;
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const centerX = 100;
    const centerY = 100;

    return (
      <div className="flex justify-center items-center relative">
        <svg width="200" height="200" viewBox="0 0 200 200" className="transform -rotate-90">
          {stats.map((stat, index) => {
            const offset = cumulativePercentage;
            const strokeDasharray = `${(stat.percentage / 100) * circumference} ${circumference}`;
            cumulativePercentage += stat.percentage;
            
            return (
              <circle
                key={stat.category}
                cx={centerX}
                cy={centerY}
                r={radius}
                fill="none"
                stroke={stat.colorHex}
                strokeWidth="30"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={-(offset / 100) * circumference}
                className="transition-all duration-500"
                style={{
                  strokeLinecap: 'round',
                }}
              />
            );
          })}
        </svg>
        {/* 중앙에 총액 표시 - SVG 외부에 배치하여 회전 문제 해결 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-2xl font-bold text-gray-900">
            {totalExpense.toLocaleString()}
          </p>
          <p className="text-base text-gray-600 mt-1">원</p>
        </div>
      </div>
    );
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!loading && expenses.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center border-2 border-gray-200">
        <div className="text-6xl mb-4">📊</div>
        <p className="text-xl text-gray-500">아직 지출 기록이 없습니다.</p>
        <p className="text-base text-gray-400 mt-2">지출을 추가하면 통계를 확인할 수 있습니다.</p>
        <p className="text-sm text-gray-400 mt-4">
          💡 &quot;지출 기록&quot; 탭에서 지출을 추가한 후 통계를 확인해보세요!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 총 지출 요약 */}
      <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl shadow-lg p-5 md:p-8 text-white">
        <div className="flex items-center gap-2 mb-2">
          <FiTrendingUp className="w-6 h-6 md:w-8 md:h-8" />
          <h2 className="text-lg md:text-2xl font-bold">총 지출</h2>
        </div>
        <p className="text-3xl md:text-5xl font-bold mb-1 md:mb-2">{totalExpense.toLocaleString()}원</p>
        <p className="text-sm md:text-lg opacity-90">{expenses.length}건의 지출</p>
      </div>

      {/* 예산 설정 및 관리 */}
      <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-2 border-green-200">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h3 className="text-base md:text-xl font-bold text-gray-900 flex items-center gap-2">
            <FiTarget className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
            여행 예산 관리
          </h3>
          {!isEditingBudget && budget && (
            <button
              onClick={() => setIsEditingBudget(true)}
              className="text-sm text-green-600 hover:text-green-700 font-semibold"
            >
              수정
            </button>
          )}
        </div>

        {isEditingBudget ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder="예산 금액 입력 (원)"
                className="flex-1 px-4 py-3 border-2 border-green-300 rounded-lg text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={saveBudget}
                className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FiCheckCircle className="w-5 h-5" />
              </button>
              <button
                onClick={cancelEditBudget}
                className="px-4 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : budget ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="bg-green-50 rounded-lg p-3 md:p-4 border-2 border-green-200">
                <p className="text-xs md:text-sm text-gray-600 mb-1">설정된 예산</p>
                <p className="text-lg md:text-2xl font-bold text-green-700">{budget.toLocaleString()}원</p>
              </div>
              <div className={`rounded-lg p-3 md:p-4 border-2 ${
                remainingBudget && remainingBudget >= 0
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <p className="text-xs md:text-sm text-gray-600 mb-1">남은 예산</p>
                <p className={`text-lg md:text-2xl font-bold ${
                  remainingBudget && remainingBudget >= 0
                    ? 'text-blue-700'
                    : 'text-red-700'
                }`}>
                  {remainingBudget !== null ? remainingBudget.toLocaleString() : '-'}원
                </p>
              </div>
            </div>
            
            {/* 예산 사용률 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-gray-700">예산 사용률</span>
                <span className={`text-lg font-bold ${
                  budgetUsagePercentage && budgetUsagePercentage > 100 
                    ? 'text-red-600' 
                    : budgetUsagePercentage && budgetUsagePercentage > 80 
                    ? 'text-orange-600' 
                    : 'text-green-600'
                }`}>
                  {budgetUsagePercentage !== null ? budgetUsagePercentage.toFixed(1) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-6">
                <div
                  className={`h-6 rounded-full transition-all duration-500 ${
                    budgetUsagePercentage && budgetUsagePercentage > 100 
                      ? 'bg-red-500' 
                      : budgetUsagePercentage && budgetUsagePercentage > 80 
                      ? 'bg-orange-500' 
                      : 'bg-green-500'
                  }`}
                  style={{ 
                    width: `${Math.min(budgetUsagePercentage || 0, 100)}%` 
                  }}
                />
              </div>
              {budgetUsagePercentage && budgetUsagePercentage > 100 && (
                <p className="text-sm text-red-600 font-semibold flex items-center gap-1">
                  <FiAlertCircle className="w-4 h-4" />
                  예산을 초과했습니다!
                </p>
              )}
              {budgetUsagePercentage && budgetUsagePercentage > 80 && budgetUsagePercentage <= 100 && (
                <p className="text-sm text-orange-600 font-semibold flex items-center gap-1">
                  <FiAlertCircle className="w-4 h-4" />
                  예산이 거의 소진되었습니다
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-600 mb-3">예산을 설정하면 지출을 관리할 수 있어요</p>
            <button
              onClick={() => setIsEditingBudget(true)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
            >
              예산 설정하기
            </button>
          </div>
        )}
      </div>

      {/* 카테고리별 원형 차트 (도형 형식) */}
      <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-2 border-purple-200">
        <h3 className="text-base md:text-xl font-bold text-gray-900 mb-4 md:mb-6 flex items-center gap-2">
          <FiPieChart className="w-5 h-5 md:w-6 md:h-6" />
          카테고리별 지출 분포
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 원형 차트 */}
          <div className="flex justify-center items-center">
            {categoryStats.length > 0 ? (
              renderCircularChart(categoryStats)
            ) : (
              <div className="text-center text-gray-400">
                <p className="text-lg">지출 데이터가 없습니다</p>
              </div>
            )}
          </div>

          {/* 범례 및 상세 정보 */}
          <div className="space-y-3">
            {categoryStats.map((stat) => (
              <div key={stat.category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: stat.colorHex }}
                  />
                  <span className="text-2xl">{stat.icon}</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {CATEGORY_INFO[stat.category].label}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">
                    {stat.total.toLocaleString()}원
                  </p>
                  <p className="text-sm text-gray-500">{stat.percentage.toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 카테고리별 상세 정보 (기존 스타일 유지) */}
      <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-2 border-purple-200">
        <h3 className="text-base md:text-xl font-bold text-gray-900 mb-3 md:mb-4 flex items-center gap-2">
          <FiPieChart className="w-5 h-5 md:w-6 md:h-6" />
          카테고리별 상세 내역
        </h3>

        <div className="space-y-4">
          {categoryStats.map((stat) => (
            <div key={stat.category} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{stat.icon}</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {CATEGORY_INFO[stat.category].label}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">
                    {stat.total.toLocaleString()}원
                  </p>
                  <p className="text-sm text-gray-500">{stat.percentage.toFixed(1)}%</p>
                </div>
              </div>

              {/* 프로그레스 바 */}
              <div className="w-full bg-gray-200 rounded-full h-5">
                <div
                  className="h-5 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${stat.percentage}%`,
                    backgroundColor: stat.colorHex
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 통화별 지출 분석 */}
      {Object.keys(currencyStats).length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-2 border-blue-200">
          <h3 className="text-base md:text-xl font-bold text-gray-900 mb-3 md:mb-4 flex items-center gap-2">
            <FiDollarSign className="w-5 h-5 md:w-6 md:h-6" />
            통화별 지출 분석
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(currencyStats).map(([currency, stat]) => {
              const country = CURRENCY_COUNTRY_MAP[currency] || currency;
              return (
                <div key={currency} className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border-2 border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-lg font-bold text-gray-900">{currency}</span>
                      <span className="text-sm text-gray-600 ml-2">({country})</span>
                    </div>
                    <span className="text-sm text-gray-600">{stat.count}건</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600">원화 환산</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {stat.totalInKRW.toLocaleString()}원
                    </p>
                    {currency !== 'KRW' && (
                      <p className="text-base text-gray-600">
                        {currency} {stat.total.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 예상 지출 및 평균 지출 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-r from-green-500 to-teal-500 rounded-xl shadow-lg p-4 md:p-6 text-white">
          <h3 className="text-base md:text-xl font-bold mb-2 md:mb-3">💡 평균 일일 지출</h3>
          <p className="text-2xl md:text-4xl font-bold">
            {dayStats.length > 0
              ? Math.round(averageDailyExpense).toLocaleString()
              : '0'}원
          </p>
          <p className="text-sm md:text-base opacity-90 mt-1 md:mt-2">
            {dayStats.length}일 동안의 평균
          </p>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl shadow-lg p-4 md:p-6 text-white">
          <h3 className="text-base md:text-xl font-bold mb-2 md:mb-3">📊 예상 총 지출</h3>
          <p className="text-2xl md:text-4xl font-bold">
            {estimatedTotalExpense > 0
              ? Math.round(estimatedTotalExpense).toLocaleString()
              : '0'}원
          </p>
          <p className="text-sm md:text-base opacity-90 mt-1 md:mt-2">
            Day {maxDay}까지 예상
          </p>
        </div>
      </div>

      {/* 최고/최저 지출일 */}
      {dayStats.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-2 border-red-200">
            <h4 className="text-sm md:text-lg font-bold text-gray-900 mb-1 md:mb-2">📈 최고 지출일</h4>
            <p className="text-base md:text-xl font-bold text-red-600">
              Day {dayStats.reduce((max, stat) => stat.total > max.total ? stat : max).day}
            </p>
            <p className="text-sm md:text-base text-gray-600 mt-1">
              {dayStats.reduce((max, stat) => stat.total > max.total ? stat : max).total.toLocaleString()}원
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-2 border-green-200">
            <h4 className="text-sm md:text-lg font-bold text-gray-900 mb-1 md:mb-2">📉 최저 지출일</h4>
            <p className="text-base md:text-xl font-bold text-green-600">
              Day {dayStats.reduce((min, stat) => stat.total < min.total ? stat : min).day}
            </p>
            <p className="text-sm md:text-base text-gray-600 mt-1">
              {dayStats.reduce((min, stat) => stat.total < min.total ? stat : min).total.toLocaleString()}원
            </p>
          </div>
        </div>
      )}

      {/* Day별 지출 통계 */}
      <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-2 border-blue-200">
        <h3 className="text-base md:text-xl font-bold text-gray-900 mb-4 md:mb-6">📅 날짜별 지출 추이</h3>

        <div className="space-y-4">
          {dayStats.map((stat) => {
            const barWidth = (stat.total / maxDayTotal) * 100;

            return (
              <div key={stat.day} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-gray-900">Day {stat.day}</span>
                  <span className="text-lg font-bold text-blue-600">
                    {stat.total.toLocaleString()}원
                  </span>
                </div>

                {/* 바 차트 */}
                <div className="w-full bg-gray-200 rounded-full h-6">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-6 rounded-full transition-all duration-500 flex items-center justify-end pr-3"
                    style={{ width: `${barWidth}%` }}
                  >
                    {barWidth > 15 && (
                      <span className="text-xs font-bold text-white">
                        {stat.total.toLocaleString()}원
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
