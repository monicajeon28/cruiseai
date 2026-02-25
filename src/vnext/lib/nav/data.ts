import terminalsData from '@/data/terminals.json';
import { includesKo } from './utils';

export const COUNTRIES = [
  { label: '미국', value: 'US' },
  { label: '캐나다', value: 'CA' },
  { label: '멕시코', value: 'MX' },
  { label: '자메이카', value: 'JM' },
  { label: '바하마', value: 'BS' },
  { label: '영국', value: 'GB' },
  { label: '프랑스', value: 'FR' },
  { label: '이탈리아', value: 'IT' },
  { label: '스페인', value: 'ES' },
  { label: '독일', value: 'DE' },
  { label: '호주', value: 'AU' },
  { label: '뉴질랜드', value: 'NZ' },
  { label: '일본', value: 'JP' },
  { label: '중국', value: 'CN' },
  { label: '싱가포르', value: 'SG' },
  { label: '아랍에미리트', value: 'AE' },
  { label: '브라질', value: 'BR' },
  { label: '아르헨티나', value: 'AR' },
  { label: '남아프리카 공화국', value: 'ZA' },
  { label: '이집트', value: 'EG' },
  { label: '그리스', value: 'GR' },
  { label: '터키', value: 'TR' },
  { label: '러시아', value: 'RU' },
  { label: '인도', value: 'IN' },
  { label: '태국', value: 'TH' },
  { label: '베트남', value: 'VN' },
  { label: '필리핀', value: 'PH' },
  { label: '말레이시아', value: 'MY' },
  { label: '인도네시아', value: 'ID' },
  { label: '스위스', value: 'CH' },
  { label: '오스트리아', value: 'AT' },
  { label: '네덜란드', value: 'NL' },
  { label: '벨기에', value: 'BE' },
  { label: '아일랜드', value: 'IE' },
  { label: '노르웨이', value: 'NO' },
  { label: '스웨덴', value: 'SE' },
  { label: '덴마크', value: 'DK' },
  { label: '핀란드', value: 'FI' },
  { label: '포르투갈', value: 'PT' },
  { label: '폴란드', value: 'PL' },
  { label: '체코', value: 'CZ' },
  { label: '헝가리', value: 'HU' },
  { label: '페루', value: 'PE' },
  { label: '칠레', value: 'CL' },
  { label: '콜롬비아', value: 'CO' },
  { label: '에콰도르', value: 'EC' },
  { label: '베네수엘라', value: 'VE' },
  { label: '모로코', value: 'MA' },
  { label: '케냐', value: 'KE' },
  { label: '나이지리아', value: 'NG' },
  { label: '이디오피아', value: 'ET' },
];

export const CITIES = [
  // 인기 도시
  { label: '뉴욕', value: 'New York' },
  { label: '런던', value: 'London' },
  { label: '파리', value: 'Paris' },
  { label: '도쿄', value: 'Tokyo' },
  { label: '서울', value: 'Seoul' },
  { label: '로스앤젤레스', value: 'Los Angeles' },
  { label: '시드니', value: 'Sydney' },
  { label: '베이징', value: 'Beijing' },
  { label: '모스크바', value: 'Moscow' },
  { label: '두바이', value: 'Dubai' },

  // 크루즈 주요 기항지
  { label: '마이애미', value: 'Miami' },
  { label: '바르셀로나', value: 'Barcelona' },
  { label: '로마', value: 'Rome' },
  { label: '베니스', value: 'Venice' },
  { label: '코펜하겐', value: 'Copenhagen' },
  { label: '상하이', value: 'Shanghai' },
  { label: '싱가포르', value: 'Singapore' },
  { label: '시애틀', value: 'Seattle' },
  { label: '밴쿠버', value: 'Vancouver' },
  { label: '알래스카', value: 'Alaska' }, // 주 또는 지역이지만, 편의상 도시처럼 포함
  { label: '카리브해', value: 'Caribbean' }, // 지역이지만, 편의상 도시처럼 포함
  { label: '멕시코 리비에라', value: 'Mexican Riviera' }, // 지역
  { label: '지중해', value: 'Mediterranean' }, // 지역
  { label: '북유럽', value: 'Northern Europe' }, // 지역
  { label: '알래스카', value: 'Alaska' },
  { label: '하와이', value: 'Hawaii' },
  { label: '카보산루카스', value: 'Cabo San Lucas' },
  { label: '코즈멜', value: 'Cozumel' },
  { label: '나폴리', value: 'Naples' },
  { label: '산토리니', value: 'Santorini' },
];

export const ATTRACTIONS = [
  { label: '에펠탑', value: 'Eiffel Tower' },
  { label: '자유의 여신상', value: 'Statue of Liberty' },
  { label: '콜로세움', value: 'Colosseum' },
  { label: '만리장성', value: 'Great Wall of China' },
  { label: '타지마할', value: 'Taj Mahal' },
  { label: '시드니 오페라 하우스', value: 'Sydney Opera House' },
  { label: '피라미드', value: 'Pyramids of Giza' },
  { label: '빅벤', value: 'Big Ben' },
  { label: '센트럴 파크', value: 'Central Park' },
  { label: '루브르 박물관', value: 'Louvre Museum' },
];

export interface TerminalData {
  id: string;
  name: string;
  name_ko: string;
  keywords_ko: string[];
  lat: number;
  lng: number;
  city: string;
  country: string;
}

export const CRUISE_TERMINALS: TerminalData[] = Array.from(
  new Map<string, TerminalData>(
    terminalsData
      .filter(terminal => terminal.name.toLowerCase().includes('cruise') || terminal.name.toLowerCase().includes('port'))
      .map(terminal => [terminal.id, terminal as TerminalData])
  ).values()
);

export const PORTS = CRUISE_TERMINALS.map(terminal => ({
  label: terminal.name_ko,
  value: terminal.name,
}));

// 모든 POI(관심 지점) 데이터를 한 곳에 모읍니다.
export const ALL_POIS = [
  ...COUNTRIES.map(item => ({ ...item, type: 'country' })),
  ...CITIES.map(item => ({ ...item, type: 'city' })),
  ...ATTRACTIONS.map(item => ({ ...item, type: 'attraction' })),
  ...PORTS.map(item => ({ ...item, type: 'port' })),
];

// 검색을 위한 모든 라벨과 값을 단일 배열로 결합합니다.
export const ALL_SEARCHABLE_ITEMS = ALL_POIS.map(item => ({ label: item.label, value: item.value }));

/* === 미국(US) 크루즈 터미널 정의 === */
export const US_PORTS = [
  { label: '포트 마이애미', value: 'PortMiami' },
  { label: '포트 카나베랄', value: 'Port Canaveral' },
  { label: '갈베스톤 크루즈 터미널', value: 'Galveston Cruise Terminal' },
  { label: '롱비치 크루즈 터미널', value: 'Long Beach Cruise Terminal' },
  { label: '맨해튼 크루즈 터미널', value: 'Manhattan Cruise Terminal' },
  { label: '브루클린 크루즈 터미널', value: 'Brooklyn Cruise Terminal' },
  { label: '샌프란시스코 크루즈 터미널', value: 'San Francisco Cruise Terminal' },
  { label: '시애틀 크루즈 터미널', value: 'Seattle Cruise Terminal' },
];

/** 국가코드별 포트 매핑 (필요 국가만 점진 추가) */
export const portsByCountry: Record<string, { label: string; value: string }[]> = {
  ...CRUISE_TERMINALS.reduce((acc, terminal) => {
    const countryCode = findCountryCodeByKorean(terminal.country) || COUNTRIES.find(c => c.label.toLowerCase() === terminal.country.toLowerCase())?.value || terminal.country;
    if (countryCode) {
      if (!acc[countryCode]) {
        acc[countryCode] = [];
      }
      acc[countryCode].push({ label: terminal.name_ko, value: terminal.name });
    }
    return acc;
  }, {} as Record<string, { label: string; value: string }[]>),
  // KR: [
  //   { label: '부산항 국제여객터미널', value: 'Busan Port International Passenger Terminal' },
  //   { label: '인천항 국제여객터미널', value: 'Incheon Port International Passenger Terminal' },
  //   { label: '제주항 국제여객터미널', value: 'Jeju Port International Passenger Terminal' },
  // ],
  // JP: [
  //   { label: '도쿄 국제 크루즈 터미널', value: 'Tokyo International Cruise Terminal' },
  //   { label: '요코하마 오산바시', value: 'Yokohama Osanbashi Pier' },
  // ],
  // HK: [
  //   { label: '홍콩 오션 터미널', value: 'Ocean Terminal, Hong Kong' },
  //   { label: '카이탁 크루즈 터미널', value: 'Kai Tak Cruise Terminal' },
  // ],
};

/** 한글 국가명 → ISO2 코드 */
export function findCountryCodeByKorean(kor: string): string | null {
  const q = kor.trim();
  const hit = COUNTRIES.find(c => c.label === q);
  return hit?.value ?? null;
}

export function filterCruiseTerminals(query: string, country?: string, city?: string): TerminalData[] {
  let filteredTerminals = CRUISE_TERMINALS;

  if (country) {
    filteredTerminals = filteredTerminals.filter(terminal => terminal.country.toLowerCase() === country.toLowerCase());
  }

  if (city) {
    filteredTerminals = filteredTerminals.filter(terminal => terminal.city.toLowerCase() === city.toLowerCase());
  }

  if (query) {
    const lowerCaseQuery = query.toLowerCase();
    filteredTerminals = filteredTerminals.filter(terminal =>
      includesKo(terminal.name_ko, query) ||
      includesKo(terminal.name, query) ||
      terminal.keywords_ko.some(keyword => includesKo(keyword, query))
    );
  }

  const uniqueTerminals = Array.from(new Map(filteredTerminals.map(terminal => [terminal.id, terminal])).values());

  return uniqueTerminals;
}
