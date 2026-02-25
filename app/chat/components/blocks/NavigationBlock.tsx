'use client';

type Props = {
  navigation: {
    from: string;
    to: string;
  };
};

export default function NavigationBlock({ navigation }: Props) {
  const createGoogleMapsLink = (mode: 'transit' | 'driving' | 'walking' | 'bicycling') => {
    const baseUrl = "https://www.google.com/maps/dir/";
    const origin = encodeURIComponent(navigation.from);
    const destination = encodeURIComponent(navigation.to);
    return `${baseUrl}${origin}/${destination}/data=!4m2!4m1!3e${mode === 'transit' ? '3' : mode === 'driving' ? '0' : '2'}`;
  };

  return (
    <div className="mt-4 rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50 p-5 shadow-lg">
      {/* 경로 정보 */}
      <div className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <span>📍</span>
        <span>{navigation.from}</span>
        <span className="text-blue-600">→</span>
        <span>{navigation.to}</span>
      </div>
      
      {/* 구글 맵 버튼 3개 (크게!) */}
      <div className="grid grid-cols-3 gap-3">
        <a
          href={createGoogleMapsLink('transit')}
          target="_blank"
          rel="noopener noreferrer"
          className="
            flex flex-col items-center justify-center gap-2
            px-4 py-5
            bg-gradient-to-br from-blue-500 to-blue-600
            text-white
            rounded-xl
            shadow-lg
            hover:shadow-xl
            hover:from-blue-600 hover:to-blue-700
            active:scale-95
            transition-all
            min-h-[100px]
          "
        >
          <span className="text-4xl">🚌</span>
          <span className="text-base font-bold">대중교통</span>
          <span className="text-xs opacity-90">버스/지하철</span>
        </a>
        
        <a
          href={createGoogleMapsLink('driving')}
          target="_blank"
          rel="noopener noreferrer"
          className="
            flex flex-col items-center justify-center gap-2
            px-4 py-5
            bg-gradient-to-br from-green-500 to-green-600
            text-white
            rounded-xl
            shadow-lg
            hover:shadow-xl
            hover:from-green-600 hover:to-green-700
            active:scale-95
            transition-all
            min-h-[100px]
          "
        >
          <span className="text-4xl">🚗</span>
          <span className="text-base font-bold">자동차</span>
          <span className="text-xs opacity-90">택시/렌터카</span>
        </a>
        
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navigation.to)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="
            flex flex-col items-center justify-center gap-2
            px-4 py-5
            bg-gradient-to-br from-purple-500 to-purple-600
            text-white
            rounded-xl
            shadow-lg
            hover:shadow-xl
            hover:from-purple-600 hover:to-purple-700
            active:scale-95
            transition-all
            min-h-[100px]
          "
        >
          <span className="text-4xl">🗺️</span>
          <span className="text-base font-bold">지도보기</span>
          <span className="text-xs opacity-90">위치 확인</span>
        </a>
      </div>
      
      {/* 안내 메시지 */}
      <div className="mt-4 p-3 bg-white/80 rounded-lg">
        <p className="text-sm text-gray-700 text-center">
          💡 버튼을 클릭하면 구글 맵이 열립니다
        </p>
      </div>
    </div>
  );
}
