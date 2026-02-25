'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Trip {
  cruiseName: string;
  destination: string;
  startDate: string;
  endDate: string;
}

type PushMsg = { d: string; title: string; html: string } | null;

interface DdayPushModalProps {
  userId: string;
  userName: string;
  trip: Trip;
  message: PushMsg;
  onClose: () => void;
}

const DdayPushModal: React.FC<DdayPushModalProps> = ({
  userId,
  userName,
  trip,
  message,
  onClose,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // ESC 키로 닫기
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!message || !mounted) return null;

  // 메시지를 줄바꿈 처리
  const formatMessage = (html: string) => {
    return html
      .replace(/\n/g, '<br/>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-blue-700">$1</strong>');
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-2xl p-6 md:p-8 m-4 max-w-md w-full relative border-2 border-blue-200 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 아이콘 */}
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-3xl">🔔</span>
          </div>
        </div>

        {/* 제목 */}
        <h3 className="text-2xl font-extrabold text-gray-900 mb-4 text-center">
          {message.title}
        </h3>

        {/* 메시지 내용 */}
        <div
          className="text-gray-800 text-base leading-relaxed mb-6 space-y-2 [&>strong]:bg-yellow-200 [&>strong]:px-1 [&>strong]:rounded"
          dangerouslySetInnerHTML={{ __html: formatMessage(message.html) }}
        />

        {/* 확인 버튼 */}
        <button
          onClick={onClose}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-lg px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all shadow-lg transform hover:scale-105"
        >
          확인했어요! ✓
        </button>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default DdayPushModal;