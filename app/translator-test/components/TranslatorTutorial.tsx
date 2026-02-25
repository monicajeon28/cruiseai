// app/translator/components/TranslatorTutorial.tsx
'use client';

import { useState } from 'react';

const STEPS = [
  {
    title: '사진을 찍으면 메뉴판을 번역해드려요!',
    description: '일본어, 중국어 메뉴판도 한글로 보세요.',
    emoji: '📷',
  },
  {
    title: '말하기 버튼을 꾹 누르고 말하세요',
    description: '한국어로 말하면 자동으로 번역됩니다.',
    emoji: '🎤',
  },
  {
    title: '빠른 문장을 클릭하면 바로 번역!',
    description: '자주 쓰는 말을 버튼으로 준비했어요.',
    emoji: '⚡',
  },
];

type Props = {
  onComplete: () => void;
};

export default function TranslatorTutorial({ onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = STEPS[currentStep];
  
  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete();
      localStorage.setItem('hasSeenTranslatorTutorial', 'true');
    }
  };
  
  const handleSkip = () => {
    onComplete();
    localStorage.setItem('hasSeenTranslatorTutorial', 'true');
  };
  
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-lg w-full">
        {/* 진행 표시 */}
        <div className="flex gap-2 mb-6">
          {STEPS.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 flex-1 rounded-full ${
                idx <= currentStep ? 'bg-blue-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        
        {/* 이모티콘 */}
        <div className="text-center mb-6">
          <span className="text-9xl">{step.emoji}</span>
        </div>
        
        {/* 내용 */}
        <h2 className="text-3xl font-bold mb-4 text-center">
          {step.title}
        </h2>
        <p className="text-xl text-gray-600 mb-8 text-center leading-relaxed">
          {step.description}
        </p>
        
        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            className="flex-1 px-6 py-4 border-2 border-gray-300 rounded-xl text-lg font-medium hover:bg-gray-50 transition-all"
          >
            건너뛰기
          </button>
          <button
            onClick={handleNext}
            className="flex-1 px-6 py-4 bg-blue-500 text-white rounded-xl text-lg font-bold hover:bg-blue-600 active:scale-95 transition-all"
          >
            {currentStep < STEPS.length - 1 ? '다음 →' : '시작하기 🚀'}
          </button>
        </div>
      </div>
    </div>
  );
}












