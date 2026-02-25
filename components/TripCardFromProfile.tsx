'use client';
import { useEffect, useState } from 'react';
import { formatNightsDays, calcDday } from '@/utils/dateHelpers';
import { format } from 'date-fns'; // date-fns의 format 임포트

const formatDate = (iso: string) => format(new Date(iso), 'yyyy.MM.dd');

type Trip = {
  cruiseName: string;
  companionType?: string;
  destination: string[] | string;
  startDate: string; // YYYY-MM-DD
  endDate:   string;   // YYYY-MM-DD
};
type Profile = { name?: string; lastTrip?: Trip; trip?: Trip };

function parseDest(dest: Trip['destination']) {
  if (Array.isArray(dest)) return dest.join(' · ');
  try {
    const a = JSON.parse(dest as any);
    return Array.isArray(a) ? a.join(' · ') : (dest as string);
  } catch {
    return dest as string;
  }
}

function dayDiff(a: Date, b: Date) {
  // 시차 영향 최소화를 위해 자정 기준
  const d1 = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const d2 = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((d2 - d1) / 86400000);
}

function tripStatusText(sISO: string, eISO: string) {
  const today = new Date();
  const s = new Date(sISO);
  const e = new Date(eISO);

  if (today < s) {
    const d = dayDiff(today, s);
    return `D-${d}`;
  }
  if (today > e) {
    return '여행이 종료되었습니다';
  }
  const day = dayDiff(s, today) + 1;
  return `여행 ${day}일차`;
}

export default function TripCardFromProfile({ stickyCompact=false }: {stickyCompact?:boolean}) {
  const [data, setData] = useState<{ profile?: Profile; trip?: Trip } | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/user/profile', { credentials: 'include' });
      const j: Profile | null = await r.json().catch(() => null);
      setData({ profile: j ?? undefined, trip: (j?.lastTrip ?? j?.trip) ?? undefined });
    })();
  }, []);

  const trip = data?.trip;
  if (!trip) return (
    <div className="rounded-2xl border shadow-sm bg-white p-3">
      <div className="text-[14.5px] text-gray-700">
        🚢 여행정보를 먼저 등록해 주세요. <a className="text-blue-600 underline" href="/onboarding">등록하러 가기</a>
      </div>
    </div>
  );

  const user = data?.profile;
  const destPretty = parseDest(trip.destination);
  const { nights, days } = formatNightsDays(trip.startDate, trip.endDate);
  const dDay = calcDday(trip.startDate);

  return (
    <div className={`rounded-2xl border shadow-sm bg-white ${stickyCompact ? 'p-3' : 'p-4'}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm md:text-base">
        <span>📅 <b>D-{Math.max(dDay,0)}</b></span>
        <span> | 👤 {user?.name ?? '고객'}</span>
        <span> | 🚢 <b>{trip.cruiseName}</b></span>
        <span> | 🧭 {destPretty}</span>
        <span> | ⏱️ {nights}박 {days}일 ({formatDate(trip.startDate)} ~ {formatDate(trip.endDate)})</span>
      </div>
    </div>
  );
}
