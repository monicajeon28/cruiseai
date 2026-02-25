'use client';

import { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiSearch, FiX, FiEdit2 } from 'react-icons/fi';
import {
  AIRLINES,
  searchAirlines,
  getAirlinesGroupedByRegion,
  getManualEntryOption,
  getNoFlightOption,
  Airline
} from '@/data/airlines';

interface AirlineSelectProps {
  value?: string; // airlineCode 또는 수동입력 시 항공사명
  onChange: (airlineCode: string, airlineName: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showNoFlight?: boolean; // "항공 미포함" 옵션 표시 여부
}

export default function AirlineSelect({
  value,
  onChange,
  placeholder = '항공사 선택',
  disabled = false,
  className = '',
  showNoFlight = true,
}: AirlineSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredAirlines, setFilteredAirlines] = useState<Airline[]>([]);
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  // 현재 선택된 항공사
  const selectedAirline = value
    ? AIRLINES.find(a => a.code === value || a.displayName === value)
    : null;

  // value가 목록에 없으면 수동 입력된 값으로 간주
  const isManualValue = value && !selectedAirline;

  // 검색어 변경 시 필터링
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredAirlines([]);
    } else {
      setFilteredAirlines(searchAirlines(searchQuery));
    }
  }, [searchQuery]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
        setIsManualMode(false);
        setManualInput('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 드롭다운 열릴 때 검색창에 포커스
  useEffect(() => {
    if (isOpen && inputRef.current && !isManualMode) {
      inputRef.current.focus();
    }
  }, [isOpen, isManualMode]);

  // 수동 입력 모드일 때 포커스
  useEffect(() => {
    if (isManualMode && manualInputRef.current) {
      manualInputRef.current.focus();
    }
  }, [isManualMode]);

  const handleSelect = (airline: Airline) => {
    if (airline.code === 'MANUAL') {
      setIsManualMode(true);
      setManualInput('');
    } else {
      onChange(airline.code, airline.displayName);
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      // 수동 입력 시 code는 'MANUAL', name은 입력값
      onChange('MANUAL', manualInput.trim());
      setIsOpen(false);
      setSearchQuery('');
      setIsManualMode(false);
      setManualInput('');
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', '');
    setSearchQuery('');
    setIsManualMode(false);
    setManualInput('');
  };

  // 지역별 그룹
  const groupedAirlines = getAirlinesGroupedByRegion();
  const manualOption = getManualEntryOption();
  const noFlightOption = getNoFlightOption();

  // 표시할 값
  const displayValue = selectedAirline
    ? selectedAirline.displayName
    : isManualValue
      ? value
      : '';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* 선택 버튼 */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between gap-2 px-3 py-2
          border rounded-lg bg-white text-left
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-blue-400 cursor-pointer'}
          ${isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300'}
        `}
      >
        <span className={displayValue ? 'text-gray-900' : 'text-gray-400'}>
          {displayValue || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {displayValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <FiX className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <FiChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* 드롭다운 */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-hidden">
          {isManualMode ? (
            // 수동 입력 모드
            <div className="p-3">
              <div className="text-sm font-medium text-gray-700 mb-2">항공사명 직접 입력</div>
              <div className="flex gap-2">
                <input
                  ref={manualInputRef}
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleManualSubmit();
                    } else if (e.key === 'Escape') {
                      setIsManualMode(false);
                    }
                  }}
                  placeholder="예: 아시아나항공(OZ)"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
                />
                <button
                  type="button"
                  onClick={handleManualSubmit}
                  disabled={!manualInput.trim()}
                  className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  확인
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsManualMode(false)}
                className="mt-2 text-sm text-gray-500 hover:text-gray-700"
              >
                &larr; 목록에서 선택
              </button>
            </div>
          ) : (
            <>
              {/* 검색창 */}
              <div className="sticky top-0 bg-white border-b border-gray-100 p-2">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="항공사명 또는 코드 검색..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              {/* 항공사 목록 */}
              <div className="overflow-y-auto max-h-72">
                {/* 직접 입력 옵션 */}
                <button
                  type="button"
                  onClick={() => handleSelect(manualOption)}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-blue-50 flex items-center gap-2 border-b border-gray-100 text-blue-600 font-medium"
                >
                  <FiEdit2 className="w-4 h-4" />
                  <span>직접 입력</span>
                </button>

                {/* 항공 미포함 옵션 */}
                {showNoFlight && (
                  <button
                    type="button"
                    onClick={() => handleSelect(noFlightOption)}
                    className={`
                      w-full px-4 py-2 text-left text-sm hover:bg-blue-50 border-b border-gray-100
                      ${value === 'NONE' ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}
                    `}
                  >
                    항공 미포함
                  </button>
                )}

                {searchQuery ? (
                  // 검색 중일 때는 플랫 리스트
                  filteredAirlines.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500 text-sm">
                      검색 결과가 없습니다
                    </div>
                  ) : (
                    <div className="py-1">
                      {filteredAirlines.map(airline => (
                        <button
                          key={airline.code}
                          type="button"
                          onClick={() => handleSelect(airline)}
                          className={`
                            w-full px-4 py-2 text-left text-sm hover:bg-blue-50 flex items-center justify-between
                            ${value === airline.code ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
                          `}
                        >
                          <span>{airline.displayName}</span>
                          <span className="text-xs text-gray-400">{airline.region}</span>
                        </button>
                      ))}
                    </div>
                  )
                ) : (
                  // 기본 상태에서는 지역별 그룹
                  <div className="py-1">
                    {groupedAirlines.map(({ region, airlines }) => (
                      <div key={region}>
                        <div className="px-4 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                          {region}
                        </div>
                        {airlines.map(airline => (
                          <button
                            key={airline.code}
                            type="button"
                            onClick={() => handleSelect(airline)}
                            className={`
                              w-full px-4 py-2 text-left text-sm hover:bg-blue-50
                              ${value === airline.code ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
                            `}
                          >
                            {airline.displayName}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
