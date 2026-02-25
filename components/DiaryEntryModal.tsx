'use client';

import { useState } from 'react';
import { FiX, FiSave } from 'react-icons/fi';

interface DiaryEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryCode: string;
  countryName: string;
  tripId?: number;
  onSave?: () => void;
}

export default function DiaryEntryModal({
  isOpen,
  onClose,
  countryCode,
  countryName,
  tripId,
  onSave,
}: DiaryEntryModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/diary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tripId,
          countryCode,
          countryName,
          title: title.trim(),
          content: content.trim(),
          visitDate,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        alert('여행 기록이 저장되었습니다! ✨');
        setTitle('');
        setContent('');
        setVisitDate(new Date().toISOString().split('T')[0]);
        onSave?.();
        onClose();
      } else {
        alert(`저장 실패: ${data.message || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('Diary save error:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">✏️ 여행 기록 남기기</h2>
            <p className="text-sm text-gray-600 mt-1">{countryName}의 추억을 기록하세요</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="닫기"
          >
            <FiX size={28} />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 방문 날짜 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              방문 날짜
            </label>
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-base"
              required
            />
          </div>

          {/* 제목 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 맛있는 점심 식사, 아름다운 풍경..."
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-base"
              maxLength={100}
              required
            />
            <p className="text-xs text-gray-500 mt-1">{title.length}/100</p>
          </div>

          {/* 내용 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              기록 내용
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="오늘의 여행 경험을 자유롭게 적어보세요..."
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-base resize-none"
              rows={8}
              maxLength={2000}
              required
            />
            <p className="text-xs text-gray-500 mt-1">{content.length}/2000</p>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                '저장 중...'
              ) : (
                <>
                  <FiSave size={20} />
                  저장하기
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

