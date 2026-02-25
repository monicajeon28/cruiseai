import { portsByCountry, findCountryCodeByKorean } from '@/vnext/lib/nav/data';

export type Terminal = { id: string; name_ko: string; lat: number; lng: number; }; // 임시 Terminal 타입 정의

export function normalizeCountryOrCityToken(input: string) {
  const s = (input||'').trim().toLowerCase();
  if (s==='us' || s==='usa' || s==='united states' || s==='미국') return 'US';
  return findCountryCodeByKorean(input) || s.toUpperCase();
}

export function suggestCruiseTerminals(countryOrToken: string, limit?: number) {
  const cc = normalizeCountryOrCityToken(countryOrToken);
  const terminals = portsByCountry[cc] ?? [];
  return limit ? terminals.slice(0, limit) : terminals;
}

// 임시 suggestAirports 함수
export function suggestAirports(countryOrToken: string, limit?: number): Terminal[] {
  const cc = normalizeCountryOrCityToken(countryOrToken);
  // 실제 공항 데이터가 없으므로 임시 데이터 반환
  const airports: Terminal[] = [
    { id: 'LAX', name_ko: '로스앤젤레스 공항', lat: 33.94, lng: -118.4 },
    { id: 'JFK', name_ko: '뉴욕 JFK 공항', lat: 40.64, lng: -73.77 },
  ];
  return limit ? airports.slice(0, limit) : airports;
}

// 임시 resolveTerminalByText 함수
export function resolveTerminalByText(text: string): Terminal | undefined {
  const normalizedText = text.trim().toLowerCase();
  // 간단한 매칭 로직 (실제 구현 필요)
  const allTerminals: Terminal[] = [];
  for (const countryCode in portsByCountry) {
    portsByCountry[countryCode].forEach(port => {
      allTerminals.push({ id: port.value, name_ko: port.label, lat: 0, lng: 0 }); // lat, lng 임시 값
    });
  }
  // 임시 공항 데이터도 추가
  const airports: Terminal[] = [
    { id: 'LAX', name_ko: '로스앤젤레스 공항', lat: 33.94, lng: -118.4 },
    { id: 'JFK', name_ko: '뉴욕 JFK 공항', lat: 40.64, lng: -73.77 },
  ];
  allTerminals.push(...airports);

  return allTerminals.find(t => t.name_ko.toLowerCase().includes(normalizedText) || t.id.toLowerCase().includes(normalizedText));
}
