'use client';
import { useEffect, useMemo, useState } from 'react';
import type { User, Trip } from '@/types/app';

function safeJson<T>(r: Response): Promise<T | null> {
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return Promise.resolve(null);
  return r.json().catch(() => null);
}

function ddays(fromISO: string) {
  const today = new Date();
  const from = new Date(fromISO + 'T00:00:00');
  const diff = Math.floor((from.getTime() - today.setHours(0, 0, 0, 0)) / 86400000);
  return diff; // 음수면 지난 날
}

function tripDay(fromISO: string) {
  const today = new Date();
  const from = new Date(fromISO + 'T00:00:00');
  const diff = Math.floor((today.setHours(0, 0, 0, 0) - from.getTime()) / 86400000) + 1;
  return Math.max(diff, 1);
}

export default function OnboardingSummary() {
  const [profile, setProfile] = useState<User | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);

  useEffect(() => {
    (async () => {
      // 프로필
      const pr = await fetch('/api/user/profile', { credentials: 'include' });
      const pj = await safeJson<{ success: boolean; user: User }>(pr);
      if (pj?.success && pj.user) setProfile(pj.user);

      // 최신 여행
      const has = await fetch('/api/trips/has', { credentials: 'include' });
      if (!has.ok) { setTrip(null); return; }
      const hj = await safeJson<{ hasTrip: boolean }>(has);
      if (!hj?.hasTrip) { setTrip(null); return; }

      const lr = await fetch('/api/trips/latest', { credentials: 'include' });
      if (!lr.ok) { setTrip(null); return; }
      const lj = await safeJson<{ trip: Trip }>(lr);
      if (lj?.trip) setTrip(lj.trip);
    })();
  }, []);

  const line1 = useMemo(() => {
    if (!trip) return null;
    const who = profile?.name ? `${profile.name}님` : '여행자님';
    const dst = (trip.destination || []).join(', ');
    return `${who}  ${trip.cruiseName}  ${trip.companionType}와 함께  ${dst}`;
  }, [trip, profile]);

  const line2 = useMemo(() => {
    if (!trip) return null;
    const d = ddays(trip.startDate);
    if (d > 0) return `🗓️ D-${d}일 남았습니다.`;
    if (d === 0) return `🗓️ 오늘부터 여행 시작! 여행 1일째`;
    // 지난 경우: 여행 중이거나 지나감
    const day = tripDay(trip.startDate);
    return `🛳️ 여행 ${day}일째`;
  }, [trip]);

  if (!trip) {
    return (
      <div className="w-full bg-white border rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="text-sm">
          <div className="font-semibold">여행정보가 아직 없어요.</div>
          <div className="text-gray-600">등록하러 가기에서 여행 정보를 먼저 등록해주세요.</div>
        </div>
        <a href="/onboarding" className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold">
          등록하러 가기
        </a>
      </div>
    );
  }

  return (
    <div className="w-full bg-white border rounded-xl p-4">
      <div className="text-sm font-semibold mb-1">{line1}</div>
      <div className="text-sm text-gray-700 mb-1">{line2}</div>
      <div className="text-xs text-gray-500">
        {trip.startDate} ~ {trip.endDate} · {trip.nights}박 {trip.days}일
      </div>
    </div>
  );
}
