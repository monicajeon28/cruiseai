// data/airlines.ts
// 세계 주요 항공사 목록 (한국어 이름 + IATA 코드)

export interface Airline {
  code: string;      // IATA 코드 (2자리)
  nameKo: string;    // 한국어 이름
  nameEn: string;    // 영어 이름
  region: string;    // 지역 그룹
  displayName: string; // 표시용 이름 (예: 대한항공(KE))
}

export const AIRLINES: Airline[] = [
  // 직접 입력 옵션
  { code: 'MANUAL', nameKo: '직접 입력', nameEn: 'Manual Entry', region: '기타', displayName: '직접 입력' },

  // 아시아 - 동북아
  { code: 'KE', nameKo: '대한항공', nameEn: 'Korean Air', region: '아시아 - 동북아', displayName: '대한항공(KE)' },
  { code: 'OZ', nameKo: '아시아나항공', nameEn: 'Asiana Airlines', region: '아시아 - 동북아', displayName: '아시아나항공(OZ)' },
  { code: '7C', nameKo: '제주항공', nameEn: 'Jeju Air', region: '아시아 - 동북아', displayName: '제주항공(7C)' },
  { code: 'LJ', nameKo: '진에어', nameEn: 'Jin Air', region: '아시아 - 동북아', displayName: '진에어(LJ)' },
  { code: 'TW', nameKo: '티웨이항공', nameEn: "T'way Air", region: '아시아 - 동북아', displayName: '티웨이항공(TW)' },
  { code: 'JL', nameKo: '일본항공', nameEn: 'Japan Airlines', region: '아시아 - 동북아', displayName: '일본항공(JL)' },
  { code: 'NH', nameKo: '전일본공수', nameEn: 'All Nippon Airways', region: '아시아 - 동북아', displayName: '전일본공수(NH)' },
  { code: 'CA', nameKo: '중국국제항공', nameEn: 'Air China', region: '아시아 - 동북아', displayName: '중국국제항공(CA)' },
  { code: 'MU', nameKo: '중국동방항공', nameEn: 'China Eastern Airlines', region: '아시아 - 동북아', displayName: '중국동방항공(MU)' },
  { code: 'CZ', nameKo: '중국남방항공', nameEn: 'China Southern Airlines', region: '아시아 - 동북아', displayName: '중국남방항공(CZ)' },
  { code: 'CX', nameKo: '캐세이퍼시픽', nameEn: 'Cathay Pacific', region: '아시아 - 동북아', displayName: '캐세이퍼시픽(CX)' },
  { code: 'CI', nameKo: '중화항공', nameEn: 'China Airlines', region: '아시아 - 동북아', displayName: '중화항공(CI)' },
  { code: 'BR', nameKo: '에바항공', nameEn: 'EVA Air', region: '아시아 - 동북아', displayName: '에바항공(BR)' },
  { code: 'HX', nameKo: '홍콩항공', nameEn: 'Hong Kong Airlines', region: '아시아 - 동북아', displayName: '홍콩항공(HX)' },
  { code: 'SC', nameKo: '산동항공', nameEn: 'Shandong Airlines', region: '아시아 - 동북아', displayName: '산동항공(SC)' },
  { code: 'FM', nameKo: '상하이항공', nameEn: 'Shanghai Airlines', region: '아시아 - 동북아', displayName: '상하이항공(FM)' },
  { code: 'ZH', nameKo: '선전항공', nameEn: 'Shenzhen Airlines', region: '아시아 - 동북아', displayName: '선전항공(ZH)' },
  { code: 'MF', nameKo: '샤먼항공', nameEn: 'Xiamen Airlines', region: '아시아 - 동북아', displayName: '샤먼항공(MF)' },

  // 아시아 - 동남아/서남아
  { code: 'SQ', nameKo: '싱가포르항공', nameEn: 'Singapore Airlines', region: '아시아 - 동남아/서남아', displayName: '싱가포르항공(SQ)' },
  { code: 'TG', nameKo: '타이항공', nameEn: 'Thai Airways', region: '아시아 - 동남아/서남아', displayName: '타이항공(TG)' },
  { code: 'VN', nameKo: '베트남항공', nameEn: 'Vietnam Airlines', region: '아시아 - 동남아/서남아', displayName: '베트남항공(VN)' },
  { code: 'VJ', nameKo: '비엣젯항공', nameEn: 'VietJet Air', region: '아시아 - 동남아/서남아', displayName: '비엣젯항공(VJ)' },
  { code: 'PR', nameKo: '필리핀항공', nameEn: 'Philippine Airlines', region: '아시아 - 동남아/서남아', displayName: '필리핀항공(PR)' },
  { code: '5J', nameKo: '세부퍼시픽', nameEn: 'Cebu Pacific', region: '아시아 - 동남아/서남아', displayName: '세부퍼시픽(5J)' },
  { code: 'GA', nameKo: '가루다인도네시아항공', nameEn: 'Garuda Indonesia', region: '아시아 - 동남아/서남아', displayName: '가루다인도네시아항공(GA)' },
  { code: 'MH', nameKo: '말레이시아항공', nameEn: 'Malaysia Airlines', region: '아시아 - 동남아/서남아', displayName: '말레이시아항공(MH)' },
  { code: 'AK', nameKo: '에어아시아', nameEn: 'AirAsia', region: '아시아 - 동남아/서남아', displayName: '에어아시아(AK)' },
  { code: 'XJ', nameKo: '타이에어아시아X', nameEn: 'Thai AirAsia X', region: '아시아 - 동남아/서남아', displayName: '타이에어아시아X(XJ)' },
  { code: 'BI', nameKo: '로얄브루나이항공', nameEn: 'Royal Brunei Airlines', region: '아시아 - 동남아/서남아', displayName: '로얄브루나이항공(BI)' },
  { code: '6E', nameKo: '인디고항공', nameEn: 'IndiGo', region: '아시아 - 동남아/서남아', displayName: '인디고항공(6E)' },
  { code: 'AI', nameKo: '에어인디아', nameEn: 'Air India', region: '아시아 - 동남아/서남아', displayName: '에어인디아(AI)' },

  // 중동
  { code: 'EK', nameKo: '에미레이트항공', nameEn: 'Emirates', region: '중동', displayName: '에미레이트항공(EK)' },
  { code: 'QR', nameKo: '카타르항공', nameEn: 'Qatar Airways', region: '중동', displayName: '카타르항공(QR)' },
  { code: 'EY', nameKo: '에티하드항공', nameEn: 'Etihad Airways', region: '중동', displayName: '에티하드항공(EY)' },
  { code: 'SV', nameKo: '사우디아항공', nameEn: 'Saudia', region: '중동', displayName: '사우디아항공(SV)' },
  { code: 'TK', nameKo: '터키항공', nameEn: 'Turkish Airlines', region: '중동', displayName: '터키항공(TK)' },
  { code: 'WY', nameKo: '오만항공', nameEn: 'Oman Air', region: '중동', displayName: '오만항공(WY)' },
  { code: 'RJ', nameKo: '로얄요르단항공', nameEn: 'Royal Jordanian', region: '중동', displayName: '로얄요르단항공(RJ)' },

  // 북아메리카 - 미국/캐나다
  { code: 'DL', nameKo: '델타항공', nameEn: 'Delta Air Lines', region: '북아메리카', displayName: '델타항공(DL)' },
  { code: 'AA', nameKo: '아메리칸항공', nameEn: 'American Airlines', region: '북아메리카', displayName: '아메리칸항공(AA)' },
  { code: 'UA', nameKo: '유나이티드항공', nameEn: 'United Airlines', region: '북아메리카', displayName: '유나이티드항공(UA)' },
  { code: 'WN', nameKo: '사우스웨스트항공', nameEn: 'Southwest Airlines', region: '북아메리카', displayName: '사우스웨스트항공(WN)' },
  { code: 'AC', nameKo: '에어캐나다', nameEn: 'Air Canada', region: '북아메리카', displayName: '에어캐나다(AC)' },
  { code: 'HA', nameKo: '하와이안항공', nameEn: 'Hawaiian Airlines', region: '북아메리카', displayName: '하와이안항공(HA)' },
  { code: 'AS', nameKo: '알래스카항공', nameEn: 'Alaska Airlines', region: '북아메리카', displayName: '알래스카항공(AS)' },
  { code: 'B6', nameKo: '제트블루', nameEn: 'JetBlue Airways', region: '북아메리카', displayName: '제트블루(B6)' },
  { code: 'NK', nameKo: '스피릿항공', nameEn: 'Spirit Airlines', region: '북아메리카', displayName: '스피릿항공(NK)' },
  { code: 'WS', nameKo: '웨스트젯', nameEn: 'WestJet', region: '북아메리카', displayName: '웨스트젯(WS)' },
  { code: 'AM', nameKo: '아에로멕시코', nameEn: 'Aeromexico', region: '북아메리카', displayName: '아에로멕시코(AM)' },

  // 유럽
  { code: 'LH', nameKo: '루프트한자', nameEn: 'Lufthansa', region: '유럽', displayName: '루프트한자(LH)' },
  { code: 'AF', nameKo: '에어프랑스', nameEn: 'Air France', region: '유럽', displayName: '에어프랑스(AF)' },
  { code: 'KL', nameKo: 'KLM네덜란드항공', nameEn: 'KLM Royal Dutch Airlines', region: '유럽', displayName: 'KLM네덜란드항공(KL)' },
  { code: 'BA', nameKo: '영국항공', nameEn: 'British Airways', region: '유럽', displayName: '영국항공(BA)' },
  { code: 'AY', nameKo: '핀에어', nameEn: 'Finnair', region: '유럽', displayName: '핀에어(AY)' },
  { code: 'LX', nameKo: '스위스국제항공', nameEn: 'Swiss International Air Lines', region: '유럽', displayName: '스위스국제항공(LX)' },
  { code: 'AZ', nameKo: '이타항공', nameEn: 'ITA Airways', region: '유럽', displayName: '이타항공(AZ)' },
  { code: 'IB', nameKo: '이베리아항공', nameEn: 'Iberia', region: '유럽', displayName: '이베리아항공(IB)' },
  { code: 'LO', nameKo: 'LOT폴란드항공', nameEn: 'LOT Polish Airlines', region: '유럽', displayName: 'LOT폴란드항공(LO)' },
  { code: 'OK', nameKo: '체코항공', nameEn: 'Czech Airlines', region: '유럽', displayName: '체코항공(OK)' },
  { code: 'OS', nameKo: '오스트리아항공', nameEn: 'Austrian Airlines', region: '유럽', displayName: '오스트리아항공(OS)' },
  { code: 'SK', nameKo: 'SAS스칸디나비아항공', nameEn: 'Scandinavian Airlines', region: '유럽', displayName: 'SAS스칸디나비아항공(SK)' },
  { code: 'FR', nameKo: '라이언에어', nameEn: 'Ryanair', region: '유럽', displayName: '라이언에어(FR)' },
  { code: 'U2', nameKo: '이지젯', nameEn: 'easyJet', region: '유럽', displayName: '이지젯(U2)' },
  { code: 'W6', nameKo: '위즈에어', nameEn: 'Wizz Air', region: '유럽', displayName: '위즈에어(W6)' },
  { code: 'VY', nameKo: '부엘링항공', nameEn: 'Vueling', region: '유럽', displayName: '부엘링항공(VY)' },
  { code: 'TP', nameKo: '탭포르투갈항공', nameEn: 'TAP Air Portugal', region: '유럽', displayName: '탭포르투갈항공(TP)' },
  { code: 'SU', nameKo: '아에로플로트', nameEn: 'Aeroflot', region: '유럽', displayName: '아에로플로트(SU)' },

  // 오세아니아
  { code: 'QF', nameKo: '콴타스항공', nameEn: 'Qantas', region: '오세아니아', displayName: '콴타스항공(QF)' },
  { code: 'NZ', nameKo: '에어뉴질랜드', nameEn: 'Air New Zealand', region: '오세아니아', displayName: '에어뉴질랜드(NZ)' },
  { code: 'JQ', nameKo: '젯스타', nameEn: 'Jetstar Airways', region: '오세아니아', displayName: '젯스타(JQ)' },
  { code: 'VA', nameKo: '버진오스트레일리아', nameEn: 'Virgin Australia', region: '오세아니아', displayName: '버진오스트레일리아(VA)' },

  // 중남미 & 아프리카
  { code: 'LA', nameKo: '라탐항공', nameEn: 'LATAM Airlines', region: '중남미 & 아프리카', displayName: '라탐항공(LA)' },
  { code: 'AV', nameKo: '아비앙카항공', nameEn: 'Avianca', region: '중남미 & 아프리카', displayName: '아비앙카항공(AV)' },
  { code: 'CM', nameKo: '코파항공', nameEn: 'Copa Airlines', region: '중남미 & 아프리카', displayName: '코파항공(CM)' },
  { code: 'AR', nameKo: '아에로아르헨티나', nameEn: 'Aerolineas Argentinas', region: '중남미 & 아프리카', displayName: '아에로아르헨티나(AR)' },
  { code: 'ET', nameKo: '에티오피아항공', nameEn: 'Ethiopian Airlines', region: '중남미 & 아프리카', displayName: '에티오피아항공(ET)' },
  { code: 'MS', nameKo: '이집트항공', nameEn: 'EgyptAir', region: '중남미 & 아프리카', displayName: '이집트항공(MS)' },
  { code: 'SA', nameKo: '남아프리카항공', nameEn: 'South African Airways', region: '중남미 & 아프리카', displayName: '남아프리카항공(SA)' },
  { code: 'KQ', nameKo: '케냐항공', nameEn: 'Kenya Airways', region: '중남미 & 아프리카', displayName: '케냐항공(KQ)' },
  { code: 'AT', nameKo: '로얄에어모로코', nameEn: 'Royal Air Maroc', region: '중남미 & 아프리카', displayName: '로얄에어모로코(AT)' },

  // 기타 / 없음
  { code: 'NONE', nameKo: '항공 미포함', nameEn: 'No Flight', region: '기타', displayName: '항공 미포함' },
];

// 지역 순서 정의
const REGION_ORDER = [
  '아시아 - 동북아',
  '아시아 - 동남아/서남아',
  '중동',
  '북아메리카',
  '유럽',
  '오세아니아',
  '중남미 & 아프리카',
  '기타',
];

// 검색 함수 (한글/영어/코드 모두 검색 가능)
export function searchAirlines(query: string): Airline[] {
  if (!query || query.trim() === '') {
    return AIRLINES.filter(a => a.code !== 'MANUAL'); // 검색 안 할 때는 직접입력 제외
  }

  const normalizedQuery = query.toLowerCase().trim();

  return AIRLINES.filter(airline =>
    airline.code !== 'MANUAL' && (
      airline.nameKo.toLowerCase().includes(normalizedQuery) ||
      airline.nameEn.toLowerCase().includes(normalizedQuery) ||
      airline.code.toLowerCase().includes(normalizedQuery) ||
      airline.region.toLowerCase().includes(normalizedQuery) ||
      airline.displayName.toLowerCase().includes(normalizedQuery)
    )
  );
}

// 코드로 항공사 찾기
export function getAirlineByCode(code: string): Airline | undefined {
  return AIRLINES.find(airline => airline.code === code.toUpperCase());
}

// 지역별 항공사 목록
export function getAirlinesByRegion(region: string): Airline[] {
  return AIRLINES.filter(airline => airline.region === region && airline.code !== 'MANUAL');
}

// 지역별로 그룹핑된 항공사 목록 (드롭다운용)
export function getAirlinesGroupedByRegion(): { region: string; airlines: Airline[] }[] {
  const groups: { region: string; airlines: Airline[] }[] = [];

  for (const region of REGION_ORDER) {
    if (region === '기타') continue; // 기타는 나중에 처리
    const airlines = AIRLINES.filter(a => a.region === region && a.code !== 'MANUAL' && a.code !== 'NONE');
    if (airlines.length > 0) {
      groups.push({ region, airlines });
    }
  }

  return groups;
}

// 추천 항공사 (지역순서대로, 직접입력/미포함 제외)
export function getRecommendedAirlines(): Airline[] {
  const result: Airline[] = [];

  for (const region of REGION_ORDER) {
    if (region === '기타') continue;
    const airlines = AIRLINES.filter(a => a.region === region && a.code !== 'MANUAL' && a.code !== 'NONE');
    result.push(...airlines);
  }

  return result;
}

// 직접 입력 항목 가져오기
export function getManualEntryOption(): Airline {
  return AIRLINES.find(a => a.code === 'MANUAL')!;
}

// 항공 미포함 옵션 가져오기
export function getNoFlightOption(): Airline {
  return AIRLINES.find(a => a.code === 'NONE')!;
}
