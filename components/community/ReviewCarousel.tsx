// components/community/ReviewCarousel.tsx
// 커뮤니티 페이지용 후기 캐러셀 (3개씩 보이도록, 좌우 이동)

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FiStar, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface Review {
  id: number;
  authorName: string;
  rating: number;
  title: string | null;
  content: string;
  images: string[];
  cruiseLine: string | null;
  shipName: string | null;
  travelDate: string | null;
  createdAt: string;
}

export default function ReviewCarousel() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemsPerPage = 3;

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      // 메인페이지와 같은 API 사용
      const response = await fetch('/api/public/reviews?limit=50');
      const data = await response.json();

      if (data.ok && Array.isArray(data.reviews)) {
        setReviews(data.reviews);
      }
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - itemsPerPage));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(reviews.length - itemsPerPage, prev + itemsPerPage));
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, index) => (
      <FiStar
        key={index}
        className={index < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
        size={16}
      />
    ));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow-sm">
        <p className="text-gray-600">등록된 후기가 없습니다.</p>
      </div>
    );
  }

  const visibleReviews = reviews.slice(currentIndex, currentIndex + itemsPerPage);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex + itemsPerPage < reviews.length;

  return (
    <div className="relative">
      {/* 좌우 이동 버튼 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrev}
          disabled={!canGoPrev}
          className={`p-2 rounded-full transition-colors ${canGoPrev
              ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
        >
          <FiChevronLeft size={24} />
        </button>
        <div className="text-sm text-gray-600">
          {currentIndex + 1}-{Math.min(currentIndex + itemsPerPage, reviews.length)} / {reviews.length}
        </div>
        <button
          onClick={handleNext}
          disabled={!canGoNext}
          className={`p-2 rounded-full transition-colors ${canGoNext
              ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
        >
          <FiChevronRight size={24} />
        </button>
      </div>

      {/* 후기 그리드 */}
      <div className="grid md:grid-cols-3 gap-6">
        {visibleReviews.map((review, idx) => (
          <Link
            key={`review-${review.id}-${currentIndex}-${idx}`}
            href={`/community/reviews/${review.id}`}
            className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all border border-gray-100"
          >
            <div className="aspect-video bg-gray-200 relative overflow-hidden">
              {review.images && review.images.length > 0 ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={review.images[0]}
                  alt={review.title || '리뷰 이미지'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <span className="text-4xl">🚢</span>
                </div>
              )}
              <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded">
                <span className="text-yellow-500 text-sm">⭐ {review.rating}</span>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {review.cruiseLine && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {review.cruiseLine}
                  </span>
                )}
                {review.shipName && review.shipName !== review.cruiseLine && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {review.shipName}
                  </span>
                )}
              </div>
              <h3 className="font-bold text-gray-900 mb-2 line-clamp-2">
                {review.title || review.content.substring(0, 30) + '...'}
              </h3>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {review.content}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>👤 {review.authorName}</span>
                <span>{new Date(review.createdAt).toLocaleDateString('ko-KR')}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}







































