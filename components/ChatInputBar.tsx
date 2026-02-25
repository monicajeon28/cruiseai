'use client';

import { useState } from 'react'; // ChangeEvent, useCallback, useRef는 더 이상 필요 없으므로 제거
import type { ChatInputMode, ChatInputPayload } from '@/lib/types';
import { useRelatedPorts } from '@/components/chat/hooks/useRelatedPorts';
import ChipGroup from '@/vnext/components/ChipGroup';
// import { renderEmphasis } from '@/lib/utils'; // 사용하지 않으므로 제거
// import { Chip } from './Chip'; // 사용하지 않으므로 제거

export default function ChatInputBar({
  mode,
  onChangeMode,
  onSubmit,
}: {
  mode: ChatInputMode;
  onChangeMode: (m: ChatInputMode) => void;
  onSubmit: (p: ChatInputPayload) => void | Promise<void>;
}) {
  const [text, setText] = useState('');
  const [origin, setOrigin] = useState('');
  const [to, setTo] = useState(''); // dest -> to
  const [countryKor, setCountryKor] = useState<string | null>(null); // 추가
  const [cityKorHint, setCityKorHint] = useState<string | null>(null); // 추가

  // (예시) 지역 칩 클릭 핸들러
  const pickRegion = (korCountry: string, city?: string) => {
    setCountryKor(korCountry);
    setCityKorHint(city ?? null);
    if (city) setTo(`${city} 크루즈 터미널`);
    else setTo(''); // 도시 힌트 없으면 도착지 입력 초기화
  };

  const relatedPorts = useRelatedPorts({
    countryKor, // 추가
    cityKorHint, // 추가
    toInput: to, // dest -> to
    limit: 6,
  });

  const submit = () => {
    // 모드별로 payload 구성
    const payload: ChatInputPayload = {
      mode,
      text: (mode === 'general' || mode === 'show') ? text : '',
      origin: mode === 'go' ? origin : undefined,
      dest: mode === 'go' ? to : undefined, // dest -> to
    };
    onSubmit(payload);
    setText('');
    setOrigin('');
    setTo(''); // dest -> to
    setCountryKor(null); // 추가
    setCityKorHint(null); // 추가
  };

  // Tailwind CSS 클래스 매핑 (프로젝트 스타일에 맞게 조정)
  const inputClass = "w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const btnBaseClass = "px-4 py-2 rounded-lg font-semibold";
  const btnPrimaryClass = "bg-red-600 text-white hover:bg-red-700";
  const btnDefaultClass = "bg-gray-100 text-gray-800 hover:bg-gray-200";
  const btnDangerClass = "bg-red-500 text-white hover:bg-red-600";

  return (
    <div className="border-t p-3 space-y-2">
      {/* 지역 칩 (GO 모드에서만 표시) */}
      {mode === 'go' && (
        <div className="flex flex-wrap gap-2 mb-3">
          <button onClick={() => pickRegion('미국', '마이애미')} className="px-3 py-1.5 rounded-full border bg-white hover:bg-gray-50 text-sm">미국 · 마이애미</button>
          <button onClick={() => pickRegion('미국', '포트 로더데일')} className="px-3 py-1.5 rounded-full border bg-white hover:bg-gray-50 text-sm">미국 · 포트 로더데일</button>
          <button onClick={() => pickRegion('미국', '케이프 커내버럴')} className="px-3 py-1.5 rounded-full border bg-white hover:bg-gray-50 text-sm">미국 · 케이프 커내버럴</button>
          <button onClick={() => pickRegion('일본', '도쿄')} className="px-3 py-1.5 rounded-full border bg-white hover:bg-gray-50 text-sm">일본 · 도쿄</button>
          <button onClick={() => pickRegion('한국', '부산')} className="px-3 py-1.5 rounded-full border bg-white hover:bg-gray-50 text-sm">한국 · 부산</button>
          <button onClick={() => pickRegion(null, null)} className="px-3 py-1.5 rounded-full border bg-white hover:bg-gray-50 text-sm">모두 보기</button>
        </div>
      )}

      {mode === 'go' && (
        <div className="flex gap-2">
          <input
            className={inputClass}
            placeholder="출발지"
            value={origin}
            onChange={e=>setOrigin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
          />
          <input
            className={inputClass}
            placeholder="도착지 (예: 마이애미 크루즈 터미널)" // 플레이스홀더 업데이트
            value={to}
            onChange={e=>setTo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
          />
        </div>
      )}

      {mode === 'go' && relatedPorts.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-3">
          {relatedPorts.map(p => (
            <button
              key={p.id}
              onClick={() => setTo(p.label)}
              className="px-3 py-1.5 rounded-full border bg-white hover:bg-gray-50 text-sm"
              title={p.value}
            >
              {p.label}
            </button>
          ))
        }
        </div>
      )}

      {mode === 'show' && (
        <div className="space-y-2">
          <input
            className={inputClass + " w-full"}
            placeholder="사진을 검색하세요 (예: 코스타 세레나, 지중해, 객실 등)"
            value={text}
            onChange={e=>setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
          />
        </div>
      )}

      {mode === 'general' && (
        <input
          className={inputClass + " w-full"}
          placeholder="무엇이든 물어보세요"
          value={text}
          onChange={e=>setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
      )}

      <div className="flex gap-2">
        <button className={`${btnBaseClass} ${mode==='go'?btnPrimaryClass:btnDefaultClass}`} onClick={()=>onChangeMode('go')}>크루즈닷 가자</button>
        <button className={`${btnBaseClass} ${mode==='show'?btnPrimaryClass:btnDefaultClass}`} onClick={()=>onChangeMode('show')}>크루즈닷 보여줘</button>
        <button className={`${btnBaseClass} ${mode==='general'?btnPrimaryClass:btnDefaultClass}`} onClick={()=>onChangeMode('general')}>일반</button>
        <button className={`${btnBaseClass} ${btnDangerClass} ml-auto`} onClick={submit}>보내기</button>
      </div>
    </div>
  );
}
