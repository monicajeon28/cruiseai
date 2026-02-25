'use client';

import { useState } from 'react';
import CompanionEditor from './CompanionEditor';
import { formatDateK } from '@/lib/utils';

interface TripInfoSectionProps {
  trip: {
    id: number | string;
    cruiseName?: string | null;
    destination?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    companionType?: string | null;
  };
  companionType: string;
  tripDuration: string;
  destinationString?: string; // 파싱된 목적지 문자열
}

export default function TripInfoSection({ trip, companionType, tripDuration, destinationString }: TripInfoSectionProps) {
  const [showCompanionEditor, setShowCompanionEditor] = useState(false);
  const [currentCompanion, setCurrentCompanion] = useState(companionType);
  const [currentCompanionType, setCurrentCompanionType] = useState(trip.companionType || '');

  const handleCompanionUpdate = () => {
    // 페이지 새로고침하여 최신 정보 반영
    window.location.reload();
  };

  return (
    <>
      <section className="mt-4 rounded-xl border bg-white p-4">
        <h2 className="text-base font-semibold text-gray-800">나의 여행</h2>
        <p className="mt-2 text-[17px] md:text-[18px] leading-8 text-gray-900">
          <span role="img" aria-label="cruise">🚢</span> 크루즈: <span className="font-semibold text-gray-900">{trip.cruiseName ?? '정보 없음'}</span>
        </p>
        <p className="mt-1 text-[17px] md:text-[18px] leading-8 text-gray-900">
          <span role="img" aria-label="destination">❤️</span> 여행지: <span className="font-semibold text-gray-900">{destinationString ?? '정보 없음'}</span>
        </p>
        <p className="mt-1 text-[17px] md:text-[18px] leading-8 text-gray-900">
          <span role="img" aria-label="companion">🧑‍🤝‍🧑</span> 동반자: <span className="font-semibold text-gray-900">{currentCompanion}</span>
        </p>
        <p className="mt-1 text-[17px] md:text-[18px] leading-8 text-gray-900">
          <span role="img" aria-label="duration">🗓️</span> 기간: <span className="font-semibold text-gray-900">{tripDuration}</span>
        </p>
        {trip.startDate && trip.endDate && (
          <p className="mt-1 text-[17px] md:text-[18px] leading-8 text-gray-900">
            <span role="img" aria-label="dates">📅</span> 여행일정: <span className="font-semibold text-gray-900">
              {formatDateK(trip.startDate)} ~ {formatDateK(trip.endDate)}
            </span>
          </p>
        )}
        <div className="flex gap-2 mt-4">
          <a
            className="flex-1 px-6 py-2 bg-red-600 text-white font-semibold rounded-lg shadow text-center"
            href="/map"
          >
            나의 크루즈 여행 지도 보기
          </a>
          <button
            onClick={() => setShowCompanionEditor(true)}
            className="flex-1 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow text-center hover:bg-blue-700 transition-colors"
          >
            동반자 수정
          </button>
        </div>
      </section>

      {showCompanionEditor && (
        <CompanionEditor
          currentCompanion={currentCompanionType}
          tripId={trip.id}
          onClose={() => setShowCompanionEditor(false)}
          onSuccess={handleCompanionUpdate}
        />
      )}
    </>
  );
}

