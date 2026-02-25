'use client';

import { useState, useEffect } from 'react';

type FontSize = 1 | 2 | 3; // 1: 보통, 2: 큼, 3: 아주 큼

export default function FontSizeSetting() {
  const [fontSize, setFontSize] = useState<FontSize>(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 저장된 글씨 크기 설정 로드
    const saved = localStorage.getItem('global-font-size');
    if (saved) {
      const size = parseInt(saved) as FontSize;
      if ([1, 2, 3].includes(size)) {
        setFontSize(size);
        applyFontSize(size);
      }
    }
    setIsLoading(false);
  }, []);

  const applyFontSize = (size: FontSize) => {
    // CSS 변수로 전역 글씨 크기 설정
    const root = document.documentElement;
    const sizeMap = {
      1: { base: '16px', lg: '18px', xl: '20px', '2xl': '24px' },
      2: { base: '18px', lg: '20px', xl: '22px', '2xl': '26px' },
      3: { base: '20px', lg: '22px', xl: '24px', '2xl': '28px' },
    };
    
    const sizes = sizeMap[size];
    root.style.setProperty('--font-size-base', sizes.base);
    root.style.setProperty('--font-size-lg', sizes.lg);
    root.style.setProperty('--font-size-xl', sizes.xl);
    root.style.setProperty('--font-size-2xl', sizes['2xl']);
  };

  const handleFontSizeChange = (size: FontSize) => {
    setFontSize(size);
    localStorage.setItem('global-font-size', String(size));
    applyFontSize(size);
  };

  if (isLoading) {
    return null;
  }

  const sizeLabels = {
    1: '보통',
    2: '큼',
    3: '아주 큼',
  };

  return (
    <div className="p-5 bg-white/90 backdrop-blur rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🔤</span>
            <h3 className="text-lg font-bold text-gray-800">글씨 크기</h3>
          </div>
          <p className="text-sm text-gray-600">
            전체 앱의 글씨 크기를 조절합니다
          </p>
        </div>
        <div className="px-4 py-2 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg">
          <span className="text-base font-bold text-blue-700">
            {sizeLabels[fontSize]}
          </span>
        </div>
      </div>
      
      <div className="flex gap-3">
        {([1, 2, 3] as FontSize[]).map((size) => (
          <button
            key={size}
            onClick={() => handleFontSizeChange(size)}
            className={`flex-1 px-4 py-3 text-base font-semibold rounded-xl transition-all ${
              fontSize === size
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transform scale-105'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {sizeLabels[size]}
          </button>
        ))}
      </div>
      
      <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500 text-center flex items-center justify-center gap-1">
        <span>💡</span>
        <span>변경사항은 즉시 적용됩니다</span>
      </div>
    </div>
  );
}

