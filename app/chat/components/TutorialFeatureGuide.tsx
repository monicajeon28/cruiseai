// app/chat/components/TutorialFeatureGuide.tsx
// 기능 안내 팝업 (단계별)

'use client';

interface TutorialFeatureGuideProps {
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  totalSteps: number;
}

const guideSteps = [
  {
    title: '💬 AI 채팅 상담',
    description: '크루즈 여행에 대한 모든 질문을 AI 크루즈닷에게 물어보세요!',
    details: [
      '실시간으로 답변해드립니다',
      '크루즈 추천, 준비물, 일정 등 모든 것',
      '24시간 언제든지 이용 가능',
    ],
    example: '예: "제주도 크루즈 3박 4일 추천해줘"',
    modes: [
      {
        name: '크루즈닷 가자',
        description: '클릭만 해도 원하는 관광지, 맛집을 찾아드려요',
        example: '클릭만 하면 바로 추천!',
      },
      {
        name: '크루즈닷 보여줘',
        description: '"오키나와 보여줘"라고만 입력해도 오키나와를 다 보여줘요',
        bonus: '보너스! 크루즈닷 만의 실제 여행 후 경험 컨텐츠도 보여드려요',
        example: '예: "오키나와 보여줘"',
      },
      {
        name: '일반',
        description: '정확한 크루즈 정보를 알려드려요',
        example: '예: "코스타세레나는 몇 톤이야?"',
      },
    ],
  },
  {
    title: '✅ 스마트 체크리스트',
    description: '여행 준비물을 놓치지 않도록 체크리스트로 관리하세요!',
    details: [
      '준비물을 항목별로 체크',
      '알림 기능으로 시간 맞춰 알림',
      '여행 전까지 완벽하게 준비',
    ],
    example: '예: 여권, 승선권, 신용카드 등',
  },
  {
    title: '🗺️ 실시간 여행 지도',
    description: '크루즈 경로와 방문지 정보를 지도에서 한눈에 확인하세요!',
    details: [
      '크루즈 경로 시각화',
      'GPS 기반 실시간 위치 추적',
      '방문지 정보 및 추천',
    ],
    example: '예: 현재 위치와 목적지까지 경로 확인',
  },
  {
    title: '💰 가계부 관리',
    description: '여행 중 지출을 체계적으로 관리하세요!',
    details: [
      '카테고리별 지출 기록',
      '실시간 지출 현황 확인',
      '예산 관리 및 분석',
    ],
    example: '예: 식사, 쇼핑, 엔터테인먼트 등',
  },
  {
    title: '🎯 종합 관리',
    description: '모든 기능을 통합하여 완벽한 크루즈 여행을 경험하세요!',
    details: [
      '일정 관리와 알림',
      'D-day 카운트다운',
      '여행 후기 및 기록',
    ],
    example: '예: 출발 D-3일 알림, 여행 일정 확인',
  },
];

export default function TutorialFeatureGuide({
  currentStep,
  onNext,
  onPrev,
  onClose,
  totalSteps,
}: TutorialFeatureGuideProps) {
  const step = guideSteps[currentStep];

  if (!step) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 relative">
        {/* 진행 바 */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600">
              {currentStep + 1} / {totalSteps}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">{step.title.split(' ')[0]}</div>
          <h3 className="text-3xl font-bold text-gray-900 mb-3">
            {step.title.substring(step.title.indexOf(' ') + 1)}
          </h3>
          <p className="text-xl text-gray-700 mb-6">{step.description}</p>

          <div className="bg-gray-50 rounded-xl p-6 text-left mb-4">
            <h4 className="font-bold text-gray-900 mb-3">주요 기능:</h4>
            <ul className="space-y-2">
              {step.details.map((detail, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">✓</span>
                  <span className="text-gray-700">{detail}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* AI 채팅 모드 안내 (첫 번째 단계만) */}
          {currentStep === 0 && step.modes && (
            <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 rounded-xl p-6 mb-4 border-2 border-purple-200">
              <h4 className="font-bold text-gray-900 mb-4 text-lg">🎯 AI 채팅 3가지 모드:</h4>
              <div className="space-y-4">
                {step.modes.map((mode, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border-2 border-purple-100 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <h5 className="font-bold text-gray-900 mb-1 text-lg">
                          &quot;{mode.name}&quot;
                        </h5>
                        <p className="text-gray-700 mb-2">{mode.description}</p>
                        {mode.bonus && (
                          <p className="text-sm text-purple-600 font-semibold mb-2">
                            ✨ {mode.bonus}
                          </p>
                        )}
                        <p className="text-sm text-gray-600 italic">
                          💡 {mode.example}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <p className="text-gray-800">
              <span className="font-bold">💡 예시:</span> {step.example}
            </p>
          </div>
        </div>

        {/* 네비게이션 버튼 */}
        <div className="flex justify-between gap-4">
          <button
            onClick={onPrev}
            disabled={currentStep === 0}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${currentStep === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            ← 이전
          </button>

          {currentStep < totalSteps - 1 ? (
            <button
              onClick={onNext}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-bold hover:shadow-xl transform hover:scale-105 transition-all"
            >
              다음 →
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-bold hover:shadow-xl transform hover:scale-105 transition-all"
            >
              시작하기 →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

