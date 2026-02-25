// app/community/reviews/write/page.tsx
// 크루즈 후기 작성 페이지

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiX } from 'react-icons/fi';

export default function ReviewWritePage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    rating: 5,
    cruiseLine: '',
    shipName: '',
    images: [] as string[],
    mainImageIndex: 0, // 메인 사진 인덱스
    authorName: '' // 관리자용 닉네임 선택
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  
  // 크루즈 라인/선박명 검색 관련
  const [cruiseLineSearch, setCruiseLineSearch] = useState('');
  const [shipNameSearch, setShipNameSearch] = useState('');
  const [cruiseLineSuggestions, setCruiseLineSuggestions] = useState<string[]>([]);
  const [shipNameSuggestions, setShipNameSuggestions] = useState<string[]>([]);
  const [cruiseData, setCruiseData] = useState<Array<{cruise_line: string; ships: string[]}>>([]);

  useEffect(() => {
    // 로그인 상태 확인 (커뮤니티 전용)
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.user) {
          // 커뮤니티 사용자 또는 관리자인지 확인
          if (data.user.role === 'community' || data.user.role === 'admin') {
            setIsLoggedIn(true);
            setIsAdmin(data.user.role === 'admin');
          } else {
            // 지니 가이드 사용자는 커뮤니티 로그인으로 리다이렉트
            router.push('/community/login?next=/community/reviews/write');
          }
        } else {
          router.push('/community/login?next=/community/reviews/write');
        }
        setLoading(false);
      })
      .catch(() => {
        router.push('/community/login?next=/community/reviews/write');
        setLoading(false);
      });
    
    // 크루즈 데이터 로드
    import('@/data/cruise_ships.json')
      .then((module) => {
        setCruiseData(module.default);
      })
      .catch((error) => console.error('Failed to load cruise ships data:', error));
  }, [router]);
  
  // 크루즈 라인 검색
  useEffect(() => {
    if (cruiseLineSearch.length > 0) {
      const searchTerm = cruiseLineSearch.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
      const suggestions = cruiseData
        .map(line => line.cruise_line)
        .filter(line => {
          const cleaned = line.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
          return cleaned.includes(searchTerm);
        })
        .slice(0, 10);
      setCruiseLineSuggestions(suggestions);
    } else {
      setCruiseLineSuggestions([]);
    }
  }, [cruiseLineSearch, cruiseData]);
  
  // 선박명 검색 (선택된 크루즈 라인에 따라 필터링)
  useEffect(() => {
    if (shipNameSearch.length > 0) {
      const searchTerm = shipNameSearch.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
      let ships: string[] = [];
      
      if (formData.cruiseLine) {
        // 선택된 크루즈 라인의 선박만 검색
        const selectedLine = cruiseData.find(line => line.cruise_line === formData.cruiseLine);
        if (selectedLine) {
          ships = selectedLine.ships;
        }
      } else {
        // 크루즈 라인이 선택되지 않았으면 모든 선박 검색
        cruiseData.forEach(line => {
          ships.push(...line.ships);
        });
      }
      
      const suggestions = ships
        .filter(ship => {
          const cleaned = ship.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
          return cleaned.includes(searchTerm);
        })
        .slice(0, 10);
      setShipNameSuggestions(suggestions);
    } else {
      setShipNameSuggestions([]);
    }
  }, [shipNameSearch, formData.cruiseLine, cruiseData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleRatingChange = (rating: number) => {
    setFormData({
      ...formData,
      rating
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + imageFiles.length > 10) {
      setError('사진은 최대 10장까지 업로드할 수 있습니다.');
      return;
    }

    const newFiles = [...imageFiles, ...files];
    setImageFiles(newFiles);

    // 미리보기 생성
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    setImagePreviews(newPreviews);
  };

  const removeImage = (index: number) => {
    const newFiles = imageFiles.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImageFiles(newFiles);
    setImagePreviews(newPreviews);
    
    // 메인 사진 인덱스 조정
    if (formData.mainImageIndex === index) {
      setFormData({ ...formData, mainImageIndex: 0 });
    } else if (formData.mainImageIndex > index) {
      setFormData({ ...formData, mainImageIndex: formData.mainImageIndex - 1 });
    }
  };
  
  const setMainImage = (index: number) => {
    setFormData({ ...formData, mainImageIndex: index });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }

    if (!formData.content.trim()) {
      setError('내용을 입력해주세요.');
      return;
    }

    if (formData.rating < 1 || formData.rating > 5) {
      setError('별점을 선택해주세요.');
      return;
    }

    setSubmitting(true);

    try {
      // 이미지 업로드 처리
      const imageUrls: string[] = [];
      if (imageFiles.length > 0) {
        for (const file of imageFiles) {
          const uploadFormData = new FormData();
          uploadFormData.append('file', file);
          uploadFormData.append('type', 'review'); // 리뷰 이미지임을 표시
          
          const uploadRes = await fetch('/api/community/upload', {
            method: 'POST',
            credentials: 'include',
            body: uploadFormData,
          });
          
          const uploadData = await uploadRes.json();
          if (uploadData.ok && uploadData.url) {
            imageUrls.push(uploadData.url);
          } else {
            console.error('이미지 업로드 실패:', uploadData.error);
            setError(`이미지 업로드에 실패했습니다: ${uploadData.error || '알 수 없는 오류'}`);
            setSubmitting(false);
            return;
          }
        }
      }

      const response = await fetch('/api/community/reviews', {
        method: 'POST',
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
          images: imageUrls,
          mainImageIndex: formData.mainImageIndex,
          authorName: isAdmin && formData.authorName ? formData.authorName.trim() : undefined // 관리자만 닉네임 지정 가능
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.error || '후기 작성에 실패했습니다.');
        setSubmitting(false);
        return;
      }

      // 작성 성공 시 메시지 표시
      if (data.review?.message) {
        alert(data.review.message);
      } else {
        alert('후기가 등록되었습니다.');
      }

      // 작성 성공 시 후기 상세 페이지 또는 목록으로 이동
      router.push(`/community/reviews/${data.review.id}`);
    } catch (err) {
      setError('후기 작성 중 오류가 발생했습니다.');
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

  if (!isLoggedIn) {
    return null; // 로그인 페이지로 리다이렉트됨
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-8">
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

          {/* 후기 작성 폼 */}
          <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">크루즈 후기 작성</h1>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 별점 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  별점 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRatingChange(star)}
                      className={`text-4xl transition-transform hover:scale-110 ${
                        star <= formData.rating ? 'text-yellow-400' : 'text-gray-300'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-2">{formData.rating}점 선택됨</p>
              </div>

              {/* 크루즈 정보 */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    크루즈 라인
                  </label>
                  <input
                    type="text"
                    value={cruiseLineSearch || formData.cruiseLine}
                    onChange={(e) => {
                      setCruiseLineSearch(e.target.value);
                      if (!e.target.value) {
                        setFormData({ ...formData, cruiseLine: '', shipName: '' });
                        setShipNameSearch('');
                      }
                    }}
                    placeholder="예: MSC, 코스타, 로얄캐리비안"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  {cruiseLineSuggestions.length > 0 && (
                    <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-lg">
                      {cruiseLineSuggestions.map((line) => (
                        <li
                          key={line}
                          onClick={() => {
                            setFormData({ ...formData, cruiseLine: line, shipName: '' });
                            setCruiseLineSearch(line);
                            setShipNameSearch('');
                            setCruiseLineSuggestions([]);
                          }}
                          className="px-4 py-2 cursor-pointer hover:bg-blue-50 text-gray-900"
                        >
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    선박명
                  </label>
                  <input
                    type="text"
                    value={shipNameSearch || formData.shipName}
                    onChange={(e) => {
                      setShipNameSearch(e.target.value);
                      if (!e.target.value) {
                        setFormData({ ...formData, shipName: '' });
                      }
                    }}
                    placeholder="예: 벨리시마, 세레나"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    disabled={!formData.cruiseLine}
                  />
                  {shipNameSuggestions.length > 0 && (
                    <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-lg">
                      {shipNameSuggestions.map((ship) => (
                        <li
                          key={ship}
                          onClick={() => {
                            setFormData({ ...formData, shipName: ship });
                            setShipNameSearch(ship);
                            setShipNameSuggestions([]);
                          }}
                          className="px-4 py-2 cursor-pointer hover:bg-blue-50 text-gray-900"
                        >
                          {ship}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!formData.cruiseLine && (
                    <p className="text-xs text-gray-500 mt-1">크루즈 라인을 먼저 선택해주세요</p>
                  )}
                </div>
              </div>

              {/* 관리자용 닉네임 선택 */}
              {isAdmin && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    작성자 닉네임 (관리자 전용)
                  </label>
                  <input
                    type="text"
                    name="authorName"
                    value={formData.authorName}
                    onChange={handleChange}
                    placeholder="다른 닉네임으로 작성하려면 입력하세요 (비워두면 본인 닉네임 사용)"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    관리자는 다른 사용자의 닉네임으로 후기를 작성할 수 있습니다.
                  </p>
                </div>
              )}

              {/* 제목 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="후기 제목을 입력해주세요"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  required
                />
              </div>

              {/* 내용 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  내용 <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  placeholder="여행 후기를 작성해주세요"
                  rows={10}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  required
                />
              </div>

              {/* 사진 업로드 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사진 (최대 10장)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="cursor-pointer inline-block px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    📷 사진 선택
                  </label>
                  <p className="text-sm text-gray-500 mt-2">
                    {imageFiles.length}장 선택됨
                  </p>
                </div>

                {/* 이미지 미리보기 */}
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative aspect-square group">
                        <img
                          src={preview}
                          alt={`미리보기 ${index + 1}`}
                          className={`w-full h-full object-cover rounded-lg ${
                            formData.mainImageIndex === index 
                              ? 'ring-4 ring-blue-500' 
                              : 'opacity-75 group-hover:opacity-100'
                          }`}
                        />
                        {formData.mainImageIndex === index && (
                          <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded font-semibold">
                            메인
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <FiX size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setMainImage(index)}
                          className="absolute bottom-2 left-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded hover:bg-black/90 transition-colors"
                        >
                          {formData.mainImageIndex === index ? '메인 사진' : '메인으로 설정'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? '작성 중...' : '후기 작성하기'}
                </button>
                <Link
                  href="/community"
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}











