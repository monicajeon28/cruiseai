'use client';
import Image from 'next/image';

type Props = { mode: 'go'|'show'|'general'; onMode: (m:Props['mode'])=>void };

export default function ChatTopBar({ mode, onMode }: Props) {
  const Tab = ({v,label}:{v:Props['mode'];label:string}) => (
    <button
      onClick={()=>onMode(v)}
      className={`px-3 py-2 rounded-lg text-sm font-semibold ${mode===v?'bg-blue-600 text-white':'bg-white border'}`}
    >{label}</button>
  );
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-white sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <Image src="/images/ai-cruise-logo.png" alt="logo" width={28} height={12} />
        <span className="font-bold text-gray-800 text-sm">크루즈닷</span>
      </div>
      <div className="flex gap-2">
        <Tab v="go" label="크루즈닷 가자 (길찾기/지도)" />
        <Tab v="show" label="크루즈닷 보여줘 (사진/설명)" />
        <Tab v="general" label="일반" />
      </div>
    </div>
  );
}



