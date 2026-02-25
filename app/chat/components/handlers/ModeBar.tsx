'use client';
import React from 'react';

export type ChatInputMode = 'go' | 'show' | 'plain';

export default function ModeBar({
  mode,
  onChange,
  onGuide,
}: {
  mode: ChatInputMode;
  onChange: (m: ChatInputMode) => void;
  onGuide: () => void;
}) {
  const btn = (m: ChatInputMode, label: string) => (
    <button
      onClick={() => onChange(m)}
      className={`h-9 px-3 rounded-lg font-semibold border
        ${mode === m ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-800 hover:bg-gray-50'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-t bg-white"> {/* gap-2와 bg-white 추가 */}
      <div className="flex gap-2">
        {btn('go', '크루즈닷 가자')}
        {btn('show', '크루즈닷 보여줘')}
        {btn('plain', '일반')}
      </div>
      <button
        onClick={onGuide}
        className="h-9 px-3 rounded-lg bg-blue-600 text-white font-semibold"
      >
        크루즈닷가이드소개
      </button>
    </div>
  );
}
