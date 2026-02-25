'use client'
import { useEffect } from 'react';
import type { ChatInputMode } from '@/lib/types';

export default function HelpModal({
  open, onClose, mode = 'general',
}: { open: boolean; onClose: () => void; mode?: ChatInputMode }) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open) return null;

  // 모드별 내용
  const getModeContent = () => {
    switch (mode) {
      case 'go':
        return {
          title: '🧭 크루즈닷 가자 - 사용 방법',
          icon: '🧭',
          color: 'text-red-600',
          sections: [
            {
              title: '📍 출발지와 도착지 입력',
              items: [
                '출발지와 도착지를 입력하세요. (예: 홍콩 공항 → 홍콩 크루즈 터미널)',
                '출발지가 애매하면 "현 위치" 버튼을 클릭하거나 나라/도시/공항을 선택하세요.',
                '입력 후 크루즈닷이 추천 후보 버튼을 띄우고, 대중교통/자동차/지도로 보기를 제공합니다.',
              ],
            },
            {
              title: '🎤 음성으로 입력하기',
              items: [
                '출발지 또는 도착지 입력창 옆의 🎤 마이크 버튼을 클릭하세요.',
                '말을 시작하면 자동으로 인식됩니다. (예: "홍콩 공항")',
                '말을 끝내면 자동으로 텍스트로 변환되어 입력창에 표시됩니다.',
                '마이크 버튼이 빨간색으로 바뀌면 듣는 중입니다.',
              ],
            },
            {
              title: '💡 팁',
              items: [
                '키보드로 직접 입력하거나 마이크 버튼으로 음성 입력 모두 가능합니다.',
                '입력 후 "보내기" 버튼을 클릭하면 길찾기 정보를 받을 수 있습니다.',
              ],
            },
          ],
        };
      case 'show':
        return {
          title: '🖼️ 크루즈닷 보여줘 - 사용 방법',
          icon: '🖼️',
          color: 'text-blue-600',
          sections: [
            {
              title: '📸 크루즈 사진 보기',
              items: [
                '크루즈 이름을 입력하세요. (예: "벨리시마 보여줘", "오션뷰 보여줘")',
                '크루즈닷이 해당 크루즈의 사진을 찾아서 보여줍니다.',
                '사진을 클릭하면 더 큰 화면으로 볼 수 있습니다.',
              ],
            },
            {
              title: '🎤 음성으로 입력하기',
              items: [
                '입력창 옆의 🎤 마이크 버튼을 클릭하세요.',
                '말을 시작하면 자동으로 인식됩니다. (예: "벨리시마 보여줘")',
                '말을 끝내면 자동으로 텍스트로 변환되어 입력창에 표시됩니다.',
                '마이크 버튼이 빨간색으로 바뀌면 듣는 중입니다.',
              ],
            },
            {
              title: '💡 팁',
              items: [
                '크루즈 이름을 정확히 말하면 더 정확한 결과를 받을 수 있습니다.',
                '키보드로 직접 입력하거나 마이크 버튼으로 음성 입력 모두 가능합니다.',
              ],
            },
          ],
        };
      case 'general':
      default:
        return {
          title: '💬 크루즈닷 (일반 대화) - 사용 방법',
          icon: '💬',
          color: 'text-purple-600',
          sections: [
            {
              title: '💬 일반 질문하기',
              items: [
                '크루즈 여행에 대한 질문을 자유롭게 물어보세요.',
                '크루즈닷이 지식 베이스를 검색해서 정확한 답변을 제공합니다.',
                '예: "크루즈 준비물 뭐가 필요해?", "일본 여행 팁 알려줘"',
              ],
            },
            {
              title: '✨ 빠른 핵심 답변',
              items: [
                '크루즈닷은 모든 답변을 100자 이내로 정리해드려요.',
                '필요한 정보만 간단하게 받아보고 싶을 때 사용하세요.',
              ],
            },
            {
              title: '💡 추천 질문 예시',
              items: [
                '예: "3월 일본 크루즈 준비물 알려줘"',
                '예: "부산 출발 MSC 상품 있어?"',
                '예: "요즘 인기 있는 노선 추천해줘"',
              ],
            },
            {
              title: '🎤 음성으로 입력하기',
              items: [
                '입력창 옆의 🎤 마이크 버튼을 클릭하세요.',
                '말을 시작하면 자동으로 인식됩니다.',
                '말을 끝내면 자동으로 텍스트로 변환되어 입력창에 표시됩니다.',
                '마이크 버튼이 빨간색으로 바뀌면 듣는 중입니다.',
              ],
            },
            {
              title: '💡 중요 사항',
              items: [
                '답변은 100자 이내로 제공됩니다.',
                '상품 추천이 필요하면 상품명이나 코드를 함께 알려주세요.',
                '"크루즈닷 가자"와 "크루즈닷 보여줘" 탭에서는 일반 대화가 제공되지 않습니다.',
              ],
            },
          ],
        };
    }
  };

  const content = getModeContent();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      aria-modal="true" role="dialog"
    >
      <div
        className="w-[min(700px,95vw)] max-h-[90vh] rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className={`bg-gradient-to-r ${mode === 'go' ? 'from-red-500 to-red-600' : mode === 'show' ? 'from-blue-500 to-blue-600' : 'from-purple-500 to-purple-600'} text-white p-6`}>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{content.icon}</span>
            <h2 className="text-2xl font-bold">{content.title}</h2>
          </div>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {content.sections.map((section, index) => (
            <div key={index} className="bg-gray-50 rounded-xl p-5 border border-gray-200">
              <h3 className={`font-bold text-lg mb-3 ${content.color}`}>
                {section.title}
              </h3>
              <ul className="space-y-2 text-gray-700 leading-relaxed">
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* 하단 버튼 */}
        <div className="border-t p-6 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition-colors"
          >
            닫기
          </button>
          <button
            onClick={onClose}
            className={`px-6 py-3 rounded-xl text-white font-semibold transition-all hover:scale-105 ${
              mode === 'go' ? 'bg-red-600 hover:bg-red-700' : 
              mode === 'show' ? 'bg-blue-600 hover:bg-blue-700' : 
              'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            이해했어요! ✨
          </button>
        </div>
      </div>
    </div>
  );
}
