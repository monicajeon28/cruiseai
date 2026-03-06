// app/my-info/page.tsx
// 지니몰 내 정보 페이지

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiEdit2, FiTrash2, FiEye, FiMessageCircle, FiHeart, FiStar, FiSave, FiX } from 'react-icons/fi';
import { showError, showSuccess } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';

interface Post {
  id: number;
  title: string;
  content: string;
  category: string;
  views: number;
  likes: number;
  comments: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Review {
  id: number;
  title: string;
  content: string;
  rating: number;
  cruiseLine: string | null;
  shipName: string | null;
  travelDate: string | null;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

interface Comment {
  id: number;
  content: string;
  postId: number;
  postTitle: string;
  createdAt: string;
  updatedAt: string;
}

interface Trip {
  id: number;
  cruiseName: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  createdAt: string;
  CruiseProduct: {
    productCode: string;
    packageName: string;
    cruiseLine: string;
    shipName: string;
  } | null;
}

export default function MyInfoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ name: string | null; email: string | null; phone: string | null } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [error, setError] = useState('');
  
  // 편집 모드
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMyInfo();
  }, []);

  const fetchMyInfo = async () => {
    try {
      const response = await fetch('/api/community/my-info', {
        credentials: 'include'
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        if (response.status === 401) {
          router.push('/community/login?next=/my-info');
          return;
        }
        setError(data.error || '정보를 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
        return;
      }

      setUser(data.user);
      setEditName(data.user.name || '');
      setEditPhone(data.user.phone || '');
      setPosts(data.posts || []);
      setReviews(data.reviews || []);
      // API 응답의 comments를 프론트엔드 형식으로 변환
      setComments((data.comments || []).map((comment: any) => ({
        id: comment.id,
        content: comment.content,
        postId: comment.CommunityPost?.id || comment.postId,
        postTitle: comment.CommunityPost?.title || comment.postTitle || '게시글',
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt
      })));
      setTrips(data.trips || []);
    } catch (err) {
      setError('정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (!confirm('정말 이 게시글을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/community/posts/${postId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      if (data.ok) {
        setPosts(posts.filter(p => p.id !== postId));
      } else {
        showError(data.error || '게시글 삭제에 실패했습니다.');
      }
    } catch (error) {
      logger.error('Failed to delete post:', error);
      showError('게시글 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteReview = async (reviewId: number) => {
    if (!confirm('정말 이 리뷰를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/community/reviews/${reviewId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      if (response.ok && data.ok) {
        // 리뷰 목록에서 제거
        setReviews(reviews.filter(r => r.id !== reviewId));
        showSuccess('리뷰가 삭제되었습니다.');
      } else {
        showError(data.error || '리뷰 삭제에 실패했습니다.');
      }
    } catch (error) {
      logger.error('Failed to delete review:', error);
      showError('리뷰 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('정말 이 댓글을 삭제하시겠습니까?')) {
      return;
    }

    try {
      // 댓글이 속한 게시글 ID 찾기
      const comment = comments.find(c => c.id === commentId);
      if (!comment) return;

      const response = await fetch(`/api/community/posts/${comment.postId}/comments/${commentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      if (data.ok) {
        setComments(comments.filter(c => c.id !== commentId));
      } else {
        showError(data.error || '댓글 삭제에 실패했습니다.');
      }
    } catch (error) {
      logger.error('Failed to delete comment:', error);
      showError('댓글 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleSave = async () => {
    if (!editName.trim() || !editPhone.trim()) {
      showError('이름과 연락처를 모두 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/community/my-info/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: editName.trim(),
          phone: editPhone.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        showError(data.error || '정보 저장에 실패했습니다.');
        return;
      }

      showSuccess('정보가 저장되었습니다.');
      setIsEditing(false);
      fetchMyInfo();
    } catch (err) {
      showError('정보 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, { label: string; color: string }> = {
      'travel-tip': { label: '여행팁', color: 'bg-blue-100 text-blue-800' },
      'destination': { label: '관광지추천', color: 'bg-purple-100 text-purple-800' },
      'qna': { label: '질문 답변', color: 'bg-green-100 text-green-800' },
      'general': { label: '일반', color: 'bg-gray-100 text-gray-800' }
    };
    return labels[category] || labels['general'];
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

  if (error && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/" className="text-blue-600 hover:text-blue-700">
            메인페이지로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* 이전으로 가기 */}
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
            >
              <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" size={20} />
              <span className="font-medium">이전으로 가기</span>
            </Link>
          </div>

          {/* 헤더 */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              내 정보
            </h1>
            {user && (
              <div className="flex flex-col items-center gap-4">
                <p className="text-xl text-gray-600">
                  {user.name || '사용자'}님의 활동 내역입니다.
                </p>
              </div>
            )}
          </div>

          {/* 사용자 정보 섹션 - 항상 표시 */}
          <div className="mb-12 bg-white rounded-xl shadow-lg p-8 border-2 border-blue-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">👤 사용자 정보</h2>
              </div>
              {user && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FiEdit2 size={18} />
                  수정
                </button>
              )}
            </div>

            {!user ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">사용자 정보를 불러오는 중...</p>
              </div>
            ) : isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-base"
                    placeholder="이름을 입력하세요 (예: 홍길동)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    연락처 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-base"
                    placeholder="연락처를 입력하세요 (예: 010-1234-5678)"
                  />
                  <p className="text-xs text-gray-500 mt-1">하이픈(-) 없이 숫자만 입력해도 됩니다.</p>
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditName(user.name || '');
                      setEditPhone(user.phone || '');
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <FiX size={18} />
                    취소
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <FiSave size={18} />
                    {saving ? '저장 중...' : '저장하기'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <span className="text-gray-600 font-semibold text-base md:text-lg min-w-[100px]">이름:</span>
                  <span className="font-bold text-gray-900 text-base md:text-lg">{user.name || '미입력'}</span>
                </div>
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <span className="text-gray-600 font-semibold text-base md:text-lg min-w-[100px]">연락처:</span>
                  <span className="font-bold text-gray-900 text-base md:text-lg break-all">{user.phone || '미입력'}</span>
                </div>
                {user.email && (
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <span className="text-gray-600 font-semibold text-base md:text-lg min-w-[100px]">이메일:</span>
                    <span className="font-bold text-gray-900 text-base md:text-lg break-all">{user.email}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 내 게시글 섹션 */}
          <div className="mb-12 bg-white rounded-xl shadow-lg p-8 border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              내가 올린 게시글 ({posts.length}개)
            </h2>
            {posts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">아직 작성한 게시글이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => {
                  const categoryInfo = getCategoryLabel(post.category);
                  return (
                    <div
                      key={post.id}
                      className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${categoryInfo.color}`}>
                              {categoryInfo.label}
                            </span>
                            <Link
                              href={`/community/posts/${post.id}`}
                              className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                            >
                              {post.title}
                            </Link>
                          </div>
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{post.content}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <FiEye size={16} />
                              {post.views}
                            </span>
                            <span className="flex items-center gap-1">
                              <FiHeart size={16} />
                              {post.likes}
                            </span>
                            <span className="flex items-center gap-1">
                              <FiMessageCircle size={16} />
                              {post.commentCount || post.comments}
                            </span>
                            <span>
                              {new Date(post.createdAt).toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="삭제"
                          >
                            <FiTrash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 내 리뷰 섹션 */}
          <div className="mb-12 bg-white rounded-xl shadow-lg p-8 border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              내가 올린 리뷰 ({reviews.length}개)
            </h2>
            {reviews.length === 0 ? (
              <p className="text-gray-500 text-center py-8">아직 작성한 리뷰가 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <span
                                key={i}
                                className={`text-lg ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                              >
                                <FiStar size={18} fill={i < review.rating ? 'currentColor' : 'none'} />
                              </span>
                            ))}
                          </div>
                          <Link
                            href={`/community/reviews/${review.id}`}
                            className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                          >
                            {review.title}
                          </Link>
                        </div>
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{review.content}</p>
                        <div className="text-sm text-gray-500">
                          {review.cruiseLine && <span>크루즈 라인: {review.cruiseLine} </span>}
                          {review.shipName && <span>선박명: {review.shipName} </span>}
                          <span className="ml-4">
                            {new Date(review.createdAt).toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Link
                          href={`/community/reviews/${review.id}/edit`}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="수정"
                        >
                          <FiEdit2 size={18} />
                        </Link>
                        <button
                          onClick={() => handleDeleteReview(review.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="삭제"
                        >
                          <FiTrash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 내 댓글 섹션 */}
          <div className="mb-12 bg-white rounded-xl shadow-lg p-8 border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              내가 쓴 댓글 ({comments.length}개)
            </h2>
            {comments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">아직 작성한 댓글이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="mb-2">
                          <Link
                            href={`/community/posts/${comment.postId}`}
                            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                          >
                            {comment.postTitle}
                          </Link>
                        </div>
                        <p className="text-gray-700 mb-2">{comment.content}</p>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.createdAt).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="삭제"
                        >
                          <FiTrash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

