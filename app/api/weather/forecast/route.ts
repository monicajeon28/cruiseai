// app/api/weather/forecast/route.ts
// WeatherAPI.com 날씨 예보 API Route (서버 사이드)

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

// 한글 도시명 → 영문 도시명 매핑 (WeatherAPI 호환)
const CITY_NAME_MAP: Record<string, string> = {
  // 일본
  '후쿠오카': 'Fukuoka, Japan',
  '나가사키': 'Nagasaki, Japan',
  '오사카': 'Osaka, Japan',
  '도쿄': 'Tokyo, Japan',
  '요코하마': 'Yokohama, Japan',
  '나하': 'Naha, Japan',
  '오키나와': 'Okinawa, Japan',
  '삿포로': 'Sapporo, Japan',
  '고베': 'Kobe, Japan',
  '교토': 'Kyoto, Japan',
  '시모노세키': 'Shimonoseki, Japan',
  '가고시마': 'Kagoshima, Japan',
  '벳푸': 'Beppu, Japan',
  '하카타': 'Fukuoka, Japan',
  '이시가키': 'Ishigaki, Japan',
  '미야코지마': 'Miyakojima, Japan',
  // 한국
  '부산': 'Busan, South Korea',
  '인천': 'Incheon, South Korea',
  '서울': 'Seoul, South Korea',
  '제주': 'Jeju, South Korea',
  '여수': 'Yeosu, South Korea',
  '속초': 'Sokcho, South Korea',
  // 중국
  '상하이': 'Shanghai, China',
  '홍콩': 'Hong Kong',
  '칭다오': 'Qingdao, China',
  '톈진': 'Tianjin, China',
  '다롄': 'Dalian, China',
  // 대만
  '타이베이': 'Taipei, Taiwan',
  '지룽': 'Keelung, Taiwan',
  '가오슝': 'Kaohsiung, Taiwan',
  // 동남아
  '싱가포르': 'Singapore',
  '방콕': 'Bangkok, Thailand',
  '호치민': 'Ho Chi Minh City, Vietnam',
  '다낭': 'Da Nang, Vietnam',
  '하롱베이': 'Ha Long, Vietnam',
  '푸켓': 'Phuket, Thailand',
  '발리': 'Bali, Indonesia',
  '마닐라': 'Manila, Philippines',
  // 유럽/지중해
  '바르셀로나': 'Barcelona, Spain',
  '로마': 'Rome, Italy',
  '베네치아': 'Venice, Italy',
  '나폴리': 'Naples, Italy',
  '아테네': 'Athens, Greece',
  '산토리니': 'Santorini, Greece',
  '아르고스톨리': 'Argostoli, Greece',
  '케팔로니아': 'Kefalonia, Greece',
  '두브로브니크': 'Dubrovnik, Croatia',
  '마르세유': 'Marseille, France',
  '니스': 'Nice, France',
  '몬테카를로': 'Monte Carlo, Monaco',
  '리스본': 'Lisbon, Portugal',
  // 알래스카/북미
  '시애틀': 'Seattle, USA',
  '밴쿠버': 'Vancouver, Canada',
  '주노': 'Juneau, USA',
  '케치칸': 'Ketchikan, USA',
  '스캐그웨이': 'Skagway, USA',
  // 카리브해
  '마이애미': 'Miami, USA',
  '나소': 'Nassau, Bahamas',
  '코주멜': 'Cozumel, Mexico',
  '칸쿤': 'Cancun, Mexico',
  // 북유럽
  '코펜하겐': 'Copenhagen, Denmark',
  '스톡홀름': 'Stockholm, Sweden',
  '오슬로': 'Oslo, Norway',
  '헬싱키': 'Helsinki, Finland',
  '상트페테르부르크': 'Saint Petersburg, Russia',
  '탈린': 'Tallinn, Estonia',
  // 호주/뉴질랜드
  '시드니': 'Sydney, Australia',
  '멜버른': 'Melbourne, Australia',
  '오클랜드': 'Auckland, New Zealand',
};

// 도시명을 영문으로 변환
function convertCityName(city: string): string {
  // 이미 영문이면 그대로 반환
  if (/^[a-zA-Z\s,]+$/.test(city)) {
    return city;
  }
  // 매핑에서 찾기
  const mapped = CITY_NAME_MAP[city];
  if (mapped) {
    return mapped;
  }
  // 매핑에 없으면 그대로 반환 (WeatherAPI가 처리하도록)
  console.log(`[Weather API] 도시명 매핑 없음: ${city}`);
  return city;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const days = parseInt(searchParams.get('days') || '14');

    if (!city) {
      return NextResponse.json(
        { ok: false, error: '도시명(city)이 필요합니다.' },
        { status: 400 }
      );
    }

    // 환경변수 직접 확인
    const apiKey = process.env.WEATHER_API_KEY;

    if (!apiKey) {
      console.error('[Weather API] WEATHER_API_KEY 환경변수가 설정되지 않았습니다.');
      return NextResponse.json(
        { ok: false, error: 'WEATHER_API_KEY 환경변수가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 한글 도시명을 영문으로 변환
    const englishCity = convertCityName(city);
    console.log(`[Weather API] 도시명 변환: ${city} → ${englishCity}`);

    // WeatherAPI.com 직접 호출
    const response = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(englishCity)}&days=${days}&lang=ko`,
      {
        cache: 'no-store' // 캐싱 비활성화
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Weather API] API 응답 오류:', response.status, errorText);
      return NextResponse.json(
        { ok: false, error: `날씨 API 요청 실패: ${response.status}` },
        { status: 500 }
      );
    }

    const weatherData = await response.json();

    return NextResponse.json({
      ok: true,
      data: weatherData,
    });
  } catch (error: any) {
    console.error('[Weather API] 오류:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '날씨 정보를 가져오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
