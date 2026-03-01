'use client';

import { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiCalendar, FiAlertCircle, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { logger } from '@/lib/logger';

type Currency = {
  code: string;
  symbol: string;
  name: string;
  country: string;
};

// 주요 국가 통화 목록 (전체)
const DEFAULT_CURRENCIES: Currency[] = [
  { code: 'KRW', symbol: '₩', name: '원', country: '한국' },
  { code: 'USD', symbol: '$', name: '달러', country: '미국' },
  { code: 'JPY', symbol: '¥', name: '엔', country: '일본' },
  { code: 'CNY', symbol: '¥', name: '위안', country: '중국' },
  { code: 'TWD', symbol: 'NT$', name: '달러', country: '대만' },
  { code: 'HKD', symbol: 'HK$', name: '달러', country: '홍콩' },
  { code: 'SGD', symbol: 'S$', name: '달러', country: '싱가포르' },
  { code: 'THB', symbol: '฿', name: '바트', country: '태국' },
  { code: 'VND', symbol: '₫', name: '동', country: '베트남' },
  { code: 'PHP', symbol: '₱', name: '페소', country: '필리핀' },
  { code: 'MYR', symbol: 'RM', name: '링깃', country: '말레이시아' },
  { code: 'IDR', symbol: 'Rp', name: '루피아', country: '인도네시아' },
  { code: 'EUR', symbol: '€', name: '유로', country: '유럽' },
  { code: 'GBP', symbol: '£', name: '파운드', country: '영국' },
  { code: 'CHF', symbol: 'CHF', name: '프랑', country: '스위스' },
  { code: 'AUD', symbol: 'A$', name: '달러', country: '호주' },
  { code: 'NZD', symbol: 'NZ$', name: '달러', country: '뉴질랜드' },
  { code: 'CAD', symbol: 'C$', name: '달러', country: '캐나다' },
  { code: 'RUB', symbol: '₽', name: '루블', country: '러시아' },
  { code: 'TRY', symbol: '₺', name: '리라', country: '터키' },
  { code: 'AED', symbol: 'د.إ', name: '디르함', country: 'UAE' },
];

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

type ExpenseCategory = '식사' | '쇼핑' | '교통' | '관광' | '숙박' | '기타';

const CATEGORIES: { key: ExpenseCategory; label: string; icon: string }[] = [
  { key: '식사', label: '식사', icon: '🍽️' },
  { key: '쇼핑', label: '쇼핑', icon: '🛍️' },
  { key: '교통', label: '교통', icon: '🚕' },
  { key: '관광', label: '관광', icon: '🎭' },
  { key: '숙박', label: '숙박', icon: '🏨' },
  { key: '기타', label: '기타', icon: '💰' },
];

const STORAGE_KEY = 'expense-tracker-items';

// 환율 API 실패 시 기본 환율 (대략적 값 — 정확하지 않음을 표시)
const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  'USD': 1370,
  'JPY': 9.2,     // 100엔 아님! 1엔 기준
  'EUR': 1530,
  'CNY': 190,
  'TWD': 43,
  'HKD': 175,
  'SGD': 1020,
  'GBP': 1740,
  'AUD': 870,
  'CAD': 990,
  'THB': 38,
  'VND': 0.054,
  'MYR': 310,
  'PHP': 24,
};

export default function ExpenseTracker() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>(DEFAULT_CURRENCIES);
  const [cachedRates, setCachedRates] = useState<Record<string, number>>(DEFAULT_EXCHANGE_RATES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [tripDates, setTripDates] = useState<{ startDate: string; endDate: string } | null>(null);
  const [tripId, setTripId] = useState<number>(0);

  // 폼 상태
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory>('식사');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('KRW');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [amountInKRW, setAmountInKRW] = useState<number>(0); // 원화 환산 금액

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, []);

  // 실시간 환율 계산 - 캐시된 환율로 즉시 계산 (API 호출 없음, 딜레이 없음)
  useEffect(() => {
    const amountNum = parseFloat(amount) || 0;
    if (!amount || amountNum <= 0) {
      setAmountInKRW(0);
      return;
    }
    if (selectedCurrency === 'KRW') {
      setAmountInKRW(amountNum);
      return;
    }
    const rate = cachedRates[selectedCurrency] ?? DEFAULT_EXCHANGE_RATES[selectedCurrency] ?? 1;
    setAmountInKRW(Math.round(amountNum * rate));
  }, [amount, selectedCurrency, cachedRates]);

  // localStorage에서 로드
  const loadFromLocalStorage = (): Expense[] => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      logger.error('[ExpenseTracker] Failed to load from localStorage:', e);
    }
    return [];
  };

  // localStorage에 저장
  const saveToLocalStorage = (items: Expense[]): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      return true;
    } catch (e) {
      logger.error('[ExpenseTracker] Failed to save to localStorage:', e);
      return false;
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      // 통화 및 여행 날짜 정보
      const countriesRes = await fetch('/api/wallet/countries');
      const countriesData = await countriesRes.json();

      logger.debug('[ExpenseTracker] Countries data:', countriesData);

      if (countriesData.success) {
        if (countriesData.currencies?.length > 0) {
          setCurrencies(countriesData.currencies);

          // 여행지 통화 환율을 한 번에 사전 로드 (이후 계산은 로컬에서 즉시)
          const foreignCodes = countriesData.currencies
            .map((c: any) => c.code)
            .filter((c: string) => c !== 'KRW');
          if (foreignCodes.length > 0) {
            // 1주일 localStorage 캐시 확인 (앱 실행마다 API 호출 불필요)
            const RATE_CACHE_KEY = 'wallet-exchange-rates-v1';
            const RATE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 1주일
            let ratesCached = false;
            try {
              const cached = localStorage.getItem(RATE_CACHE_KEY);
              if (cached) {
                const { rates: cachedObj, ts } = JSON.parse(cached);
                if (Date.now() - ts < RATE_CACHE_TTL) {
                  setCachedRates(cachedObj);
                  ratesCached = true; // return 제거: 환율 캐시 HIT 시에도 지출 데이터 계속 로드
                }
              }
            } catch { /* 캐시 파싱 실패 → API 호출 */ }

            if (!ratesCached) {
              fetch('/api/wallet/exchange-rate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currencies: foreignCodes }),
              }).then(r => r.json()).then(data => {
                if (data.success) {
                  const rates: Record<string, number> = { KRW: 1 };
                  data.rates.forEach((r: any) => { rates[r.code] = r.rateToKRW; });
                  setCachedRates(rates);
                  // localStorage에 1주일 캐시 저장
                  try {
                    localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rates, ts: Date.now() }));
                  } catch { /* 저장 공간 부족 시 무시 */ }
                }
              }).catch(() => {/* DEFAULT_EXCHANGE_RATES 유지 */});
            }
          }
        }
        setTripDates(countriesData.tripDates);
        if (countriesData.tripId) {
          setTripId(countriesData.tripId);
        }
      }

      // localStorage 먼저 표시 (즉시 0ms) → 백그라운드에서 API 동기화
      const localItems = loadFromLocalStorage();
      if (localItems.length > 0) {
        setExpenses(localItems);
        setLoading(false); // 로딩 스피너 즉시 제거
      }

      // API에서 지출 기록 동기화 (백그라운드)
      try {
        const expensesRes = await fetch('/api/wallet/expenses', {
          credentials: 'include',
        });

        if (expensesRes.ok) {
          const expensesData = await expensesRes.json();
          logger.debug('[ExpenseTracker] Expenses data:', expensesData);

          if (expensesData.success) {
            // API 응답 형식에 맞게 변환
            const formattedExpenses = (expensesData.expenses || []).map((exp: any) => ({
              id: exp.id,
              tripId: exp.tripId,
              day: exp.day || 1,
              date: exp.date || (exp.createdAt ? new Date(exp.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
              category: exp.category,
              amount: exp.amount || exp.foreignAmount || 0,
              currency: exp.currency || 'KRW',
              amountInKRW: exp.amountInKRW || exp.krwAmount || 0,
              description: exp.description || '',
              createdAt: exp.createdAt || new Date().toISOString(),
            }));

            // API 데이터로 갱신 (이미 로컬 데이터 표시 중이므로 부드럽게 교체)
            const serverIds = new Set(formattedExpenses.map((e: any) => e.id));
            const pendingLocal = loadFromLocalStorage().filter(l => !serverIds.has(l.id));
            const merged = [...formattedExpenses, ...pendingLocal];
            setExpenses(merged);
            saveToLocalStorage(merged);
            return;
          }
        }
      } catch (apiError: any) {
        logger.warn('[ExpenseTracker] API failed, using localStorage:', apiError);
        // localItems는 이미 위에서 표시됨 → 추가 작업 불필요
      }
    } catch (error: any) {
      logger.error('[ExpenseTracker] Error loading data:', error);
      // localStorage에서라도 로드 시도
      const localItems = loadFromLocalStorage();
      if (localItems.length > 0) {
        setExpenses(localItems);
      } else {
        setError(`데이터를 불러오는 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 지출 추가
  const handleAddExpense = async () => {
    if (!description.trim()) {
      alert('지출 내용을 입력해주세요.');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('올바른 금액을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      // 캐시된 환율로 즉시 계산 (API 호출 없음)
      let amountInKRW = amountNum;
      if (selectedCurrency !== 'KRW') {
        const rate = cachedRates[selectedCurrency] ?? DEFAULT_EXCHANGE_RATES[selectedCurrency] ?? 1;
        amountInKRW = Math.round(amountNum * rate);
      }

      // 날짜 계산 (startDate + day)
      let expenseDate = new Date().toISOString().split('T')[0];
      if (tripDates?.startDate) {
        const start = new Date(tripDates.startDate);
        start.setDate(start.getDate() + selectedDay - 1);
        expenseDate = start.toISOString().split('T')[0];
      }

      // 새 지출 항목 생성 (localStorage용)
      const newExpense: Expense = {
        id: `local-${Date.now()}`, // localStorage용 임시 ID
        tripId: tripId, // API에서 받아온 tripId 사용
        day: selectedDay,
        date: expenseDate,
        category: selectedCategory,
        amount: amountNum,
        currency: selectedCurrency,
        amountInKRW,
        description: description.trim(),
        createdAt: new Date().toISOString(),
      };

      // 즉시 localStorage에 저장 (낙관적 업데이트)
      const updatedExpenses = [newExpense, ...expenses];
      setExpenses(updatedExpenses);
      saveToLocalStorage(updatedExpenses);

      // API에 저장 시도 (백그라운드)
      try {
        const res = await fetch('/api/wallet/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            tripId: tripId,
            day: selectedDay,
            date: expenseDate,
            category: selectedCategory,
            amount: amountNum,
            currency: selectedCurrency,
            amountInKRW,
            description: description.trim(),
          }),
        });

        if (res.ok) {
          const result = await res.json();
          if (result.success && result.expense) {
            // 서버 ID로 업데이트
            const finalExpenses = updatedExpenses.map(exp =>
              exp.id === newExpense.id ? { ...exp, id: result.expense.id } : exp
            );
            setExpenses(finalExpenses);
            saveToLocalStorage(finalExpenses);
          }
        }
      } catch (apiError: any) {
        logger.warn('[ExpenseTracker] API save failed, keeping local:', apiError);
        // API 실패해도 localStorage에는 저장됨
      }

      // 폼 초기화
      setDescription('');
      setAmount('');
      setAmountInKRW(0);

      // 성공 메시지는 표시하지 않음 (자동 저장이므로)
    } catch (error: any) {
      logger.error('[ExpenseTracker] Add expense error:', error);
      alert(`지출 추가 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  // 모든 지출 삭제 (리셋)
  const handleResetAll = async () => {
    if (expenses.length === 0) return;

    const confirmMessage = `정말로 모든 지출 기록(${expenses.length}개)을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`;
    if (!confirm(confirmMessage)) return;

    setLoading(true);
    try {
      // 즉시 상태에서 삭제 (낙관적 업데이트)
      setExpenses([]);

      // localStorage에 저장 시도
      const saved = saveToLocalStorage([]);
      if (!saved) {
        alert('로컬 저장소에 저장하는 중 오류가 발생했습니다. 페이지를 새로고침해주세요.');
        // 저장 실패 시 다시 로드
        await loadData();
        return;
      }

      // API에서 모든 지출 삭제 시도
      try {
        const deleteUrl = tripId
          ? `/api/wallet/expenses?all=true&tripId=${tripId}`
          : '/api/wallet/expenses?all=true';
        const res = await fetch(deleteUrl, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (res.ok) {
          const result = await res.json();
          logger.debug('[ExpenseTracker] All expenses deleted:', result.deletedCount);
          alert(`모든 지출 기록이 삭제되었습니다. (${result.deletedCount || expenses.length}개)`);
        } else {
          logger.warn('[ExpenseTracker] API delete all failed, but local delete succeeded');
          // localStorage는 성공했으므로 성공 메시지 표시
          alert(`모든 지출 기록이 삭제되었습니다. (${expenses.length}개)\n서버 동기화는 나중에 자동으로 시도됩니다.`);
        }
      } catch (apiError) {
        logger.warn('[ExpenseTracker] API delete all error, but local delete succeeded:', apiError);
        // localStorage는 성공했으므로 성공 메시지 표시
        alert(`모든 지출 기록이 삭제되었습니다. (${expenses.length}개)\n서버 동기화는 나중에 자동으로 시도됩니다.`);
      }
    } catch (error: any) {
      logger.error('[ExpenseTracker] Reset all error:', error);
      alert(error.message || '삭제 중 오류가 발생했습니다.');
      // 에러 발생 시 다시 로드
      await loadData();
    } finally {
      setLoading(false);
    }
  };

  // 지출 삭제
  const handleDeleteExpense = async (id: number | string) => {
    if (!confirm('이 지출을 삭제하시겠습니까?')) return;

    setLoading(true);
    try {
      // 즉시 localStorage에서 삭제 (낙관적 업데이트)
      const updatedExpenses = expenses.filter(exp => exp.id !== id);
      setExpenses(updatedExpenses);
      saveToLocalStorage(updatedExpenses);

      // API에서 삭제 시도 (숫자 ID인 경우만)
      if (typeof id === 'number') {
        try {
          const res = await fetch(`/api/wallet/expenses?id=${id}`, {
            method: 'DELETE',
            credentials: 'include',
          });

          if (!res.ok) {
            logger.warn('[ExpenseTracker] API delete failed, but local delete succeeded');
          }
        } catch (apiError) {
          logger.warn('[ExpenseTracker] API delete error, but local delete succeeded:', apiError);
        }
      }
    } catch (error: any) {
      logger.error('[ExpenseTracker] Delete error:', error);
      alert(error.message || '삭제 중 오류가 발생했습니다.');
      // 에러 발생 시 다시 로드
      await loadData();
    } finally {
      setLoading(false);
    }
  };

  // 지출 수정
  const [editingExpenseId, setEditingExpenseId] = useState<number | string | null>(null);
  const [editingAmount, setEditingAmount] = useState<string>('');
  const [editingDescription, setEditingDescription] = useState<string>('');

  const handleStartEdit = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setEditingAmount(expense.amount.toString());
    setEditingDescription(expense.description);
  };

  const handleCancelEdit = () => {
    setEditingExpenseId(null);
    setEditingAmount('');
    setEditingDescription('');
  };

  const handleSaveEdit = async (id: number | string) => {
    const amountNum = parseFloat(editingAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('올바른 금액을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      // 즉시 localStorage에서 업데이트 (DEFAULT_EXCHANGE_RATES로 환율 계산)
      const updatedExpenses = expenses.map(exp => {
        if (exp.id === id) {
          const currency = exp.currency;
          let amountInKRW: number;
          if (currency === 'KRW') {
            amountInKRW = amountNum;
          } else {
            // DEFAULT_EXCHANGE_RATES 사용 (stale 환율 대신 표준 환율)
            const rate = DEFAULT_EXCHANGE_RATES[currency];
            amountInKRW = rate
              ? Math.round(amountNum * rate)
              : Math.round(amountNum * (exp.amountInKRW && exp.amount ? exp.amountInKRW / exp.amount : 1));
          }
          return {
            ...exp,
            amount: amountNum,
            amountInKRW,
            description: editingDescription.trim(),
          };
        }
        return exp;
      });

      setExpenses(updatedExpenses);
      saveToLocalStorage(updatedExpenses);

      // API 업데이트 시도 (숫자 ID인 경우만)
      if (typeof id === 'number') {
        try {
          const expense = expenses.find(e => e.id === id);
          if (expense) {
            const res = await fetch('/api/wallet/expenses', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                id,
                amount: amountNum,
                amountInKRW: updatedExpenses.find(e => e.id === id)?.amountInKRW,
                description: editingDescription.trim(),
              }),
            });

            if (!res.ok) {
              logger.warn('[ExpenseTracker] API update failed, but local update succeeded');
            }
          }
        } catch (apiError) {
          logger.warn('[ExpenseTracker] API update error, but local update succeeded:', apiError);
        }
      }

      setEditingExpenseId(null);
      setEditingAmount('');
      setEditingDescription('');
    } catch (error: any) {
      logger.error('[ExpenseTracker] Update error:', error);
      alert(error.message || '수정 중 오류가 발생했습니다.');
      await loadData();
    } finally {
      setLoading(false);
    }
  };

  // 날짜/시간 포맷팅 함수
  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = date.getHours();
      const minutes = date.getMinutes();

      const ampm = hours >= 12 ? '오후' : '오전';
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes.toString().padStart(2, '0');

      return `${year}년 ${month}월 ${day}일 ${ampm} ${displayHours}시 ${displayMinutes}분`;
    } catch (e) {
      return dateString;
    }
  };

  // Day별로 그룹화
  const expensesByDay = expenses.reduce((acc, expense) => {
    if (!acc[expense.day]) {
      acc[expense.day] = [];
    }
    acc[expense.day].push(expense);
    return acc;
  }, {} as Record<number, Expense[]>);

  // 전체 총합 계산 (한국 금액 기준)
  const totalAmount = expenses.reduce((sum, expense) => sum + expense.amountInKRW, 0);

  const totalDays = tripDates?.startDate && tripDates?.endDate
    ? Math.ceil((new Date(tripDates.endDate).getTime() - new Date(tripDates.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 7;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 에러 메시지 */}
      {error && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 flex items-center gap-3">
          <FiAlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
          <p className="text-base text-yellow-800">{error}</p>
        </div>
      )}

      {/* 지출 추가 폼 */}
      <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-2 border-green-200">
        <h2 className="text-base md:text-xl font-bold text-gray-900 mb-4 md:mb-6 flex items-center gap-2">
          <FiPlus className="w-5 h-5 md:w-6 md:h-6" />
          지출 추가
        </h2>

        {/* Day 선택 */}
        <div className="mb-4">
          <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
            <FiCalendar className="inline w-4 h-4 mr-2" />
            여행 날짜
          </label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(Number(e.target.value))}
            className="w-full px-3 py-2.5 text-sm md:text-base font-semibold border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                Day {day}
              </option>
            ))}
          </select>
        </div>

        {/* 카테고리 선택 */}
        <div className="mb-4">
          <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">카테고리</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`py-2.5 px-2 rounded-lg text-sm font-semibold transition-all ${selectedCategory === cat.key
                  ? 'bg-green-500 text-white shadow-lg scale-105'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <div className="text-xl mb-0.5">{cat.icon}</div>
                <div>{cat.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 금액 입력 */}
        <div className="mb-4">
          <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">금액</label>
          <div className="flex gap-2">
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-1/3 px-3 py-2.5 text-sm md:text-base font-semibold border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.code} ({currency.country})
                </option>
              ))}
            </select>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="금액"
              className="flex-1 px-3 py-2.5 text-sm md:text-base font-semibold border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          {/* 한화 환산 금액 표시 */}
          {amount && parseFloat(amount) > 0 && selectedCurrency !== 'KRW' && (
            <div className="mt-2 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm md:text-base font-semibold text-blue-900">한국돈으로 환산:</span>
                <span className="text-lg md:text-xl font-bold text-blue-600">
                  {amountInKRW > 0 ? `${amountInKRW.toLocaleString()}원` : '계산 중...'}
                </span>
              </div>
            </div>
          )}
          {amount && parseFloat(amount) > 0 && selectedCurrency === 'KRW' && (
            <div className="mt-2 p-3 bg-gray-50 border-2 border-gray-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm md:text-base font-semibold text-gray-700">입력 금액:</span>
                <span className="text-lg md:text-xl font-bold text-gray-800">
                  {parseFloat(amount).toLocaleString()}원
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 설명 입력 */}
        <div className="mb-4 md:mb-6">
          <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">내용</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="예: 점심식사, 택시비, 기념품 등"
            className="w-full px-3 py-2.5 text-sm md:text-base border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* 추가 버튼과 리셋 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={handleAddExpense}
            disabled={loading}
            className="flex-1 py-2.5 md:py-3 text-base md:text-lg font-bold bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <FiPlus className="w-5 h-5" />
            지출 추가
          </button>
          <button
            onClick={handleResetAll}
            disabled={loading || expenses.length === 0}
            className="px-4 md:px-6 py-2.5 md:py-3 text-base md:text-lg font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            title="모든 지출 기록 삭제"
          >
            <FiTrash2 className="w-5 h-5" />
            모두 지우기
          </button>
        </div>
      </div>

      {/* 지출 목록 (Day별) */}
      <div className="space-y-4">
        {Object.keys(expensesByDay)
          .map(Number)
          .sort((a, b) => a - b)
          .map((day) => {
            const dayExpenses = expensesByDay[day];
            const dayTotal = dayExpenses.reduce((sum, exp) => sum + exp.amountInKRW, 0);

            return (
              <div key={day} className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-2 border-blue-200">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h3 className="text-base md:text-xl font-bold text-gray-900">Day {day}</h3>
                  <p className="text-sm md:text-lg font-bold text-blue-600">
                    총 {dayTotal.toLocaleString()}원
                  </p>
                </div>

                <div className="space-y-3">
                  {dayExpenses.map((expense) => {
                    const category = CATEGORIES.find(c => c.key === expense.category);
                    const currency = currencies.find(c => c.code === expense.currency);
                    const isEditing = editingExpenseId === expense.id;

                    return (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="text-3xl">{category?.icon || '💰'}</div>
                          {isEditing ? (
                            <div className="flex-1 flex flex-col gap-2">
                              <input
                                type="number"
                                value={editingAmount}
                                onChange={(e) => setEditingAmount(e.target.value)}
                                placeholder="금액"
                                className="px-3 py-2 border-2 border-blue-300 rounded-lg text-lg font-semibold"
                                autoFocus
                              />
                              <input
                                type="text"
                                value={editingDescription}
                                onChange={(e) => setEditingDescription(e.target.value)}
                                placeholder="내용"
                                className="px-3 py-2 border-2 border-blue-300 rounded-lg text-lg"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSaveEdit(expense.id)}
                                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                                >
                                  <FiCheck className="w-4 h-4" />
                                  저장
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors flex items-center gap-2"
                                >
                                  <FiX className="w-4 h-4" />
                                  취소
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1">
                              <p className="text-lg font-semibold text-gray-900">
                                {expense.description}
                              </p>
                              <p className="text-base text-gray-600">
                                {currency?.symbol}{expense.amount.toLocaleString()} {expense.currency}
                                {expense.currency !== 'KRW' && ` ≈ ${expense.amountInKRW.toLocaleString()}원`}
                              </p>
                              <p className="text-sm text-gray-500 mt-1">
                                {formatDateTime(expense.createdAt)}
                              </p>
                            </div>
                          )}
                        </div>
                        {!isEditing && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleStartEdit(expense)}
                              className="p-4 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                              aria-label="수정"
                            >
                              <FiEdit2 className="w-6 h-6" />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(expense.id)}
                              className="p-4 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              aria-label="삭제"
                            >
                              <FiTrash2 className="w-6 h-6" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

        {expenses.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 text-center border-2 border-gray-200">
            <p className="text-base md:text-xl text-gray-500">아직 지출 기록이 없습니다.</p>
            <p className="text-sm md:text-base text-gray-400 mt-2">위 폼에서 지출을 추가해보세요!</p>
          </div>
        )}

        {/* 전체 총합 표시 */}
        {expenses.length > 0 && (
          <div className="bg-gradient-to-r from-green-500 to-blue-500 rounded-xl shadow-2xl p-4 md:p-6 border-4 border-green-600 mt-4 md:mt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="text-2xl md:text-4xl">💰</div>
                <div>
                  <p className="text-base md:text-2xl font-bold text-white">전체 지출 총계</p>
                  <p className="text-sm md:text-lg text-green-100 mt-0.5 md:mt-1">모든 Day 합산</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl md:text-4xl font-extrabold text-white">
                  {totalAmount.toLocaleString()}원
                </p>
                <p className="text-sm md:text-lg text-green-100 mt-0.5 md:mt-1">
                  {Object.keys(expensesByDay).length}일 동안의 총 지출
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
