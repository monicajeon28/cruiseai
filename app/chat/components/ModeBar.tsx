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
      className={`px-3 py-2 rounded-md text-sm ${mode === id ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}
      onClick={() => onChangeTab(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full border-b bg-white">
      <div className="mx-auto max-w-6xl px-3 flex gap-2 p-3 border-b bg-white">
        <Tab id="go" label="크루즈닷 가자" />
        <Tab id="show" label="크루즈닷 보여줘" />
        <Tab id="general" label="일반" />
        <div className="ml-auto text-sm text-gray-500">
          <button
            className={`px-3 py-2 rounded-md text-sm bg-gray-100 text-gray-700`}
            onClick={() => onChangeTab('info')}
          >
            크루즈닷사용설명서
          </button>
        </div>
      </div>
    </div>
  );
}
