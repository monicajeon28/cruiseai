'use client';
import { useState } from 'react';

type Mode = 'go'|'show'|'free';

export default function ChatTabs({ onModeChange }: { onModeChange: (mode: Mode) => void }) {
  const [currentMode, setCurrentMode] = useState<Mode>('go');

  const handleModeChange = (mode: Mode) => {
    setCurrentMode(mode);
    onModeChange(mode);
  };

  const Tab = ({m, label}:{m:Mode; label:string}) => (
    <button
      onClick={() => handleModeChange(m)}
      className={[
        "min-h-[48px] px-3 py-2 rounded-lg text-[15px] font-bold border",
        currentMode===m ? "bg-[#1e40af] text-white border-[#1e40af]"
                 : "bg-white text-gray-900 hover:bg-gray-50"
      ].join(' ')}
    >
      {label}
    </button>
  );

  return (
    <div className="flex gap-2">
      <Tab m="go"   label="크루즈닷 가자 (길찾기/지도)" />
      <Tab m="show" label="크루즈닷 보여줘 (사진/설명)" />
      <Tab m="free" label="일반" />
    </div>
  );
}



