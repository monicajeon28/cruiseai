'use client';

import React, { useCallback } from 'react';
import type { ChatInputMode } from '@/lib/types';

type TabProps = { id: ChatInputMode; label: string; mode: ChatInputMode; onChangeTab: (m: ChatInputMode) => void };

const Tab = React.memo(function Tab({ id, label, mode, onChangeTab }: TabProps) {
  const handleClick = useCallback(() => onChangeTab(id), [id, onChangeTab]);
  return (
    <button
      className={`px-2 py-2.5 min-h-[44px] rounded-md text-sm shrink-0 touch-manipulation select-none ${mode === id ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}
      onClick={handleClick}
    >
      {label}
    </button>
  );
});

const ModeBar = React.memo(function ModeBar({
  mode,
  onChangeTab,
}: {
  mode: ChatInputMode;
  onChangeTab: (m: ChatInputMode) => void;
}) {
  const handleInfoClick = useCallback(() => onChangeTab('info'), [onChangeTab]);

  return (
    <div className="w-full bg-white">
      <div className="mx-auto max-w-5xl px-2 flex gap-1.5 p-2 border-b bg-white overflow-x-auto scrollbar-hide">
        <Tab id="go" label="🗺️ 가자" mode={mode} onChangeTab={onChangeTab} />
        <Tab id="show" label="📸 보여줘" mode={mode} onChangeTab={onChangeTab} />
        <Tab id="general" label="💬 일반" mode={mode} onChangeTab={onChangeTab} />
        <div className="ml-auto shrink-0">
          <button
            title="크루즈닷 사용설명서"
            className="px-2 py-2.5 min-h-[44px] rounded-md text-sm shrink-0 touch-manipulation select-none bg-gray-100 text-gray-700"
            onClick={handleInfoClick}
          >
            ❓
          </button>
        </div>
      </div>
    </div>
  );
});

export default ModeBar;
