export default function TripSummaryCard({
  cruiseName, destinations, start, end, onMyInfo,
}: {
  cruiseName?: string; destinations?: string[]; start?: string; end?: string; onMyInfo?: () => void;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="font-bold text-lg text-gray-700">여행 정보</div>
        <button onClick={onMyInfo}
          className="min-h-[48px] px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[15px] font-semibold hover:bg-blue-700">
          나의 정보 보기
        </button>
      </div>
      <div className="mt-2 flex items-start gap-3">
        <div className="text-2xl">🛳</div>
        <div className="flex-1">
          <div className="font-bold text-lg">{cruiseName ?? '— 크루즈 미선택 —'}</div>
          <div className="text-sm text-gray-700">{destinations?.length ? `「 ${destinations.join(' 」·「 ')} 」` : '방문지 미설정'}</div>
          <div className="text-xs text-gray-500 mt-1">{start && end ? `${start} ~ ${end}` : '출발/도착일 미설정'}</div>
        </div>
      </div>
    </div>
  );
}
