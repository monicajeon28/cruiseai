'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { csrfFetch } from '@/lib/csrf-client';

// ── 타입 ────────────────────────────────────────────────────────────────
interface ItineraryItem {
  id: number;
  day: number;
  date: string;
  type: string;
  location: string | null;
  country: string | null;
  arrival: string | null;
  departure: string | null;
  portLat: number | null;
  portLng: number | null;
  isToday: boolean;
}

interface TravelerItem {
  roomNumber: number;
  korName: string | null;
  engName: string | null;
  nationality: string | null;
  passportExpiryDate: string | null;
  hasPassport: boolean;
}

interface OnboardData {
  ok: boolean;
  user: { id: number; name: string | null; phone: string | null };
  trip: {
    id: number;
    cruiseName: string | null;
    reservationCode: string | null;
    startDate: string | null;
    endDate: string | null;
    nights: number;
    days: number;
    destination: unknown;
    status: string;
    itinerary: ItineraryItem[];
    todayItinerary: { day: number; location: string | null; country: string | null; type: string } | null;
  } | null;
  travelers: TravelerItem[];
  passportStatus: { isSubmitted: boolean; submittedAt: string | null; guestCount: number } | null;
}

// ── 유틸 ────────────────────────────────────────────────────────────────
function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function getTypeLabel(type: string, location: string | null) {
  const t = (type || '').toLowerCase();
  if (t === 'sea' || t === 'cruising') return '🌊 항해 중';
  return `⚓ ${location ?? '기항지'}`;
}

function getTypeColor(type: string) {
  const t = (type || '').toLowerCase();
  if (t === 'sea' || t === 'cruising') return 'bg-blue-100 text-blue-700 border-blue-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

function getDestinations(dest: unknown): string {
  if (!dest) return '';
  if (Array.isArray(dest)) return dest.join(' · ');
  if (typeof dest === 'string') return dest;
  return '';
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [data, setData] = useState<OnboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllItinerary, setShowAllItinerary] = useState(false);

  // APIS 데이터 로드
  useEffect(() => {
    fetch('/api/auth/onboard-data', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: OnboardData) => {
        if (!d.ok) {
          setError('여행 정보를 불러올 수 없습니다.');
        } else {
          setData(d);
        }
      })
      .catch(() => setError('네트워크 오류가 발생했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  // 온보딩 완료 → /chat 이동
  const handleStart = useCallback(async () => {
    setConfirming(true);
    try {
      const r = await csrfFetch('/api/auth/onboard', {
        method: 'POST',
        credentials: 'include',
      });
      const d = await r.json();
      if (d.ok) {
        router.push('/chat');
      } else {
        setError('시작하기 처리 중 오류가 발생했습니다.');
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setConfirming(false);
    }
  }, [router]);

  // ── 로딩 화면 ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-blue-200 animate-ping opacity-40" />
            <div className="absolute inset-2 rounded-full border-4 border-blue-400 border-t-transparent animate-spin" />
          </div>
          <p className="text-blue-600 font-medium text-lg">여행 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // ── 에러 화면 ────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center space-y-5">
          <div className="text-6xl">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900">정보를 불러올 수 없어요</h2>
          <p className="text-gray-600">{error ?? '알 수 없는 오류가 발생했습니다.'}</p>
          <p className="text-sm text-gray-500">
            여행 정보가 아직 등록되지 않았거나 잠시 후 다시 시도해주세요.
          </p>
          <button
            onClick={handleStart}
            disabled={confirming}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all"
          >
            그냥 시작하기
          </button>
        </div>
      </div>
    );
  }

  const { user, trip, travelers, passportStatus } = data;
  const itinerary = trip?.itinerary ?? [];
  const visibleItinerary = showAllItinerary ? itinerary : itinerary.slice(0, 5);
  const destinations = getDestinations(trip?.destination);

  // ── 메인 온보딩 화면 ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 relative overflow-hidden">
      {/* 배경 그라디언트 orbs */}
      <div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
      />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8 pb-24 space-y-5">
        {/* 환영 헤더 */}
        <div className="text-center space-y-2 pt-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-xl border-2 border-blue-100 mb-2">
            <img src="/images/ai-cruise-logo.png" alt="크루즈닷AI" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 leading-tight">
            {user.name ? (
              <>
                <span className="text-blue-600">{user.name}</span>님,<br />
                크루즈닷AI에 오신 것을 환영합니다! 🎉
              </>
            ) : (
              <>크루즈닷AI에 오신 것을 환영합니다! 🎉</>
            )}
          </h1>
          <p className="text-gray-500 text-base">
            예약하신 크루즈 여행 정보를 확인해보세요
          </p>
        </div>

        {/* 여행 정보 카드 */}
        {trip ? (
          <div className="bg-white rounded-3xl shadow-xl border border-blue-100 overflow-hidden">
            {/* 카드 상단 그라디언트 바 */}
            <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

            <div className="p-6 space-y-4">
              {/* 크루즈 기본 정보 */}
              <div className="flex items-start gap-3">
                <span className="text-3xl mt-0.5">🚢</span>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-gray-900 leading-tight">
                    {trip.cruiseName ?? '크루즈 여행'}
                  </h2>
                  {destinations && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{destinations}</p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                      trip.status === 'Upcoming' || trip.status === 'upcoming'
                        ? 'bg-blue-100 text-blue-700'
                        : trip.status === 'Completed' || trip.status === 'completed'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {trip.status === 'Upcoming' ? '예정' : trip.status === 'Completed' ? '완료' : '진행 중'}
                  </span>
                </div>
              </div>

              {/* 일정 요약 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-2xl p-3 space-y-0.5">
                  <p className="text-xs text-blue-500 font-medium">출항일</p>
                  <p className="text-sm font-bold text-blue-900">{formatDate(trip.startDate)}</p>
                </div>
                <div className="bg-indigo-50 rounded-2xl p-3 space-y-0.5">
                  <p className="text-xs text-indigo-500 font-medium">귀항일</p>
                  <p className="text-sm font-bold text-indigo-900">{formatDate(trip.endDate)}</p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-3 text-center">
                <p className="text-white font-bold text-lg">
                  {trip.nights}박 {trip.days}일 크루즈 여행
                </p>
                {trip.reservationCode && (
                  <p className="text-blue-200 text-xs mt-0.5">예약번호: {trip.reservationCode}</p>
                )}
              </div>

              {/* 오늘 일정 하이라이트 */}
              {trip.todayItinerary && (
                <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl p-3">
                  <span className="text-2xl">📍</span>
                  <div>
                    <p className="text-xs text-yellow-600 font-semibold">오늘 일정 (Day {trip.todayItinerary.day})</p>
                    <p className="text-sm font-bold text-yellow-900">
                      {trip.todayItinerary.location ?? '정보 없음'}
                      {trip.todayItinerary.country && (
                        <span className="text-yellow-600"> · {trip.todayItinerary.country}</span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 text-center space-y-2">
            <p className="text-4xl">⏳</p>
            <p className="font-bold text-gray-700">여행 일정이 아직 등록되지 않았어요</p>
            <p className="text-sm text-gray-500">어드민에서 일정 등록 후 다시 확인해주세요</p>
          </div>
        )}

        {/* 전체 일정 */}
        {itinerary.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <span>🗓️</span> 전체 일정
              </h3>
              <span className="text-xs text-gray-400 font-medium">{itinerary.length}일</span>
            </div>

            <div className="px-4 pb-4 space-y-2">
              {visibleItinerary.map((it) => (
                <div
                  key={it.id}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 border transition-all ${
                    it.isToday
                      ? 'bg-yellow-50 border-yellow-300 shadow-sm'
                      : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  {/* Day 배지 */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${
                      it.isToday ? 'bg-yellow-400 text-yellow-900' : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    D{it.day}
                  </div>

                  {/* 일정 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getTypeColor(it.type)}`}
                      >
                        {getTypeLabel(it.type, it.location)}
                      </span>
                      {it.isToday && (
                        <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full font-bold">
                          오늘
                        </span>
                      )}
                    </div>
                    {it.arrival || it.departure ? (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {it.arrival && `입항 ${it.arrival}`}
                        {it.arrival && it.departure && ' · '}
                        {it.departure && `출항 ${it.departure}`}
                      </p>
                    ) : null}
                  </div>

                  {/* 날짜 */}
                  <p className="flex-shrink-0 text-xs text-gray-400">
                    {formatDate(it.date)}
                  </p>
                </div>
              ))}

              {itinerary.length > 5 && (
                <button
                  onClick={() => setShowAllItinerary((v) => !v)}
                  className="w-full py-2 text-sm text-blue-600 font-semibold hover:text-blue-700 transition-colors"
                >
                  {showAllItinerary ? '▲ 접기' : `▼ 전체 ${itinerary.length}일 보기`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 동행자 정보 */}
        {travelers.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <span>👥</span> 동행자 정보
                <span className="text-xs text-gray-400 font-normal ml-1">{travelers.length}명</span>
              </h3>
            </div>
            <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {travelers.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-2.5 border border-gray-100"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {t.korName ?? t.engName ?? '이름 미등록'}
                    </p>
                    {t.engName && t.korName && (
                      <p className="text-xs text-gray-400 truncate">{t.engName}</p>
                    )}
                  </div>
                  <div className="ml-auto flex-shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        t.hasPassport
                          ? 'bg-green-100 text-green-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {t.hasPassport ? '여권✓' : '여권미등록'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 여권 제출 상태 */}
        {passportStatus && (
          <div
            className={`rounded-3xl shadow-xl border overflow-hidden ${
              passportStatus.isSubmitted
                ? 'bg-green-50 border-green-200'
                : 'bg-orange-50 border-orange-200'
            }`}
          >
            <div className="px-5 py-4 flex items-center gap-3">
              <span className="text-2xl">{passportStatus.isSubmitted ? '✅' : '⏰'}</span>
              <div>
                <p
                  className={`font-bold text-sm ${
                    passportStatus.isSubmitted ? 'text-green-800' : 'text-orange-800'
                  }`}
                >
                  {passportStatus.isSubmitted
                    ? `여권 제출 완료 (${passportStatus.guestCount}명)`
                    : '여권 제출 대기 중'}
                </p>
                {passportStatus.isSubmitted && passportStatus.submittedAt && (
                  <p className="text-xs text-green-600">
                    {formatDate(passportStatus.submittedAt)} 제출
                  </p>
                )}
                {!passportStatus.isSubmitted && (
                  <p className="text-xs text-orange-600">
                    크루즈몰에서 여권 정보를 등록해주세요
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 안내 메시지 */}
        <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4 space-y-1.5">
          <p className="text-xs font-semibold text-blue-700">크루즈닷AI란?</p>
          <ul className="text-xs text-blue-600 space-y-1">
            <li>• 기항지 날씨 · 교통 · 관광 정보를 AI가 실시간 안내</li>
            <li>• 통번역기로 현지 소통 지원</li>
            <li>• 여행 체크리스트 · 다이어리 관리</li>
            <li>• 스마트 길찾기 · 환율 정보</li>
          </ul>
        </div>
      </div>

      {/* 하단 고정 시작 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/80 backdrop-blur-md border-t border-gray-200 px-4 py-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleStart}
            disabled={confirming}
            className="w-full bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:via-blue-800 hover:to-indigo-800 disabled:opacity-60 text-white font-bold text-xl py-5 rounded-2xl shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {confirming ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                시작하는 중...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>🚀</span>
                <span>확인했어요, 크루즈닷AI 시작하기</span>
                <span>✨</span>
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
