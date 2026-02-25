'use client';

import { useRouter } from 'next/navigation';
import DirectionsButtons from '@/components/DirectionsButtons'; // DirectionsButtons 임포트

interface Route {
  label: string;
  url: string;
}

type Msg =
  | { role: "assistant"|"user"; type: "text"; text: string }
  | { role: "assistant"; type: "options"; title: string; hint?: string; options: {label: string; payload: any}[] }
  | { role: "assistant"; type: "directions"; title: string; routes: Route[]; note?: string } // routes 타입 업데이트
  | { role: "assistant"; type: "nearby"; title: string; routes: Route[]; note?: string }; // routes 타입 업데이트

export function MessageBubble({
  msg, onOptionClick }:{
  msg: Msg; onOptionClick?: (payload:any)=>void
}) {
  if (msg.type === "options") {
    return (
      <div className="rounded-2xl bg-white shadow-md p-4">
        <div className="font-bold text-lg mb-1">👇 {msg.title}</div>
        {msg.hint && <div className="text-sm text-gray-600 mb-3">{msg.hint}</div>}
        <div className="flex flex-wrap gap-2">
          {msg.options.map((o,i) => (
            <button key={i}
              onClick={() => onOptionClick?.(o.payload)}
              className="px-3 py-3 rounded-xl bg-red-600 text-white font-bold text-[16px] hover:opacity-90"> {/* bg-brand-red -> bg-red-600 변경 */}
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (msg.type === "directions" || msg.type === "nearby") {
    return (
      <div className="rounded-2xl bg-white shadow-md p-4">
        <div className="font-extrabold text-lg mb-2">📍 {msg.title}</div>
        <DirectionsButtons routes={msg.routes} />
        {"note" in msg && msg.note && (
          <div className="mt-3 text-sm bg-yellow-50 text-yellow-900 rounded-md px-3 py-2">
            {msg.note}
          </div>
        )}
      </div>
    );
  }
  // fallback text
  return <p className="text-[17px] leading-relaxed text-gray-900 whitespace-pre-wrap">{msg.text}</p>;
}
