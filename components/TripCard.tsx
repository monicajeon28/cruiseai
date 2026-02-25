'use client';
import Link from 'next/link';

interface TripCardProps {
  trip: { cruiseName?: string; destinations?: string[]; startDate?: string; endDate?: string; };
}

export default function TripCard({ trip }: TripCardProps) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="font-bold text-lg text-gray-700">나의 여행</div>
        <Link href="/profile"
          className="min-h-[48px] px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[15px] font-semibold hover:bg-blue-700">
          나의 정보 보기
        </Link>
      </div>
      <div className="mt-2 flex items-start gap-3">
        <div className="text-2xl">🛳</div>
        <div className="flex-1">
          <div className="font-bold text-lg">{trip.cruiseName ?? '— 크루즈 미선택 —'}</div>
          <div className="text-sm text-gray-700">{trip.destinations?.length ? `「 ${trip.destinations.join(' 」·「 ')} 」` : '방문지 미설정'}</div>
          <div className="text-xs text-gray-500 mt-1">{trip.startDate && trip.endDate ? `${trip.startDate} ~ ${trip.endDate}` : '출발/도착일 미설정'}</div>
        </div>
      </div>
    </div>
  );
}











