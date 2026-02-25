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
  destinationString?: string;
}

export default function TripInfoSection({ trip, companionType, tripDuration, destinationString }: TripInfoSectionProps) {
  const [showCompanionEditor, setShowCompanionEditor] = useState(false);
  const [currentCompanion, setCurrentCompanion] = useState(companionType);
  const [currentCompanionType, setCurrentCompanionType] = useState(trip.companionType || '');

  const handleCompanionUpdate = () => {
    window.location.reload();
  };

  return (
    <>
      <section className="bg-white rounded-2xl shadow-xl p-6 border-2 border-blue-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="text-3xl">🚢</span>
          나의 여행
        </h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
            <span className="text-2xl">🚢</span>
            <div className="flex-1">
              <span className="text-gray-600 font-medium block mb-1">크루즈</span>
              <span className="font-bold text-lg text-gray-900">{trip.cruiseName ?? '정보 없음'}</span>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-pink-50 to-red-50 rounded-lg border border-pink-200">
            <span className="text-2xl">❤️</span>
            <div className="flex-1">
              <span className="text-gray-600 font-medium block mb-1">여행지</span>
              <span className="font-bold text-lg text-gray-900">{destinationString ?? '정보 없음'}</span>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg border border-green-200">
            <span className="text-2xl">🗓️</span>
            <div className="flex-1">
              <span className="text-gray-600 font-medium block mb-1">기간</span>
              <span className="font-bold text-lg text-gray-900">{tripDuration}</span>
              {trip.startDate && trip.endDate && (
                <p className="text-sm text-gray-600 mt-1">
                  {formatDateK(trip.startDate)} ~ {formatDateK(trip.endDate)}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
            <span className="text-2xl">🧑‍🤝‍🧑</span>
            <div className="flex-1">
              <span className="text-gray-600 font-medium block mb-1">동반자</span>
              <span className="font-bold text-lg text-gray-900">{currentCompanion}</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 mt-6">
          <a
            className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold rounded-xl shadow-lg text-center hover:from-red-600 hover:to-pink-600 transition-all transform hover:scale-105"
            href="/map-test"
          >
            🗺️ 나의 크루즈 여행 지도 보기
          </a>
          <button
            onClick={() => setShowCompanionEditor(true)}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl shadow-lg text-center hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105"
          >
            ✏️ 동반자 수정
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

