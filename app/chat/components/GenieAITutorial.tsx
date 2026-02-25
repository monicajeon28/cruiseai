'use client';

import { useState, useEffect } from 'react';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  example: string;
  emoji: string;
  color: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'where',
    title: '📍 어디서 사용하나요?',
    description: '"크루즈닷" 탭에서 사용할 수 있어요!\n가장 아래에 있는 "크루즈닷" 탭을 눌러보세요.',
    example: '📱 화면 하단 → "크루즈닷" 탭 클릭\n\n✨ 여기서 모든 기능을 사용할 수 있어요!',
    emoji: '📍',
    color: 'bg-blue-500',
  },
  {
    id: 'concise',
    title: '⚡ 100자 핵심 답변',
    description: '크루즈닷은 100자 이내로 핵심만 알려줘요.\n필요한 정보만 빠르게 확인해보세요!',
    example: '💬 "3월 일본 크루즈 날씨 어때?"\n\n✨ "평균 12℃, 일교차 크니 얇은 겉옷 챙기세요!"',
    emoji: '⚡',
    color: 'bg-indigo-500',
  },
  {
    id: 'voice',
    title: '🎤 음성으로도 사용할 수 있어요!',
    description: '마이크 버튼을 누르면 말로도 질문할 수 있어요!\n말을 끝내면 자동으로 인식돼요.',
    example: '1️⃣ 마이크 버튼 클릭\n2️⃣ 말하기: "벨리시마 일정 알려줘"\n3️⃣ 말 끝나면 자동 인식!\n\n✨ 글자로 써도 똑같이 작동해요!',
    emoji: '🎤',
    color: 'bg-pink-500',
  },
  {
    id: 'products',
    title: '🛳️ 상품 질문도 OK',
    description: '상품 코드나 선사 이름을 말하면 추천을 도와드려요.\n최신 인기 상품도 바로 안내돼요.',
    example: '💬 "SAMPLE-MED-001 상품 설명해줘"\n💬 "부산 출발 MSC 추천해줘"\n\n✨ 상품 정보 + 가격까지 한 번에!',
    emoji: '🛳️',
    color: 'bg-teal-500',
  },
];

interface Props {
  onComplete: () => void;
  userId?: number;
  isTestMode?: boolean;
}

export default function GenieAITutorial({ onComplete, userId, isTestMode = false }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  // 이미 본 튜토리얼인지 확인
  useEffect(() => {
    const storageKey = userId 
      ? `genie_ai_tutorial_seen_${userId}` 
      : 'genie_ai_tutorial_seen';
    const hasSeen = localStorage.getItem(storageKey);
    
    if (hasSeen === 'true') {
      setIsVisible(false);
      onComplete();
    }
  }, [userId, onComplete]);

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    const storageKey = userId 
      ? `genie_ai_tutorial_seen_${userId}` 
      : 'genie_ai_tutorial_seen';
    localStorage.setItem(storageKey, 'true');
    setIsVisible(false);
    onComplete();
  };

  if (!isVisible) {
    return null;
  }

  const step = TUTORIAL_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TUTORIAL_STEPS.length - 1;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-slideUp">
        {/* 헤더 */}
        <div className="relative bg-gradient-to-r from-blue-500 to-purple-500 p-6 text-white">
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors text-2xl"
            aria-label="닫기"
          >
            ✕
          </button>
          
          <div className="text-center">
            <div className="text-6xl mb-3 animate-bounce">{step.emoji}</div>
            <h2 className="text-2xl font-bold mb-2">{step.title}</h2>
            {isTestMode && (
              <div className="bg-white/20 rounded-full px-3 py-1 text-sm inline-block mb-2">
                🎁 3일 체험 중
              </div>
            )}
          </div>
        </div>

        {/* 내용 */}
        <div className="p-6">
          {/* 진행 표시 */}
          <div className="flex gap-2 mb-6">
            {TUTORIAL_STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-2 flex-1 rounded-full transition-all ${
                  index === currentStep
                    ? step.color
                    : index < currentStep
                    ? 'bg-gray-300'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* 설명 */}
          <div className="text-center mb-6">
            <p className="text-lg text-gray-700 mb-5 leading-relaxed whitespace-pre-line">
              {step.description}
            </p>
            
            {/* 예시 박스 */}
            <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-blue-200 shadow-inner">
              <div className="text-sm text-blue-600 font-semibold mb-3 flex items-center justify-center gap-2">
                <span className="text-lg">💡</span>
                <span>이렇게 사용하세요</span>
              </div>
              <div className="text-base text-gray-800 font-medium whitespace-pre-line leading-relaxed bg-white/60 rounded-xl p-4">
                {step.example}
              </div>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3">
            {!isFirst && (
              <button
                onClick={handlePrevious}
                className="flex-1 px-6 py-4 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-lg"
              >
                ← 이전
              </button>
            )}
            <button
              onClick={handleNext}
              className={`flex-1 px-6 py-4 rounded-xl font-bold text-white text-lg transition-all hover:scale-105 ${
                isLast ? 'bg-gradient-to-r from-green-500 to-emerald-500' : step.color
              }`}
            >
              {isLast ? '🎉 시작하기' : '다음 →'}
            </button>
          </div>

          {/* 건너뛰기 링크 */}
          <button
            onClick={handleSkip}
            className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            건너뛰기
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}

