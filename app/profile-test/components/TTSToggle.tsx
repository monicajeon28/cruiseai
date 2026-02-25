// app/profile/components/TTSToggle.tsx
'use client';

import { useState, useEffect } from 'react';
import tts from '@/lib/tts';

export default function TTSToggle() {
  const [isEnabled, setIsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TTS 설정 로드
    setIsEnabled(tts.getEnabled());
    setIsLoading(false);
  }, []);

  const handleToggle = () => {
    const newValue = !isEnabled;
    setIsEnabled(newValue);
    tts.setEnabled(newValue);
  };

  if (isLoading) {
    return null; // 로딩 중에는 아무것도 표시하지 않음
  }

  return (
    <div className="flex items-center justify-between p-5 bg-white/90 backdrop-blur rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🔊</span>
          <h3 className="text-lg font-bold text-gray-800">AI 답변 자동 읽어주기</h3>
        </div>
        <p className="text-sm text-gray-600">
          AI가 답변을 완료하면 자동으로 음성으로 읽어줍니다
        </p>
      </div>
      
      <button
        onClick={handleToggle}
        className={`relative inline-flex h-9 w-16 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-md ${
          isEnabled ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-gray-200'
        }`}
        role="switch"
        aria-checked={isEnabled}
        aria-label="AI 답변 자동 읽어주기"
      >
        <span
          className={`pointer-events-none inline-block h-8 w-8 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
            isEnabled ? 'translate-x-7' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

