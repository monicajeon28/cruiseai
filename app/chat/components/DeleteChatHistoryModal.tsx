'use client';

import { useEffect } from 'react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
};

export default function DeleteChatHistoryModal({ isOpen, onClose, onConfirm, isDeleting = false }: Props) {
  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={isDeleting ? undefined : onClose}
      />
      
      {/* 모달 콘텐츠 */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
        <div className="text-center">
          {/* 아이콘 */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>

          {/* 제목 */}
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            대화 내역을 삭제하시겠습니까?
          </h3>

          {/* 설명 */}
          <p className="text-gray-600 mb-6">
            모든 채팅 기록이 영구적으로 삭제됩니다.<br />
            이 작업은 되돌릴 수 없습니다.
          </p>

          {/* 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className={`flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors ${
                isDeleting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              취소
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className={`flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors ${
                isDeleting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isDeleting ? (
                <span className="inline-flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  삭제 중...
                </span>
              ) : (
                '삭제'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

