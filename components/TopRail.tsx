'use client';
import OnboardingSummary from '@/components/OnboardingSummary';
import QuickTools from '@/components/QuickTools';
import { ChatMessage } from '@/types/app';

type Props = { onQuickToolPick: (cmd: string) => void; };

export default function TopRail({ onQuickToolPick }: Props) {
  return (
    <div className="sticky top-0 z-10 bg-[#fafafa] pb-3">
      <OnboardingSummary />
      <div className="px-3 pt-2">
        <QuickTools onPick={onQuickToolPick} />
      </div>
      {/* 모드 안내 (항상) */}
    </div>
  );
}
