'use client';

import { ChatInputPayload } from '@/components/chat/types';

type Props = {
  onSend?: (payload: ChatInputPayload) => void;
};

export default function GoAnywhere({ onSend }: Props) {
  const handleChipClick = (text: string) => {
    if (onSend) {
      onSend({ mode: 'go', text, from: '', to: text });
    }
  };

  return (
    <div className="text-center py-12">
      <div className="text-7xl mb-4">🗺️</div>
      <h2 className="text-3xl font-bold text-gray-900 mb-4">어디로 갈까요?</h2>
      <p className="text-xl text-gray-600 mb-8">
        출발지와 도착지를 입력하면<br />
        최적의 길을 안내해드립니다
      </p>
      
      <div className="bg-blue-50 rounded-xl p-5 max-w-lg mx-auto border-2 border-blue-200">
        <p className="text-lg text-blue-900 font-semibold mb-3">💡 빠른 검색 예시 (참고용)</p>
        <div className="grid grid-cols-2 gap-2 text-base text-gray-700">
          <div className="bg-white rounded-lg p-2 cursor-default">
            📍 현 위치
          </div>
          <div className="bg-white rounded-lg p-2 cursor-default">
            🏪 편의점
          </div>
          <div className="bg-white rounded-lg p-2 cursor-default">
            🛒 마트
          </div>
          <div className="bg-white rounded-lg p-2 cursor-default">
            🍽️ 맛집
          </div>
          <div className="bg-white rounded-lg p-2 cursor-default">
            🏛️ 관광지
          </div>
          <div className="bg-white rounded-lg p-2 cursor-default">
            ☕ 카페
          </div>
        </div>
      </div>
    </div>
  );
}
