'use client';
import { useState } from 'react';

type Mode = 'go'|'show'|'free'; // ChatShell에 정의된 Mode와 동일

interface ComposerProps {
  // mode: Mode; // mode prop 제거
  onSend: (text: string) => void;
}

export default function Composer({ onSend }: ComposerProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSend(input);
      setInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {/* 추천 키워드 칩 (모바일 키보드 위와 별개로 앱에서 제공) */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['근처 스타벅스', '터미널 가는 길', '사진 보여줘', '환율 계산기'].map((k) => (
          <button key={k} type="button"
            className="shrink-0 px-3 py-2 rounded-full bg-gray-100 text-[15px] font-medium"
            onClick={()=>setInput(k)}>{k}</button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={input} onChange={e=>setInput(e.target.value)}
          placeholder="예) 인천공항에서 카이탁 크루즈 터미널까지"
          className="flex-1 h-[48px] rounded-xl border px-4 text-[16px]"
          inputMode="text"
          enterKeyHint="send"
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
        />
        <button type="submit" className="h-[48px] px-4 rounded-xl bg-brand-red text-white font-bold hover:bg-red-600">전송</button>
      </div>
    </form>
  );
}
