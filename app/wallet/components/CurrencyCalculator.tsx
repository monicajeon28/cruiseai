'use client';

import { useState, useEffect } from 'react';
import { FiRefreshCw, FiAlertCircle, FiChevronDown } from 'react-icons/fi';
import { logger } from '@/lib/logger';
import SuggestSheet, { type SuggestItem } from '@/components/chat/SuggestSheet';

type Currency = {
  code: string;
  symbol: string;
  name: string;
  country: string;
};

type ExchangeRate = {
  code: string;
  rateToKRW: number; // 해당 통화 1단위당 원화
  rateFromKRW: number; // 원화 1원당 해당 통화
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

function currencyToSuggestItem(c: Currency): SuggestItem {
  return {
    id: c.code,
    label: `${c.country} ${c.symbol}`,
    subtitle: `${c.code} · ${c.name}`,
  };
}

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

  // 바텀시트 표시 상태
  const [showFromSheet, setShowFromSheet] = useState(false);
  const [showToSheet, setShowToSheet] = useState(false);

  // 숫자 포맷팅 함수 (천 단위 콤마)
  const formatNumber = (value: string): string => {
    const numbers = value.replace(/[^\d.]/g, '');
    if (!numbers) return '';
    const parts = numbers.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  // 포맷팅된 문자열에서 숫자만 추출
  const parseNumber = (value: string): number => {
    const cleaned = value.replace(/,/g, '');
    return parseFloat(cleaned) || 0;
  };

  // 통화 목록 및 환율 불러오기
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const countriesRes = await fetch('/api/wallet/countries');
        const countriesData = await countriesRes.json();

        logger.debug('[CurrencyCalculator] Countries data:', countriesData);

        if (countriesData.success && countriesData.currencies?.length > 0) {
          setCurrencies(countriesData.currencies);

          const currencyCodes = countriesData.currencies.map((c: Currency) => c.code);
          const ratesRes = await fetch('/api/wallet/exchange-rate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currencies: currencyCodes }),
          });

          const ratesData = await ratesRes.json();
          logger.debug('[CurrencyCalculator] Rates data:', ratesData);

          if (ratesData.success) {
            setRates(ratesData.rates);
            setLastUpdate(new Date(ratesData.timestamp).toLocaleString('ko-KR'));
          }
        } else {
          logger.debug('[CurrencyCalculator] Using default currencies');
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
      } catch (error) {
        logger.error('[CurrencyCalculator] Error loading data:', error);
        setError('환율 정보를 불러오는 중 오류가 발생했습니다.');
        setCurrencies(DEFAULT_CURRENCIES);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 환율 계산
  useEffect(() => {
    if (rates.length === 0 || !fromAmount) {
      setToAmount('');
      return;
    }

    const amount = parseNumber(fromAmount);
    if (isNaN(amount) || amount === 0) {
      setToAmount('');
      return;
    }

    const fromRate = rates.find(r => r.code === fromCurrency);
    const toRate = rates.find(r => r.code === toCurrency);

    if (!fromRate || !toRate) {
      setToAmount('');
      return;
    }

    const amountInKRW = amount * fromRate.rateToKRW;
    const convertedAmount = amountInKRW * toRate.rateFromKRW;

    const decimals = ['KRW', 'JPY', 'VND', 'IDR'].includes(toCurrency) ? 0 : 2;
    const formatted = convertedAmount.toFixed(decimals);

    setToAmount(formatNumber(formatted));
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
    } catch (error) {
      logger.error('[CurrencyCalculator] Error refreshing rates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fromCurrencyInfo = currencies.find(c => c.code === fromCurrency);
  const toCurrencyInfo = currencies.find(c => c.code === toCurrency);
  const suggestItems = currencies.map(currencyToSuggestItem);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
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

      {/* 환율 계산기 */}
      <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-2 border-blue-200">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <h2 className="text-lg md:text-xl font-bold text-gray-900">💱 환율 계산기</h2>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            aria-label="환율 새로고침"
          >
            <FiRefreshCw className={`w-5 h-5 md:w-6 md:h-6 text-blue-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* From 통화 */}
        <div className="mb-3 md:mb-4">
          <label className="block text-base md:text-lg font-semibold text-gray-700 mb-2">보낼 금액</label>
          <div className="flex gap-2">
            {/* 통화 선택 버튼 (바텀시트) */}
            <button
              onClick={() => setShowFromSheet(true)}
              className="flex-1 flex items-center justify-between px-3 py-2.5 text-base md:text-lg font-semibold border-2 border-blue-300 rounded-lg bg-blue-50 active:bg-blue-100 transition-colors"
            >
              <span className="text-gray-900">
                {fromCurrencyInfo ? `${fromCurrencyInfo.country} ${fromCurrencyInfo.symbol}` : fromCurrency}
              </span>
              <FiChevronDown size={18} className="text-blue-500 ml-1 shrink-0" />
            </button>
            <input
              type="text"
              inputMode="decimal"
              value={fromAmount}
              onChange={(e) => setFromAmount(formatNumber(e.target.value))}
              placeholder="금액"
              className="flex-1 px-3 py-2.5 text-base md:text-lg font-semibold border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {fromCurrencyInfo && (
            <p className="mt-1 text-sm text-gray-500 pl-1">{fromCurrency} · {fromCurrencyInfo.name}</p>
          )}
        </div>

        {/* 화살표 */}
        <div className="flex justify-center my-3">
          <div className="text-2xl md:text-4xl text-blue-500">⬇️</div>
        </div>

        {/* To 통화 */}
        <div className="mb-4 md:mb-6">
          <label className="block text-base md:text-lg font-semibold text-gray-700 mb-2">받을 금액</label>
          <div className="flex gap-2">
            {/* 통화 선택 버튼 (바텀시트) */}
            <button
              onClick={() => setShowToSheet(true)}
              className="flex-1 flex items-center justify-between px-3 py-2.5 text-base md:text-lg font-semibold border-2 border-green-300 rounded-lg bg-green-50 active:bg-green-100 transition-colors"
            >
              <span className="text-gray-900">
                {toCurrencyInfo ? `${toCurrencyInfo.country} ${toCurrencyInfo.symbol}` : toCurrency}
              </span>
              <FiChevronDown size={18} className="text-green-500 ml-1 shrink-0" />
            </button>
            <input
              type="text"
              value={toAmount}
              readOnly
              placeholder="0.00"
              className="flex-1 px-3 py-2.5 text-base md:text-lg font-semibold bg-green-50 border-2 border-green-300 rounded-lg text-green-700"
            />
          </div>
          {toCurrencyInfo && (
            <p className="mt-1 text-sm text-gray-500 pl-1">{toCurrency} · {toCurrencyInfo.name}</p>
          )}
        </div>

        {/* 마지막 업데이트 */}
        {lastUpdate && (
          <p className="text-sm text-gray-500 text-center">
            마지막 업데이트: {lastUpdate}
          </p>
        )}
      </div>

      {/* 환율표 */}
      <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-2 border-purple-200">
        <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-3 md:mb-4">📊 실시간 환율표 (원화 기준)</h3>
        <div className="space-y-2 md:space-y-3">
          {rates.map((rate) => {
            const currency = currencies.find(c => c.code === rate.code);
            if (!currency) return null;

            return (
              <div
                key={rate.code}
                className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200"
              >
                <div>
                  <p className="text-base md:text-lg font-bold text-gray-900">
                    {currency.symbol} {currency.code}
                  </p>
                  <p className="text-sm md:text-base text-gray-600">{currency.country}</p>
                </div>
                <div className="text-right">
                  <p className="text-base md:text-xl font-bold text-blue-600">
                    {rate.rateToKRW.toLocaleString('ko-KR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} 원
                  </p>
                  <p className="text-xs md:text-sm text-gray-500">1 {currency.code}당</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 보낼 통화 바텀시트 */}
      {showFromSheet && (
        <SuggestSheet
          title="보낼 통화 선택"
          items={suggestItems}
          onPick={(item) => {
            setFromCurrency(item.id.replace('custom:', ''));
            setShowFromSheet(false);
          }}
          onClose={() => setShowFromSheet(false)}
        />
      )}

      {/* 받을 통화 바텀시트 */}
      {showToSheet && (
        <SuggestSheet
          title="받을 통화 선택"
          items={suggestItems}
          onPick={(item) => {
            setToCurrency(item.id.replace('custom:', ''));
            setShowToSheet(false);
          }}
          onClose={() => setShowToSheet(false)}
        />
      )}
    </div>
  );
}
