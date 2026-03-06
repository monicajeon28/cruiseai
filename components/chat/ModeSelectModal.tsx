'use client';

import { useEffect } from 'react';
import { FiX, FiCheck } from 'react-icons/fi';
import type { ChatInputMode } from '@/lib/types';

type Mode = {
  key: ChatInputMode;
  emoji: string;
  title: string;
  desc: string;
  color: string;       // bg 색
  border: string;      // border 색
  activeBg: string;    // 선택됐을 때 배경
};

const MODES: Mode[] = [
  {
    key: 'go',
    emoji: '🗺️',
    title: '크루즈닷 가자',
    desc: '기항지 관광, 맛집, 쇼핑, 터미널 이동 경로 안내',
    color: 'bg-blue-50',
    border: 'border-blue-200',
    activeBg: 'bg-blue-600',
  },
  {
    key: 'show',
    emoji: '📸',
    title: '크루즈닷 보여줘',
    desc: '크루즈 관련 사진, 시설, 선박 내부 이미지 검색',
    color: 'bg-purple-50',
    border: 'border-purple-200',
    activeBg: 'bg-purple-600',
  },
  {
    key: 'general',
    emoji: '💬',
    title: '일반 대화',
    desc: '크루즈 여행 전반에 관한 자유로운 질문과 대화',
    color: 'bg-green-50',
    border: 'border-green-200',
    activeBg: 'bg-green-600',
  },
];

interface ModeSelectModalProps {
  currentMode: ChatInputMode;
  onChange: (mode: ChatInputMode) => void;
  onClose: () => void;
}

export default function ModeSelectModal({ currentMode, onChange, onClose }: ModeSelectModalProps) {
  // ESC 키로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <>
      {/* 배경 딤 */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* 바텀시트 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-white shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* 핸들 바 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-gray-300" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4">
          <h2 className="text-xl font-bold text-gray-900">대화 모드 선택</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <FiX size={22} className="text-gray-600" />
          </button>
        </div>

        {/* 모드 버튼 3개 */}
        <div className="px-4 pb-6 space-y-3">
          {MODES.map((m) => {
            const isActive = currentMode === m.key;
            return (
              <button
                key={m.key}
                onClick={() => onChange(m.key)}
                className={`
                  w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2
                  transition-all active:scale-[0.98]
                  ${isActive
                    ? `${m.activeBg} border-transparent text-white shadow-lg`
                    : `${m.color} ${m.border} text-gray-800 hover:shadow-md`
                  }
                `}
              >
                <span className="text-4xl flex-shrink-0">{m.emoji}</span>
                <div className="flex-1 text-left">
                  <p className={`text-lg font-bold leading-tight ${isActive ? 'text-white' : 'text-gray-900'}`}>
                    {m.title}
                  </p>
                  <p className={`text-sm mt-0.5 leading-relaxed ${isActive ? 'text-white/80' : 'text-gray-500'}`}>
                    {m.desc}
                  </p>
                </div>
                {isActive && (
                  <FiCheck size={22} className="text-white flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
