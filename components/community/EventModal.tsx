// components/community/EventModal.tsx
// 이벤트 참여 안내 모달

'use client';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
}

export default function EventModal({
  isOpen,
  onClose,
  onConfirm,
  title = '크루즈 후기 참여 이벤트',
  message,
  confirmText = '확인'
}: EventModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>
        <p className="text-gray-700 mb-6 leading-relaxed whitespace-pre-line">
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-yellow-400 text-gray-900 font-bold rounded-lg hover:bg-yellow-500 transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}











































