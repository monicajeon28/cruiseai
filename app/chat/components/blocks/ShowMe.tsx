'use client';

import { ChatInputPayload } from '@/components/chat/types';

type Props = {
  onSend?: (payload: ChatInputPayload) => void;
};

export default function ShowMe({ onSend }: Props) {
  const handleChipClick = (text: string) => {
    if (onSend) {
      onSend({ mode: 'show', text, from: '', to: text });
    }
  };

  return (
    <div className="text-center py-12">
      <div className="text-7xl mb-4">📸</div>
      <h2 className="text-3xl font-bold text-gray-900 mb-4">무엇을 볼까요?</h2>
      <p className="text-xl text-gray-600 mb-8">
        크루즈 선박이나 여행지를 입력하면<br />
        관련 사진과 정보를 보여드립니다
      </p>
      
      <div className="bg-purple-50 rounded-xl p-5 max-w-lg mx-auto border-2 border-purple-200">
        <p className="text-lg text-purple-900 font-semibold mb-3">💡 빠른 검색 예시 (참고용)</p>
        <div className="grid grid-cols-2 gap-2 text-base text-gray-700">
          <div className="bg-white rounded-lg p-2 cursor-default">
            🚢 벨리시마
          </div>
          <div className="bg-white rounded-lg p-2 cursor-default">
            🏝️ 오키나와
          </div>
          <div className="bg-white rounded-lg p-2 cursor-default">
            🌃 홍콩
          </div>
          <div className="bg-white rounded-lg p-2 cursor-default">
            🚢 코스타세레나
          </div>
          <div className="bg-white rounded-lg p-2 cursor-default">
            🗼 도쿄
          </div>
          <div className="bg-white rounded-lg p-2 cursor-default">
            🏛️ 로마
          </div>
        </div>
      </div>
    </div>
  );
}

