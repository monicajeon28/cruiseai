'use client';

import { useEffect, useState } from 'react';
import { FiCalendar, FiMapPin, FiAnchor, FiClock } from 'react-icons/fi';

/**
 * 내 여행 목록 페이지 (읽기 전용)
 * 사용자가 관리자에게 배정받은 여행 목록을 확인
 */

interface Trip {
  id: number;
  cruiseName: string;
  packageName: string;
  nights: number;
  days: number;
  startDate: string;
  endDate: string;
  destinations: string[];
  status: string;
  product: {
    cruiseLine: string;
    shipName: string;
    source: string | null;
  };
}

export default function MyTripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/trips/list', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          setTrips(data.trips);
        }
      }
    } catch (error) {
      console.error('Error loading trips:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      Upcoming: 'bg-blue-100 text-blue-700',
      InProgress: 'bg-green-100 text-green-700',
      Completed: 'bg-gray-100 text-gray-700',
    };

    const labels = {
      Upcoming: '예정',
      InProgress: '진행 중',
      Completed: '완료',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const getSourceBadge = (source: string | null) => {
    if (!source) return null;

    const colors = {
      cruisedot: 'bg-green-100 text-green-700',
      wcruise: 'bg-purple-100 text-purple-700',
      manual: 'bg-gray-100 text-gray-700',
    };

    const labels = {
      cruisedot: 'CruiseDot',
      wcruise: 'WCruise',
      manual: '수동',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[source as keyof typeof colors] || 'bg-gray-100 text-gray-700'}`}>
        {labels[source as keyof typeof labels] || source}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">내 여행</h1>
          <p className="text-gray-600">
            {trips.length > 0
              ? `총 ${trips.length}개의 여행이 등록되어 있습니다`
              : '등록된 여행이 없습니다'}
          </p>
        </div>

        {/* 여행 목록 */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">여행 목록을 불러오는 중...</p>
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed">
            <p className="text-gray-500 text-lg mb-2">등록된 여행이 없습니다</p>
            <p className="text-gray-400 text-sm">
              관리자가 여행을 배정하면 여기에 표시됩니다
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusBadge(trip.status)}
                      {trip.product.source && getSourceBadge(trip.product.source)}
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      {trip.product.cruiseLine} - {trip.product.shipName}
                    </h2>
                    <p className="text-gray-600 text-lg">{trip.packageName}</p>
                  </div>
                  <FiAnchor size={40} className="text-blue-600" />
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                  {/* 출발일 */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FiCalendar className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">출발일</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(trip.startDate).toLocaleDateString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  {/* 종료일 */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <FiCalendar className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">종료일</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(trip.endDate).toLocaleDateString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  {/* 기간 */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <FiClock className="text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">여행 기간</p>
                      <p className="font-semibold text-gray-900">
                        {trip.nights}박 {trip.days}일
                      </p>
                    </div>
                  </div>

                  {/* 목적지 */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <FiMapPin className="text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">방문 도시</p>
                      <p className="font-semibold text-gray-900">
                        {trip.destinations.length}개 도시
                      </p>
                    </div>
                  </div>
                </div>

                {/* 목적지 리스트 */}
                {trip.destinations.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-600 mb-2">방문 도시:</p>
                    <div className="flex flex-wrap gap-2">
                      {trip.destinations.map((dest, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                        >
                          {dest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
