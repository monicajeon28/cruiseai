// components/mall/ProductReviews.tsx
// 상품 리뷰 목록 컴포넌트

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiStar, FiArrowLeft } from 'react-icons/fi';
import Link from 'next/link';

interface ProductReviewsProps {
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

export default function ProductReviews({
  productCode,
  productName,
  cruiseLine,
  shipName,
  rating,
  reviewCount,
}: ProductReviewsProps) {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 리뷰 데이터 가져오기
    const fetchReviews = async () => {
      try {
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
    };

    fetchReviews();
  }, [productCode]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href={`/products/${productCode}`}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FiArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{productName}</h1>
              <p className="text-sm text-gray-600 mt-1">
                {cruiseLine} · {shipName}
              </p>
            </div>
          </div>

          {/* 별점과 리뷰 개수 */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <FiStar className="text-yellow-400 fill-yellow-400" size={24} />
              <span className="text-2xl font-black text-gray-900">{rating.toFixed(1)}</span>
            </div>
            <span className="text-lg text-gray-600 font-semibold">
              이용자 리뷰 {reviewCount.toLocaleString('ko-KR')}개
            </span>
          </div>
        </div>

        {/* 리뷰 목록 */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">리뷰를 불러오는 중...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600">리뷰가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {review.authorName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{review.authorName}</div>
                      <div className="flex items-center gap-1 mt-1">
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
                  <span className="text-xs text-gray-500">
                    {new Date(review.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <p className="text-gray-700 leading-relaxed">{review.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



