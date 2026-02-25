'use client';

import { useState, useEffect } from 'react';
import { FiStar, FiMessageSquare } from 'react-icons/fi';

interface FeedbackCollectionUIProps {
  tripName?: string;
  onFeedbackSubmit?: (feedback: { satisfaction: number; comment: string }) => void;
}

/**
 * 여행 피드백 수집 UI 컴포넌트
 * 50대 이상을 위한 큰 버튼 디자인
 */
export function FeedbackCollectionUI({
  tripName = '크루즈 여행',
  onFeedbackSubmit,
}: FeedbackCollectionUIProps) {
  const [step, setStep] = useState(0); // 0: 소개, 1: 만족도 선택, 2: 의견 입력
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSatisfactionSelect = (score: number) => {
    setSatisfaction(score);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!satisfaction) return;

    setIsSubmitting(true);
    try {
      if (onFeedbackSubmit) {
        onFeedbackSubmit({
          satisfaction,
          comment,
        });
      }
      // 제출 후 리셋
      setTimeout(() => {
        setStep(0);
        setSatisfaction(null);
        setComment('');
        setIsSubmitting(false);
      }, 1000);
    } catch (error) {
      console.error('피드백 제출 오류:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 shadow-lg">
      {step === 0 && (
        <div className="text-center space-y-6">
          <h2 className="text-3xl font-bold text-gray-900">
            ✨ {tripName}은 어땠나요?
          </h2>
          <p className="text-lg text-gray-700">
            당신의 소중한 의견은 더 나은 여행 서비스를 만드는 데 큰 도움이 됩니다.
          </p>
          <button
            onClick={() => setStep(1)}
            className="w-full px-8 py-4 bg-blue-600 text-white text-xl font-bold rounded-2xl hover:bg-blue-700 transition-colors"
          >
            피드백 작성하기
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <h3 className="text-2xl font-bold text-gray-900 text-center">
            여행 만족도는?
          </h3>
          <div className="grid grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                onClick={() => handleSatisfactionSelect(score)}
                className={`p-6 rounded-2xl text-center transition-all transform hover:scale-105 ${
                  satisfaction === score
                    ? 'bg-yellow-400 text-white shadow-lg scale-105'
                    : 'bg-white text-yellow-400 hover:bg-yellow-50'
                }`}
              >
                <div className="flex justify-center mb-2">
                  <FiStar size={32} fill="currentColor" />
                </div>
                <div className="text-xl font-bold">{score}</div>
                <div className="text-xs mt-1">
                  {score === 1 && '별로'}
                  {score === 2 && '그저그래'}
                  {score === 3 && '보통'}
                  {score === 4 && '좋아'}
                  {score === 5 && '최고!'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h3 className="text-2xl font-bold text-gray-900">
            더 이상 선택한 점수: {satisfaction}점 ⭐️
          </h3>
          <div className="space-y-4">
            <label className="block text-lg font-semibold text-gray-700">
              <FiMessageSquare size={24} className="inline mr-2" />
              개선할 점이 있으신가요? (선택사항)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="예: 음식이 맛있었으나 객실이 좀 더 크면 좋겠어요..."
              className="w-full px-6 py-4 border-2 border-gray-300 rounded-2xl text-lg focus:outline-none focus:border-blue-500 resize-none"
              rows={4}
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="flex-1 px-6 py-4 bg-gray-300 text-gray-900 text-lg font-bold rounded-2xl hover:bg-gray-400 transition-colors"
              disabled={isSubmitting}
            >
              이전
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 px-6 py-4 bg-blue-600 text-white text-lg font-bold rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '제출 중...' : '피드백 제출'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
