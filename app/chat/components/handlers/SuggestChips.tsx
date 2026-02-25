'use client';

import { COUNTRIES } from '@/vnext/lib/nav/data';

type Chip = { label: string; value: string };
const FIXED_TO: Chip[] = [
  { label: '근처 식당', value: 'nearby:restaurant' },
  { label: '관광지',    value: 'nearby:attraction' },
  { label: '근처 맛집', value: 'nearby:food' },
  { label: '스타벅스',  value: 'nearby:starbucks' },
  { label: '편의점',    value: 'nearby:convenience' },
  { label: '마트',      value: 'nearby:market' },
];

export default function SuggestChips({
  slot, query, onPick,
}: { slot: 'from'|'to'; query: string; onPick: (v: string)=>void }) {
  if (slot === 'to') {
    return (
      <div className="mt-2 flex flex-wrap gap-3">
        {FIXED_TO.map(c =>
          <button 
            key={c.value} 
            className="
              px-5 py-4
              rounded-xl
              border-2
              text-lg font-bold
              min-h-[70px]
              bg-blue-50
              hover:bg-blue-100
              hover:border-blue-400
              active:scale-95
              transition-all
              shadow-sm
              hover:shadow-md
            "
            onClick={() => onPick(c.value)}
          >
            {c.label}
          </button>
        )}
      </div>
    );
  }

  // from: 국가명이면 그 국가의 공항(간단 매핑; 실제 공항 데이터는 추후 확장)
  const isCountry = COUNTRIES.some(c => c.label === query.trim());
  if (!isCountry) return null;

  // 데모용: 국가 → 대표 공항 샘플
  const airportsByCountry: Record<string, Chip[]> = {
    '미국': [
      { label: 'LAX (로스앤젤레스)', value: 'LAX' },
      { label: 'JFK (뉴욕)', value: 'JFK' },
      { label: 'MIA (마이애미)', value: 'MIA' },
      { label: 'SFO (샌프란시스코)', value: 'SFO' },
    ],
    '대만': [
      { label: 'TPE (타오위안)', value: 'TPE' },
      { label: 'TSA (송산)', value: 'TSA' },
      { label: 'KHH (가오슝)', value: 'KHH' },
    ],
    // … 필요 시 추가
  };

  const chips = airportsByCountry[query.trim()] ?? [];
  if (!chips.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-3">
      {chips.map(c =>
        <button 
          key={c.value} 
          className="
            px-5 py-4
            rounded-xl
            border-2
            text-lg font-bold
            min-h-[70px]
            bg-gray-50
            hover:bg-gray-100
            hover:border-gray-400
            active:scale-95
            transition-all
            shadow-sm
            hover:shadow-md
          "
          onClick={() => onPick(c.value)}
        >
          {c.label}
        </button>
      )}
    </div>
  );
}
