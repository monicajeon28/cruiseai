// app/community/reviews/[id]/page.tsx
// 리뷰 상세 페이지

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiStar, FiChevronLeft, FiChevronRight, FiX, FiZoomIn, FiTrash2 } from 'react-icons/fi';
import Image from 'next/image';

interface Review {
  id: number;
  authorName: string;
  title: string;
  content: string;
  images: string[];
  rating: number;
  cruiseLine: string | null;
  shipName: string | null;
  travelDate: string | null;
  createdAt: string;
  isApproved?: boolean; // 승인 상태
}

export default function ReviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [prevReviewId, setPrevReviewId] = useState<number | null>(null);
  const [nextReviewId, setNextReviewId] = useState<number | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAdminUser, setIsAdminUser] = useState(false); // user1~user10 관리자 확인

  useEffect(() => {
    if (!params.id) return;

    // 관리자 user1~user10 확인
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        const adminUser = data.ok && data.user && data.user.role === 'admin' && 
          data.user.phone && /^user(1[0]|[1-9])$/.test(data.user.phone);
        setIsAdminUser(!!adminUser);
      })
      .catch(() => {
        setIsAdminUser(false);
      });

    const loadReview = async () => {
      try {
        // 먼저 DB에서 조회
        const response = await fetch(`/api/community/reviews/${params.id}`);
        const data = await response.json();

        if (data.ok && data.review) {
          setReview({
            ...data.review,
            images: Array.isArray(data.review.images) ? data.review.images : []
          });
          setPrevReviewId(data.prevReviewId || null);
          setNextReviewId(data.nextReviewId || null);
        } else {
          // DB에 없으면 샘플 데이터에서 찾기
          try {
            const sampleResponse = await fetch('/api/public/reviews?limit=50');
            const sampleData = await sampleResponse.json();
            const foundReview = sampleData.reviews?.find((r: Review) => r.id === parseInt(params.id as string));
            
            if (foundReview) {
              setReview({
                ...foundReview,
                images: Array.isArray(foundReview.images) ? foundReview.images : []
              });
            } else {
              setError('리뷰를 찾을 수 없습니다.');
            }
          } catch (sampleErr) {
            console.error('Failed to load sample reviews:', sampleErr);
            setError('리뷰를 불러오는데 실패했습니다.');
          }
        }
      } catch (err) {
        console.error('Failed to load review:', err);
        setError('리뷰를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadReview();
  }, [params.id]);

  // 이미지 모달 키보드 이벤트 처리
  useEffect(() => {
    if (!imageModalOpen || !review?.images) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setImageModalOpen(false);
      } else if (e.key === 'ArrowLeft' && review.images && review.images.length > 1) {
        setCurrentImageIndex((prev) => 
          prev === 0 ? review.images.length - 1 : prev - 1
        );
      } else if (e.key === 'ArrowRight' && review.images && review.images.length > 1) {
        setCurrentImageIndex((prev) => 
          prev === review.images.length - 1 ? 0 : prev + 1
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageModalOpen, review?.images]);

  const handleDeleteReview = async () => {
    if (!review) return;
    
    if (!confirm('정말 이 리뷰를 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/community/reviews/${params.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      const data = await response.json();
      if (data.ok) {
        alert('리뷰가 삭제되었습니다.');
        router.push('/community/reviews');
      } else {
        alert(data.error || '리뷰 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete review:', error);
      alert('리뷰 삭제 중 오류가 발생했습니다.');
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, index) => (
      <FiStar
        key={index}
        className={index < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
        size={24}
      />
    ));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !review) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <Link
                href="/community"
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
              >
                <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" size={20} />
                <span className="font-medium">목록으로</span>
              </Link>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <p className="text-red-600 mb-4">{error || '리뷰를 찾을 수 없습니다.'}</p>
              <Link
                href="/community"
                className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                리뷰 목록으로 돌아가기
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white relative">
      {/* 이전/다음 후기 이동 버튼 */}
      <div className="fixed left-2 md:left-4 top-1/2 -translate-y-1/2 z-20">
        {prevReviewId ? (
          <Link
            href={`/community/reviews/${prevReviewId}`}
            className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 bg-white hover:bg-blue-50 rounded-full shadow-xl border-2 border-blue-500 hover:border-blue-600 transition-all transform hover:scale-110 active:scale-95 group"
            aria-label="이전 후기"
          >
            <FiChevronLeft className="w-7 h-7 md:w-8 md:h-8 text-blue-600 group-hover:text-blue-700" />
          </Link>
        ) : (
          <div className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 bg-gray-100 rounded-full shadow-lg border-2 border-gray-300 opacity-50 cursor-not-allowed">
            <FiChevronLeft className="w-7 h-7 md:w-8 md:h-8 text-gray-400" />
          </div>
        )}
      </div>

      <div className="fixed right-2 md:right-4 top-1/2 -translate-y-1/2 z-20">
        {nextReviewId ? (
          <Link
            href={`/community/reviews/${nextReviewId}`}
            className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 bg-white hover:bg-blue-50 rounded-full shadow-xl border-2 border-blue-500 hover:border-blue-600 transition-all transform hover:scale-110 active:scale-95 group"
            aria-label="다음 후기"
          >
            <FiChevronRight className="w-7 h-7 md:w-8 md:h-8 text-blue-600 group-hover:text-blue-700" />
          </Link>
        ) : (
          <div className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 bg-gray-100 rounded-full shadow-lg border-2 border-gray-300 opacity-50 cursor-not-allowed">
            <FiChevronRight className="w-7 h-7 md:w-8 md:h-8 text-gray-400" />
          </div>
        )}
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* 이전으로 가기 */}
          <div className="mb-6">
            <Link
              href="/community"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
            >
              <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" size={20} />
              <span className="font-medium">목록으로</span>
            </Link>
          </div>

          {/* 리뷰 상세 */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
            {/* 이미지 갤러리 */}
            {review.images && review.images.length > 0 && (
              <div className="relative h-96 bg-gray-100 group cursor-pointer" onClick={() => {
                setCurrentImageIndex(0);
                setImageModalOpen(true);
              }}>
                <img
                  src={review.images[0]}
                  alt={review.title}
                  className="w-full h-full object-contain"
                  style={{ imageOrientation: 'from-image' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200';
                  }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                  <FiZoomIn className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            )}

            {/* 리뷰 내용 */}
            <div className="p-8">
              {/* 헤더 */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h1 className="text-3xl font-bold text-gray-900">{review.title}</h1>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {renderStars(review.rating)}
                      <span className="text-lg font-semibold text-gray-700 ml-2">
                        {review.rating}.0
                      </span>
                    </div>
                    {/* 삭제 버튼 (관리자 user1~user10인 경우) */}
                    {isAdminUser && (
                      <button
                        onClick={handleDeleteReview}
                        className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="관리자 권한으로 삭제"
                      >
                        <FiTrash2 size={18} />
                        <span className="text-sm font-medium">삭제</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 작성자 및 여행 정보 */}
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                  <span className="flex items-center gap-1">
                    <span>👤</span>
                    <span className="font-medium">{review.authorName}</span>
                  </span>
                  {review.cruiseLine && (
                    <span className="flex items-center gap-1">
                      <span>🚢</span>
                      <span>{review.cruiseLine}</span>
                    </span>
                  )}
                  {review.shipName && (
                    <span className="flex items-center gap-1">
                      <span>{review.shipName}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <span>📅</span>
                    <span>{new Date(review.createdAt).toLocaleDateString('ko-KR')}</span>
                  </span>
                </div>
              </div>

              {/* 본문 */}
              <div className="prose max-w-none mb-8">
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {review.content}
                </p>
              </div>

              {/* 추가 이미지 */}
              {review.images && review.images.length > 1 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
                  {review.images.slice(1).map((image, index) => (
                    <div 
                      key={index} 
                      className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group cursor-pointer"
                      onClick={() => {
                        setCurrentImageIndex(index + 1);
                        setImageModalOpen(true);
                      }}
                    >
                      <img
                        src={image}
                        alt={`${review.title} - 이미지 ${index + 2}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                        <FiZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 관련 리뷰 링크 */}
          <div className="mt-8 text-center">
            <Link
              href="/community/reviews"
              className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              더 많은 리뷰 보기
            </Link>
          </div>
        </div>
      </div>

      {/* 이미지 모달 (크게 보기) */}
      {imageModalOpen && review.images && review.images.length > 0 && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setImageModalOpen(false)}
        >
          {/* 닫기 버튼 */}
          <button
            onClick={() => setImageModalOpen(false)}
            className="absolute top-4 right-4 z-10 w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
            aria-label="닫기"
          >
            <FiX className="w-6 h-6 text-white" />
          </button>

          {/* 이미지 컨테이너 */}
          <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {/* 이전 이미지 버튼 */}
            {review.images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) => 
                    prev === 0 ? review.images.length - 1 : prev - 1
                  );
                }}
                className="absolute left-4 md:left-8 w-14 h-14 md:w-16 md:h-16 bg-white/90 hover:bg-white rounded-full shadow-lg border-2 border-gray-200 hover:border-blue-500 transition-all transform hover:scale-110 active:scale-95 flex items-center justify-center z-10"
                aria-label="이전 이미지"
              >
                <FiChevronLeft className="w-7 h-7 md:w-8 md:h-8 text-gray-700" />
              </button>
            )}

            {/* 현재 이미지 */}
            <div className="relative max-w-full max-h-full flex items-center justify-center">
              <img
                src={review.images[currentImageIndex]}
                alt={`${review.title} - 이미지 ${currentImageIndex + 1}`}
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200';
                }}
              />
              {/* 이미지 인덱스 표시 */}
              {review.images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm font-medium">
                  {currentImageIndex + 1} / {review.images.length}
                </div>
              )}
            </div>

            {/* 다음 이미지 버튼 */}
            {review.images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) => 
                    prev === review.images.length - 1 ? 0 : prev + 1
                  );
                }}
                className="absolute right-4 md:right-8 w-14 h-14 md:w-16 md:h-16 bg-white/90 hover:bg-white rounded-full shadow-lg border-2 border-gray-200 hover:border-blue-500 transition-all transform hover:scale-110 active:scale-95 flex items-center justify-center z-10"
                aria-label="다음 이미지"
              >
                <FiChevronRight className="w-7 h-7 md:w-8 md:h-8 text-gray-700" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

