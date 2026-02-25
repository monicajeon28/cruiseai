'use client';

import Link from 'next/link';

type Props = {
  name?: string | null;
  lastTripSummary?: string | null;
  tripNumber?: number | null;
  tripId?: number | null;
};

export default function TripInfoBannerClient({ name, lastTripSummary, tripNumber, tripId }: Props) {
  return (
    <div className="w-full rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-sm text-gray-500">안녕하세요{ name ? `, ${name}님` : '' } 👋</div>
          <div className="mt-1 font-semibold">
            {lastTripSummary ?? '여행 정보를 등록하시면 맞춤 추천을 시작할게요.'}
          </div>
          {tripNumber && tripNumber > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                {tripNumber}번째 여행
              </span>
            </div>
          )}
        </div>
        {tripId && (
          <Link
            href="/profile"
            className="shrink-0 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            추가
          </Link>
        )}
      </div>
    </div>
  );
}

