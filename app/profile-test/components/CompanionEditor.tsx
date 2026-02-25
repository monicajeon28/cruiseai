'use client';

import { useState } from 'react';
import { FiX } from 'react-icons/fi';

type CompanionType = '친구' | '커플' | '가족' | '혼자';

interface CompanionEditorProps {
  currentCompanion: string;
  tripId: string | number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CompanionEditor({
  currentCompanion,
  tripId,
  onClose,
  onSuccess,
}: CompanionEditorProps) {
  const [selectedCompanion, setSelectedCompanion] = useState<CompanionType>(() => {
    // 현재 동반자 타입을 한국어로 변환
    const typeMap: Record<string, CompanionType> = {
      'solo': '혼자',
      'couple': '커플',
      'family': '가족',
      'friends': '친구',
      'group': '가족',
    };
    return typeMap[currentCompanion] || '가족';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const companions: CompanionType[] = ['친구', '커플', '가족', '혼자'];

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/trips/companion', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          tripId: String(tripId),
          companionType: selectedCompanion,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        alert(data.message || '수정에 실패했습니다.');
        return;
      }

      alert('동반자 정보가 수정되었습니다.');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating companion:', error);
      alert('수정 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">동반자 수정</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="닫기"
          >
            <FiX size={24} />
          </button>
        </div>

        <p className="text-gray-600 mb-6">
          동반자 정보만 수정할 수 있습니다. 다른 정보는 관리자 패널에서 수정해주세요.
        </p>

        <div className="space-y-3 mb-6">
          {companions.map((companion) => (
            <button
              key={companion}
              onClick={() => setSelectedCompanion(companion)}
              className={`w-full h-14 rounded-lg border-2 font-semibold text-lg transition-all ${
                selectedCompanion === companion
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-800 border-gray-300 hover:border-blue-400'
              }`}
            >
              {companion}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? '수정 중...' : '수정하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

