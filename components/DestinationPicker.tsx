'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import countriesData from '@/data/countries.json';

type Option = {
  value: string;          // 저장용 (예: '말레이시아 (Malaysia)' | '일본 · 홋카이도')
  label: string;          // 표시용 (value와 동일)
  country: string;        // '일본 (Japan)'
  region?: string;        // '홋카이도 (Hokkaido)'
  continent: string;      // '아시아 (Asia)'
};

function buildOptions(): Option[] {
  const out: Option[] = [];

  for (const g of countriesData as any[]) {
    const continent = g.continent as string;
    for (const c of g.countries as any[]) {
      const countryName = c.name as string;

      // 1) 국가 자체
      out.push({
        value: countryName,
        label: countryName,
        country: countryName,
        continent,
      });

      // 2) 지역이 있으면 "국가 · 지역"으로 각각 옵션 생성
      if (Array.isArray(c.regions) && c.regions.length) {
        for (const r of c.regions as string[]) {
          const combined = `${countryName} · ${r}`;
          out.push({
            value: combined,
            label: combined,
            country: countryName,
            region: r,
            continent,
          });
        }
      }
    }
  }
  // 중복 제거
  const seen = new Set<string>();
  return out.filter(o => (seen.has(o.value) ? false : (seen.add(o.value), true)));
}

const ALL_OPTIONS = buildOptions();

export type DestinationPickerProps = {
  maxCount: number;                // 방문 국가 개수(최대 선택 개수)
  value: string[];                 // 선택된 목적지 배열
  onChange: (next: string[]) => void;
  placeholder?: string;
};

export default function DestinationPicker({
  maxCount,
  value,
  onChange,
  placeholder = '말레이시아 · 싱가포르 · 태국 …',
}: DestinationPickerProps) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return ALL_OPTIONS.slice(0, 30);
    return ALL_OPTIONS
      .filter(o => o.label.toLowerCase().includes(key))
      .slice(0, 50);
  }, [q]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const canAddMore = value.length < maxCount;

  function add(val: string) {
    if (!canAddMore) return;
    if (value.includes(val)) return;
    onChange([...value, val]);
    setQ('');
    setOpen(false);
  }

  function remove(val: string) {
    onChange(value.filter(v => v !== val));
  }

  return (
    <div className="relative" ref={boxRef}>
      {/* 선택된 칩 */}
      <div className="flex flex-wrap gap-2 pb-2">
        {value.map(v => (
          <span key={v} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 border text-gray-800 text-sm">
            {v}
            <button
              type="button"
              className="ml-1 text-gray-500 hover:text-gray-700"
              onClick={() => remove(v)}
              aria-label={`${v} 제거`}
            >
              ×
            </button>
          </span>
        ))}
        {!value.length && (
          <span className="text-sm text-gray-400">예: 말레이시아, 싱가포르, 태국…</span>
        )}
      </div>

      {/* 검색 입력 */}
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full h-11 px-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-red"
        />
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="h-11 px-3 rounded-lg border bg-white"
          aria-label="목록 열기"
        >▼</button>
      </div>

      {/* 드롭다운 */}
      {open && (
        <div
          className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-lg border bg-white shadow"
          role="listbox"
        >
          {!filtered.length && (
            <div className="px-3 py-2 text-sm text-gray-500">검색 결과 없음</div>
          )}
          {filtered.map(opt => {
            const disabled = (!canAddMore && !value.includes(opt.value));
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => add(opt.value)}
                disabled={disabled}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                  disabled ? 'text-gray-300 cursor-not-allowed' : 'text-gray-800'
                }`}
              >
                <div className="font-medium">{opt.label}</div>
                <div className="text-xs text-gray-500">{opt.continent}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* 남은 개수 안내 */}
      <div className="mt-2 text-sm text-gray-600">
        선택 {value.length}/{maxCount}
        {!canAddMore && <span className="ml-2 text-red-600 font-semibold">최대 개수에 도달했어요</span>}
      </div>
    </div>
  );
}



