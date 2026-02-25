'use client';
import { useEffect, useRef, useState } from 'react';
import ChatHeader from '@/components/chat/ChatHeader';
import TripSummaryCard from './TripSummaryCard';
import QuickTools from './QuickTools';
import SuggestedChips from './SuggestedChips';

type Mode = 'go' | 'show' | 'free';
type Msg = { role: 'user' | 'assistant'; text?: string; };

export default function ChatShell({
  initialTrip,
  onSend,
  input, // Accept input prop
  setInput, // Accept setInput prop
}: {
  initialTrip?: { cruiseName?: string; destinations?: string[]; start?: string; end?: string };
  onSend: (payload: { text: string; mode: Mode }) => Promise<Msg[]>;
  input: string; // Define input prop type
  setInput: React.Dispatch<React.SetStateAction<string>>; // Define setInput prop type
}) {
  const [mode, setMode] = useState<Mode>('go');
  const [messages, setMessages] = useState<Msg[]>([]);
  // const [input, setInput] = useState(''); // Remove local input state
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  async function submit(text: string) {
    if (!text.trim()) return;
    setMessages(m => [...m, { role: 'user', text }]);
    const resp = await onSend({ text, mode });
    setMessages(m => [...m, ...resp]);
    setInput('');
  }

  return (
    <div className="mx-auto max-w-4xl w-full px-3 sm:px-4 py-4 space-y-3">
      <ChatHeader mode={mode} onModeChange={setMode} />

      <div className="text-lg font-bold text-gray-900">행복한 크루즈 여행! AI 가이드 크루즈닷</div>

      <QuickTools onPick={(cmd) => submit(cmd)} />

      <TripSummaryCard
        cruiseName={initialTrip?.cruiseName}
        destinations={initialTrip?.destinations}
        start={initialTrip?.start}
        end={initialTrip?.end}
        onMyInfo={() => submit('나의 정보 보기')}
      />

      <div className="rounded-xl border bg-white p-3">
        <div className="text-sm text-gray-800 leading-6">
          안녕하세요! 무엇을 도와드릴까요? (아래 예시를 눌러보세요)
          <br />• <b>크루즈닷 가자</b>: 길찾기·지도·주변검색
          <br />• <b>크루즈닷 보여줘</b>: 여행지·선박·자료·사진
        </div>
        <div className="mt-3">
          <SuggestedChips onPick={submit} currentInput={input} />
        </div>
      </div>

      {/* 대화 */}
      <div className="min-h-[320px] max-h-[calc(100vh-340px)] overflow-y-auto rounded-xl border bg-white p-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? "text-right" : "text-left"}>
            <div className={[
              "inline-block max-w-[85%] rounded-2xl px-3 py-2 text-[15px] leading-6",
              m.role === 'user' ? "bg-[#1e40af] text-white" : "bg-gray-100 text-gray-900"
            ].join(' ')}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* 입력창 */}
      <form
        onSubmit={(e) => { e.preventDefault(); submit(input); }}
        className="sticky bottom-[env(safe-area-inset-bottom)] bg-transparent"
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={
              mode === 'go'
                ? "예) 인천공항에서 카이탁 크루즈 터미널까지"
                : mode === 'show'
                  ? "예) 코스타 세레나 사진 보여줘"
                  : "무엇이든 물어보세요"
            }
            className="flex-1 rounded-xl border px-3 py-3 text-[16px]"
          />
          <button
            className="min-h-[48px] px-4 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700"
          >전송</button>
        </div>
      </form>
    </div>
  );
}
