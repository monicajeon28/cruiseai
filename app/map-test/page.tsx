'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiMap, FiGlobe, FiTag, FiCalendar, FiMapPin } from 'react-icons/fi';
import { trackFeature } from '@/lib/analytics';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { scaleQuantile } from 'd3-scale';
import { geoCentroid } from 'd3-geo'; // d3-geo에서 geoCentroid 임포트
import Image from 'next/image'; // Added missing import for Image
// import LogoutButton from '@/components/LogoutButton';
import { ZoomableGroup } from "react-simple-maps"; // ZoomableGroup 임포트
import * as topojson from 'topojson-client'; // topojson-client 임포트
// import { FeatureCollection } from 'geojson'; // FeatureCollection 임포트 제거
import TripFormModal from '@/components/TripFormModal'; // TripFormModal 임포트
import VisitedCountryModal from '@/components/VisitedCountryModal'; // VisitedCountryModal 임포트
import TutorialCountdown from '@/app/chat/components/TutorialCountdown';
import { checkTestModeClient, TestModeInfo, getCorrectPath } from '@/lib/test-mode-client';
import { clearAllLocalStorage } from '@/lib/csrf-client';
import { logger } from '@/lib/logger';
import { usePathname } from 'next/navigation';

// Geographies 데이터 (나중에 public/data/world-110m.json 등으로 옮길 수 있습니다)
const geoUrl = "/data/countries-110m.json"; // 로컬 파일 경로로 변경

interface Trip {
  id: string | number; // Changed from number to string | number
  cruiseName: string;
  companion: string;
  destination: string;
  startDate: string;
  endDate: string;
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

  // 경로 보호: 일반 사용자는 /map으로 리다이렉트
  useEffect(() => {
    const checkPath = async () => {
      const testModeInfo = await checkTestModeClient();
      const correctPath = getCorrectPath(pathname || '/map-test', testModeInfo);

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
  const [testModeInfo, setTestModeInfo] = useState<TestModeInfo | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<number>(0);

  // 테스트 모드 확인
  useEffect(() => {
    checkTestModeClient().then(setTestModeInfo);
  }, []);

  // 튜토리얼 표시 (페이지 진입 시마다 항상 표시)
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTutorial(true);
      setTutorialStep(0);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleTutorialNext = () => {
    if (tutorialStep < 2) {
      setTutorialStep(tutorialStep + 1);
    } else {
      setShowTutorial(false);
    }
  };

  const handleTutorialSkip = () => {
    setShowTutorial(false);
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        clearAllLocalStorage();
        window.location.href = '/login-test';
      } else {
        logger.error('[MapTest] 로그아웃 실패');
        alert('로그아웃에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      logger.error('[MapTest] 로그아웃 요청 중 오류 발생:', error);
      alert('로그아웃 중 오류가 발생했습니다.');
    }
  };

  const [countryColorMap, setCountryColorMap] = useState<{ [key: string]: string }>(() => {
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
                                                                englishCountryName === 'South Africa' ? 'ZA' : null;
          countryCode = countryCodeFromEnglish || 'XX'; // 기본값 XX
        }

        // 즉시 로컬 상태 업데이트
        setCountryColorMap((prev) => {
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
          logger.log('[MapPage] 방문 국가 서버 저장 완료:', englishCountryName);
        } catch (error) {
          logger.error('[MapPage] 방문 국가 서버 저장 실패:', error);
          // 서버 저장 실패해도 로컬에는 저장됨
        }
      }
    }
  }, [selectedCountryFromList, currentColor, countryKoreanToEnglishMap]);

  const handleRemoveColorFromSelectedCountry = useCallback(() => {
    if (selectedCountryFromList) {
      const englishCountryName = countryKoreanToEnglishMap[selectedCountryFromList]; // 한국어 국가명으로 영어 국가명 조회
      if (englishCountryName) {
        setCountryColorMap((prev) => {
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
      logger.log('Map Page: Starting init process.');
      try {
        // 1) 여행 기록: localStorage에서 먼저 로드 (사용자가 추가한 여행 보존)
        let localTrips: Trip[] = loadTripsFromLocal();
        logger.log('Map Page: Trips loaded from localStorage:', localTrips);

        // 2) 지도 페이지 여행 기록 API에서 로드 (서버와 동기화)
        let apiTrips: Trip[] = [];
        try {
          const apiResponse = await fetch('/api/map-travel-records', { credentials: 'include' });
          const apiData = await apiResponse.json().catch(() => ({}));
          apiTrips = Array.isArray(apiData?.trips) ? apiData.trips : [];
          logger.log('Map Page: Map travel records loaded from API:', apiTrips);
        } catch (apiError) {
          logger.warn('Map Page: API map travel records fetch failed, using localStorage only.', apiError);
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

        logger.log('Map Page: Merged trips:', mergedTrips);
        setUserTrips(mergedTrips);

        // 병합된 데이터를 localStorage에 저장 (동기화)
        saveTripsToLocal(mergedTrips);

        // 4) 여행 데이터에서 방문 국가 자동 추출하여 색상 맵에 추가
        const autoColorMap: { [key: string]: string } = {};
        mergedTrips.forEach((trip) => {
          if (trip.destination) {
            const destinations = trip.destination.split(',').map((d: string) => d.trim()).filter((d: string) => d);
            destinations.forEach((dest: string) => {
              const englishName = countryKoreanToEnglishMap[dest];
              if (englishName) {
                // 기본 색상: 빨강 (#EF4444)
                autoColorMap[englishName] = '#EF4444';
              }
            });
          }
        });

        // 5) 방문 국가 색상 데이터: localStorage에서 먼저 로드 (사용자가 색칠한 국가 보존)
        let localColorMap: { [key: string]: string } = {};
        if (typeof window !== 'undefined') {
          const savedColors = localStorage.getItem('countryColors');
          if (savedColors) {
            try {
              const parsedColors = JSON.parse(savedColors);
              // 한국어 키를 영어 키로 변환
              for (const koreanName in parsedColors) {
                const englishName = countryKoreanToEnglishMap[koreanName];
                if (englishName) {
                  localColorMap[englishName] = parsedColors[koreanName];
                } else if (koreanName) {
                  // 이미 영어 키인 경우
                  localColorMap[koreanName] = parsedColors[koreanName];
                }
              }
              logger.log('Map Page: Country colors loaded from localStorage:', localColorMap);
            } catch (e) {
              logger.warn('Map Page: Failed to parse localStorage countryColors:', e);
            }
          }
        }

        // 5) API에서도 방문 국가 데이터 로드 시도 (서버와 동기화)
        try {
          const visitedResponse = await fetch('/api/visited-countries', { credentials: 'include' });
          const visitedData = await visitedResponse.json().catch(() => ({}));

          if (visitedData.ok && visitedData.colorMap) {
            logger.log('Map Page: Visited countries loaded from API:', visitedData.visitedCountries);
            // API 데이터, localStorage 데이터, 자동 추출된 색상 병합 (우선순위: localStorage > API > 자동)
            const mergedColorMap = { ...autoColorMap, ...visitedData.colorMap, ...localColorMap };
            setCountryColorMap(mergedColorMap);
            localStorage.setItem('countryColors', JSON.stringify(mergedColorMap));
          } else {
            // API 데이터가 없으면 localStorage 데이터와 자동 추출된 색상 병합
            const mergedColorMap = { ...autoColorMap, ...localColorMap };
            setCountryColorMap(mergedColorMap);
            localStorage.setItem('countryColors', JSON.stringify(mergedColorMap));
          }
        } catch (visitedError) {
          logger.warn('Map Page: Failed to load visited countries from API, using localStorage only:', visitedError);
          // API 실패 시 localStorage 데이터와 자동 추출된 색상 병합
          const mergedColorMap = { ...autoColorMap, ...localColorMap };
          setCountryColorMap(mergedColorMap);
          localStorage.setItem('countryColors', JSON.stringify(mergedColorMap));
        }

        setIsTripsLoaded(true);

        // 2) 지도 데이터: 그대로 fetch (정적 파일)
        logger.log('Map Page: Fetching map data from', geoUrl);
        const mapResponse = await fetch(geoUrl);
        if (!mapResponse.ok) {
          throw new Error(`HTTP error! status: ${mapResponse.status}`);
        }
        const world = await mapResponse.json();
        const features = (topojson.feature(world, world.objects.countries as any) as any).features;

        setGeographyData(features);
        setIsMapDataLoaded(true);
      } catch (e) {
        logger.error('Map Page: Map init failed', e);
        setIsTripsLoaded(true);
        setIsMapDataLoaded(true);
      }
    };

    init();

    // 여행 기록을 다시 불러오는 함수
    const loadTripsFromServer = async () => {
      try {
        logger.log('[MapPage] 서버에서 여행 기록 다시 불러오기');
        const apiResponse = await fetch('/api/map-travel-records', { credentials: 'include' });
        const apiData = await apiResponse.json().catch(() => ({}));

        if (apiData.ok && Array.isArray(apiData.trips)) {
          const apiTrips: Trip[] = apiData.trips;
          logger.log('[MapPage] 서버에서 불러온 여행 기록:', apiTrips);

          // 서버 데이터가 우선 (서버가 진실의 원천)
          setUserTrips(apiTrips);
          saveTripsToLocal(apiTrips);
        }
      } catch (error) {
        logger.error('[MapPage] 여행 기록 불러오기 실패:', error);
      }
    };

    // 페이지가 다시 보일 때 여행 기록 다시 불러오기
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        logger.log('[MapPage] 페이지가 다시 보임, 여행 기록 다시 불러오기');
        loadTripsFromServer();
      }
    };

    // 포커스 이벤트 (페이지 전환 후 돌아올 때)
    const handleFocus = () => {
      logger.log('[MapPage] 페이지 포커스, 여행 기록 다시 불러오기');
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
    logger.log('Map Page: isTripsLoaded', isTripsLoaded, 'isMapDataLoaded', isMapDataLoaded);
    if (isTripsLoaded && isMapDataLoaded) {
      setIsLoading(false);
      logger.log('Map Page: isLoading set to false.');
    }
  }, [isTripsLoaded, isMapDataLoaded]);

  // 기능 사용 추적
  useEffect(() => {
    trackFeature('map');
  }, []);

  // 국가 클릭 핸들러
  const handleCountryClick = useCallback((geo: any) => {
    const englishCountryName = geo.properties.name; // name 속성 사용
    if (!englishCountryName) { // name이 없는 경우 처리
      logger.warn('Map Page: Clicked geography has no name property:', geo.properties);
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
                            englishCountryName;

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
      // 국가 색상 업데이트 (서버 저장 전에 먼저 적용)
      if (tripData.selectedCountriesWithColors && Array.isArray(tripData.selectedCountriesWithColors)) {
        setCountryColorMap((prev) => {
          const newMap = { ...prev };
          tripData.selectedCountriesWithColors.forEach((item: { englishName: string; color: string }) => {
            newMap[item.englishName] = item.color;
          });
          localStorage.setItem('countryColors', JSON.stringify(newMap));
          return newMap;
        });
      }

      // 서버에 저장/수정
      const method = tripData.id ? 'PUT' : 'POST';
      const url = '/api/map-travel-records';

      // 날짜 필수 검증 (먼저 확인)
      if (!tripData.startDate || !tripData.endDate) {
        logger.error('[MapPage] 날짜 누락:', { startDate: tripData.startDate, endDate: tripData.endDate });
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
        logger.error('[MapPage] 시작일 형식 오류:', requestBody.startDate);
        throw new Error(`시작일 형식이 올바르지 않습니다: ${requestBody.startDate}. YYYY-MM-DD 형식이어야 합니다.`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(requestBody.endDate)) {
        logger.error('[MapPage] 종료일 형식 오류:', requestBody.endDate);
        throw new Error(`종료일 형식이 올바르지 않습니다: ${requestBody.endDate}. YYYY-MM-DD 형식이어야 합니다.`);
      }

      logger.log('[MapPage] 서버 전송 데이터:', requestBody);

      // undefined 값 제거 (하지만 startDate와 endDate는 필수이므로 제거하지 않음)
      Object.keys(requestBody).forEach(key => {
        if (key !== 'startDate' && key !== 'endDate' && (requestBody[key] === undefined || requestBody[key] === '')) {
          delete requestBody[key];
        }
      });

      if (tripData.id) {
        requestBody.id = tripData.id;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        // 서버에서 받은 에러 정보를 포함하여 throw
        const error: any = new Error(data.message || '여행 기록 저장에 실패했습니다');
        error.details = data.details;
        error.code = data.code;
        error.hint = data.hint;
        throw error;
      }

      // 서버에서 최신 데이터 다시 불러오기
      const loadResponse = await fetch('/api/map-travel-records', { credentials: 'include' });
      const loadData = await loadResponse.json();

      if (loadData.ok && Array.isArray(loadData.trips)) {
        setUserTrips(loadData.trips);
        saveTripsToLocal(loadData.trips);

        // 색상은 선택된 색상이 있으면 그대로 유지 (서버에서 다시 불러올 때 덮어쓰지 않음)
        // 선택된 색상이 없을 때만 기본 색상 적용
        if (tripData.selectedCountriesWithColors && Array.isArray(tripData.selectedCountriesWithColors)) {
          setCountryColorMap((currentMap) => {
            const updatedMap = { ...currentMap };
            tripData.selectedCountriesWithColors.forEach((item: { englishName: string; color: string }) => {
              updatedMap[item.englishName] = item.color;
            });
            localStorage.setItem('countryColors', JSON.stringify(updatedMap));
            return updatedMap;
          });
        }
      }
    } catch (error: any) {
      logger.error('[MapPage] 여행 기록 저장 실패:', error);

      // 서버에서 받은 에러 메시지가 있으면 표시
      const errorMessage = error?.details || error?.message || '알 수 없는 오류';
      const hint = error?.hint || '';

      alert(`여행 기록 저장에 실패했습니다: ${errorMessage}${hint ? '\n\n' + hint : ''}`);
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
      }
    } catch (error) {
      logger.error('[MapPage] 여행 기록 삭제 실패:', error);
      alert(`여행 기록 삭제에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }, []);

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
    <>
      {/* 72시간 카운트다운 배너 (상단 고정) */}
      {testModeInfo && testModeInfo.isTestMode && (
        <TutorialCountdown testModeInfo={testModeInfo} onLogout={handleLogout} />
      )}

      {/* 튜토리얼 팝업 */}
      {showTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 md:p-8 relative">
            {/* 닫기 버튼 */}
            <button
              onClick={handleTutorialSkip}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-3xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              ✕
            </button>

            {/* 단계별 내용 */}
            {tutorialStep === 0 && (
              <div className="text-center">
                <div className="text-7xl mb-5">🗺️</div>
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 leading-tight">나의 크루즈 여행 지도</h3>
                <p className="text-lg md:text-xl text-gray-700 mb-5 leading-relaxed">
                  방문한 국가를 지도에서 색칠하고 여행 기록을 남겨보세요!
                </p>
                <ul className="text-left space-y-3 text-base md:text-lg text-gray-600 mb-6 bg-blue-50 rounded-lg p-5 leading-relaxed">
                  <li className="flex items-start gap-3">
                    <span className="text-blue-600 font-bold text-xl flex-shrink-0">1️⃣</span>
                    <span>지도에서 국가를 클릭하면 방문 기록을 추가할 수 있습니다</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-blue-600 font-bold text-xl flex-shrink-0">2️⃣</span>
                    <span>왼쪽의 + / - 버튼으로 지도를 확대/축소할 수 있습니다</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-blue-600 font-bold text-xl flex-shrink-0">3️⃣</span>
                    <span>방문한 국가는 자동으로 색칠되어 표시됩니다</span>
                  </li>
                </ul>
                <div className="flex gap-4">
                  <button
                    onClick={handleTutorialSkip}
                    className="flex-1 px-5 py-4 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors text-base md:text-lg"
                    style={{ minHeight: '56px' }}
                  >
                    건너뛰기
                  </button>
                  <button
                    onClick={handleTutorialNext}
                    className="flex-1 px-5 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg text-base md:text-lg"
                    style={{ minHeight: '56px' }}
                  >
                    다음
                  </button>
                </div>
                <div className="mt-4 flex justify-center gap-2">
                  <div className={`w-4 h-4 rounded-full transition-all ${(tutorialStep as number) >= 0 ? 'bg-blue-600' : 'bg-gray-300'} ${(tutorialStep as number) === 0 ? 'scale-125' : ''}`}></div>
                  <div className={`w-4 h-4 rounded-full transition-all ${(tutorialStep as number) >= 1 ? 'bg-green-600' : 'bg-gray-300'} ${(tutorialStep as number) === 1 ? 'scale-125' : ''}`}></div>
                  <div className={`w-4 h-4 rounded-full transition-all ${(tutorialStep as number) >= 2 ? 'bg-purple-600' : 'bg-gray-300'} ${(tutorialStep as number) === 2 ? 'scale-125' : ''}`}></div>
                </div>
              </div>
            )}

            {tutorialStep === 1 && (
              <div className="text-center">
                <div className="text-7xl md:text-8xl mb-5">📍</div>
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 leading-tight">여행 기록 추가하기</h3>
                <p className="text-lg md:text-xl text-gray-700 mb-5 leading-relaxed">
                  크루즈 여행 정보를 기록하면 지도에 자동으로 표시됩니다.
                </p>
                <ul className="text-left space-y-3 text-base md:text-lg text-gray-600 mb-6 bg-green-50 rounded-lg p-5 leading-relaxed">
                  <li className="flex items-start gap-3">
                    <span className="text-green-600 font-bold text-xl flex-shrink-0">•</span>
                    <span>&quot;+ 새로운 여행 추가&quot; 버튼을 클릭하세요</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-600 font-bold text-xl flex-shrink-0">•</span>
                    <span>크루즈 이름, 목적지, 날짜를 입력하세요</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-600 font-bold text-xl flex-shrink-0">•</span>
                    <span>방문한 국가가 자동으로 지도에 색칠됩니다</span>
                  </li>
                </ul>
                <div className="bg-green-50 rounded-lg p-4 md:p-5 mb-6">
                  <p className="text-base md:text-lg text-green-800 leading-relaxed">
                    <span className="font-bold">팁:</span> 여러 번의 크루즈 여행을 기록하면 모든 방문 국가를 한눈에 볼 수 있습니다!
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={handleTutorialSkip}
                    className="flex-1 px-5 py-4 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors text-base md:text-lg"
                    style={{ minHeight: '56px' }}
                  >
                    건너뛰기
                  </button>
                  <button
                    onClick={handleTutorialNext}
                    className="flex-1 px-5 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold hover:from-green-600 hover:to-green-700 transition-all shadow-lg text-base md:text-lg"
                    style={{ minHeight: '56px' }}
                  >
                    다음
                  </button>
                </div>
                <div className="mt-4 flex justify-center gap-2">
                  <div className={`w-4 h-4 rounded-full transition-all ${(tutorialStep as number) >= 0 ? 'bg-blue-600' : 'bg-gray-300'} ${(tutorialStep as number) === 0 ? 'scale-125' : ''}`}></div>
                  <div className={`w-4 h-4 rounded-full transition-all ${(tutorialStep as number) >= 1 ? 'bg-green-600' : 'bg-gray-300'} ${(tutorialStep as number) === 1 ? 'scale-125' : ''}`}></div>
                  <div className={`w-4 h-4 rounded-full transition-all ${(tutorialStep as number) >= 2 ? 'bg-purple-600' : 'bg-gray-300'} ${(tutorialStep as number) === 2 ? 'scale-125' : ''}`}></div>
                </div>
              </div>
            )}

            {tutorialStep === 2 && (
              <div className="text-center">
                <div className="text-7xl md:text-8xl mb-5">✨</div>
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 leading-tight">여행 기록 관리</h3>
                <p className="text-lg md:text-xl text-gray-700 mb-5 leading-relaxed">
                  저장된 여행 기록을 수정하거나 삭제할 수 있습니다.
                </p>
                <ul className="text-left space-y-3 text-base md:text-lg text-gray-600 mb-6 bg-purple-50 rounded-lg p-5 leading-relaxed">
                  <li className="flex items-start gap-3">
                    <span className="text-purple-600 font-bold text-xl flex-shrink-0">✏️</span>
                    <span>각 여행 카드의 ✏️ 버튼으로 수정할 수 있습니다</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-600 font-bold text-xl flex-shrink-0">🗑️</span>
                    <span>🗑️ 버튼으로 여행 기록을 삭제할 수 있습니다</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-600 font-bold text-xl flex-shrink-0">📌</span>
                    <span>여행 기록은 등록 순서대로 표시됩니다</span>
                  </li>
                </ul>
                <div className="bg-purple-50 rounded-lg p-4 md:p-5 mb-6">
                  <p className="text-base md:text-lg text-purple-800 leading-relaxed">
                    <span className="font-bold">완료!</span> 이제 나만의 크루즈 여행 지도를 만들어보세요! 🎉
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={handleTutorialSkip}
                    className="flex-1 px-5 py-4 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors text-base md:text-lg"
                    style={{ minHeight: '56px' }}
                  >
                    건너뛰기
                  </button>
                  <button
                    onClick={handleTutorialNext}
                    className="flex-1 px-5 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-bold hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg text-base md:text-lg"
                    style={{ minHeight: '56px' }}
                  >
                    시작하기 🚀
                  </button>
                </div>
                <div className="mt-4 flex justify-center gap-2">
                  <div className={`w-4 h-4 rounded-full transition-all ${(tutorialStep as number) >= 0 ? 'bg-blue-600' : 'bg-gray-300'} ${(tutorialStep as number) === 0 ? 'scale-125' : ''}`}></div>
                  <div className={`w-4 h-4 rounded-full transition-all ${(tutorialStep as number) >= 1 ? 'bg-green-600' : 'bg-gray-300'} ${(tutorialStep as number) === 1 ? 'scale-125' : ''}`}></div>
                  <div className={`w-4 h-4 rounded-full transition-all ${(tutorialStep as number) >= 2 ? 'bg-purple-600' : 'bg-gray-300'} ${(tutorialStep as number) === 2 ? 'scale-125' : ''}`}></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="flex flex-col h-[100dvh] bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 text-gray-900 overflow-hidden">
        {/* Header */}
        <header className="bg-white/95 backdrop-blur p-4 md:p-5 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-2 border-gray-200">
          <div className="flex items-center space-x-3 md:space-x-4 flex-1 min-w-0">
            <Link href="/profile-test" className="flex items-center text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0">
              <FiArrowLeft size={32} className="mr-2" />
            </Link>
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500 p-1 flex-shrink-0">
              <Image src="/images/ai-cruise-logo.png" alt="크루즈 가이드 로고" width={40} height={40} className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-800 truncate">🗺️ 나의 크루즈 여행 지도</h1>
              <p className="text-sm md:text-base lg:text-lg text-gray-600 font-medium truncate">방문했던 국가를 색칠하고 기록해보세요</p>
            </div>
          </div>
          {/* 다시 크루즈 가이드 3일 무료 체험으로 이동하기 버튼 */}
          <Link
            href="/chat-test"
            className="w-full md:w-auto px-5 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl shadow-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 text-base md:text-lg flex items-center justify-center gap-2"
            style={{ minHeight: '56px' }}
          >
            <span>🏠</span>
            <span className="hidden sm:inline">3일 무료체험으로</span>
            <span className="sm:hidden">홈으로</span>
          </Link>
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
                        return geographies.map((geo: any) => {
                          const englishCountryName = geo.properties.name; // name 속성 사용
                          // name이 없으면 렌더링하지 않거나 기본 처리
                          if (!englishCountryName) {
                            logger.warn('Map Page: Skipping geo without name:', geo.properties);
                            return null;
                          }

                          // 국가명 매칭 시도 (대소문자 무시, 부분 일치)
                          let isVisited = Object.keys(countryColorMap).includes(englishCountryName);
                          let countryColor = countryColorMap[englishCountryName] || "#F8F9FA";

                          // 정확히 매칭되지 않으면 대소문자 무시하여 찾기
                          if (!isVisited) {
                            const matchedKey = Object.keys(countryColorMap).find(key =>
                              key.toLowerCase() === englishCountryName.toLowerCase()
                            );
                            if (matchedKey) {
                              isVisited = true;
                              countryColor = countryColorMap[matchedKey];
                            }
                          }

                          // 여전히 매칭되지 않으면 Singapore 관련 매칭 시도
                          if (!isVisited && englishCountryName.toLowerCase().includes('singapore')) {
                            const singaporeKey = Object.keys(countryColorMap).find(key =>
                              key.toLowerCase().includes('singapore')
                            );
                            if (singaporeKey) {
                              isVisited = true;
                              countryColor = countryColorMap[singaporeKey];
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
            <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl border-2 border-gray-200 p-6 md:p-8 max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-3">
                  <FiTag className="text-3xl md:text-4xl text-blue-600" />
                  <span>나의 크루즈 여행 기록</span>
                </h2>
                {/* 새로운 여행 추가하기 버튼 */}
                <button
                  onClick={() => handleAddTripClick()}
                  className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg text-base md:text-lg whitespace-nowrap transform hover:scale-105"
                  style={{ minHeight: '56px' }}
                >
                  + 새로운 여행 추가
                </button>
              </div>
              {
                userTrips.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2">
                    {userTrips.map((trip, index) => (
                      <div key={trip.id} className="bg-gradient-to-br from-white to-gray-50 p-4 md:p-5 rounded-xl shadow-md border-2 border-gray-200 hover:shadow-xl hover:border-blue-300 transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-bold text-base md:text-lg text-gray-800 flex-1">
                            {index === 0 && "📌 첫 번째"}
                            {index === 1 && "📌 두 번째"}
                            {index === 2 && "📌 세 번째"}
                            {index > 2 && `📌 ${index + 1}번째`}
                          </h3>
                          <div className="flex gap-2 ml-2">
                            <button
                              onClick={() => handleEditTripClick(trip)}
                              className="text-blue-600 hover:text-blue-800 text-lg md:text-xl font-medium px-2 py-1 hover:bg-blue-50 rounded-lg transition-colors"
                              title="수정"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteTrip(trip.id)}
                              className="text-red-600 hover:text-red-800 text-lg md:text-xl font-medium px-2 py-1 hover:bg-red-50 rounded-lg transition-colors"
                              title="삭제"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm md:text-base">
                          <p className="text-gray-800 truncate font-semibold">
                            <span className="text-xl">🚢</span> {removeEnglishInParentheses(trip.cruiseName)}
                          </p>
                          <p className="text-gray-700 truncate">
                            <span className="text-lg">📍</span> {removeEnglishFromDestination(trip.destination)}
                          </p>
                          <p className="text-gray-600 text-sm md:text-base">
                            <FiCalendar className="inline mr-1" /> {formatDate(trip.startDate)} ~ {formatDate(trip.endDate)}
                          </p>
                          <p className="text-blue-600 font-bold text-base md:text-lg">
                            {calculateDday(trip.startDate) > 0 ? `D-${calculateDday(trip.startDate)}` : `여행 ${-calculateDday(trip.startDate) + 1}일차`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🗺️</div>
                    <p className="text-xl md:text-2xl text-gray-700 mb-6 font-semibold">아직 등록된 여행 기록이 없습니다.</p>
                    <button
                      onClick={() => handleAddTripClick()}
                      className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg text-lg md:text-xl transform hover:scale-105"
                      style={{ minHeight: '64px' }}
                    >
                      첫 여행 추가하기 🚀
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
    </>
  );
} 