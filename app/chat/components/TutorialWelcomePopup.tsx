// app/chat/components/TutorialWelcomePopup.tsx
// 튜토리얼 환영 팝업

'use client';

interface TutorialWelcomePopupProps {
  onClose: () => void;
  remainingHours: number;
}

export default function TutorialWelcomePopup({ onClose, remainingHours }: TutorialWelcomePopupProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col relative animate-scale-in">
        {/* 닫기 버튼 - 항상 보이도록 z-index 높임 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-3xl font-bold z-10 bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-md hover:shadow-lg transition-all"
          aria-label="닫기"
        >
          ×
        </button>

        {/* 콘텐츠 - 스크롤 가능하게 */}
        <div className="text-center overflow-y-auto flex-1 px-6 py-4">
          <div className="text-5xl mb-4 animate-bounce">🎉</div>
          <h2 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-3">
            크루즈닷AI에 오신 것을 환영합니다!
          </h2>
          <p className="text-lg text-gray-700 mb-4">
            <span className="font-bold text-purple-600">{remainingHours}시간</span> 동안
            <br />
            모든 기능을 <span className="font-bold text-pink-600">무료로 체험</span>하실 수 있습니다!
          </p>

          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 mb-4">
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              ✨ 체험 가능한 기능들
            </h3>
            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💬</span>
                <div>
                  <div className="font-bold text-sm">AI 채팅 상담</div>
                  <div className="text-xs text-gray-600">24시간 질문 가능</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">✅</span>
                <div>
                  <div className="font-bold text-sm">스마트 체크리스트</div>
                  <div className="text-xs text-gray-600">준비물 관리</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🗺️</span>
                <div>
                  <div className="font-bold text-sm">실시간 여행 지도</div>
                  <div className="text-xs text-gray-600">GPS 기반 안내</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">💰</span>
                <div>
                  <div className="font-bold text-sm">가계부 관리</div>
                  <div className="text-xs text-gray-600">지출 추적</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-3 mb-4">
            <p className="text-gray-800 text-sm font-medium">
              💡 <span className="font-bold">팁:</span> 실제 크루즈 여행에서도 이 모든 기능을 사용할 수 있습니다!
              <br />
              체험 기간 동안 자유롭게 탐색해보세요.
            </p>
          </div>

          <button
            onClick={onClose}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-bold text-base hover:shadow-xl transform hover:scale-105 transition-all w-full mb-2"
          >
            시작하기 →
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes scale-in {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

