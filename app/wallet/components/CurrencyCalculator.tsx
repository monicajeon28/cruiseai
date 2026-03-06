'use client';

import { useState, useEffect } from 'react';
import { FiRefreshCw, FiAlertCircle } from 'react-icons/fi';
import { BottomSheet } from '@/components/ui/BottomSheet';

type Currency = {
  code: string;
  symbol: string;
  name: string;
  country: string;
};

type ExchangeRate = {
  code: string;
  rateToKRW: number;
  rateFromKRW: number;
};

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

const PINNED_CURRENCIES = ['KRW', 'JPY', 'USD', 'VND', 'SGD', 'EUR'];

export default function CurrencyCalculator() {
  const [currencies, setCurrencies] = useState<Currency[]>(DEFAULT_CURRENCIES);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const [fromCurrency, setFromCurrency] = useState<string>('KRW');
  const [toCurrency, setToCurrency] = useState<string>('USD');
  const [fromAmount, setFromAmount] = useState<string>('10,000');
  const [toAmount, setToAmount] = useState<string>('');

  const [showFromSheet, setShowFromSheet] = useState(false);
  const [showToSheet, setShowToSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);

  const formatNumber = (value: string): string => {
    const numbers = value.replace(/[^\d.]/g, '');
    if (!numbers) return '';
    const parts = numbers.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const parseNumber = (value: string): number => {
    const cleaned = value.replace(/,/g, '');
    return parseFloat(cleaned) || 0;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const countriesRes = await fetch('/api/wallet/countries');
        const countriesData = await countriesRes.json();

        if (countriesData.success && countriesData.currencies?.length > 0) {
          setCurrencies(countriesData.currencies);
          const currencyCodes = countriesData.currencies.map((c: Currency) => c.code);
          const ratesRes = await fetch('/api/wallet/exchange-rate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currencies: currencyCodes }),
          });
          const ratesData = await ratesRes.json();
          if (ratesData.success) {
            setRates(ratesData.rates);
            setLastUpdate(new Date(ratesData.timestamp).toLocaleString('ko-KR'));
          }
        } else {
          const currencyCodes = DEFAULT_CURRENCIES.map(c => c.code);
          const ratesRes = await fetch('/api/wallet/exchange-rate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currencies: currencyCodes }),
          });
          const ratesData = await ratesRes.json();
          if (ratesData.success) {
            setRates(ratesData.rates);
            setLastUpdate(new Date(ratesData.timestamp).toLocaleString('ko-KR'));
          }
        }
      } catch {
        setError('환율 정보를 불러오는 중 오류가 발생했습니다.');
        setCurrencies(DEFAULT_CURRENCIES);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (rates.length === 0 || !fromAmount) { setToAmount(''); return; }
    const amount = parseNumber(fromAmount);
    if (isNaN(amount) || amount === 0) { setToAmount(''); return; }
    const fromRate = rates.find(r => r.code === fromCurrency);
    const toRate = rates.find(r => r.code === toCurrency);
    if (!fromRate || !toRate) { setToAmount(''); return; }
    const amountInKRW = amount * fromRate.rateToKRW;
    const convertedAmount = amountInKRW * toRate.rateFromKRW;
    const decimals = ['KRW', 'JPY', 'VND', 'IDR'].includes(toCurrency) ? 0 : 2;
    setToAmount(formatNumber(convertedAmount.toFixed(decimals)));
  }, [fromAmount, fromCurrency, toCurrency, rates]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const currencyCodes = currencies.map(c => c.code);
      const ratesRes = await fetch('/api/wallet/exchange-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currencies: currencyCodes }),
      });
      const ratesData = await ratesRes.json();
      if (ratesData.success) {
        setRates(ratesData.rates);
        setLastUpdate(new Date(ratesData.timestamp).toLocaleString('ko-KR'));
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 flex items-center gap-3">
          <FiAlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
          <p className="text-base text-yellow-800">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-2 border-blue-200">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base md:text-xl font-bold text-gray-900">💱 환율 계산기</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelpModal(true)}
              className="w-7 h-7 min-h-0 rounded-full bg-gray-100 flex items-center justify-center
                         text-gray-500 text-sm font-bold p-0 active:bg-gray-200"
              aria-label="사용법 보기"
            >
              ?
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 min-h-0 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              aria-label="환율 새로고침"
            >
              <FiRefreshCw className={`w-5 h-5 text-blue-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* From */}
        <div className="mb-3">
          <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">내가 가진 돈</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {PINNED_CURRENCIES.map((code) => (
              <button
                key={code}
                onClick={() => setFromCurrency(code)}
                className={`px-3 py-1.5 min-h-0 rounded-full text-sm font-semibold border-2 transition-colors
                  ${fromCurrency === code
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 active:bg-gray-50'
                  }`}
              >
                {code}
              </button>
            ))}
            <button
              onClick={() => setShowFromSheet(true)}
              className="px-3 py-1.5 min-h-0 rounded-full text-sm font-semibold border-2 border-dashed
                         border-gray-300 text-gray-400 active:bg-gray-50"
            >
              + 더보기
            </button>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={fromAmount}
            onChange={(e) => setFromAmount(formatNumber(e.target.value))}
            placeholder="금액"
            className="w-full px-3 py-2.5 text-sm md:text-base font-semibold border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 스왑 버튼 */}
        <div className="flex justify-center my-2">
          <button
            onClick={() => {
              const temp = fromCurrency;
              setFromCurrency(toCurrency);
              setToCurrency(temp);
            }}
            className="w-11 h-11 min-h-0 rounded-full bg-gray-100 flex items-center justify-center
                       text-gray-600 text-lg active:bg-gray-200 active:scale-95 p-0 transition-transform"
            aria-label="통화 방향 전환"
          >
            ⇄
          </button>
        </div>

        {/* To */}
        <div className="mb-4">
          <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">환전 후 받을 돈</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {PINNED_CURRENCIES.map((code) => (
              <button
                key={code}
                onClick={() => setToCurrency(code)}
                className={`px-3 py-1.5 min-h-0 rounded-full text-sm font-semibold border-2 transition-colors
                  ${toCurrency === code
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-700 border-gray-200 active:bg-gray-50'
                  }`}
              >
                {code}
              </button>
            ))}
            <button
              onClick={() => setShowToSheet(true)}
              className="px-3 py-1.5 min-h-0 rounded-full text-sm font-semibold border-2 border-dashed
                         border-gray-300 text-gray-400 active:bg-gray-50"
            >
              + 더보기
            </button>
          </div>
          <input
            type="text"
            value={toAmount}
            readOnly
            placeholder="0.00"
            className="w-full px-3 py-2.5 text-sm md:text-base font-semibold bg-green-50 border-2 border-green-300 rounded-lg text-green-700"
          />
        </div>

        {lastUpdate && (
          <p className="text-xs text-gray-400 text-center">기준환율 · {lastUpdate} 업데이트 · 실제 환전 금액과 다를 수 있음</p>
        )}
      </div>

      {/* 환율표 */}
      <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-2 border-purple-200">
        <h3 className="text-base md:text-xl font-bold text-gray-900 mb-3">📊 실시간 환율표 (원화 기준)</h3>
        <div className="space-y-2">
          {rates.map((rate) => {
            const currency = currencies.find(c => c.code === rate.code);
            if (!currency) return null;
            return (
              <div key={rate.code} className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                <div>
                  <p className="text-sm md:text-base font-bold text-gray-900">{currency.symbol} {currency.code}</p>
                  <p className="text-xs text-gray-600">{currency.country}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm md:text-lg font-bold text-blue-600">
                    {rate.rateToKRW.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 원
                  </p>
                  <p className="text-xs text-gray-500">1 {currency.code}당</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* From 통화 선택 시트 */}
      <BottomSheet open={showFromSheet} onClose={() => { setShowFromSheet(false); setSearchQuery(''); }} title="통화 선택">
        <div className="px-4 pt-3 pb-2">
          <input
            type="text"
            inputMode="search"
            placeholder="통화 검색 (USD, 달러, 미국...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="w-full px-4 py-2.5 rounded-xl bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <ul className="pb-4">
          {currencies
            .filter((c) => searchQuery === '' || c.code.toLowerCase().includes(searchQuery.toLowerCase()) || c.country.includes(searchQuery) || c.name.includes(searchQuery))
            .map((c) => (
              <li key={c.code}>
                <button
                  onClick={() => { setFromCurrency(c.code); setShowFromSheet(false); setSearchQuery(''); }}
                  className={`w-full min-h-0 flex items-center justify-between px-4 py-3 active:bg-gray-50 ${fromCurrency === c.code ? 'bg-blue-50' : ''}`}
                >
                  <span className="font-semibold text-gray-900">{c.code}</span>
                  <span className="text-gray-500 text-sm">{c.country} · {c.name}</span>
                </button>
              </li>
            ))}
        </ul>
      </BottomSheet>

      {/* To 통화 선택 시트 */}
      <BottomSheet open={showToSheet} onClose={() => { setShowToSheet(false); setSearchQuery(''); }} title="통화 선택">
        <div className="px-4 pt-3 pb-2">
          <input
            type="text"
            inputMode="search"
            placeholder="통화 검색 (USD, 달러, 미국...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="w-full px-4 py-2.5 rounded-xl bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <ul className="pb-4">
          {currencies
            .filter((c) => searchQuery === '' || c.code.toLowerCase().includes(searchQuery.toLowerCase()) || c.country.includes(searchQuery) || c.name.includes(searchQuery))
            .map((c) => (
              <li key={c.code}>
                <button
                  onClick={() => { setToCurrency(c.code); setShowToSheet(false); setSearchQuery(''); }}
                  className={`w-full min-h-0 flex items-center justify-between px-4 py-3 active:bg-gray-50 ${toCurrency === c.code ? 'bg-green-50' : ''}`}
                >
                  <span className="font-semibold text-gray-900">{c.code}</span>
                  <span className="text-gray-500 text-sm">{c.country} · {c.name}</span>
                </button>
              </li>
            ))}
        </ul>
      </BottomSheet>

      {/* 사용법 모달 */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowHelpModal(false)}>
          <div className="bg-white rounded-2xl p-6 mx-4 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">환율 계산기 사용법</h3>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-2 items-start"><span className="font-bold text-blue-600 flex-shrink-0">1.</span><span>위쪽에서 <b>내가 가진 돈</b>의 통화를 선택하세요</span></li>
              <li className="flex gap-2 items-start"><span className="font-bold text-blue-600 flex-shrink-0">2.</span><span>금액을 입력하면 <b>환전 후 받을 돈</b>이 자동 계산됩니다</span></li>
              <li className="flex gap-2 items-start"><span className="font-bold text-gray-500 flex-shrink-0">⇄</span><span>가운데 버튼으로 방향을 바꿀 수 있어요</span></li>
              <li className="flex gap-2 items-start"><span className="font-bold text-gray-400 flex-shrink-0">*</span><span className="text-gray-500">환율은 실시간 기준이며 실제 환전 금액과 다를 수 있어요</span></li>
            </ul>
            <button onClick={() => setShowHelpModal(false)} className="mt-5 w-full py-2.5 min-h-0 rounded-xl bg-gray-100 text-gray-700 font-semibold active:bg-gray-200">
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
