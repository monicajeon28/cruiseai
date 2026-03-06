'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ChatInputMode } from '@/lib/types';

export default function ModeBar({
  mode,
  onChangeTab,
}: {
  mode: ChatInputMode;
  onChangeTab: (m: ChatInputMode) => void;
}) {
  const Tab = ({ id, label }: { id: ChatInputMode; label: string }) => (
    <button
      className={`flex-1 min-h-[44px] py-2.5 rounded-md text-sm font-semibold text-center transition-colors ${
        mode === id ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
      onClick={() => onChangeTab(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full border-b bg-white">
      <div className="mx-auto max-w-6xl px-3 flex items-center gap-1.5 py-2">
        <Tab id="go" label="가자" />
        <Tab id="show" label="보여줘" />
        <Tab id="general" label="일반" />
        <button
          className="w-10 min-h-[44px] flex items-center justify-center rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 text-base font-bold flex-shrink-0"
          onClick={() => onChangeTab('info')}
          title="크루즈닷 사용설명서"
          aria-label="사용설명서"
        >
          ?
        </button>
      </div>
    </div>
  );
}
