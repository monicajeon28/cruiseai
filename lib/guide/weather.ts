// lib/weather.ts
// WeatherAPI.com을 사용한 날씨 정보 가져오기

export interface WeatherForecast {
  date: string;
  day: {
    maxtemp_c: number;
    mintemp_c: number;
    condition: {
      text: string;
      icon: string;
    };
  };
  hour: Array<{
    time: string;
    temp_c: number;
    condition: {
      text: string;
      icon: string;
    };
  }>;
}

export interface WeatherResponse {
  location: {
    name: string;
    country: string;
  };
  current: {
    temp_c: number;
    condition: {
      text: string;
      icon: string;
    };
  };
  forecast: {
    forecastday: WeatherForecast[];
  };
}

/**
 * WeatherAPI.com을 사용하여 14일 날씨 예보 가져오기
 * 1시간 캐시 적용 (Next.js 자동 캐싱)
 */
export async function getWeatherForecast(
  city: string,
  days: number = 14
): Promise<WeatherResponse | null> {
  try {
    const apiKey = process.env.WEATHER_API_KEY;

    if (!apiKey) {
      console.warn('[Weather] WEATHER_API_KEY가 설정되지 않았습니다.');
      return null;
    }

    // 1시간 캐시 적용 (Next.js 자동 캐싱)
    const response = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(city)}&days=${days}&lang=ko`,
      {
        next: { revalidate: 3600 } // 1시간 캐시
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Weather] API 오류:', response.status, errorText);
      throw new Error(`날씨 API 요청 실패: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Weather] 날씨 정보 가져오기 실패:', error);
    return null;
  }
}

/**
 * 현재 날씨만 가져오기
 */
export async function getCurrentWeather(city: string) {
  try {
    const apiKey = process.env.WEATHER_API_KEY;

    if (!apiKey) {
      return null;
    }

    const response = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(city)}&lang=ko`,
      {
        next: { revalidate: 3600 } // 1시간 캐시
      }
    );

    if (!response.ok) {
      throw new Error(`날씨 API 요청 실패: ${response.status}`);
    }

    const data = await response.json();
    return {
      location: data.location,
      current: data.current,
    };
  } catch (error) {
    console.error('[Weather] 현재 날씨 가져오기 실패:', error);
    return null;
  }
}

