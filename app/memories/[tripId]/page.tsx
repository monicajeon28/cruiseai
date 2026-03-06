'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiArrowLeft, FiDownload, FiShare2, FiMapPin, FiDollarSign, FiBook, FiGlobe } from 'react-icons/fi';
import { logger } from '@/lib/logger';

/**
 * 여행 추억 리포트 페이지
 * 작업자 C (UX/기능 전문가) - 여행 후 UI
 * 공유하고 싶은 세련된 디자인
 */

interface MemoriesData {
  trip: {
    id: number;
    cruiseName: string | null;
    startDate: Date | null;
    endDate: Date | null;
    nights: number;
    days: number;
  };
  statistics: {
    totalExpense: number;
    expenseCount: number;
    expensesByCategory: Record<string, number>;
    expensesByCurrency: Record<string, number>;
    visitedCountries: number;
    portsVisited: number;
    diaryCount: number;
  };
  details: {
    ports: Array<{
      day: number;
      location: string | null;
      country: string | null;
      arrival: string | null;
      departure: string | null;
    }>;
    diaries: Array<{
      id: number;
      date: Date;
      location: string | null;
      content: string;
      photos: any;
    }>;
    visitedCountries: string[];
  };
}

export default function MemoriesPage({ params }: { params: { tripId: string } }) {
  const router = useRouter();
  const [memories, setMemories] = useState<MemoriesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMemories = async () => {
      try {
        const response = await fetch(`/api/trips/${params.tripId}/memories`, {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.memories) {
            setMemories(data.memories);
          }
        }
      } catch (error) {
        logger.error('Error loading memories:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMemories();
  }, [params.tripId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">추억을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!memories) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 text-xl mb-4">여행 정보를 찾을 수 없습니다</p>
          <button
            onClick={() => router.push('/profile')}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700"
          >
            프로필로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const { trip, statistics, details } = memories;

  // 카테고리별 지출 비율 계산
  const categoryData = Object.entries(statistics.expensesByCategory).map(([category, amount]) => ({
    category,
    amount,
    percentage: statistics.totalExpense > 0 ? (amount / statistics.totalExpense) * 100 : 0,
  })).sort((a, b) => b.amount - a.amount);

  const categoryLabels: Record<string, string> = {
    food: '🍔 식비',
    transport: '🚕 교통',
    shopping: '🛍️ 쇼핑',
    souvenir: '🎁 기념품',
    entertainment: '🎭 엔터테인먼트',
    other: '📝 기타',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* 헤더 */}
      <header className="bg-white/80 backdrop-blur-sm sticky top-0 z-20 border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium"
          >
            <FiArrowLeft size={22} />
            뒤로가기
          </button>
          
          <div className="flex gap-2">
            <button className="p-2 rounded-lg hover:bg-gray-100" title="다운로드">
              <FiDownload size={20} />
            </button>
            <button className="p-2 rounded-lg hover:bg-gray-100" title="공유하기">
              <FiShare2 size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* 타이틀 카드 */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl shadow-2xl p-8 sm:p-12 text-white">
          <div className="text-center">
            <span className="text-6xl sm:text-7xl mb-6 block">🚢</span>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">
              {trip.cruiseName || '크루즈 여행'}
            </h1>
            <p className="text-xl sm:text-2xl opacity-90">
              {trip.startDate && new Date(trip.startDate).toLocaleDateString('ko-KR', { 
                year: 'numeric', month: 'long', day: 'numeric' 
              })}
              {' ~ '}
              {trip.endDate && new Date(trip.endDate).toLocaleDateString('ko-KR', {
                year: 'numeric', month: 'long', day: 'numeric'
              })}
            </p>
            <p className="text-lg mt-2 opacity-75">
              {trip.nights}박 {trip.days}일의 특별한 추억
            </p>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<FiGlobe className="text-blue-600" size={28} />}
            value={statistics.visitedCountries}
            label="방문 국가"
            bgColor="bg-blue-50"
          />
          <StatCard
            icon={<FiMapPin className="text-green-600" size={28} />}
            value={statistics.portsVisited}
            label="기항지"
            bgColor="bg-green-50"
          />
          <StatCard
            icon={<FiDollarSign className="text-purple-600" size={28} />}
            value={`${(statistics.totalExpense / 10000).toFixed(0)}만원`}
            label="총 지출"
            bgColor="bg-purple-50"
          />
          <StatCard
            icon={<FiBook className="text-pink-600" size={28} />}
            value={statistics.diaryCount}
            label="다이어리"
            bgColor="bg-pink-50"
          />
        </div>

        {/* 방문 국가 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <FiGlobe className="text-blue-600" />
            방문한 나라들
          </h2>
          <div className="flex flex-wrap gap-3">
            {details.visitedCountries.map((country, idx) => (
              <div
                key={idx}
                className="px-6 py-3 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full text-gray-900 font-semibold text-lg shadow-sm"
              >
                {country}
              </div>
            ))}
          </div>
        </div>

        {/* 기항지 목록 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <FiMapPin className="text-green-600" />
            여행 일정
          </h2>
          <div className="space-y-4">
            {details.ports.map((port, idx) => (
              <div
                key={idx}
                className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="flex-shrink-0 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-green-700">Day {port.day}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">{port.location}</h3>
                  <p className="text-gray-600">{port.country}</p>
                  {port.arrival && port.departure && (
                    <p className="text-sm text-gray-500 mt-1">
                      🕐 {port.arrival} ~ {port.departure}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 가계부 차트 */}
        {categoryData.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <FiDollarSign className="text-purple-600" />
              지출 분석
            </h2>
            
            {/* 총액 */}
            <div className="mb-6 p-6 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl text-center">
              <p className="text-gray-700 mb-2">총 지출 금액</p>
              <p className="text-4xl sm:text-5xl font-bold text-purple-700">
                {statistics.totalExpense.toLocaleString()} 원
              </p>
            </div>

            {/* 카테고리별 바 차트 */}
            <div className="space-y-4">
              {categoryData.map((cat, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-700 text-lg">
                      {categoryLabels[cat.category] || cat.category}
                    </span>
                    <span className="text-gray-900 font-bold">
                      {cat.amount.toLocaleString()} 원
                    </span>
                  </div>
                  <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-1 text-right">
                    {cat.percentage.toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 다이어리 */}
        {details.diaries.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <FiBook className="text-pink-600" />
              여행 다이어리
            </h2>
            <div className="space-y-6">
              {details.diaries.map((diary, idx) => (
                <div key={idx} className="border-l-4 border-pink-400 pl-6 py-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <FiMapPin size={16} />
                    <span className="font-medium">{diary.location}</span>
                    <span>·</span>
                    <span>{new Date(diary.date).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <p className="text-gray-700 leading-relaxed text-lg whitespace-pre-wrap">
                    {diary.content}
                  </p>
                  {/* 사진 갤러리 */}
                  {(() => {
                    let photos: string[] = [];
                    if (Array.isArray(diary.photos)) {
                      photos = diary.photos.filter((p: unknown) => typeof p === 'string');
                    } else if (typeof diary.photos === 'string') {
                      try {
                        const parsed = JSON.parse(diary.photos);
                        if (Array.isArray(parsed)) photos = parsed.filter((p: unknown) => typeof p === 'string');
                      } catch { /* 단일 URL 문자열인 경우 */ photos = [diary.photos]; }
                    }
                    if (photos.length === 0) return null;
                    return (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {photos.map((photoUrl: string, photoIdx: number) => (
                          <div key={photoIdx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photoUrl}
                              alt={`사진 ${photoIdx + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 공유 CTA */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-4">
            ✨ 소중한 추억을 공유하세요
          </h2>
          <p className="text-lg mb-6 opacity-90">
            가족, 친구들과 함께 여행의 순간들을 나눠보세요
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-purple-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors shadow-md">
              📱 카카오톡으로 공유
            </button>
            <button className="bg-white/20 backdrop-blur text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/30 transition-colors">
              💾 PDF로 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 통계 카드 컴포넌트
function StatCard({ 
  icon, 
  value, 
  label, 
  bgColor 
}: { 
  icon: React.ReactNode; 
  value: number | string; 
  label: string; 
  bgColor: string;
}) {
  return (
    <div className={`${bgColor} rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow`}>
      <div className="flex flex-col items-center text-center">
        <div className="mb-3">{icon}</div>
        <p className="text-4xl font-bold text-gray-900 mb-2">{value}</p>
        <p className="text-gray-600 font-medium">{label}</p>
      </div>
    </div>
  );
}

