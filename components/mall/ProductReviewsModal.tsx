// components/mall/ProductReviewsModal.tsx
// 상품 리뷰 모달 컴포넌트

'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiStar, FiX } from 'react-icons/fi';

interface ProductReviewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  productCode: string;
  productName: string;
  cruiseLine: string;
  shipName: string;
  rating: number;
  reviewCount: number;
}

interface Review {
  id: number;
  authorName: string;
  rating: number;
  content: string;
  createdAt: string;
}

export default function ProductReviewsModal({
  isOpen,
  onClose,
  productCode,
  productName,
  cruiseLine,
  shipName,
  rating,
  reviewCount,
}: ProductReviewsModalProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    if (!productCode) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/products/${productCode}/reviews`);
      const data = await res.json();
      if (data.ok && data.reviews) {
        setReviews(data.reviews);
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
    } finally {
      setLoading(false);
    }
  }, [productCode]);

  useEffect(() => {
    if (isOpen) {
      fetchReviews();
    } else {
      // 모달 닫을 때 상태 초기화
      setReviews([]);
      setLoading(true);
    }
  }, [isOpen, fetchReviews]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // 모달 외부 클릭 시 닫기
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* 헤더 */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 pr-8">{productName}</h2>
              <p className="text-sm text-gray-600 mt-1">
                {cruiseLine} · {shipName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
              aria-label="닫기"
            >
              <FiX className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* 별점과 리뷰 개수 */}
          <div className="flex items-center gap-3 pt-4 mt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <FiStar className="text-yellow-400 fill-yellow-400" size={22} />
              <span className="text-xl font-black text-gray-900">{rating.toFixed(1)}</span>
            </div>
            <span className="text-base text-gray-600 font-semibold">
              이용자 리뷰 {reviewCount.toLocaleString('ko-KR')}개
            </span>
          </div>
        </div>

        {/* 리뷰 목록 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-500">리뷰를 불러오는 중...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">아직 리뷰가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-gray-50 rounded-xl p-5 border border-gray-100"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {review.authorName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">{review.authorName}</div>
                        <div className="flex items-center gap-0.5 mt-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <FiStar
                              key={star}
                              className={
                                star <= review.rating
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-gray-300'
                              }
                              size={14}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(review.createdAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <p className="text-gray-700 leading-relaxed text-sm">{review.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
