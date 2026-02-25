'use client';
import { useMemo } from 'react';
import { findDestinations } from '@/lib/nav/selector';
import { terminalsByRegion } from '@/lib/nav/data';
import { detectRegionCode } from '@/lib/nav/geo';

export default function SuggestedChips({ onPick, currentInput }: { onPick: (t: string) => void; currentInput: string }) {
  const dynamicItems = useMemo(() => {
    if (!currentInput || currentInput.length < 2) return [];

    const detectedRegionCode = detectRegionCode(currentInput);
    if (detectedRegionCode && terminalsByRegion[detectedRegionCode]) {
      return terminalsByRegion[detectedRegionCode].map(t => `${t.name}으로 가는 길`);
    }

    const foundDests = findDestinations(currentInput);
    return foundDests.map(d => `${d.name_ko}으로 가는 길`);

  }, [currentInput]);

  const staticItems = [
    "크루즈닷 미국 크루즈 터미널 어떻게 가?",
    "크루즈닷 미국 크루즈 터미널 어딨지 ?",
    "인천공항에서 카이탁 크루즈 터미널까지",
  ];

  const itemsToDisplay = dynamicItems.length > 0 ? dynamicItems : staticItems;

  return (
    <div className="flex flex-wrap gap-2">
      {itemsToDisplay.map((t, i) => (
        <button key={i} onClick={() => onPick(t)}
          className="min-h-[48px] rounded-2xl bg-[#1e40af] text-white px-3 py-2 text-[15px] hover:bg-[#1b3a9a]">
          {t}
        </button>
      ))}
    </div>
  );
}
