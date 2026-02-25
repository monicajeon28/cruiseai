// components/SimplifiedOnboarding.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { csrfFetch } from '@/lib/csrf-client';

type CruiseProduct = {
  productCode: string;
  packageName: string;
  shipName: string;
  nights: number;
  days: number;
};

export default function SimplifiedOnboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<CruiseProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // URL 파라미터에서 productCode 가져오기
  const productCodeFromUrl = searchParams?.get('productCode');

  // 크루즈 상품 목록 불러오기
  useEffect(() => {
    fetch('/api/cms/products')
      .then(res => res.json())
      .then(data => {
        if (data.ok && Array.isArray(data.products)) {
          setProducts(data.products);
          
          // URL 파라미터로 전달된 상품 코드가 있으면 기본 선택
          if (productCodeFromUrl) {
            const productExists = data.products.find(
              (p: CruiseProduct) => p.productCode === productCodeFromUrl.toUpperCase()
            );
            if (productExists) {
              setSelectedProduct(productCodeFromUrl.toUpperCase());
            }
          }
        }
      })
      .catch(err => {
        console.error('크루즈 상품 로드 실패:', err);
      });
  }, [productCodeFromUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedProduct) {
      setError('크루즈를 선택해주세요.');
      return;
    }

    if (!departureDate) {
      setError('출발 날짜를 선택해주세요.');
      return;
    }

    setLoading(true);

    try {
      const response = await csrfFetch('/api/trips/auto-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productCode: selectedProduct,
          departureDate,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.error || data.message || '여행 정보 생성에 실패했습니다.');
        return;
      }

      // 성공: 채팅 페이지로 이동
      const pathname = window.location.pathname;
      const isTestMode = pathname?.includes('/chat-test') || 
                         pathname?.includes('/tools-test') || 
                         pathname?.includes('/translator-test') || 
                         pathname?.includes('/profile-test') ||
                         pathname?.includes('/checklist-test') ||
                         pathname?.includes('/wallet-test');
      router.push(isTestMode ? '/chat-test' : '/chat');
    } catch (err) {
      console.error('Onboarding error:', err);
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-red-50 p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8 md:p-10">
        {/* 로고 */}
        <div className="text-center mb-8">
          <img
            src="/images/ai-cruise-logo.png"
            alt="크루즈 가이드"
            className="w-24 h-24 mx-auto mb-4"
          />
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">
            환영합니다! 🎉
          </h1>
          <p className="text-base md:text-lg text-gray-600">
            예약하신 크루즈 여행 정보를 입력해주세요
          </p>
        </div>

        {/* 안내 메시지 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm md:text-base text-blue-800 leading-relaxed">
            💡 <strong>간단한 두 가지만</strong> 입력하시면<br />
            모든 여행 일정이 자동으로 준비됩니다!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 크루즈 선택 */}
          <div>
            <label htmlFor="cruiseProduct" className="block text-lg md:text-xl font-bold text-gray-900 mb-3">
              1️⃣ 크루즈 선택
            </label>
            <select
              id="cruiseProduct"
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full h-14 md:h-16 text-lg md:text-xl px-4 rounded-xl border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
              disabled={loading}
            >
              <option value="">크루즈를 선택하세요</option>
              {products.map(p => (
                <option key={p.productCode} value={p.productCode}>
                  {p.packageName} ({p.nights}박 {p.days}일)
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-2">
              🚢 예약하신 크루즈 상품을 선택하세요
            </p>
            
            {/* 선택된 상품 정보 미리보기 */}
            {selectedProduct && products.find(p => p.productCode === selectedProduct) && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-base font-semibold text-blue-900">
                  ✅ {products.find(p => p.productCode === selectedProduct)?.shipName}
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  {products.find(p => p.productCode === selectedProduct)?.nights}박 {products.find(p => p.productCode === selectedProduct)?.days}일 일정
                </p>
              </div>
            )}
          </div>

          {/* 출발 날짜 */}
          <div>
            <label htmlFor="departureDate" className="block text-lg md:text-xl font-bold text-gray-900 mb-3">
              2️⃣ 출발 날짜
            </label>
            <input
              id="departureDate"
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              className="w-full h-14 md:h-16 text-lg md:text-xl px-4 rounded-xl border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              disabled={loading}
              min={new Date().toISOString().split('T')[0]} // 오늘 이후 날짜만 선택 가능
            />
            <p className="text-sm text-gray-500 mt-2">
              🗓️ 크루즈 승선 날짜를 선택하세요
            </p>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-700 text-sm md:text-base">⚠️ {error}</p>
            </div>
          )}

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 md:h-16 text-lg md:text-xl font-extrabold rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>여행 정보 생성 중...</span>
              </>
            ) : (
              <>
                <span>🚢 여행 시작하기</span>
              </>
            )}
          </button>
        </form>

        {/* 안내 (개발 모드에서만) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-xs text-green-800 font-semibold mb-2">✅ 개선 완료:</p>
            <p className="text-xs text-green-700">
              크루즈 선택 드롭다운으로 변경 - 예약번호 입력 불필요!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

