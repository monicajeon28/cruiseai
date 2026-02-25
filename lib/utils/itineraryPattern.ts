// lib/utils/itineraryPattern.ts
// itineraryPattern 파싱 및 국가 코드 추출 유틸리티

import { getKoreanCountryName } from './countryMapping';

/**
 * itineraryPattern을 배열 형태로 정규화
 * - 배열 형태: 그대로 반환
 * - 객체 형태: { days: [...] } 또는 { destination: [...], days: [...] } → days 배열 반환
 */
export function normalizeItineraryPattern(pattern: any): any[] {
  if (!pattern) return [];
  
  // 문자열인 경우 JSON 파싱 시도
  let parsed: any = pattern;
  if (typeof pattern === 'string') {
    try {
      parsed = JSON.parse(pattern);
    } catch (e) {
      console.error('[normalizeItineraryPattern] JSON parse error:', e);
      return [];
    }
  }
  
  // 배열인 경우 그대로 반환
  if (Array.isArray(parsed)) {
    return parsed;
  }
  
  // 객체인 경우 days 배열 추출
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.days)) {
      return parsed.days;
    }
    // days가 없으면 빈 배열 반환
    return [];
  }
  
  return [];
}

/**
 * itineraryPattern에서 국가 코드 배열 추출
 * 모든 타입의 day에서 국가를 추출 (PortVisit, Embarkation, Disembarkation 등)
 */
export function extractCountryCodesFromItineraryPattern(pattern: any): string[] {
  const days = normalizeItineraryPattern(pattern);
  const countryCodes = new Set<string>();
  
  days.forEach((day: any) => {
    // 모든 타입의 day에서 국가 추출 (PortVisit, Embarkation, Disembarkation 등)
    if (day && typeof day === 'object' && day.country) {
      const countryCode = String(day.country).toUpperCase().trim();
      // 한국 제외하고 유효한 국가 코드만 추가
      if (countryCode && countryCode !== 'KR' && countryCode.length === 2) {
        countryCodes.add(countryCode);
      }
    }
  });
  
  return Array.from(countryCodes);
}

/**
 * itineraryPattern에서 목적지 배열 추출 (한국어 이름 형식)
 */
export function extractDestinationsFromItineraryPattern(pattern: any): string[] {
  const days = normalizeItineraryPattern(pattern);
  const destinations: string[] = [];
  const seen = new Set<string>();
  
  days.forEach((day: any) => {
    if (day.type === 'PortVisit' && day.location && day.country) {
      const countryName = getKoreanCountryName(day.country) || day.country;
      const destinationStr = `${countryName} - ${day.location}`;
      
      if (!seen.has(destinationStr)) {
        seen.add(destinationStr);
        destinations.push(destinationStr);
      }
    }
  });
  
  return destinations;
}

/**
 * itineraryPattern에서 방문 국가 정보 추출 (코드와 이름)
 */
export function extractVisitedCountriesFromItineraryPattern(pattern: any): Map<string, { code: string; name: string; location: string | null }> {
  const days = normalizeItineraryPattern(pattern);
  const visitedCountries = new Map<string, { code: string; name: string; location: string | null }>();
  
  days.forEach((day: any) => {
    if (day.country && typeof day.country === 'string' && day.country !== 'KR') {
      const code = day.country.toUpperCase();
      const name = getKoreanCountryName(code) || code;
      
      if (!visitedCountries.has(code)) {
        visitedCountries.set(code, {
          code,
          name,
          location: day.location || null,
        });
      }
    }
  });
  
  return visitedCountries;
}

