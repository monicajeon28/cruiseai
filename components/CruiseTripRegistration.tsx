'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { normalize } from '@/utils/normalize';
import { ActionMeta, SingleValue, MultiValue, Props as RSProps } from 'react-select'; // Import ActionMeta, SingleValue, MultiValue, RSProps
import { Option } from './CountrySelect'; // Import Option from CountrySelect
import { csrfFetch } from '@/lib/csrf-client';

type RSOnChange<T extends boolean> = T extends true
  ? (v: MultiValue<Option>) => void
  : (v: SingleValue<Option>) => void;

const ONBOARDED_COOKIE = "cruise:onboarded"; // Add ONBOARDED_COOKIE constant

import countries from '@/data/countries.json';
import cruiseData from '@/data/cruise_ships.json';

const SingleCountrySelect = dynamic(() => import('@/components/CountrySelect'), { ssr: false }) as React.ComponentType<RSProps<Option, false>>;
const MultiCountrySelect = dynamic(() => import('@/components/CountrySelect'), { ssr: false }) as React.ComponentType<RSProps<Option, true>>;

const radioBase =
  'inline-flex items-center justify-center h-10 px-4 rounded-full border text-[16px] font-medium';
const radioOn  = `${radioBase} bg-red-600 text-white border-red-600`;
const radioOff = `${radioBase} bg-white text-gray-800 border-gray-300 hover:bg-gray-50`;

const fmt = (d: Date | string | number) => {
  const dd = new Date(d);
  const yyyy = dd.getUTCFullYear();
  const mm = String(dd.getUTCMonth() + 1).padStart(2, '0');
  const dd2 = String(dd.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd2}`;
};

function calcNightsDays(startISO?: string, endISO?: string) {
  if (!startISO || !endISO) return { nights: 0, days: 0 };
  const s = new Date(startISO); s.setHours(0,0,0,0);
  const e = new Date(endISO);  e.setHours(0,0,0,0);
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  return { nights: Math.max(days - 1, 0), days: Math.max(days, 0) };
}

interface CruiseTripRegistrationProps {
  initialTripData?: {
    cruiseName?: string | null;
    companionType?: string | null;
    destination?: any;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    visitCount?: number | null;
  };
}

export default function CruiseTripRegistration({ initialTripData }: CruiseTripRegistrationProps = {}) {
  const router = useRouter();

  // 초기값 설정: initialTripData가 있으면 사용, 없으면 기본값
  const getInitialDate = (date: Date | string | null | undefined): string => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return fmt(d);
  };

  const getInitialDestinations = (): Option[] => {
    if (!initialTripData?.destination) return [];
    const destArray = Array.isArray(initialTripData.destination) 
      ? initialTripData.destination 
      : [initialTripData.destination];
    return destArray
      .filter((d: any) => d && typeof d === 'string')
      .map((d: string) => ({ value: d, label: d }));
  };

  const getInitialCompanion = (): '친구'|'커플'|'가족'|'혼자' => {
    const type = initialTripData?.companionType;
    if (type === '친구' || type === '커플' || type === '가족' || type === '혼자') {
      return type;
    }
    // 매핑
    if (type === 'solo') return '혼자';
    if (type === 'couple') return '커플';
    if (type === 'family') return '가족';
    if (type === 'friends') return '친구';
    return '가족';
  };

  const [loading, setLoading] = useState(false) // `submitting`을 `loading`으로 변경
  
  // 크루즈 라인과 선박명 분리 (상품 관리 페이지와 동일한 방식)
  const [selectedCruiseLine, setSelectedCruiseLine] = useState<string>('');
  const [selectedShipName, setSelectedShipName] = useState<string>('');
  const [cruiseLineSearchTerm, setCruiseLineSearchTerm] = useState('');
  const [shipNameSearchTerm, setShipNameSearchTerm] = useState('');
  const [cruiseLineDropdownOpen, setCruiseLineDropdownOpen] = useState(false);
  const [shipNameDropdownOpen, setShipNameDropdownOpen] = useState(false);
  const cruiseLineDropdownRef = useRef<HTMLDivElement>(null);
  const shipNameDropdownRef = useRef<HTMLDivElement>(null);
  
  const [companion, setCompanion] = useState<'친구'|'커플'|'가족'|'혼자'>(getInitialCompanion());
  const [visitCount, setVisitCount] = useState<number>(initialTripData?.visitCount || 3);
  const [destinations, setDestinations] = useState<Option[]>(getInitialDestinations());
  const [startDate, setStartDate] = useState<string>(getInitialDate(initialTripData?.startDate));
  const [endDate, setEndDate]     = useState<string>(getInitialDate(initialTripData?.endDate));
  const [destInput, setDestInput] = useState('');

  const { nights, days } = calcNightsDays(startDate, endDate);

  // 크루즈선사 목록 생성 (한국어 이름을 value로 사용)
  const cruiseLineOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    (cruiseData as any[]).forEach((line) => {
      const cruiseLineShort = line.cruise_line.split('(')[0].trim(); // 한국어 이름
      options.push({
        value: cruiseLineShort, // 한국어 이름을 value로 사용
        label: cruiseLineShort
      });
    });
    return options;
  }, []);

  // 선택된 크루즈선사에 해당하는 크루즈선 목록 (한국어 이름을 value로 사용)
  const shipNameOptions = useMemo(() => {
    if (!selectedCruiseLine) return [];
    
    const selectedLine = (cruiseData as any[]).find((line) => {
      const cruiseLineShort = line.cruise_line.split('(')[0].trim();
      return cruiseLineShort === selectedCruiseLine;
    });

    if (!selectedLine) return [];

    const options: Array<{ value: string; label: string }> = [];
    selectedLine.ships.forEach((ship: string) => {
      const shipNameShort = ship.split('(')[0].trim(); // 한국어 이름
      
      // 중복 제거 로직
      let displayLabel = shipNameShort;
      const cruiseLineKeywords = selectedLine.cruise_line.split('(')[0].trim().split(' ').filter((word: string) => word.length > 1);
      const hasCruiseLineInShipName = cruiseLineKeywords.some((keyword: string) => 
        shipNameShort.includes(keyword)
      );
      
      if (!hasCruiseLineInShipName) {
        const simpleCruiseLine = cruiseLineKeywords[0] || selectedLine.cruise_line.split('(')[0].trim();
        displayLabel = `${simpleCruiseLine} ${shipNameShort}`;
      }

      options.push({
        value: shipNameShort, // 한국어 이름을 value로 사용
        label: displayLabel
      });
    });
    return options;
  }, [selectedCruiseLine]);

  // 필터링된 크루즈선사 옵션 (한국어 검색)
  const filteredCruiseLineOptions = useMemo(() => {
    if (!cruiseLineSearchTerm.trim()) {
      return cruiseLineOptions.slice(0, 50);
    }
    const term = normalize(cruiseLineSearchTerm);
    return cruiseLineOptions.filter(option => 
      normalize(option.label).includes(term) || normalize(option.value).includes(term)
    ).slice(0, 50);
  }, [cruiseLineSearchTerm, cruiseLineOptions]);

  // 필터링된 크루즈선 이름 옵션 (한국어 검색)
  const filteredShipNameOptions = useMemo(() => {
    if (!shipNameSearchTerm.trim()) {
      return shipNameOptions.slice(0, 50);
    }
    const term = normalize(shipNameSearchTerm);
    return shipNameOptions.filter(option => 
      normalize(option.label).includes(term) || normalize(option.value).includes(term)
    ).slice(0, 50);
  }, [shipNameSearchTerm, shipNameOptions]);

  // 선택된 크루즈선사 라벨
  const selectedCruiseLineLabel = useMemo(() => {
    const option = cruiseLineOptions.find(opt => opt.value === selectedCruiseLine);
    return option?.label || selectedCruiseLine || '';
  }, [selectedCruiseLine, cruiseLineOptions]);

  // 선택된 크루즈선 이름 라벨
  const selectedShipNameLabel = useMemo(() => {
    const option = shipNameOptions.find(opt => opt.value === selectedShipName);
    return option?.label || selectedShipName || '';
  }, [selectedShipName, shipNameOptions]);

  /** 목적지 옵션 (국가 + 지역) */
  // 미국/캐나다는 국가만 표시, 다른 국가는 국가-지역 형식으로 표시
  const destinationOptions = useMemo<Option[]>(() => {
    const out: Option[] = [];
    (countries as any[]).forEach(cont => {
      (cont?.countries || []).forEach((c:any) => {
        const countryName = c?.name;
        if (!countryName) return;
        
        // 미국과 캐나다는 국가만 추가 (지역 제외)
        if (countryName.includes('미국') || countryName.includes('United States') ||
            countryName.includes('캐나다') || countryName.includes('Canada')) {
          out.push({ value: countryName, label: countryName });
        } else {
          // 다른 국가는 국가와 지역 모두 추가
          out.push({ value: countryName, label: countryName });
          if (Array.isArray(c?.regions)) {
            c.regions.forEach((r:string)=>{
              const v = `${countryName} - ${r}`;
              out.push({ value:v, label:v });
            });
          }
        }
      });
    });
    const map = new Map<string, Option>();
    out.forEach(o => map.set(o.value, o));
    return Array.from(map.values());
  }, []);

  /** 공통 필터 (한/영, 공백, 대소문자 무시) */
  const filterOption = (opt:any, raw:string) =>
    normalize(opt?.label ?? '')?.includes(normalize(raw));

  // 연관검색 칩: 크루즈 라인
  const cruiseLineChips = useMemo(() => {
    if (!cruiseLineSearchTerm) return [];
    const n = normalize(cruiseLineSearchTerm);
    return cruiseLineOptions
      .filter(o => normalize(o.label).includes(n) || normalize(o.value).includes(n))
      .slice(0, 5);
  }, [cruiseLineSearchTerm, cruiseLineOptions]);

  // 연관검색 칩: 선박명
  const shipNameChips = useMemo(() => {
    if (!shipNameSearchTerm || !selectedCruiseLine) return [];
    const n = normalize(shipNameSearchTerm);
    return shipNameOptions
      .filter(o => normalize(o.label).includes(n) || normalize(o.value).includes(n))
      .slice(0, 5);
  }, [shipNameSearchTerm, shipNameOptions, selectedCruiseLine]);

  const destChips = useMemo(()=> {
    if (!destInput) return [];
    const n = normalize(destInput);
    return destinationOptions
      .filter(o => normalize(o.label).includes(n))
      .slice(0,5);
  }, [destInput, destinationOptions]);

  // 크루즈 라인 선택 핸들러
  const handleCruiseLineSelect = (value: string, label: string) => {
    setSelectedCruiseLine(value);
    setSelectedShipName(''); // 크루즈선사 변경 시 크루즈선 이름 초기화
    setCruiseLineSearchTerm('');
    setCruiseLineDropdownOpen(false);
  };

  // 선박명 선택 핸들러
  const handleShipNameSelect = (value: string, label: string) => {
    setSelectedShipName(value);
    setShipNameSearchTerm('');
    setShipNameDropdownOpen(false);
  };

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cruiseLineDropdownRef.current && !cruiseLineDropdownRef.current.contains(event.target as Node)) {
        setCruiseLineDropdownOpen(false);
      }
      if (shipNameDropdownRef.current && !shipNameDropdownRef.current.contains(event.target as Node)) {
        setShipNameDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 멀티 선택 핸들러
  const handleDestChange = (v: MultiValue<Option>) => {
    const arr = v ?? [];
    const limited = arr.slice(0, visitCount);
    setDestinations(limited);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return; // `submitting` 대신 `loading` 사용
    setLoading(true);    // `setSubmitting` 대신 `setLoading` 사용

    // 크루즈 라인과 선박명을 결합하여 cruiseName 생성
    const cruiseName = selectedShipName 
      ? `${selectedCruiseLineLabel} ${selectedShipNameLabel}`.trim()
      : selectedCruiseLineLabel || '';

    const payload = {
      cruiseName: cruiseName,
      companionType: companion,
      // 수정 모드일 때는 기존 destination과 날짜 유지
      destination: initialTripData && initialTripData.destination 
        ? (Array.isArray(initialTripData.destination) ? initialTripData.destination : [initialTripData.destination])
        : destinations.map(d=>d.value),
      startDate: initialTripData && initialTripData.startDate ? fmt(initialTripData.startDate) : fmt(startDate),
      endDate: initialTripData && initialTripData.endDate ? fmt(initialTripData.endDate) : fmt(endDate),
      nights: Number(nights),
      days: Number(days),
      visitCount: initialTripData && initialTripData.visitCount ? initialTripData.visitCount : visitCount,
    };

    try {
      const res = await csrfFetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();

      if (!res.ok || !j.ok) {
        alert(j.message ?? '저장 실패');
        return;
      }
      location.href = j.next;
    } catch (e) {
      console.error(e);
      alert('네트워크 오류');
    } finally {
      setLoading(false);
    }
  }

  // 진행률 계산 (5단계: 크루즈 라인, 선박명, 동반자, 방문국가, 목적지, 날짜)
  const progress = useMemo(() => {
    let completed = 0;
    if (selectedCruiseLine) completed++;
    if (selectedShipName) completed++;
    if (companion) completed++;
    if (visitCount) completed++;
    if (destinations.length > 0) completed++;
    if (startDate && endDate) completed++;
    return Math.round((completed / 6) * 100);
  }, [selectedCruiseLine, selectedShipName, companion, visitCount, destinations.length, startDate, endDate]);

  const handleSkip = () => {
    if (confirm('나중에 여행 정보를 등록할 수 있습니다. 지금 건너뛰시겠습니까?')) {
      const pathname = window.location.pathname;
      const isTestMode = pathname?.includes('/chat-test') || 
                         pathname?.includes('/tools-test') || 
                         pathname?.includes('/translator-test') || 
                         pathname?.includes('/profile-test') ||
                         pathname?.includes('/checklist-test') ||
                         pathname?.includes('/wallet-test');
      router.push(isTestMode ? '/chat-test' : '/chat');
    }
  };

  return (
    <div className="max-w-md w-[520px] mx-auto bg-white rounded-2xl shadow p-6">
      {/* 로고 */}
      <div className="flex flex-col items-center gap-2 mb-4">
        <img
          src="/images/ai-cruise-logo.png" alt="크루즈닷 로고"
          className="w-24 h-auto md:w-28 mx-auto mb-1" // ← 기존 width prop 대신 Tailwind
        />
        <div className="flex items-center justify-between w-full mb-2">
          <h1 className="text-3xl font-extrabold text-center flex-1">
            {initialTripData ? '여행 정보 수정' : '여행 정보 등록'}
          </h1>
          {!initialTripData && (
            <button
              type="button"
              onClick={handleSkip}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1"
            >
              건너뛰기
            </button>
          )}
        </div>
        <p className="text-gray-600 text-center">
          {initialTripData ? '크루즈 여행 정보를 수정해주세요' : '크루즈 여행 정보를 입력해주세요'}
        </p>
        {/* 진행률 표시 */}
        {!initialTripData && (
          <div className="w-full mt-3">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>진행률</span>
              <span className="font-semibold">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 크루즈 라인 선택 */}
      <label className="block text-sm font-semibold mb-2">크루즈 라인 *</label>
      <div className="relative mb-4" ref={cruiseLineDropdownRef}>
        <input
          type="text"
          required
          value={cruiseLineDropdownOpen ? cruiseLineSearchTerm : selectedCruiseLineLabel}
          onChange={(e) => {
            setCruiseLineSearchTerm(e.target.value);
            setCruiseLineDropdownOpen(true);
          }}
          onFocus={() => {
            setCruiseLineDropdownOpen(true);
            setCruiseLineSearchTerm('');
          }}
          onBlur={() => {
            setTimeout(() => setCruiseLineDropdownOpen(false), 200);
          }}
          placeholder="크루즈선사 검색 (예: MSC, 로얄캐리비안)"
          disabled={!!initialTripData}
          className="w-full h-12 rounded-lg border px-3 text-[16px] pr-12"
        />
        {cruiseLineSearchTerm && (
          <button
            type="button"
            onClick={() => {
              setCruiseLineSearchTerm('');
              setCruiseLineDropdownOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
          >
            ✕
          </button>
        )}
        {cruiseLineDropdownOpen && filteredCruiseLineOptions.length > 0 && (
          <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-300 rounded-lg shadow-xl max-h-72 overflow-y-auto">
            {filteredCruiseLineOptions.map((option) => (
              <div
                key={option.value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleCruiseLineSelect(option.value, option.label);
                }}
                className={`px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                  selectedCruiseLine === option.value ? 'bg-blue-100 font-bold' : 'font-medium'
                }`}
              >
                <div className="text-base text-gray-900">{option.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* 연관검색 칩: 크루즈 라인 */}
      {cruiseLineChips.length > 0 && (
        <div className="flex gap-2 flex-wrap text-sm mb-4">
          {cruiseLineChips.map(c => (
            <button
              key={c.value}
              type="button"
              className="px-3 py-1 rounded-full border bg-white hover:bg-gray-50"
              onClick={() => handleCruiseLineSelect(c.value, c.label)}
              disabled={!!initialTripData}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* 선박명 선택 */}
      <label className="block text-sm font-semibold mb-2">선박명 * {selectedCruiseLine && <span className="text-gray-500 text-xs">({selectedCruiseLineLabel})</span>}</label>
      <div className="relative mb-4" ref={shipNameDropdownRef}>
        <input
          type="text"
          required
          disabled={!selectedCruiseLine || !!initialTripData}
          value={shipNameDropdownOpen ? shipNameSearchTerm : selectedShipNameLabel}
          onChange={(e) => {
            setShipNameSearchTerm(e.target.value);
            setShipNameDropdownOpen(true);
          }}
          onFocus={() => {
            if (selectedCruiseLine) {
              setShipNameDropdownOpen(true);
              setShipNameSearchTerm('');
            }
          }}
          onBlur={() => {
            setTimeout(() => setShipNameDropdownOpen(false), 200);
          }}
          placeholder={selectedCruiseLine ? "선박명 검색 (예: 벨리시마)" : "먼저 크루즈선사를 선택하세요"}
          className={`w-full h-12 rounded-lg border px-3 text-[16px] pr-12 ${
            !selectedCruiseLine ? 'bg-gray-100 border-gray-200 cursor-not-allowed' : ''
          }`}
        />
        {shipNameSearchTerm && selectedCruiseLine && (
          <button
            type="button"
            onClick={() => {
              setShipNameSearchTerm('');
              setShipNameDropdownOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
          >
            ✕
          </button>
        )}
        {shipNameDropdownOpen && selectedCruiseLine && filteredShipNameOptions.length > 0 && (
          <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-300 rounded-lg shadow-xl max-h-72 overflow-y-auto">
            {filteredShipNameOptions.map((option) => (
              <div
                key={option.value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleShipNameSelect(option.value, option.label);
                }}
                className={`px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                  selectedShipName === option.value ? 'bg-blue-100 font-bold' : 'font-medium'
                }`}
              >
                <div className="text-base text-gray-900">{option.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* 연관검색 칩: 선박명 */}
      {shipNameChips.length > 0 && (
        <div className="flex gap-2 flex-wrap text-sm mb-4">
          {shipNameChips.map(c => (
            <button
              key={c.value}
              type="button"
              className="px-3 py-1 rounded-full border bg-white hover:bg-gray-50"
              onClick={() => handleShipNameSelect(c.value, c.label)}
              disabled={!!initialTripData}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* 동반자 */}
      <label className="block text-sm font-semibold mb-2 mt-4">동반자</label>
      <div className="flex gap-2 mb-4">
        {(['친구','커플','가족','혼자'] as const).map(k=>(<button key={k} type="button" onClick={()=>setCompanion(k)} className={companion===k?radioOn:radioOff} aria-pressed={companion===k} disabled={false}>{k}</button>))}
      </div>

      {/* 방문 국가 개수 */}
      <label className="block text-sm font-semibold mb-2">방문 국가 개수</label>
      <select value={visitCount} onChange={(e)=>setVisitCount(parseInt(e.target.value,10))} className="w-full h-12 rounded-lg border px-3 mb-4 text-[16px]" disabled={!!initialTripData}>
        {[1,2,3,4,5].map(n=> <option key={n} value={n}>{n}개국</option>)}
      </select>

      {/* 목적지 선택 */}
      <label className="block text-sm font-semibold mb-2">
        목적지 선택 <span className="text-blue-600 font-bold">({destinations.length}/{visitCount}개 선택)</span>
        {destinations.length > 0 && (
          <button type="button" onClick={() => setDestinations([])} className="ml-2 text-red-500 text-xs font-medium hover:underline" disabled={!!initialTripData}>
            초기화
          </button>
        )}
      </label>
      <MultiCountrySelect
        instanceId="dest-select"
        isMulti={true}
        options={destinationOptions}
        value={destinations}
        onChange={handleDestChange}
        onInputChange={(v: string)=> setDestInput(v)}
        filterOption={filterOption}
        placeholder="목적지를 선택하세요 (여러 개 선택 가능)"
        isDisabled={!!initialTripData} // 수정 모드일 때 비활성화
      />
      {/* n/m 선택 카운터 */}
      <div className="mt-1 text-xs text-gray-500">
        {visitCount}개 중 <span className="font-semibold text-blue-600">{destinations.length}</span> 선택됨
      </div>
      {/* 연관 칩 */}
      {destChips.length>0 && (
        <div className="flex gap-2 flex-wrap text-sm mt-2">
          {destChips.map(c=>(<button key={c.value} type="button" className="px-3 py-1 rounded-full border bg-white hover:bg-gray-50" onClick={()=>{
            setDestinations(prev => {
              if (prev.some(p=>p.value===c.value)) return prev;
              if (prev.length >= visitCount) return prev;
              return [...prev, c];
            });
          }} disabled={!!initialTripData}>{c.label}</button>))}
        </div>
      )}
      {/* 목적지 선택 요약 카운터 */}
      {/* Removed the previous counter display from here */}
      {/* 출/도착일 */}
      <div className="grid grid-cols-2 gap-3 mb-3 mt-4">
        <div>
          <label className="block text-sm font-semibold mb-2">출발일</label>
          <div className="relative">
            <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="w-full h-12 rounded-lg border px-3 text-[16px]" disabled={!!initialTripData} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">📅</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">도착일</label>
          <div className="relative">
            <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="w-full h-12 rounded-lg border px-3 text-[16px]" disabled={!!initialTripData} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">📅</span>
          </div>
        </div>
      </div>

      {/* 여행 기간 */}
      <div className="mb-5 rounded-xl border bg-gray-50 p-4 text-center">
        <div className="text-gray-500 text-sm mb-1">여행 기간</div>
        <div className="text-red-600 text-2xl font-extrabold">{nights}박 {days}일</div>
        {startDate && endDate && (<div className="text-gray-600 text-sm mt-1">{startDate} ~ {endDate}</div>)}
      </div>

      {/* 수정 모드 안내 */}
      {initialTripData && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 font-semibold">
            ⚠️ 온보딩 수정 모드: 동행자 정보만 수정 가능합니다. 다른 정보는 관리자 패널에서 수정해주세요.
          </p>
        </div>
      )}

      <button type="button" onClick={handleSubmit} className="w-full h-12 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-[16px]">
        {initialTripData ? '여행 정보 수정하기' : '여행 정보 등록하기'}
      </button>
    </div>
  );
} 