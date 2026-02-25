// app/community/reviews/page.tsx
// 크루즈 리뷰 전체보기 페이지

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiStar, FiChevronLeft, FiChevronRight, FiTrash2, FiEdit3 } from 'react-icons/fi';

interface Review {
  id: number;
  authorName: string;
  title?: string;
  content: string;
  images: string[];
  rating: number;
  cruiseLine?: string;
  shipName?: string;
  travelDate?: string;
  createdAt: string;
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReviews, setTotalReviews] = useState(0);
  const reviewsPerPage = 12;
  const [isAdminUser, setIsAdminUser] = useState(false); // user1~user10 관리자 확인
  const [isLoggedIn, setIsLoggedIn] = useState(false); // 로그인 상태 확인
  const [imageAspects, setImageAspects] = useState<Record<number, 'portrait' | 'landscape'>>({});

  useEffect(() => {
    // 로그인 상태 확인 (커뮤니티 전용)
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        // 커뮤니티 사용자 또는 관리자인지 확인
        setIsLoggedIn(data.ok && data.user && (data.user.role === 'community' || data.user.role === 'admin'));
        
        // 관리자 user1~user10 확인
        const adminUser = data.ok && data.user && data.user.role === 'admin' && 
          data.user.phone && /^user(1[0]|[1-9])$/.test(data.user.phone);
        console.log('[Reviews Page] Admin check - ok:', data.ok);
        console.log('[Reviews Page] Admin check - role:', data.user?.role);
        console.log('[Reviews Page] Admin check - phone:', data.user?.phone);
        console.log('[Reviews Page] Admin check - isAdminUser:', !!adminUser);
        console.log('[Reviews Page] Admin check - full user data:', JSON.stringify(data.user, null, 2));
        setIsAdminUser(!!adminUser);
      })
      .catch(() => {
        setIsLoggedIn(false);
        setIsAdminUser(false);
      });
    
    loadReviews(currentPage);
  }, [currentPage]);

  const loadReviews = async (page: number) => {
    try {
      setLoading(true);
      // 페이지네이션을 위한 API 호출
      const response = await fetch(`/api/public/reviews?limit=1000`); // 전체 개수를 알기 위해 큰 limit
      const data = await response.json();

      if (data.ok && Array.isArray(data.reviews)) {
        const total = data.reviews.length;
        setTotalReviews(total);
        setTotalPages(Math.ceil(total / reviewsPerPage));
        
        // 현재 페이지에 해당하는 리뷰만 추출
        const startIndex = (page - 1) * reviewsPerPage;
        const endIndex = startIndex + reviewsPerPage;
        const paginatedReviews = data.reviews.slice(startIndex, endIndex);
        setReviews(paginatedReviews);
      }
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDeleteReview = async (reviewId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('정말 이 리뷰를 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/community/reviews/${reviewId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      const data = await response.json();
      if (data.ok) {
        alert('리뷰가 삭제되었습니다.');
        // 리뷰 목록에서 제거
        setReviews(reviews.filter(r => r.id !== reviewId));
        setTotalReviews(totalReviews - 1);
      } else {
        alert(data.error || '리뷰 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete review:', error);
      alert('리뷰 삭제 중 오류가 발생했습니다.');
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-7xl mx-auto">
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

          {/* 헤더 */}
          <div className="text-center mb-12 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1"></div>
              <div className="flex-1">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
                  크루즈 리뷰 전체보기
                </h1>
              </div>
              <div className="flex-1 flex justify-end">
                {/* 후기쓰기 버튼 - 로그인한 유저에게만 표시 */}
                {isLoggedIn ? (
                  <a
                    href="/community/reviews/write"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-blue-600 text-white text-sm md:text-base font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                  >
                    <FiEdit3 size={18} className="md:w-5 md:h-5" />
                    <span className="hidden sm:inline">후기쓰기</span>
                    <span className="sm:hidden">작성</span>
                  </a>
                ) : (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 max-w-xs">
                    <p className="text-blue-800 text-xs font-semibold mb-2">
                      후기 작성을 위해 로그인이 필요합니다.
                    </p>
                    <div className="flex gap-2">
                      <Link
                        href="/signup"
                        className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition-colors"
                      >
                        회원가입
                      </Link>
                      <Link
                        href="/community/login"
                        className="px-3 py-1 bg-white text-blue-600 text-xs font-semibold rounded border border-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        로그인
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xl text-gray-600">
              실제 고객들이 남긴 생생한 크루즈 여행 후기를 만나보세요
            </p>
          </div>

          {/* 리뷰 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
            {reviews.map((review) => (
              <Link
                key={review.id}
                href={`/community/reviews/${review.id}`}
                className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all border border-gray-100 group"
              >
                <div 
                  className={`bg-gray-200 relative overflow-hidden ${
                    imageAspects[review.id] === 'portrait' 
                      ? 'aspect-[3/4]' 
                      : 'aspect-video'
                  }`}
                >
                  {review.images && review.images.length > 0 ? (
                    <img
                      src={review.images[0]}
                      alt={review.title || '리뷰 이미지'}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      style={{ imageOrientation: 'from-image' }}
                      onLoad={(e) => {
                        const img = e.target as HTMLImageElement;
                        const isPortrait = img.naturalHeight > img.naturalWidth;
                        if (isPortrait) {
                          setImageAspects(prev => ({ ...prev, [review.id]: 'portrait' }));
                        }
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <span className="text-4xl">🚢</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex items-center gap-2">
                    <div className="bg-white/90 px-2 py-1 rounded flex items-center gap-1">
                      <FiStar className="text-yellow-500 fill-yellow-500" size={14} />
                      <span className="text-yellow-600 text-sm font-semibold">{review.rating}</span>
                    </div>
                    {/* 삭제 버튼 (관리자 user1~user10인 경우만) */}
                    {isAdminUser && (
                      <button
                        onClick={(e) => handleDeleteReview(review.id, e)}
                        className="bg-white/90 hover:bg-red-50 p-2 rounded text-red-600 transition-colors"
                        title="리뷰 삭제"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {review.cruiseLine && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                        {review.cruiseLine}
                      </span>
                    )}
                    {review.shipName && (
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded font-medium">
                        {review.shipName}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 min-h-[3rem]">
                    {review.title || review.content.substring(0, 30) + '...'}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-3 min-h-[4rem]">
                    {review.content}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                    <span className="font-medium">👤 {review.authorName}</span>
                    <span>{new Date(review.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {/* 이전 페이지 버튼 */}
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`flex items-center justify-center w-10 h-10 rounded-lg border-2 transition-all ${
                  currentPage === 1
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-blue-500 text-blue-600 hover:bg-blue-50 hover:scale-105 active:scale-95'
                }`}
                aria-label="이전 페이지"
              >
                <FiChevronLeft size={20} />
              </button>

              {/* 페이지 번호 */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    // 현재 페이지 주변 2페이지씩만 표시
                    return (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 2 && page <= currentPage + 2)
                    );
                  })
                  .map((page, index, array) => {
                    // 이전 페이지와의 간격이 2 이상이면 ... 표시
                    const showEllipsis = index > 0 && page - array[index - 1] > 1;
                    return (
                      <div key={page} className="flex items-center gap-1">
                        {showEllipsis && (
                          <span className="px-2 text-gray-400">...</span>
                        )}
                        <button
                          onClick={() => handlePageChange(page)}
                          className={`w-10 h-10 rounded-lg border-2 font-semibold transition-all ${
                            currentPage === page
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-gray-200 text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50'
                          }`}
                        >
                          {page}
                        </button>
                      </div>
                    );
                  })}
              </div>

              {/* 다음 페이지 버튼 */}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`flex items-center justify-center w-10 h-10 rounded-lg border-2 transition-all ${
                  currentPage === totalPages
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-blue-500 text-blue-600 hover:bg-blue-50 hover:scale-105 active:scale-95'
                }`}
                aria-label="다음 페이지"
              >
                <FiChevronRight size={20} />
              </button>
            </div>
          )}

          {/* 페이지 정보 */}
          <div className="text-center mt-4 text-sm text-gray-600">
            전체 {totalReviews}개의 리뷰 중 {((currentPage - 1) * reviewsPerPage) + 1} - {Math.min(currentPage * reviewsPerPage, totalReviews)}개 표시
          </div>
        </div>
      </div>
    </div>
  );
}










