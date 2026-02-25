'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FiX, FiPlusCircle, FiEdit3, FiCalendar, FiUsers, FiGlobe } from 'react-icons/fi';
import cruiseShipsData from '@/data/cruise_ships.json';

// CONTINENTS_DATA 전체 목록 (map/page.tsx와 동일하게)
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
    { koreanName: "홍콩", englishName: "Hong Kong" },
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
    { koreanName: "보스니아 헤르체고비나", englishName: "Bosnia and Herzegovina" },
    { koreanName: "북마케도니아", englishName: "North Macedonia" },
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
    { koreanName: "체코", englishName: "Czech Republic" },
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
    { koreanName: "남수단", englishName: "South Sudan" },
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
    { koreanName: "에스와티니", englishName: "Eswatini" },
    { koreanName: "에티오피아", englishName: "Ethiopia" },
    { koreanName: "우간다", englishName: "Uganda" },
    { koreanName: "이집트", englishName: "Egypt" },
    { koreanName: "잠비아", englishName: "Zambia" },
    { koreanName: "적도 기니", englishName: "Equatorial Guinea" },
    { koreanName: "중앙아프리카 공화국", englishName: "Central African Republic" },
    { koreanName: "지부티", englishName: "Djibouti" },
    { koreanName: "짐바브웨", englishName: "Zimbabwe" },
    { koreanName: "차드", englishName: "Chad" },
    { koreanName: "카메룬", englishName: "Cameroon" },
    { koreanName: "카보베르데", englishName: "Cabo Verde" },
    { koreanName: "케냐", englishName: "Kenya" },
    { koreanName: "코모로", englishName: "Comoros" },
    { koreanName: "코트디부아르", englishName: "Côte d'Ivoire" },
    { koreanName: "콩고 공화국", englishName: "Republic of the Congo" },
    { koreanName: "콩고 민주 공화국", englishName: "Democratic Republic of the Congo" },
    { koreanName: "탄자니아", englishName: "Tanzania" },
    { koreanName: "토고", englishName: "Togo" },
  ],
  NorthAmerica: [
    { koreanName: "캐나다", englishName: "Canada" },
    { koreanName: "미국", englishName: "United States" },
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
    { koreanName: "도미니카 공화국", englishName: "Dominican Republic" },
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
    { koreanName: "솔로몬 제도", englishName: "Solomon Islands" },
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

interface SelectedCountry {
  koreanName: string;
  englishName: string;
  color: string;
}

interface TripFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (tripData: { 
    id?: string | number; 
    cruiseName: string; 
    destination: string; 
    companion: string; 
    startDate: string; 
    endDate: string; 
    impressions?: string; 
    isMemoTrip?: boolean;
    selectedCountriesWithColors?: Array<{ englishName: string; color: string }>; // 선택된 국가들과 색상
  }) => void;
  initialData?: {
    id?: string | number;
    cruiseName?: string;
    destination?: string;
    companion?: string;
    startDate?: string;
    endDate?: string;
    impressions?: string;
    isMemoTrip?: boolean; 
  };
  preselectedCountry?: string | null;
}

// 동반자 옵션
const COMPANION_OPTIONS = [
  '혼자',
  '가족',
  '부부',
  '연인',
  '친구',
  '커플',
  '단체',
  '회사',
];

export default function TripFormModal({ isOpen, onClose, onSubmit, initialData, preselectedCountry }: TripFormModalProps) {
  const [cruiseName, setCruiseName] = useState('');
  const [companion, setCompanion] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [impressions, setImpressions] = useState('');
  const [isMemoTrip, setIsMemoTrip] = useState<boolean>(false);
  
  // 크루즈 이름 검색 관련 상태
  const [cruiseSearchTerm, setCruiseSearchTerm] = useState('');
  const [cruiseDropdownOpen, setCruiseDropdownOpen] = useState(false);
  
  // 동반자 검색 관련 상태
  const [companionSearchTerm, setCompanionSearchTerm] = useState('');
  const [companionDropdownOpen, setCompanionDropdownOpen] = useState(false);
  
  // 방문 국가 색칠하기 관련 상태 (복수 선택)
  const [countrySearchTerm, setCountrySearchTerm] = useState('');
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [selectedCountries, setSelectedCountries] = useState<SelectedCountry[]>([]);
  const [selectedColor, setSelectedColor] = useState<string>('#EF4444'); // 기본 빨강

  // 외부 클릭 감지를 위한 ref
  const cruiseDropdownRef = useRef<HTMLDivElement>(null);
  const companionDropdownRef = useRef<HTMLDivElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cruiseDropdownRef.current && !cruiseDropdownRef.current.contains(event.target as Node)) {
        setCruiseDropdownOpen(false);
      }
      if (companionDropdownRef.current && !companionDropdownRef.current.contains(event.target as Node)) {
        setCompanionDropdownOpen(false);
      }
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setCountryDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 크루즈 이름 목록 (평탄화)
  const allCruiseNames = useMemo(() => {
    const cruiseNames: string[] = [];
    cruiseShipsData.forEach((line: any) => {
      if (Array.isArray(line.ships)) {
        line.ships.forEach((ship: string) => {
          cruiseNames.push(ship);
        });
      }
    });
    return cruiseNames;
  }, []);

  // 검색된 크루즈 이름 목록 (검색어가 없으면 전체 목록, 있으면 필터링)
  const filteredCruiseNames = useMemo(() => {
    if (!cruiseSearchTerm.trim()) {
      return allCruiseNames.slice(0, 20); // 검색어 없으면 전체 목록 최대 20개
    }
    const term = cruiseSearchTerm.toLowerCase();
    return allCruiseNames
      .filter(name => name.toLowerCase().includes(term))
      .slice(0, 20); // 최대 20개만 표시
  }, [cruiseSearchTerm, allCruiseNames]);

  // 검색된 동반자 목록 (검색어가 없으면 전체 목록, 있으면 필터링)
  const filteredCompanions = useMemo(() => {
    if (!companionSearchTerm.trim()) {
      return COMPANION_OPTIONS; // 검색어 없으면 전체 목록
    }
    const term = companionSearchTerm.toLowerCase();
    return COMPANION_OPTIONS
      .filter(option => option.toLowerCase().includes(term));
  }, [companionSearchTerm]);

  // 국가 목록 (평탄화)
  const allCountries = useMemo(() => {
    return Object.values(CONTINENTS_DATA).flat();
  }, []);

  // 검색된 국가 목록 (이미 선택된 국가 제외, 검색어가 없으면 전체 목록)
  const filteredCountries = useMemo(() => {
    const selectedEnglishNames = new Set(selectedCountries.map(c => c.englishName));
    if (!countrySearchTerm.trim()) {
      // 검색어 없으면 전체 목록 (최대 30개)
      return allCountries
        .filter(country => !selectedEnglishNames.has(country.englishName))
        .slice(0, 30);
    }
    const term = countrySearchTerm.toLowerCase().trim();
    
    // 정확한 매칭을 우선시하고, 그 다음 단어 시작 부분 매칭
    // "중국"을 검색할 때 "중앙아프리카 공화국"이 매칭되지 않도록 주의
    return allCountries
      .filter(country => {
        if (selectedEnglishNames.has(country.englishName)) {
          return false;
        }
        
        const koreanNameLower = country.koreanName.toLowerCase();
        const englishNameLower = country.englishName.toLowerCase();
        
        // 정확한 매칭
        if (koreanNameLower === term || englishNameLower === term) {
          return true;
        }
        
        // 단어 시작 부분 매칭 (가장 일반적인 경우)
        if (koreanNameLower.startsWith(term) || englishNameLower.startsWith(term)) {
          return true;
        }
        
        // 단어 경계에서 매칭 (공백 앞뒤로 검색어가 있는 경우)
        // 예: "아프리카" 검색 시 "중앙아프리카 공화국" 매칭
        const koreanWordMatch = koreanNameLower.includes(' ' + term + ' ') || 
                                koreanNameLower.endsWith(' ' + term) ||
                                koreanNameLower.startsWith(term + ' ');
        const englishWordMatch = englishNameLower.includes(' ' + term + ' ') || 
                                 englishNameLower.endsWith(' ' + term) ||
                                 englishNameLower.startsWith(term + ' ');
        
        if (koreanWordMatch || englishWordMatch) {
          return true;
        }
        
        // 부분 문자열 매칭은 최소한으로 (단, "중국"이 "중앙"에 매칭되지 않도록)
        // 검색어가 국가 이름 중간에 포함되어 있지만, 단어 경계가 아닌 경우는 제외
        // 예: "중국" 검색 시 "중앙아프리카 공화국"은 매칭되지 않음
        return false;
      })
      .slice(0, 30); // 최대 30개만 표시
  }, [countrySearchTerm, allCountries, selectedCountries]);

  useEffect(() => {
    if (isOpen && initialData) {
      setCruiseName(initialData.cruiseName || '');
      setCruiseSearchTerm('');
      setCompanion(initialData.companion || '');
      setCompanionSearchTerm('');
      setStartDate(initialData.startDate ? initialData.startDate.split('T')[0] : '');
      setEndDate(initialData.endDate ? initialData.endDate.split('T')[0] : '');
      setImpressions(initialData.impressions || '');
      setIsMemoTrip(initialData.isMemoTrip ?? false);
      setCruiseDropdownOpen(false);
      setCompanionDropdownOpen(false);
      setCountryDropdownOpen(false);
      // 수정 모드에서는 기존 destination을 파싱해서 selectedCountries로 변환
      if (initialData.destination) {
        const destinations = initialData.destination.split(',').map(d => d.trim()).filter(d => d);
        const parsedCountries: SelectedCountry[] = [];
        destinations.forEach(dest => {
          const country = allCountries.find(c => c.koreanName === dest);
          if (country) {
            parsedCountries.push({ ...country, color: '#EF4444' }); // 기본 색상
          }
        });
        setSelectedCountries(parsedCountries);
      } else {
        setSelectedCountries([]);
      }
      setCountrySearchTerm('');
    } else if (isOpen && !initialData) {
      // 새로운 여행 추가 시 필드 초기화
      setCruiseName('');
      setCruiseSearchTerm('');
      setCruiseDropdownOpen(false);
      setCompanion('');
      setCompanionSearchTerm('');
      setCompanionDropdownOpen(false);
      setStartDate('');
      setEndDate('');
      setImpressions('');
      setIsMemoTrip(true);
      setCountrySearchTerm('');
      setCountryDropdownOpen(false);
      // preselectedCountry가 있으면 추가
      if (preselectedCountry) {
        const countryString = typeof preselectedCountry === 'string' ? preselectedCountry : String(preselectedCountry);
        const country = allCountries.find(c => c.koreanName === countryString);
        if (country) {
          setSelectedCountries([{ ...country, color: '#EF4444' }]);
        } else {
          setSelectedCountries([]);
        }
      } else {
        setSelectedCountries([]);
      }
      setCountrySearchTerm('');
      setSelectedColor('#EF4444');
    }
  }, [isOpen, initialData, preselectedCountry, allCountries]);

  const handleCountrySelect = (country: { koreanName: string; englishName: string }) => {
    // 이미 선택된 국가인지 확인
    if (selectedCountries.some(c => c.englishName === country.englishName)) {
      return;
    }
    // 새 국가 추가
    setSelectedCountries(prev => [...prev, { ...country, color: selectedColor }]);
    setCountrySearchTerm(''); // 검색어 초기화
  };

  const handleRemoveCountry = (englishName: string) => {
    setSelectedCountries(prev => prev.filter(c => c.englishName !== englishName));
  };

  const handleColorChangeForCountry = (englishName: string, color: string) => {
    setSelectedCountries(prev =>
      prev.map(c => c.englishName === englishName ? { ...c, color } : c)
    );
  };

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    // destination은 선택된 국가들의 한국어 이름으로 조합 (선택 사항)
    const destination = selectedCountries.length > 0 
      ? selectedCountries.map(c => c.koreanName).join(', ')
      : '';
    
    // 날짜만 필수로 검증 (다이어리처럼 자유롭게 기록 가능하도록)
    if (!startDate || !endDate) {
      alert('여행 시작일과 종료일은 필수 입력 항목입니다.');
      return;
    }
    
    // 날짜 형식 검증 (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      alert('날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.');
      return;
    }
    
    // 값이 있으면 전달, 없으면 undefined (서버에서 기본값 처리)
    const finalCruiseName = cruiseName.trim() || undefined;
    const finalDestination = destination.trim() || undefined;
    const finalCompanion = companion.trim() || undefined;
    const finalImpressions = impressions.trim() || undefined;
    
    console.log('[TripFormModal] 제출 데이터:', {
      startDate,
      endDate,
      cruiseName: finalCruiseName,
      destination: finalDestination,
      companion: finalCompanion,
    });
    
    onSubmit({
      id: initialData?.id,
      cruiseName: finalCruiseName,
      destination: finalDestination,
      companion: finalCompanion,
      startDate: startDate.trim(), // 공백 제거
      endDate: endDate.trim(), // 공백 제거
      impressions: finalImpressions,
      isMemoTrip: initialData?.id ? initialData.isMemoTrip : isMemoTrip,
      selectedCountriesWithColors: selectedCountries.map(c => ({
        englishName: c.englishName,
        color: c.color,
      })),
    });
    onClose();
  }, [initialData, cruiseName, selectedCountries, companion, startDate, endDate, impressions, isMemoTrip, onSubmit, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg p-8 w-full max-w-2xl shadow-xl relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 text-3xl transition-colors duration-200"
        >
          <FiX />
        </button>
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          {initialData ? <FiEdit3 className="mr-2" /> : <FiPlusCircle className="mr-2" />}
          {initialData ? '여행 기록 수정' : '새로운 여행 추가'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="cruiseName" className="block text-sm font-medium text-gray-700">
              <FiUsers className="inline-block mr-1 text-brand-red" /> 크루즈 이름 (선택 사항)
            </label>
            <div className="relative" ref={cruiseDropdownRef}>
              <input
                type="text"
                id="cruiseName"
                value={cruiseName}
                onChange={(e) => {
                  setCruiseName(e.target.value);
                  setCruiseSearchTerm(e.target.value);
                  setCruiseDropdownOpen(true);
                }}
                onFocus={() => setCruiseDropdownOpen(true)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-red focus:border-brand-red sm:text-sm"
                placeholder="크루즈 이름 검색 또는 클릭하여 선택 (예: 코스타 세레나) - 비워두면 '기록된 여행'으로 저장됩니다"
              />
              {cruiseDropdownOpen && filteredCruiseNames.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredCruiseNames.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setCruiseName(name);
                        setCruiseSearchTerm('');
                        setCruiseDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-brand-red-light hover:text-white transition-colors"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 방문 국가 색칠하기 섹션 (필수) */}
          <div className="border-t border-gray-200 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FiGlobe className="inline-block mr-1 text-brand-red" /> 방문 국가 색칠하기 (선택 사항)
            </label>
            <div className="space-y-3">
              {/* 국가 검색 */}
              <div className="relative" ref={countryDropdownRef}>
                <input
                  type="text"
                  placeholder="국가 검색 또는 클릭하여 선택..."
                  value={countrySearchTerm}
                  onChange={(e) => {
                    setCountrySearchTerm(e.target.value);
                    setCountryDropdownOpen(true);
                  }}
                  onFocus={() => setCountryDropdownOpen(true)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-red focus:border-brand-red sm:text-sm"
                />
                {countryDropdownOpen && filteredCountries.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredCountries.map((country) => (
                      <button
                        key={country.koreanName}
                        type="button"
                        onClick={() => {
                          handleCountrySelect(country);
                          setCountrySearchTerm('');
                          setCountryDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-brand-red-light hover:text-white transition-colors"
                      >
                        {country.koreanName} ({country.englishName})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 선택된 국가들 표시 (칩 형태) */}
              {selectedCountries.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600">선택된 국가 ({selectedCountries.length}개):</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedCountries.map((country) => (
                      <div
                        key={country.englishName}
                        className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5"
                      >
                        <span className="text-sm font-medium text-gray-800">{country.koreanName}</span>
                        {/* 국가별 색상 선택 */}
                        <div className="flex gap-1">
                          {[
                            { name: '빨강', color: '#EF4444' },
                            { name: '주황', color: '#F97316' },
                            { name: '노랑', color: '#FCD34D' },
                            { name: '초록', color: '#22C55E' },
                            { name: '파랑', color: '#3B82F6' },
                            { name: '남색', color: '#4F46E5' },
                            { name: '보라', color: '#A855F7' },
                          ].map((colorOption) => (
                            <button
                              key={colorOption.name}
                              type="button"
                              className={`w-6 h-6 rounded-full border-2 ${country.color === colorOption.color ? 'border-blue-500' : 'border-gray-300'} focus:outline-none`}
                              style={{ backgroundColor: colorOption.color }}
                              onClick={() => handleColorChangeForCountry(country.englishName, colorOption.color)}
                              title={colorOption.name}
                            />
                          ))}
                        </div>
                        {/* 삭제 버튼 */}
                        <button
                          type="button"
                          onClick={() => handleRemoveCountry(country.englishName)}
                          className="text-red-500 hover:text-red-700 text-sm font-bold ml-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 기본 색상 선택 (새로 추가되는 국가에 적용) */}
              <div>
                <p className="text-xs text-gray-600 mb-2">기본 색상 (새 국가 추가 시 적용):</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: '빨강', color: '#EF4444' },
                    { name: '주황', color: '#F97316' },
                    { name: '노랑', color: '#FCD34D' },
                    { name: '초록', color: '#22C55E' },
                    { name: '파랑', color: '#3B82F6' },
                    { name: '남색', color: '#4F46E5' },
                    { name: '보라', color: '#A855F7' },
                  ].map((colorOption) => (
                    <button
                      key={colorOption.name}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 ${selectedColor === colorOption.color ? 'border-blue-500' : 'border-gray-300'} focus:outline-none`}
                      style={{ backgroundColor: colorOption.color }}
                      onClick={() => setSelectedColor(colorOption.color)}
                      title={colorOption.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="companion" className="block text-sm font-medium text-gray-700">
              <FiUsers className="inline-block mr-1 text-brand-red" /> 동행인
            </label>
            <div className="relative" ref={companionDropdownRef}>
              <input
                type="text"
                id="companion"
                value={companion}
                onChange={(e) => {
                  setCompanion(e.target.value);
                  setCompanionSearchTerm(e.target.value);
                  setCompanionDropdownOpen(true);
                }}
                onFocus={() => setCompanionDropdownOpen(true)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-red focus:border-brand-red sm:text-sm"
                placeholder="동행인 검색 또는 클릭하여 선택 (예: 가족, 친구, 혼자)"
              />
              {companionDropdownOpen && filteredCompanions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredCompanions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setCompanion(option);
                        setCompanionSearchTerm('');
                        setCompanionDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-brand-red-light hover:text-white transition-colors"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                <FiCalendar className="inline-block mr-1 text-brand-red" /> 여행 시작일
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-red focus:border-brand-red sm:text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                <FiCalendar className="inline-block mr-1 text-brand-red" /> 여행 종료일
              </label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-red focus:border-brand-red sm:text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="impressions" className="block text-sm font-medium text-gray-700">
              <FiEdit3 className="inline-block mr-1 text-brand-red" /> 어땠는지 소감
            </label>
            <textarea
              id="impressions"
              rows={4}
              value={impressions}
              onChange={(e) => setImpressions(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-red focus:border-brand-red sm:text-sm"
              placeholder="여행에 대한 감동과 추억을 기록해 보세요."
            ></textarea>
          </div>

          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-lg font-semibold text-white bg-brand-red hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-red"
          >
            {initialData ? '수정하기' : '추가하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
