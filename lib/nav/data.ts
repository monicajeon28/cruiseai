// 재사용 가능한 카탈로그 (필요 시 계속 추가)
export type Place = { code: string; name: string; q: string; emoji?: string };

// 공항: 나라(또는 지역)별
export const airportsByCountry: Record<string, Place[]> = {
  TW: [
    { code: 'TPE', name: '타오위안 국제공항 (TPE)', q: 'Taiwan Taoyuan International Airport (TPE)', emoji:'🛫' },
    { code: 'TSA', name: '송산공항 (TSA)',        q: 'Taipei Songshan Airport (TSA)', emoji:'🛫' },
    { code: 'KHH', name: '가오슝 국제공항 (KHH)',  q: 'Kaohsiung International Airport (KHH)', emoji:'🛫' },
    { code: 'RMQ', name: '타이중 국제공항 (RMQ)',  q: 'Taichung International Airport (RMQ)', emoji:'🛫' },
    { code: 'HUN', name: '화롄 공항 (HUN)',        q: 'Hualien Airport (HUN)', emoji:'🛫' },
    { code: 'TTT', name: '타이둥 공항 (TTT)',       q: 'Taitung Airport (TTT)', emoji:'🛫' },
  ],
  JP: [
    { code: 'HND', name:'하네다 (HND)', q:'Tokyo Haneda Airport', emoji:'🛫' },
    { code: 'NRT', name:'나리타 (NRT)', q:'Narita International Airport', emoji:'🛫' },
    { code: 'KIX', name:'간사이 (KIX)', q:'Kansai International Airport', emoji:'🛫' },
    { code: 'ITM', name:'이타미 (ITM)', q:'Osaka Itami Airport', emoji:'🛫' },
    { code: 'FUK', name:'후쿠오카 (FUK)', q:'Fukuoka Airport', emoji:'🛫' },
  ],
  KR: [
    { code:'ICN', name:'인천국제공항 (ICN)', q:'Incheon International Airport', emoji:'🛫' },
    { code:'GMP', name:'김포공항 (GMP)',     q:'Gimpo International Airport', emoji:'🛫' },
    { code:'PUS', name:'김해공항 (PUS)',     q:'Gimhae International Airport', emoji:'🛫' },
    { code:'CJU', name:'제주공항 (CJU)',     q:'Jeju International Airport', emoji:'🛫' },
  ],
  HK: [
    { code:'HKG', name:'홍콩국제공항 (HKG)', q:'Hong Kong International Airport', emoji:'🛫' },
  ],
  SG: [
    { code:'SIN', name:'창이공항 (SIN)', q:'Singapore Changi Airport', emoji:'🛫' },
  ],
};

// 크루즈 터미널: 도시/지역 키로 묶음
export const terminalsByRegion: Record<string, Place[]> = {
  HONGKONG: [
    { code:'KAI_TAK', name:'카이탁 크루즈 터미널', q:'Kai Tak Cruise Terminal, Hong Kong', emoji:'🛳️' },
    { code:'OCEAN',   name:'오션터미널 (침사추이)', q:'Ocean Terminal, Tsim Sha Tsui, Hong Kong', emoji:'🛳️' },
  ],
  TAIWAN: [
    { code:'KEELUNG', name:'기륭(지룽) 크루즈 터미널', q:'Port of Keelung (Keelung Passenger Terminal)', emoji:'🛳️' },
    { code:'KAOHS',   name:'가오슝 크루즈 터미널',     q:'Kaohsiung Cruise Terminal', emoji:'🛳️' },
    { code:'HUALIEN', name:'화롄 항 크루즈 터미널',    q:'Hualien Port Passenger Terminal', emoji:'🛳️' },
  ],
  JAPAN: [
    { code:'YOKO',  name:'요코하마 오산바시', q:'Osanbashi Yokohama International Passenger Terminal', emoji:'🛳️' },
    { code:'KOBE',  name:'고베 크루즈 터미널',  q:'Kobe Cruise Terminal', emoji:'🛳️' },
    { code:'OSAKA', name:'오사카(Tempozan)',   q:'Osaka Tempozan Passenger Terminal', emoji:'🛳️' },
    { code:'NAGAS', name:'나가사키 크루즈 터미널', q:'Nagasaki Cruise Terminal', emoji:'🛳️' },
  ],
  KOREA: [
    { code:'BUSAN',  name:'부산 국제여객터미널(크루즈)', q:'Busan International Passenger Terminal (Cruise)', emoji:'🛳️' },
    { code:'INCHEON',name:'인천 크루즈 터미널',          q:'Incheon Cruise Terminal', emoji:'🛳️' },
    { code:'JEJU',   name:'제주 국제여객터미널',          q:'Jeju International Passenger Terminal', emoji:'🛳️' },
  ],
  SINGAPORE: [
    { code:'MBCCS', name:'마리나 베이 크루즈센터', q:'Marina Bay Cruise Centre Singapore (MBCCS)', emoji:'🛳️' },
    { code:'HARBOUR', name:'하버프론트(크루즈/페리)', q:'HarbourFront Centre Ferry & Cruise', emoji:'🛳️' },
  ],
};






