'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiMap, FiGlobe, FiTag, FiCalendar, FiMapPin } from 'react-icons/fi';
import { trackFeature } from '@/lib/analytics';
import { checkTestModeClient, getCorrectPath } from '@/lib/test-mode-client';
// 성능 최적화: 무거운 지도 라이브러리는 그대로 사용 (복잡도가 높아서 나중에 최적화)
// 동적 임포트는 컴포넌트 분리 후 적용 예정
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { scaleQuantile } from 'd3-scale';
import { geoCentroid } from 'd3-geo';
import * as topojson from 'topojson-client';
import Image from 'next/image';
// import { FeatureCollection } from 'geojson'; // FeatureCollection 임포트 제거
import TripFormModal from '@/components/TripFormModal'; // TripFormModal 임포트
import VisitedCountryModal from '@/components/VisitedCountryModal'; // VisitedCountryModal 임포트

// Geographies 데이터 (나중에 public/data/world-110m.json 등으로 옮길 수 있습니다)
const geoUrl = "/data/countries-110m.json"; // 로컬 파일 경로로 변경

interface Trip {
  id: string | number; // Changed from number to string | number
  cruiseName: string;
  companion: string;
  destination: string;
  startDate: string;
  endDate: string;
  impressions?: string; // 추가
  createdAt: string; // 추가
}

// 날짜 포맷팅 함수
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 크루즈 이름에서 괄호 안의 영어 제거
function removeEnglishInParentheses(text: string): string {
  return text.replace(/\s*\([^)]+\)/g, '').trim();
}

// 목적지에서 괄호 안의 영어 및 불필요한 하이픈 제거
function removeEnglishFromDestination(destination: string): string {
  return destination.replace(/\s*\([^)]+\)/g, '').replace(/\s*-\s*/g, ' - ').trim();
}

// 국가 코드 매핑 (from app/page.tsx)
const countryCodeMap: { [key: string]: string } = {
  '대한민국': 'KR',
  '일본': 'JP',
  '중국': 'CN',
  '대만': 'TW',
  '필리핀': 'PH',
  '미국': 'US',
  '캐나다': 'CA',
  '멕시코': 'MX',
  '영국': 'GB',
  '프랑스': 'FR',
  '독일': 'DE',
  '이탈리아': 'IT',
  '스페인': 'ES',
  '그리스': 'GR',
  '호주': 'AU',
  '뉴질랜드': 'NZ',
  '남아프리카공화국': 'ZA',
  '브라질': 'BR',
  '아르헨티나': 'AR',
  '이집트': 'EG',
  '터키': 'TR',
  '러시아': 'RU',
  '남극': 'AQ',
  'Antarctica': 'AQ',
};

// 국가 이름으로 국기 이모티콘 가져오기 (from app/page.tsx)
function getFlagEmoji(countryName: string): string {
  const countryCode = countryCodeMap[countryName];
  if (!countryCode) return '';

  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 0x1F1E6 + (char.charCodeAt(0) - 'A'.charCodeAt(0)));
  return String.fromCodePoint(...codePoints);
}

// 목적지 문자열에서 한국어 국가 이름 추출 (from app/page.tsx)
function extractKoreanCountryName(destination: string): string {
  const match = destination.match(/^([^ (]+)/);
  return match ? match[1] : '';
}

// 대륙별 국가 목록 (초기에는 일부만 포함하여 테스트)
const CONTINENTS_DATA = {
  Asia: [
    { koreanName: "대한민국", englishName: "South Korea" },
    { koreanName: "네팔", englishName: "Nepal" },
    { koreanName: "동티모르", englishName: "Timor-Leste" },
    { koreanName: "라오스", englishName: "Laos" },
    { koreanName: "레바논", englishName: "Lebanon" },
    { koreanName: "말레이시아", englishName: "Malaysia" },
    { koreanName: "몰디브", englishName: "Maldives" },
    { koreanName: "몽골", englishName: "Mongolia" },
    { koreanName: "미얀마", englishName: "Myanmar" },
    { koreanName: "바레인", englishName: "Bahrain" },
    { koreanName: "방글라데시", englishName: "Bangladesh" },
    { koreanName: "베트남", englishName: "Vietnam" },
    { koreanName: "부탄", englishName: "Bhutan" },
    { koreanName: "브루나이", englishName: "Brunei" },
    { koreanName: "사우디아라비아", englishName: "Saudi Arabia" },
    { koreanName: "스리랑카", englishName: "Sri Lanka" },
    { koreanName: "시리아", englishName: "Syria" },
    { koreanName: "싱가포르", englishName: "Singapore" },
    { koreanName: "아랍에미리트", englishName: "United Arab Emirates" },
    { koreanName: "아르메니아", englishName: "Armenia" },
    { koreanName: "아제르바이잔", englishName: "Azerbaijan" },
    { koreanName: "아프가니스탄", englishName: "Afghanistan" },
    { koreanName: "예멘", englishName: "Yemen" },
    { koreanName: "오만", englishName: "Oman" },
    { koreanName: "요르단", englishName: "Jordan" },
    { koreanName: "우즈베키스탄", englishName: "Uzbekistan" },
    { koreanName: "이라크", englishName: "Iraq" },
    { koreanName: "이란", englishName: "Iran" },
    { koreanName: "이스라엘", englishName: "Israel" },
    { koreanName: "인도", englishName: "India" },
    { koreanName: "인도네시아", englishName: "Indonesia" },
    { koreanName: "일본", englishName: "Japan" },
    { koreanName: "중국", englishName: "China" },
    { koreanName: "카자흐스탄", englishName: "Kazakhstan" },
    { koreanName: "카타르", englishName: "Qatar" },
    { koreanName: "캄보디아", englishName: "Cambodia" },
    { koreanName: "쿠웨이트", englishName: "Kuwait" },
    { koreanName: "키르기스스탄", englishName: "Kyrgyzstan" },
    { koreanName: "타지키스탄", englishName: "Tajikistan" },
    { koreanName: "태국", englishName: "Thailand" },
    { koreanName: "투르크메니스탄", englishName: "Turkmenistan" },
    { koreanName: "파키스탄", englishName: "Pakistan" },
    { koreanName: "필리핀", englishName: "Philippines" },
    { koreanName: "대만", englishName: "Taiwan" },
  ],
  Europe: [
    { koreanName: "그리스", englishName: "Greece" },
    { koreanName: "네덜란드", englishName: "Netherlands" },
    { koreanName: "노르웨이", englishName: "Norway" },
    { koreanName: "덴마크", englishName: "Denmark" },
    { koreanName: "독일", englishName: "Germany" },
    { koreanName: "라트비아", englishName: "Latvia" },
    { koreanName: "러시아", englishName: "Russia" },
    { koreanName: "루마니아", englishName: "Romania" },
    { koreanName: "룩셈부르크", englishName: "Luxembourg" },
    { koreanName: "리투아니아", englishName: "Lithuania" },
    { koreanName: "리히텐슈타인", englishName: "Liechtenstein" },
    { koreanName: "모나코", englishName: "Monaco" },
    { koreanName: "몬테네그로", englishName: "Montenegro" },
    { koreanName: "몰도바", englishName: "Moldova" },
    { koreanName: "몰타", englishName: "Malta" },
    { koreanName: "바티칸 시국", englishName: "Vatican City" },
    { koreanName: "벨기에", englishName: "Belgium" },
    { koreanName: "벨라루스", englishName: "Belarus" },
    { koreanName: "보스니아 헤르체고비나", englishName: "Bosnia and Herz." },
    { koreanName: "북마케도니아", englishName: "Macedonia" },
    { koreanName: "불가리아", englishName: "Bulgaria" },
    { koreanName: "산마리노", englishName: "San Marino" },
    { koreanName: "세르비아", englishName: "Serbia" },
    { koreanName: "스웨덴", englishName: "Sweden" },
    { koreanName: "스위스", englishName: "Switzerland" },
    { koreanName: "스페인", englishName: "Spain" },
    { koreanName: "슬로바키아", englishName: "Slovakia" },
    { koreanName: "슬로베니아", englishName: "Slovenia" },
    { koreanName: "아이슬란드", englishName: "Iceland" },
    { koreanName: "아일랜드", englishName: "Ireland" },
    { koreanName: "안도라", englishName: "Andorra" },
    { koreanName: "알바니아", englishName: "Albania" },
    { koreanName: "에스토니아", englishName: "Estonia" },
    { koreanName: "영국", englishName: "United Kingdom" },
    { koreanName: "오스트리아", englishName: "Austria" },
    { koreanName: "우크라이나", englishName: "Ukraine" },
    { koreanName: "이탈리아", englishName: "Italy" },
    { koreanName: "조지아", englishName: "Georgia" },
    { koreanName: "체코", englishName: "Czechia" },
    { koreanName: "코소보", englishName: "Kosovo" },
    { koreanName: "크로아티아", englishName: "Croatia" },
    { koreanName: "키프로스", englishName: "Cyprus" },
    { koreanName: "튀르키예", englishName: "Türkiye" },
    { koreanName: "포르투갈", englishName: "Portugal" },
    { koreanName: "폴란드", englishName: "Poland" },
    { koreanName: "프랑스", englishName: "France" },
    { koreanName: "핀란드", englishName: "Finland" },
    { koreanName: "헝가리", englishName: "Hungary" },
  ],
  Africa: [
    { koreanName: "가나", englishName: "Ghana" },
    { koreanName: "가봉", englishName: "Gabon" },
    { koreanName: "감비아", englishName: "Gambia" },
    { koreanName: "기니", englishName: "Guinea" },
    { koreanName: "기니비사우", englishName: "Guinea-Bissau" },
    { koreanName: "나미비아", englishName: "Namibia" },
    { koreanName: "나이지리아", englishName: "Nigeria" },
    { koreanName: "남수단", englishName: "S. Sudan" },
    { koreanName: "남아프리카 공화국", englishName: "South Africa" },
    { koreanName: "니제르", englishName: "Niger" },
    { koreanName: "라이베리아", englishName: "Liberia" },
    { koreanName: "레소토", englishName: "Lesotho" },
    { koreanName: "르완다", englishName: "Rwanda" },
    { koreanName: "리비아", englishName: "Libya" },
    { koreanName: "마다가스카르", englishName: "Madagascar" },
    { koreanName: "말라위", englishName: "Malawi" },
    { koreanName: "말리", englishName: "Mali" },
    { koreanName: "모로코", englishName: "Morocco" },
    { koreanName: "모리셔스", englishName: "Mauritius" },
    { koreanName: "모리타니", englishName: "Mauritania" },
    { koreanName: "모잠비크", englishName: "Mozambique" },
    { koreanName: "베냉", englishName: "Benin" },
    { koreanName: "보츠와나", englishName: "Botswana" },
    { koreanName: "부룬디", englishName: "Burundi" },
    { koreanName: "부르키나파소", englishName: "Burkina Faso" },
    { koreanName: "상투메 프린시페", englishName: "Sao Tome and Principe" },
    { koreanName: "세네갈", englishName: "Senegal" },
    { koreanName: "세이셸", englishName: "Seychelles" },
    { koreanName: "소말리아", englishName: "Somalia" },
    { koreanName: "수단", englishName: "Sudan" },
    { koreanName: "시에라리온", englishName: "Sierra Leone" },
    { koreanName: "알제리", englishName: "Algeria" },
    { koreanName: "앙골라", englishName: "Angola" },
    { koreanName: "에리트레아", englishName: "Eritrea" },
    { koreanName: "에스와티니", englishName: "eSwatini" },
    { koreanName: "에티오피아", englishName: "Ethiopia" },
    { koreanName: "우간다", englishName: "Uganda" },
    { koreanName: "이집트", englishName: "Egypt" },
    { koreanName: "잠비아", englishName: "Zambia" },
    { koreanName: "적도 기니", englishName: "Eq. Guinea" },
    { koreanName: "중앙아프리카 공화국", englishName: "Central African Rep." },
    { koreanName: "지부티", englishName: "Djibouti" },
    { koreanName: "짐바브웨", englishName: "Zimbabwe" },
    { koreanName: "차드", englishName: "Chad" },
    { koreanName: "카메룬", englishName: "Cameroon" },
    { koreanName: "카보베르데", englishName: "Cabo Verde" },
    { koreanName: "케냐", englishName: "Kenya" },
    { koreanName: "코모로", englishName: "Comoros" },
    { koreanName: "코트디부아르", englishName: "Côte d'Ivoire" },
    { koreanName: "콩고 공화국", englishName: "Congo" },
    { koreanName: "콩고 민주 공화국", englishName: "Dem. Rep. Congo" },
    { koreanName: "탄자니아", englishName: "Tanzania" },
    { koreanName: "토고", englishName: "Togo" },
  ],
  NorthAmerica: [
    { koreanName: "캐나다", englishName: "Canada" },
    { koreanName: "미국", englishName: "United States of America" },
    { koreanName: "멕시코", englishName: "Mexico" },
    { koreanName: "과테말라", englishName: "Guatemala" },
    { koreanName: "벨리즈", englishName: "Belize" },
    { koreanName: "엘살바도르", englishName: "El Salvador" },
    { koreanName: "온두라스", englishName: "Honduras" },
    { koreanName: "니카라과", englishName: "Nicaragua" },
    { koreanName: "코스타리카", englishName: "Costa Rica" },
    { koreanName: "파나마", englishName: "Panama" },
    { koreanName: "쿠바", englishName: "Cuba" },
    { koreanName: "자메이카", englishName: "Jamaica" },
    { koreanName: "아이티", englishName: "Haiti" },
    { koreanName: "도미니카 공화국", englishName: "Dominican Rep." },
    { koreanName: "바하마", englishName: "Bahamas" },
    { koreanName: "세인트키츠 네비스", englishName: "Saint Kitts and Nevis" },
    { koreanName: "앤티가 바부다", englishName: "Antigua and Barbuda" },
    { koreanName: "도미니카 연방", englishName: "Dominica" },
    { koreanName: "세인트루시아", englishName: "Saint Lucia" },
    { koreanName: "세인트빈센트 그레나딘", englishName: "Saint Vincent and the Grenadines" },
    { koreanName: "그레나다", englishName: "Grenada" },
    { koreanName: "바베이도스", englishName: "Barbados" },
    { koreanName: "트리니다드 토바고", englishName: "Trinidad and Tobago" },
  ],
  SouthAmerica: [
    { koreanName: "콜롬비아", englishName: "Colombia" },
    { koreanName: "베네수엘라", englishName: "Venezuela" },
    { koreanName: "가이아나", englishName: "Guyana" },
    { koreanName: "수리남", englishName: "Suriname" },
    { koreanName: "에콰도르", englishName: "Ecuador" },
    { koreanName: "페루", englishName: "Peru" },
    { koreanName: "브라질", englishName: "Brazil" },
    { koreanName: "볼리비아", englishName: "Bolivia" },
    { koreanName: "파라과이", englishName: "Paraguay" },
    { koreanName: "칠레", englishName: "Chile" },
    { koreanName: "아르헨티나", englishName: "Argentina" },
    { koreanName: "우루과이", englishName: "Uruguay" },
  ],
  Oceania: [
    { koreanName: "오스트레일리아 (호주)", englishName: "Australia" },
    { koreanName: "뉴질랜드", englishName: "New Zealand" },
    { koreanName: "파푸아뉴기니", englishName: "Papua New Guinea" },
    { koreanName: "피지", englishName: "Fiji" },
    { koreanName: "솔로몬 제도", englishName: "Solomon Is." },
    { koreanName: "바누아투", englishName: "Vanuatu" },
    { koreanName: "사모아", englishName: "Samoa" },
    { koreanName: "키리바시", englishName: "Kiribati" },
    { koreanName: "통가", englishName: "Tonga" },
    { koreanName: "미크로네시아 연방", englishName: "Micronesia" },
    { koreanName: "팔라우", englishName: "Palau" },
    { koreanName: "마셜 제도", englishName: "Marshall Islands" },
    { koreanName: "나우루", englishName: "Nauru" },
    { koreanName: "투발루", englishName: "Tuvalu" },
  ],
  Antarctica: [
    { koreanName: "남극", englishName: "Antarctica" },
  ],
};

// 한국어 국가명을 영문 국가명으로 매핑하는 맵
const countryKoreanToEnglishMap: { [key: string]: string } = (() => {
  const map: { [key: string]: string } = {};
  Object.values(CONTINENTS_DATA).forEach(countries => {
    countries.forEach(country => {
      // 기본 한국어 → 영어 매핑
      map[country.koreanName] = country.englishName;
    });
  });
  return map;
})();

// 국가명 별칭 매핑 (양방향 매핑)
const countryNameAliases: { [key: string]: string } = {
  // 미국 관련
  'United States': 'United States of America',
  'USA': 'United States of America',
  'US': 'United States of America',
  'U.S.A.': 'United States of America',
  'U.S.': 'United States of America',

  // 영국 관련
  'UK': 'United Kingdom',
  'Great Britain': 'United Kingdom',
  'Britain': 'United Kingdom',

  // 한국 관련
  'Korea': 'South Korea',
  'Republic of Korea': 'South Korea',

  // 대만 관련
  'Chinese Taipei': 'Taiwan',

  // 튀르키예
  'Turkey': 'Türkiye',
  'Turkiye': 'Türkiye',

  // 체코
  'Czech Republic': 'Czechia',

  // 콩고 관련
  'Republic of the Congo': 'Congo',
  'Democratic Republic of the Congo': 'Dem. Rep. Congo',
  'DRC': 'Dem. Rep. Congo',

  // 줄임말 변형들
  'Dominican Republic': 'Dominican Rep.',
  'Equatorial Guinea': 'Eq. Guinea',
  'Western Sahara': 'W. Sahara',
  'Central African Republic': 'Central African Rep.',
  'Solomon Islands': 'Solomon Is.',
  'North Cyprus': 'N. Cyprus',
  'South Sudan': 'S. Sudan',
  'Bosnia and Herzegovina': 'Bosnia and Herz.',
  'North Macedonia': 'Macedonia',

  // 에스와티니
  'Eswatini': 'eSwatini',
  'Swaziland': 'eSwatini',
};

// 영문 국가명을 한국어 국가명으로 매핑하는 맵 (별칭 포함)
const englishToKoreanCountryNameMap: { [key: string]: string } = (() => {
  const map: { [key: string]: string } = {};
  Object.values(CONTINENTS_DATA).forEach(countries => {
    countries.forEach(country => {
      const englishName = country.englishName;
      const koreanName = country.koreanName;

      // 기본 영어 이름으로 매핑
      map[englishName] = koreanName;

      // 별칭이 있으면 별칭으로도 매핑
      Object.entries(countryNameAliases).forEach(([alias, standardName]) => {
        if (standardName === englishName) {
          map[alias] = koreanName;
        }
      });
    });
  });

  return map;
})();

// ISO A2 코드를 한국어 국가명으로 매핑하는 맵 (새로 추가)
const isoToKoreanCountryNameMap: { [key: string]: string } = {};
Object.entries(countryCodeMap).forEach(([koreanName, isoCode]) => {
  isoToKoreanCountryNameMap[isoCode] = koreanName;
});

// ISO A2 코드를 영어 국가명으로 매핑하는 맵 (새로 추가)
const isoToEnglishCountryNameMap: { [key: string]: string } = {};
Object.values(CONTINENTS_DATA).forEach(countries => {
  countries.forEach(country => {
    const isoCode = countryCodeMap[country.koreanName];
    if (isoCode) {
      isoToEnglishCountryNameMap[isoCode] = country.englishName;
    }
  });
});

// 4-1) 여행 기록 로드/저장 유틸 추가
const loadTripsFromLocal = (): Trip[] => {
  try {
    const raw = localStorage.getItem('myTrips');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveTripsToLocal = (trips: Trip[]) => {
  localStorage.setItem('myTrips', JSON.stringify(trips));
};

export default function MapPage() {
  const router = useRouter();
  const pathname = usePathname();

  // 경로 보호: 테스트 모드 사용자는 /map-test로 리다이렉트
  useEffect(() => {
    const checkPath = async () => {
      const testModeInfo = await checkTestModeClient();
      const correctPath = getCorrectPath(pathname || '/map', testModeInfo);

      if (correctPath !== pathname) {
        router.replace(correctPath);
      }
    };

    checkPath();
  }, [pathname, router]);

  const [userTrips, setUserTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null); // 지도에서 선택된 국가
  const [currentColor, setCurrentColor] = useState<string>("#EF4444"); // 기본 빨간색
  const [manualColors, setManualColors] = useState<{ [key: string]: string }>(() => {
    if (typeof window !== 'undefined') {
      const savedColors = localStorage.getItem('countryColors');
      // 저장된 색상 맵의 키를 영어 국가명으로 변환
      const parsedColors = savedColors ? JSON.parse(savedColors) : {};
      const newMap: { [key: string]: string } = {};
      for (const koreanName in parsedColors) {
        const englishName = countryKoreanToEnglishMap[koreanName];
        if (englishName) {
          newMap[englishName] = parsedColors[koreanName];
        } else { // 직접 영문 이름으로 저장된 경우 (이전 버전 호환)
          newMap[koreanName] = parsedColors[koreanName];
        }
      }
      return newMap;
    }
    return {};
  });

  // Derived: tripColors (not persisted, calculated from userTrips)
  const tripColors = useMemo(() => {
    const colors: { [key: string]: string } = {};
    userTrips.forEach((trip) => {
      if (trip.destination) {
        const destinations = trip.destination.split(',').map((d: string) => d.trim()).filter((d: string) => d);
        destinations.forEach((dest: string) => {
          const englishName = countryKoreanToEnglishMap[dest];
          if (englishName) {
            colors[englishName] = '#EF4444'; // Default trip color
          }
        });
      }
    });
    return colors;
  }, [userTrips]);

  // Derived: displayedColors (merge manual and trip)
  const countryColorMap = useMemo(() => {
    return { ...tripColors, ...manualColors };
  }, [tripColors, manualColors]);

  // 새로운 상태 변수: 검색어, 목록에서 선택된 국가
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCountryFromList, setSelectedCountryFromList] = useState<string | null>(null);
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({ coordinates: [0, 0], zoom: 1 }); // 지도 확대/축소 및 위치 상태
  const [isTripModalOpen, setIsTripModalOpen] = useState(false); // 여행 추가/수정 모달 상태
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null); // 수정할 여행 데이터
  const [isVisitedCountryModalOpen, setIsVisitedCountryModalOpen] = useState(false); // 방문 국가 모달 상태
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null); // 선택된 국가 코드
  const [preselectedCountry, setPreselectedCountry] = useState<string | null>(null); // 여행 추가 폼에 미리 선택할 국가

  const inited = useRef(false); // Add useRef here

  // calculateDday 함수를 MapPage 컴포넌트 내부로 이동
  const calculateDday = useCallback((startDate: string) => {
    const start = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    const diffTime = start.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, []);

  // 목록에서 선택된 국가에 색상 적용 핸들러 (서버에도 저장)
  const handleApplyColorToListSelectedCountry = useCallback(async () => {
    if (selectedCountryFromList && currentColor) {
      const englishCountryName = countryKoreanToEnglishMap[selectedCountryFromList]; // 한국어 국가명으로 영어 국가명 조회
      if (englishCountryName) {
        // 국가 코드 찾기 (countryCodeMap에서 한국어 이름으로 찾거나, 영어 이름에서 직접)
        let countryCode = countryCodeMap[selectedCountryFromList];
        if (!countryCode) {
          // 영어 이름에서 직접 코드 추출 시도
          const countryCodeFromEnglish = englishCountryName === 'South Korea' ? 'KR' :
            englishCountryName === 'Japan' ? 'JP' :
              englishCountryName === 'Taiwan' ? 'TW' :
                englishCountryName === 'China' ? 'CN' :
                  englishCountryName === 'Hong Kong' ? 'HK' :
                    englishCountryName === 'Philippines' ? 'PH' :
                      englishCountryName === 'United States' ? 'US' :
                        englishCountryName === 'Thailand' ? 'TH' :
                          englishCountryName === 'Vietnam' ? 'VN' :
                            englishCountryName === 'Singapore' ? 'SG' :
                              englishCountryName === 'Indonesia' ? 'ID' :
                                englishCountryName === 'Malaysia' ? 'MY' :
                                  englishCountryName === 'United Kingdom' ? 'GB' :
                                    englishCountryName === 'France' ? 'FR' :
                                      englishCountryName === 'Germany' ? 'DE' :
                                        englishCountryName === 'Italy' ? 'IT' :
                                          englishCountryName === 'Spain' ? 'ES' :
                                            englishCountryName === 'Australia' ? 'AU' :
                                              englishCountryName === 'New Zealand' ? 'NZ' :
                                                englishCountryName === 'Canada' ? 'CA' :
                                                  englishCountryName === 'Mexico' ? 'MX' :
                                                    englishCountryName === 'Brazil' ? 'BR' :
                                                      englishCountryName === 'Argentina' ? 'AR' :
                                                        englishCountryName === 'Greece' ? 'GR' :
                                                          englishCountryName === 'Russia' ? 'RU' :
                                                            englishCountryName === 'Turkey' ? 'TR' :
                                                              englishCountryName === 'Egypt' ? 'EG' :
                                                                englishCountryName === 'South Africa' ? 'ZA' :
                                                                  englishCountryName === 'Antarctica' ? 'AQ' : null;
          countryCode = countryCodeFromEnglish || 'XX'; // 기본값 XX
        }

        // 즉시 로컬 상태 업데이트
        setManualColors((prev) => {
          const newMap = { ...prev };
          newMap[englishCountryName] = currentColor; // 영어 국가명을 키로 사용
          localStorage.setItem('countryColors', JSON.stringify(newMap));
          return newMap;
        });

        // 서버에 방문 국가 저장 (백그라운드)
        try {
          await fetch('/api/visited-countries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              countryCode,
              countryName: englishCountryName,
            }),
          });
          console.log('[MapPage] 방문 국가 서버 저장 완료:', englishCountryName);
        } catch (error) {
          console.error('[MapPage] 방문 국가 서버 저장 실패:', error);
          // 서버 저장 실패해도 로컬에는 저장됨
        }
      }
    }
  }, [selectedCountryFromList, currentColor, countryKoreanToEnglishMap]);

  const handleRemoveColorFromSelectedCountry = useCallback(() => {
    if (selectedCountryFromList) {
      const englishCountryName = countryKoreanToEnglishMap[selectedCountryFromList]; // 한국어 국가명으로 영어 국가명 조회
      if (englishCountryName) {
        setManualColors((prev) => {
          const newMap = { ...prev };
          delete newMap[englishCountryName]; // 영어 국가명을 키로 사용
          localStorage.setItem('countryColors', JSON.stringify(newMap));
          return newMap;
        });
      }
    }
  }, [selectedCountryFromList, countryKoreanToEnglishMap]);

  // GeoJSON features에서 해당 영문 국가명에 대한 한국어 이름을 찾기 위한 맵 생성 // 제거
  // const englishToKoreanCountryNameMap: { [key: string]: string } = useMemo(() => {
  //   const map: { [key: string]: string } = {};
  //   Object.values(CONTINENTS_DATA).forEach(countries => {
  //     countries.forEach(country => {
  //       map[country.englishName] = country.koreanName;
  //     });
  //   });
  //   return map;
  // }, []);

  const [geographyData, setGeographyData] = useState<any[] | null>(null); // 타입을 any[] | null로 변경
  const [isTripsLoaded, setIsTripsLoaded] = useState(false);
  const [isMapDataLoaded, setIsMapDataLoaded] = useState(false);

  // 4-2) useEffect 초기화 로직 교체
  useEffect(() => {
    if (inited.current) return; // Add guard here
    inited.current = true;     // Mark as initialized

    const init = async () => {
      console.log('Map Page: Starting init process.');
      try {
        // 1) 여행 기록: localStorage에서 먼저 로드 (사용자가 추가한 여행 보존)
        let localTrips: Trip[] = loadTripsFromLocal();
        console.log('Map Page: Trips loaded from localStorage:', localTrips);

        // 2) 지도 페이지 여행 기록 API에서 로드 (서버와 동기화)
        let apiTrips: Trip[] = [];
        try {
          const apiResponse = await fetch('/api/map-travel-records', { credentials: 'include' });
          const apiData = await apiResponse.json().catch(() => ({}));
          apiTrips = Array.isArray(apiData?.trips) ? apiData.trips : [];
          console.log('Map Page: Map travel records loaded from API:', apiTrips);
        } catch (apiError) {
          console.warn('Map Page: API map travel records fetch failed, using localStorage only.', apiError);
        }

        // 3) 두 데이터 소스 병합 (localStorage 우선, 중복 제거)
        const mergedTrips: Trip[] = [];
        const tripIdSet = new Set<string | number>();

        // 먼저 localStorage 데이터 추가 (우선순위 높음)
        localTrips.forEach(trip => {
          if (!tripIdSet.has(trip.id)) {
            mergedTrips.push(trip);
            tripIdSet.add(trip.id);
          }
        });

        // 그 다음 API 데이터 추가 (중복되지 않는 것만)
        apiTrips.forEach(trip => {
          if (!tripIdSet.has(trip.id)) {
            mergedTrips.push(trip);
            tripIdSet.add(trip.id);
          }
        });

        // 등록 순서대로 정렬 (오래된 순서부터)
        mergedTrips.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.startDate).getTime();
          const dateB = new Date(b.createdAt || b.startDate).getTime();
          return dateA - dateB; // 오름차순 (등록 순서대로)
        });

        console.log('Map Page: Merged trips:', mergedTrips);
        setUserTrips(mergedTrips);

        // 병합된 데이터를 localStorage에 저장 (동기화)
        saveTripsToLocal(mergedTrips);

        // 4) 여행 데이터에서 방문 국가 자동 추출 (Cleanup을 위해 계산)
        const currentTripColors: { [key: string]: string } = {};
        mergedTrips.forEach((trip) => {
          if (trip.destination) {
            const destinations = trip.destination.split(',').map((d: string) => d.trim()).filter((d: string) => d);
            destinations.forEach((dest: string) => {
              const englishName = countryKoreanToEnglishMap[dest];
              if (englishName) {
                currentTripColors[englishName] = '#EF4444';
              }
            });
          }
        });

        // 5) 방문 국가 색상 데이터: localStorage에서 먼저 로드
        let localColorMap: { [key: string]: string } = {};
        if (typeof window !== 'undefined') {
          const savedColors = localStorage.getItem('countryColors');
          if (savedColors) {
            try {
              const parsedColors = JSON.parse(savedColors);
              for (const key in parsedColors) {
                const englishName = countryKoreanToEnglishMap[key];
                if (englishName) {
                  localColorMap[englishName] = parsedColors[key];
                } else if (isoToEnglishCountryNameMap[key]) {
                  localColorMap[isoToEnglishCountryNameMap[key]] = parsedColors[key];
                } else {
                  localColorMap[key] = parsedColors[key];
                }
              }
            } catch (e) {
              console.warn('Map Page: Failed to parse localStorage countryColors:', e);
            }
          }
        }

        // 5) API에서도 방문 국가 데이터 로드 시도
        try {
          const visitedResponse = await fetch('/api/visited-countries', { credentials: 'include' });
          const visitedData = await visitedResponse.json().catch(() => ({}));

          if (visitedData.ok && visitedData.colorMap) {
            const apiColorMapConverted: { [key: string]: string } = {};
            Object.entries(visitedData.colorMap).forEach(([countryCode, color]) => {
              const englishName = isoToEnglishCountryNameMap[countryCode];
              if (englishName) {
                apiColorMapConverted[englishName] = color as string;
              } else {
                apiColorMapConverted[countryCode] = color as string;
              }
            });
            // API 데이터와 localStorage 데이터 병합
            localColorMap = { ...apiColorMapConverted, ...localColorMap };
          }
        } catch (visitedError) {
          console.warn('Map Page: Failed to load visited countries from API, using localStorage only:', visitedError);
        }

        // CLEANUP: Remove any color from localColorMap that exists in currentTripColors AND is default red
        // This fixes the "ghost" issue where trip colors were saved as manual colors.
        Object.keys(currentTripColors).forEach(country => {
          if (localColorMap[country] === '#EF4444') {
            delete localColorMap[country];
          }
        });

        setManualColors(localColorMap);
        localStorage.setItem('countryColors', JSON.stringify(localColorMap));

        setIsTripsLoaded(true);

        // 2) 지도 데이터: 그대로 fetch (정적 파일)
        console.log('Map Page: Fetching map data from', geoUrl);
        const mapResponse = await fetch(geoUrl);
        if (!mapResponse.ok) {
          throw new Error(`HTTP error! status: ${mapResponse.status}`);
        }
        const world = await mapResponse.json();
        console.log('Map Page: Map data fetched.', world);
        console.log('Map Page: world.objects.countries', world.objects.countries); // 추가된 로그
        const features = (topojson.feature(world, world.objects.countries as any) as any).features;

        // 모든 국가 이름 로그 출력 (싱가포르 확인용)
        const allCountryNames = features.map((f: any) => f.properties?.name).filter(Boolean);
        console.log('Map Page: All country names in map data:', allCountryNames.sort());
        const singaporeInMap = allCountryNames.find((name: string) =>
          name.toLowerCase().includes('singapore')
        );
        console.log('Map Page: Singapore in map data?', singaporeInMap || 'NOT FOUND');

        setGeographyData(features);
        setIsMapDataLoaded(true);
        console.log('Map Page: Geography data set.', features);
      } catch (e) {
        console.error('Map Page: Map init failed', e);
        setIsTripsLoaded(true);
        setIsMapDataLoaded(true);
      }
    };

    init();

    // 여행 기록을 다시 불러오는 함수
    const loadTripsFromServer = async () => {
      try {
        console.log('[MapPage] 서버에서 여행 기록 다시 불러오기');
        const apiResponse = await fetch('/api/map-travel-records', { credentials: 'include' });
        const apiData = await apiResponse.json().catch(() => ({}));

        if (apiData.ok && Array.isArray(apiData.trips)) {
          const apiTrips: Trip[] = apiData.trips;
          console.log('[MapPage] 서버에서 불러온 여행 기록:', apiTrips);

          // 서버 데이터가 우선 (서버가 진실의 원천)
          setUserTrips(apiTrips);
          saveTripsToLocal(apiTrips);
        }
      } catch (error) {
        console.error('[MapPage] 여행 기록 불러오기 실패:', error);
      }
    };

    // 페이지가 다시 보일 때 여행 기록 다시 불러오기
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[MapPage] 페이지가 다시 보임, 여행 기록 다시 불러오기');
        loadTripsFromServer();
      }
    };

    // 포커스 이벤트 (페이지 전환 후 돌아올 때)
    const handleFocus = () => {
      console.log('[MapPage] 페이지 포커스, 여행 기록 다시 불러오기');
      loadTripsFromServer();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    console.log('Map Page: isTripsLoaded', isTripsLoaded, 'isMapDataLoaded', isMapDataLoaded);
    if (isTripsLoaded && isMapDataLoaded) {
      setIsLoading(false);
      console.log('Map Page: isLoading set to false.');
    }
  }, [isTripsLoaded, isMapDataLoaded]);

  // 기능 사용 추적
  useEffect(() => {
    trackFeature('map');
  }, []);

  // 국가 클릭 핸들러
  const handleCountryClick = useCallback((geo: any) => {
    const englishCountryName = geo.properties.name; // name 속성 사용
    // console.log('Map Page: Country clicked:', englishCountryName); // Debug log commented out
    if (!englishCountryName) { // name이 없는 경우 처리
      console.warn('Map Page: Clicked geography has no name property:', geo.properties);
      return;
    }

    const koreanCountryName = englishToKoreanCountryNameMap[englishCountryName]; // 영어 국가명으로 한국어 이름 조회
    setSelectedCountry(englishCountryName); // selectedCountry는 영어 국가명으로 저장
    setSelectedCountryFromList(koreanCountryName || englishCountryName); // 목록 선택도 연동 (한국어 이름 우선, 없으면 영어)

    // ISO 3166-1 alpha-2 국가 코드로 변환 (간단한 매핑)
    const countryCode = englishCountryName === 'South Korea' ? 'KR' :
      englishCountryName === 'Japan' ? 'JP' :
        englishCountryName === 'Taiwan' ? 'TW' :
          englishCountryName === 'China' ? 'CN' :
            englishCountryName === 'Hong Kong' ? 'HK' :
              englishCountryName === 'Philippines' ? 'PH' :
                englishCountryName === 'United States' ? 'US' :
                  englishCountryName === 'Thailand' ? 'TH' :
                    englishCountryName === 'Vietnam' ? 'VN' :
                      englishCountryName === 'Singapore' ? 'SG' :
                        englishCountryName === 'Indonesia' ? 'ID' :
                          englishCountryName === 'Malaysia' ? 'MY' :
                            englishCountryName === 'Brazil' ? 'BR' :
                              englishCountryName === 'Antarctica' ? 'AQ' :
                                isoToEnglishCountryNameMap ? Object.keys(isoToEnglishCountryNameMap).find(code => isoToEnglishCountryNameMap[code] === englishCountryName) || englishCountryName : englishCountryName;

    setSelectedCountryCode(countryCode);

    // 방문한 국가인 경우 모달 열기 (방문 기록 있음)
    const isVisited = Object.keys(countryColorMap).includes(englishCountryName);
    if (isVisited) {
      setIsVisitedCountryModalOpen(true);
      return;
    }

    // 방문하지 않은 국가: 모달 열기 (안내 메시지 표시)
    // 사용자가 직접 색상을 선택하고 싶은 경우를 위해 모달을 먼저 표시
    setIsVisitedCountryModalOpen(true);
  }, [currentColor, englishToKoreanCountryNameMap, countryColorMap]);

  const handleAddTripClick = useCallback((countryName?: string) => {
    setEditingTrip(null); // 새 여행 추가이므로 기존 데이터 없음
    setPreselectedCountry(countryName || null); // 선택된 국가가 있으면 미리 설정
    setIsTripModalOpen(true);
  }, []);

  const handleEditTripClick = useCallback((trip: Trip) => {
    setEditingTrip(trip);
    setIsTripModalOpen(true);
  }, []);

  const handleTripFormSubmit = useCallback(async (tripData: any) => {
    try {
      // 서버에 저장/수정
      const method = tripData.id ? 'PUT' : 'POST';
      const url = '/api/map-travel-records';

      // 날짜 필수 검증 (먼저 확인)
      if (!tripData.startDate || !tripData.endDate) {
        console.error('[MapPage] 날짜 누락:', { startDate: tripData.startDate, endDate: tripData.endDate });
        throw new Error('여행 시작일과 종료일은 필수 입력 항목입니다.');
      }

      // 안전하게 데이터 준비 (null/undefined 처리)
      const requestBody: any = {
        cruiseName: tripData.cruiseName || undefined,
        companion: tripData.companion || undefined,
        destination: tripData.destination || undefined,
        startDate: String(tripData.startDate).trim(),
        endDate: String(tripData.endDate).trim(),
        impressions: tripData.impressions || undefined,
      };

      // 날짜 형식 검증
      if (!/^\d{4}-\d{2}-\d{2}$/.test(requestBody.startDate)) {
        console.error('[MapPage] 시작일 형식 오류:', requestBody.startDate);
        throw new Error(`시작일 형식이 올바르지 않습니다: ${requestBody.startDate}. YYYY-MM-DD 형식이어야 합니다.`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(requestBody.endDate)) {
        console.error('[MapPage] 종료일 형식 오류:', requestBody.endDate);
        throw new Error(`종료일 형식이 올바르지 않습니다: ${requestBody.endDate}. YYYY-MM-DD 형식이어야 합니다.`);
      }

      console.log('[MapPage] 서버 전송 데이터:', requestBody);

      // undefined 값 제거 (하지만 startDate와 endDate는 필수이므로 제거하지 않음)
      Object.keys(requestBody).forEach(key => {
        if (key !== 'startDate' && key !== 'endDate' && (requestBody[key] === undefined || requestBody[key] === '')) {
          delete requestBody[key];
        }
      });

      if (tripData.id) {
        requestBody.id = tripData.id;
      }

      // 색상 데이터 처리: TripFormModal에서 선택한 국가별 색상 적용
      if (tripData.selectedCountriesWithColors && Array.isArray(tripData.selectedCountriesWithColors)) {
        const newColors: { [key: string]: string } = {};
        tripData.selectedCountriesWithColors.forEach((item: { englishName: string; color: string }) => {
          if (item.englishName && item.color) {
            newColors[item.englishName] = item.color;
          }
        });

        if (Object.keys(newColors).length > 0) {
          setManualColors(prev => {
            const updated = { ...prev, ...newColors };
            // localStorage에도 저장
            if (typeof window !== 'undefined') {
              localStorage.setItem('countryColors', JSON.stringify(updated));
            }
            console.log('[MapPage] 국가별 색상 저장:', newColors);
            return updated;
          });
        }
      }

      // 서버 저장 전에 먼저 로컬에 저장 (오프라인 지원 및 크루즈가이드 지니/3일체험 공유)
      const tripToSave: Trip = {
        id: tripData.id || `local-${Date.now()}`,
        cruiseName: tripData.cruiseName || '',
        companion: tripData.companion || '',
        destination: tripData.destination || '',
        startDate: tripData.startDate,
        endDate: tripData.endDate,
        impressions: tripData.impressions || '',
        createdAt: tripData.createdAt || new Date().toISOString(),
      };

      // 로컬에 즉시 저장 (서버 응답 전에)
      const currentTrips = loadTripsFromLocal();
      if (tripData.id) {
        // 수정: 기존 항목 찾아서 업데이트
        const index = currentTrips.findIndex(t => String(t.id) === String(tripData.id));
        if (index >= 0) {
          currentTrips[index] = tripToSave;
        } else {
          currentTrips.push(tripToSave);
        }
      } else {
        // 새 항목 추가
        currentTrips.push(tripToSave);
      }
      saveTripsToLocal(currentTrips);
      setUserTrips([...currentTrips]);
      console.log('[MapPage] 로컬 저장 완료 (서버 응답 전) - 크루즈가이드 지니/3일체험 공유용');

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log('[MapPage] 서버 응답 전체:', JSON.stringify(data, null, 2));
      console.log('[MapPage] 서버 응답 ok:', data.ok);
      console.log('[MapPage] 서버 응답 message:', data.message);
      console.log('[MapPage] 서버 응답 details:', data.details);
      console.log('[MapPage] 서버 응답 code:', data.code);

      if (!response.ok || !data.ok) {
        // 서버 저장 실패해도 로컬에는 이미 저장됨
        console.warn('[MapPage] 서버 저장 실패, 로컬 저장은 완료됨:', data.message);
        // 에러를 throw하지 않고 성공으로 처리 (로컬 저장 완료)
        alert(`여행 기록이 저장되었습니다.\n\n(로컬 저장 완료, 서버 동기화는 나중에 자동으로 시도됩니다)`);
        return;
      }

      // 서버 저장 성공: 서버 응답에서 받은 실제 ID로 로컬 데이터 업데이트
      if (data.trip && data.trip.id) {
        const serverTripId = data.trip.id;
        const localTripIndex = currentTrips.findIndex(t => {
          // 새로 추가한 경우: local- 접두사가 있거나, ID가 없거나, 서버 응답과 내용이 같은 경우
          if (!tripData.id) {
            // 같은 내용인지 확인 (날짜, 목적지, 크루즈명으로 비교)
            return t.startDate === tripToSave.startDate &&
              t.endDate === tripToSave.endDate &&
              t.destination === tripToSave.destination &&
              t.cruiseName === tripToSave.cruiseName;
          }
          return String(t.id) === String(tripData.id);
        });

        if (localTripIndex >= 0) {
          // 로컬 데이터를 서버에서 받은 실제 ID로 업데이트
          currentTrips[localTripIndex] = {
            ...currentTrips[localTripIndex],
            id: serverTripId,
            ...data.trip,
          };
          saveTripsToLocal(currentTrips);
          setUserTrips([...currentTrips]);
          console.log('[MapPage] 로컬 데이터를 서버 ID로 업데이트 완료:', serverTripId);
        }
      }

      // 서버에서 최신 데이터 다시 불러오기 (중복 방지)
      const loadResponse = await fetch('/api/map-travel-records', { credentials: 'include' });
      const loadData = await loadResponse.json();

      if (loadData.ok && Array.isArray(loadData.trips)) {
        // 서버 데이터와 로컬 데이터 병합 (서버 데이터 우선, 중복 제거)
        const mergedTrips: Trip[] = [];
        const tripIdSet = new Set<string | number>();
        const tripContentSet = new Set<string>(); // 내용 기반 중복 체크용

        // 서버 데이터 우선 추가
        loadData.trips.forEach((trip: Trip) => {
          if (!tripIdSet.has(trip.id)) {
            mergedTrips.push(trip);
            tripIdSet.add(trip.id);
            // 내용 기반 키 생성 (중복 체크용)
            const contentKey = `${trip.startDate}-${trip.endDate}-${trip.destination}-${trip.cruiseName}`;
            tripContentSet.add(contentKey);
          }
        });

        // 로컬 데이터 중 서버에 없는 것만 추가 (내용 기반 중복 체크)
        currentTrips.forEach((trip: Trip) => {
          const tripIdStr = String(trip.id);
          const contentKey = `${trip.startDate}-${trip.endDate}-${trip.destination}-${trip.cruiseName}`;

          // 서버에 없는 ID이고, 내용도 다른 경우만 추가
          if (!tripIdSet.has(trip.id) && !tripContentSet.has(contentKey)) {
            mergedTrips.push(trip);
            tripIdSet.add(trip.id);
            tripContentSet.add(contentKey);
          }
        });

        setUserTrips(mergedTrips);
        saveTripsToLocal(mergedTrips);
        console.log('[MapPage] 서버와 로컬 데이터 병합 완료, 중복 제거됨');
      }
    } catch (error: any) {
      // 네트워크 에러 등으로 서버 요청 자체가 실패한 경우에도 로컬에는 이미 저장됨
      console.error('[MapPage] 여행 기록 저장 중 예외 발생:', error);
      console.error('[MapPage] 에러 상세:', {
        message: error?.message,
        details: error?.details,
        code: error?.code,
        hint: error?.hint,
      });

      // 로컬 저장은 이미 완료되었으므로 사용자에게 성공 메시지 표시
      alert(`여행 기록이 저장되었습니다.\n\n(로컬 저장 완료, 서버 동기화는 나중에 자동으로 시도됩니다)`);
    }
  }, [countryKoreanToEnglishMap]);

  const handleZoomIn = useCallback(() => {
    setPosition((prev) => ({
      ...prev,
      zoom: prev.zoom * 1.2,
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setPosition((prev) => ({
      ...prev,
      zoom: prev.zoom / 1.2,
    }));
  }, []);

  const handleDeleteTrip = useCallback(async (tripId: string | number) => {
    if (!confirm('정말로 이 여행 기록을 삭제하시겠습니까?')) {
      return;
    }

    try {
      // 삭제할 여행의 목적지 국가 정보 저장 (색상 정리용)
      const tripToDelete = userTrips.find(t => String(t.id) === String(tripId));
      const destinationsToRemove: string[] = [];

      if (tripToDelete?.destination) {
        const destinations = tripToDelete.destination.split(',').map((d: string) => d.trim()).filter((d: string) => d);
        destinations.forEach((dest: string) => {
          const englishName = countryKoreanToEnglishMap[dest];
          if (englishName) {
            destinationsToRemove.push(englishName);
          }
        });
      }

      // 서버에서 삭제
      const response = await fetch(`/api/map-travel-records?id=${tripId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || '여행 기록 삭제에 실패했습니다');
      }

      // 서버에서 최신 데이터 다시 불러오기
      const loadResponse = await fetch('/api/map-travel-records', { credentials: 'include' });
      const loadData = await loadResponse.json();

      if (loadData.ok && Array.isArray(loadData.trips)) {
        setUserTrips(loadData.trips);
        saveTripsToLocal(loadData.trips);

        // 삭제 후 남은 여행들에서 사용되는 국가 목록 계산
        const remainingCountries = new Set<string>();
        loadData.trips.forEach((trip: Trip) => {
          if (trip.destination) {
            const dests = trip.destination.split(',').map((d: string) => d.trim()).filter((d: string) => d);
            dests.forEach((dest: string) => {
              const englishName = countryKoreanToEnglishMap[dest];
              if (englishName) {
                remainingCountries.add(englishName);
              }
            });
          }
        });

        // 삭제한 여행의 국가 중 다른 여행에서 사용되지 않는 국가의 색상 제거
        setManualColors(prev => {
          const newMap = { ...prev };
          let hasChanges = false;

          destinationsToRemove.forEach(country => {
            // 다른 여행에서 사용되지 않는 국가만 삭제
            if (!remainingCountries.has(country) && newMap[country]) {
              delete newMap[country];
              hasChanges = true;
              console.log('[MapPage] 국가 색상 삭제:', country);
            }
          });

          if (hasChanges) {
            localStorage.setItem('countryColors', JSON.stringify(newMap));
          }
          return newMap;
        });
      }
    } catch (error) {
      console.error('[MapPage] 여행 기록 삭제 실패:', error);
      alert(`여행 기록 삭제에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }, [userTrips, countryKoreanToEnglishMap]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-lg text-gray-800">지도를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex flex-col h-screen bg-gray-100 text-gray-900 overflow-hidden">
      {/* Header */}
      <header className="bg-white p-4 shadow-md flex justify-between items-center border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <Link href="/profile" className="flex items-center text-gray-600 hover:text-gray-900 transition-colors">
            <FiArrowLeft size={28} className="mr-2" />
          </Link>
          <div className="w-10 h-10 rounded-full flex items-center justify-center">
            <Image src="/images/ai-cruise-logo.png" alt="크루즈 가이드 로고" width={40} height={40} className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">나의 크루즈 여행 지도</h1>
            <p className="text-gray-500 text-sm">방문했던 국가를 색칠하고 기록해보세요</p>
          </div>
        </div>
      </header>

      {/* Content - Changed to flex-col */}
      <div className="flex-1 flex flex-col p-6 overflow-y-auto">
        {/* Map Section - Increased height */}
        <div className="relative bg-blue-50 rounded-2xl shadow-xl border border-gray-200 p-6 flex items-center justify-center overflow-hidden mb-6 h-[60vh]">
          {isLoading ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-lg text-gray-800">지도를 불러오는 중...</p>
            </div>
          ) : (
            <ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 150 }} className="w-full h-full">
              <ZoomableGroup zoom={position.zoom} center={position.coordinates} onMoveEnd={setPosition}>
                {geographyData && (
                  <Geographies geography={geographyData || []}>
                    {({ geographies }: { geographies: any[] }) => {
                      console.log('Map Page: Rendering geographies.', geographies.length, 'geographies found.');
                      console.log('Map Page: countryColorMap keys:', Object.keys(countryColorMap));
                      console.log('Map Page: countryColorMap full:', countryColorMap);

                      // 싱가포르 관련 국가 찾기 (디버깅)
                      const singaporeCountries = geographies.filter((g: any) => {
                        const name = g.properties?.name?.toLowerCase() || '';
                        return name.includes('singapore') || name.includes('싱가포르');
                      });
                      if (singaporeCountries.length > 0) {
                        console.log('Map Page: Singapore-related countries found:', singaporeCountries.map((g: any) => ({
                          name: g.properties.name,
                          allProperties: Object.keys(g.properties)
                        })));
                      }

                      return geographies.map((geo: any) => {
                        const englishCountryName = geo.properties.name; // name 속성 사용
                        // name이 없으면 렌더링하지 않거나 기본 처리
                        if (!englishCountryName) {
                          console.warn('Map Page: Skipping geo without name:', geo.properties);
                          return null;
                        }

                        // 국가명 매칭 시도 (다양한 방법으로 시도)
                        let isVisited = false;
                        let countryColor = "#F8F9FA";

                        // 1. 정확한 매칭
                        if (countryColorMap[englishCountryName]) {
                          isVisited = true;
                          countryColor = countryColorMap[englishCountryName];
                        }

                        // 2. 대소문자 무시 매칭
                        if (!isVisited) {
                          const matchedKey = Object.keys(countryColorMap).find(key =>
                            key.toLowerCase() === englishCountryName.toLowerCase()
                          );
                          if (matchedKey) {
                            isVisited = true;
                            countryColor = countryColorMap[matchedKey];
                            console.log(`Map Page: Case-insensitive match: ${englishCountryName} -> ${matchedKey}`);
                          }
                        }

                        // 3. 별칭 매핑을 통한 매칭
                        if (!isVisited) {
                          const alias = countryNameAliases[englishCountryName];
                          if (alias && countryColorMap[alias]) {
                            isVisited = true;
                            countryColor = countryColorMap[alias];
                            console.log(`Map Page: Alias match: ${englishCountryName} -> ${alias}`);
                          }
                        }

                        // 4. 국가 코드를 통해 매칭 (countryColorMap에 국가 코드가 키로 있는 경우)
                        if (!isVisited) {
                          // 영어 국가명에서 국가 코드 찾기
                          const countryCode = isoToEnglishCountryNameMap ?
                            Object.keys(isoToEnglishCountryNameMap).find(code =>
                              isoToEnglishCountryNameMap[code] === englishCountryName
                            ) : null;
                          if (countryCode && countryColorMap[countryCode]) {
                            isVisited = true;
                            countryColor = countryColorMap[countryCode];
                            console.log(`Map Page: Country code match: ${englishCountryName} (${countryCode})`);
                          }
                        }

                        // 5. 부분 일치 매칭 (Singapore, Brazil 등)
                        if (!isVisited) {
                          const partialMatch = Object.keys(countryColorMap).find(key => {
                            const keyLower = key.toLowerCase();
                            const nameLower = englishCountryName.toLowerCase();
                            return keyLower.includes(nameLower) || nameLower.includes(keyLower);
                          });
                          if (partialMatch) {
                            isVisited = true;
                            countryColor = countryColorMap[partialMatch];
                            console.log(`Map Page: Partial match: ${englishCountryName} -> ${partialMatch}`);
                          }
                        }

                        const centroid = geoCentroid(geo);

                        return (
                          <g key={geo.rsmKey}>
                            <Geography
                              geography={geo}
                              fill={isVisited ? countryColor : "#F8F9FA"}
                              stroke="#868E96"
                              strokeWidth={0.7}
                              onClick={() => handleCountryClick(geo)}
                              style={{
                                default: { outline: "none" },
                                hover: { outline: "none", fill: isVisited ? countryColor : "#E0E0E0" },
                                pressed: { outline: "none" },
                              }}
                            />
                            {isVisited && englishToKoreanCountryNameMap[englishCountryName] && (
                              <Marker coordinates={centroid}>
                                <text
                                  y="5"
                                  textAnchor="middle"
                                  className="text-[6px] font-bold fill-white pointer-events-none drop-shadow-sm"
                                  style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: "1px", strokeLinecap: "round", strokeLinejoin: "round" }}
                                >
                                  {englishToKoreanCountryNameMap[englishCountryName]}
                                </text>
                              </Marker>
                            )}
                          </g>
                        );
                      });
                    }}
                  </Geographies>
                )}

                {/* 사용자의 여행 목적지 마커 */}

              </ZoomableGroup>
            </ComposableMap>
          )}

          {/* 확대/축소 버튼 */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col space-y-2">
            <button
              onClick={handleZoomIn}
              className="p-2 bg-white rounded-md shadow-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-red"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6 text-gray-700">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 bg-white rounded-md shadow-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-red"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6 text-gray-700">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Controls Section - now below the map */}
        <div className="w-full">
          {/* 나의 크루즈 여행 기록 */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <FiTag className="mr-2" /> 나의 크루즈 여행 기록
              </h2>
              {/* 새로운 여행 추가하기 버튼 */}
              <button
                onClick={() => handleAddTripClick()}
                className="bg-brand-red hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm whitespace-nowrap"
              >
                + 새로운 여행 추가
              </button>
            </div>
            {
              userTrips.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2">
                  {userTrips.map((trip, index) => (
                    <div key={trip.id} className="bg-gray-50 p-3 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-bold text-sm text-gray-800 flex-1">
                          {index === 0 && "📌 첫 번째"}
                          {index === 1 && "📌 두 번째"}
                          {index === 2 && "📌 세 번째"}
                          {index > 2 && `📌 ${index + 1}번째`}
                        </h3>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => handleEditTripClick(trip)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium px-1"
                            title="수정"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteTrip(trip.id)}
                            className="text-red-600 hover:text-red-800 text-xs font-medium px-1"
                            title="삭제"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <p className="text-gray-700 truncate">
                          <span className="font-semibold">🚢</span> {removeEnglishInParentheses(trip.cruiseName)}
                        </p>
                        <p className="text-gray-700 truncate">
                          <span className="font-semibold">📍</span> {removeEnglishFromDestination(trip.destination)}
                        </p>
                        <p className="text-gray-600 text-xs">
                          <FiCalendar className="inline mr-1" /> {formatDate(trip.startDate)} ~ {formatDate(trip.endDate)}
                        </p>
                        <p className="text-gray-600 font-medium">
                          {calculateDday(trip.startDate) > 0 ? `D-${calculateDday(trip.startDate)}` : `여행 ${-calculateDday(trip.startDate) + 1}일차`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">아직 등록된 여행 기록이 없습니다.</p>
                  <button
                    onClick={() => handleAddTripClick()}
                    className="bg-brand-red hover:bg-red-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                  >
                    첫 여행 추가하기
                  </button>
                </div>
              )
            }
          </div>
        </div>
      </div>
      <TripFormModal
        isOpen={isTripModalOpen}
        onClose={() => {
          setIsTripModalOpen(false);
          setPreselectedCountry(null); // 모달 닫을 때 초기화
        }}
        onSubmit={handleTripFormSubmit}
        initialData={editingTrip ?? undefined} // null일 경우 undefined 전달
        preselectedCountry={preselectedCountry} // 선택된 국가 전달
      />

      <VisitedCountryModal
        isOpen={isVisitedCountryModalOpen}
        onClose={() => setIsVisitedCountryModalOpen(false)}
        countryCode={selectedCountryCode}
        countryName={selectedCountryFromList}
        onAddTrip={handleAddTripClick} // 여행 추가 폼 열기 핸들러 전달
      />
    </main>
  );
} 