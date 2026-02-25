// components/VisitedCountryModal.tsx
'use client';

import { useEffect, useState } from 'react';
import DiaryEntryModal from './DiaryEntryModal';

interface VisitedCountryInfo {
  countryCode: string;
  countryName: string;
  visitCount: number;
  lastVisited: string;
}

interface VisitedCountryModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryCode: string | null;
  countryName: string | null;
  onAddTrip?: (countryName: string) => void; // 여행 추가 폼 열기 콜백
}

interface DiaryEntry {
  id: number;
  title: string;
  content: string;
  visitDate: string;
  createdAt: string;
}

export default function VisitedCountryModal({
  isOpen,
  onClose,
  countryCode,
  countryName,
  onAddTrip,
}: VisitedCountryModalProps) {
  const [visitInfo, setVisitInfo] = useState<VisitedCountryInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDiaryModalOpen, setIsDiaryModalOpen] = useState(false);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [showDiaryList, setShowDiaryList] = useState(false);

  useEffect(() => {
    if (isOpen && countryCode) {
      loadVisitInfo();
      loadDiaryEntries();
    }
  }, [isOpen, countryCode]);

  const loadDiaryEntries = async () => {
    if (!countryCode) return;

    try {
      const response = await fetch(`/api/diary?countryCode=${countryCode}`, {
        credentials: 'include',
      });
      const data = await response.json();

      if (data.ok && Array.isArray(data.entries)) {
        setDiaryEntries(data.entries);
      }
    } catch (error) {
      console.error('Failed to load diary entries:', error);
    }
  };

  const loadVisitInfo = async () => {
    if (!countryCode) return;

    setLoading(true);
    try {
      const response = await fetch('/api/visited-countries', { credentials: 'include' });
      const data = await response.json();

      if (data.ok && Array.isArray(data.visitedCountries)) {
        const country = data.visitedCountries.find(
          (c: VisitedCountryInfo) => c.countryCode === countryCode
        );
        setVisitInfo(country || null);
      }
    } catch (error) {
      console.error('Failed to load visit info:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-extrabold text-gray-900">
            {countryName || '국가 정보'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 내용 */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : visitInfo ? (
          <div className="space-y-4">
            {/* 방문 통계 */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">총 방문 횟수</span>
                <span className="text-3xl font-extrabold text-blue-600">{visitInfo.visitCount}회</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">마지막 방문</span>
                <span className="text-sm text-gray-600">{formatDate(visitInfo.lastVisited)}</span>
              </div>
            </div>

            {/* 다이어리 버튼 */}
            <div className="space-y-2">
              <button
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                onClick={() => setShowDiaryList(!showDiaryList)}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                여행 다이어리 보기 ({diaryEntries.length})
              </button>

              <button
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                onClick={() => setIsDiaryModalOpen(true)}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                ✏️ 새 다이어리 작성
              </button>
            </div>

            {/* 다이어리 목록 */}
            {showDiaryList && (
              <div className="mt-4 space-y-3 max-h-60 overflow-y-auto">
                {diaryEntries.length === 0 ? (
                  <div className="text-center py-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">아직 작성된 다이어리가 없습니다.</p>
                    <p className="text-xs text-gray-500 mt-1">첫 여행 기록을 남겨보세요! ✨</p>
                  </div>
                ) : (
                  diaryEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-white border-2 border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-bold text-gray-900 text-sm">{entry.title}</h4>
                        <span className="text-xs text-gray-500">
                          {new Date(entry.visitDate).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">{entry.content}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 안내 메시지 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800">
                💡 이 국가의 여행 기억을 다이어리에 기록하고 나중에 다시 볼 수 있습니다.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 space-y-4">
            {/* 아이콘 */}
            <div className="text-6xl mb-4">🗺️</div>
            
            {/* 메인 메시지 */}
            <div className="space-y-3">
              <p className="text-lg font-semibold text-gray-800">
                이 국가의 방문 기록이 없습니다
              </p>
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 text-left">
                <p className="text-sm font-semibold text-blue-900 mb-2">
                  💡 어떻게 방문 기록을 남길 수 있나요?
                </p>
                <div className="space-y-2 text-xs text-blue-800">
                  <p className="flex items-start gap-2">
                    <span className="font-bold">1단계:</span>
                    <span>오른쪽 아래 &quot;나의 크루즈 여행 기록&quot; 패널에서<br />&quot;새로운 여행 추가하기&quot; 버튼을 누르세요</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-bold">2단계:</span>
                    <span>여행 정보를 입력할 때<br />&quot;여행지&quot;에 이 국가를 포함해주세요</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-bold">3단계:</span>
                    <span>여행을 등록하면<br />자동으로 지도에 색칠됩니다! ✨</span>
                  </p>
                </div>
              </div>
              
              {/* 직접 색칠하기 안내 */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-left">
                <p className="text-xs text-yellow-800">
                  <span className="font-semibold">💡 팁:</span> 지금 바로 이 국가를 색칠하고 싶으시다면, 왼쪽 패널의 &quot;방문 국가 색칠하기&quot;에서 직접 색상을 선택할 수 있습니다.
                </p>
              </div>
            </div>

            {/* 여행 추가하기 버튼 */}
            <button
              onClick={() => {
                onClose();
                if (onAddTrip && countryName) {
                  onAddTrip(countryName);
                }
              }}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              새로운 여행 추가하기
            </button>
          </div>
        )}

        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="w-full mt-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
        >
          닫기
        </button>
      </div>

      {/* 다이어리 작성 모달 */}
      {countryCode && countryName && (
        <DiaryEntryModal
          isOpen={isDiaryModalOpen}
          onClose={() => setIsDiaryModalOpen(false)}
          countryCode={countryCode}
          countryName={countryName}
          onSave={() => {
            loadDiaryEntries();
            setShowDiaryList(true);
          }}
        />
      )}
    </div>
  );
}

