// app/community/reviews/[id]/edit/page.tsx
// 크루즈 후기 수정 페이지

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { FiArrowLeft, FiX } from 'react-icons/fi';

interface Review {
  id: number;
  title: string;
  content: string;
  rating: number;
  cruiseLine: string | null;
  shipName: string | null;
  travelDate: string | null;
  images: string[];
}

export default function ReviewEditPage() {
  const router = useRouter();
  const params = useParams();
  const reviewId = params?.id as string;
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<Review | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    rating: 5,
    cruiseLine: '',
    shipName: '',
    travelDate: '',
    images: [] as string[]
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  useEffect(() => {
    if (!reviewId) return;

    // 로그인 상태 확인
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.user && (data.user.role === 'community' || data.user.role === 'admin')) {
          setIsLoggedIn(true);
          setIsAdmin(data.user.role === 'admin');
          // 리뷰 데이터 로드
          loadReview();
        } else {
          router.push(`/community/login?next=/community/reviews/${reviewId}/edit`);
        }
        setLoading(false);
      })
      .catch(() => {
        router.push(`/community/login?next=/community/reviews/${reviewId}/edit`);
        setLoading(false);
      });
  }, [reviewId, router]);

  const loadReview = async () => {
    try {
      const response = await fetch(`/api/community/reviews/${reviewId}`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (!response.ok || !data.ok || !data.review) {
        setError('리뷰를 불러올 수 없습니다.');
        return;
      }

      const reviewData = data.review;
      setReview(reviewData);
      setFormData({
        title: reviewData.title || '',
        content: reviewData.content || '',
        rating: reviewData.rating || 5,
        cruiseLine: reviewData.cruiseLine || '',
        shipName: reviewData.shipName || '',
        travelDate: reviewData.travelDate ? new Date(reviewData.travelDate).toISOString().split('T')[0] : '',
        images: reviewData.images || []
      });
      setImagePreviews(reviewData.images || []);
    } catch (err) {
      setError('리뷰를 불러오는 중 오류가 발생했습니다.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'rating' ? parseInt(value) : value
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + imagePreviews.length > 10) {
      alert('이미지는 최대 10개까지 업로드할 수 있습니다.');
      return;
    }

    const newFiles = [...imageFiles, ...files];
    setImageFiles(newFiles);

    // 미리보기 생성
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setImagePreviews([...imagePreviews, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    const newFiles = imageFiles.filter((_, i) => i !== (index - (imagePreviews.length - imageFiles.length)));
    setImagePreviews(newPreviews);
    setImageFiles(newFiles);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // 이미지 업로드 (간단한 구현 - 실제로는 서버에 업로드 필요)
      const images = [...formData.images, ...imagePreviews.filter((_, i) => i >= formData.images.length)];

      const response = await fetch(`/api/community/reviews/${reviewId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title.trim(),
          content: formData.content.trim(),
          rating: formData.rating,
          cruiseLine: formData.cruiseLine.trim() || null,
          shipName: formData.shipName.trim() || null,
          travelDate: isAdmin ? (formData.travelDate || null) : null, // 관리자만 travelDate 수정 가능
          images: images
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.error || '리뷰 수정에 실패했습니다.');
        setSubmitting(false);
        return;
      }

      // 수정 성공 시 리뷰 상세 페이지로 이동
      router.push(`/community/reviews/${reviewId}`);
    } catch (err) {
      setError('리뷰 수정 중 오류가 발생했습니다.');
      setSubmitting(false);
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

  if (!isLoggedIn || !review) {
    return null; // 리다이렉트됨
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* 이전으로 가기 */}
          <div className="mb-6">
            <Link
              href={`/community/reviews/${reviewId}`}
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
            >
              <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" size={20} />
              <span className="font-medium">이전으로 가기</span>
            </Link>
          </div>

          {/* 헤더 */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">리뷰 수정</h1>
            <p className="text-gray-600">크루즈 여행 후기를 수정해주세요</p>
          </div>

          {/* 폼 */}
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                {error}
              </div>
            )}

            {/* 별점 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                별점 <span className="text-red-500">*</span>
              </label>
              <select
                name="rating"
                value={formData.rating}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              >
                <option value={5}>★★★★★ (5점)</option>
                <option value={4}>★★★★☆ (4점)</option>
                <option value={3}>★★★☆☆ (3점)</option>
                <option value={2}>★★☆☆☆ (2점)</option>
                <option value={1}>★☆☆☆☆ (1점)</option>
              </select>
            </div>

            {/* 제목 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="리뷰 제목을 입력하세요"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
            </div>

            {/* 내용 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                내용 <span className="text-red-500">*</span>
              </label>
              <textarea
                name="content"
                value={formData.content}
                onChange={handleChange}
                placeholder="리뷰 내용을 입력하세요"
                rows={10}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                required
              />
            </div>

            {/* 크루즈 정보 */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  크루즈 라인
                </label>
                <input
                  type="text"
                  name="cruiseLine"
                  value={formData.cruiseLine}
                  onChange={handleChange}
                  placeholder="예: MSC, 코스타, 로얄캐리비안"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  선박명
                </label>
                <input
                  type="text"
                  name="shipName"
                  value={formData.shipName}
                  onChange={handleChange}
                  placeholder="예: 벨리시마, 세레나"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* 여행 날짜 (관리자만 수정 가능) */}
            {isAdmin && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  여행 날짜 (관리자 전용)
                </label>
                <input
                  type="date"
                  name="travelDate"
                  value={formData.travelDate}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">일반 사용자는 작성일이 자동으로 표시됩니다.</p>
              </div>
            )}

            {/* 이미지 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                사진 (최대 10개)
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              {imagePreviews.length > 0 && (
                <div className="mt-4 grid grid-cols-5 gap-4">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <Image
                        src={preview}
                        alt={`미리보기 ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 20vw, 10vw"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                      >
                        <FiX size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 제출 버튼 */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '수정 중...' : '리뷰 수정하기'}
              </button>
              <Link
                href={`/community/reviews/${reviewId}`}
                className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors text-center"
              >
                취소
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

