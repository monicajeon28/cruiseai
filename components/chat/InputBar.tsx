'use client';
import * as React from 'react';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import HelpModal from '@/components/HelpModal';
// import { nanoid } from 'nanoid'; // nanoid import 삭제
import { ChatMessage, ChatInputMode, ChatInputPayload, FromCoords, SItem } from '@/lib/types';
import { csrfFetch } from '@/lib/csrf-client';

const uid = () =>
  (globalThis.crypto?.randomUUID?.() ??
   Math.random().toString(36).slice(2));

type Props = {
  mode: ChatInputMode;
  trip?: {
    embarkCountry?: string;
    embarkPortName?: string;
    cruiseName?: string;
  };
  onSend: (payload: ChatInputPayload) => void; // 기존 onSend (go/show 모드용)
  onAddMessage: (m: ChatMessage) => void;     // 새 onAddMessage (general 모드용)
  generalInput: string;
  setGeneralInput: React.Dispatch<React.SetStateAction<string>>; // 일반 탭 입력창 상태 관리
};

export default function InputBar({ mode, trip, onSend, onAddMessage, generalInput, setGeneralInput }: Props) {
  const [activeSlot, setActiveSlot] = React.useState<'from'|'to'>('from');
  const [from, setFrom] = React.useState('');
  const [localTo, setLocalTo] = React.useState(''); // 'go' 및 'show' 모드를 위한 로컬 to 상태

  // 모드에 따라 to와 setTo를 조건부로 설정
  const to = mode === 'general' ? generalInput : localTo;
  const setTo = mode === 'general' ? setGeneralInput : setLocalTo;

  const [chipsFrom, setChipsFrom] = React.useState<SItem[]>([]);
  const [chipsTo,   setChipsTo]   = React.useState<SItem[]>([]);
  const [fromPick, setFromPick] = React.useState<SItem | null>(null);
  const [toPick,   setToPick]   = React.useState<SItem | null>(null);
  const [fromCoords, setFromCoords] = React.useState<FromCoords | null>(null); // fromCoords 상태 추가
  const [openHelp, setOpenHelp] = React.useState(false); // openHelp, setOpenHelp 상태 추가

  const gpsRef = useRef<{ lat: number; lng: number } | undefined>(undefined);

  // 모드 변경 시 localTo 초기화
  useEffect(() => {
    if (mode !== 'general') {
      setLocalTo('');
    }
  }, [mode, setLocalTo]);

  // 전역에서 한번만 가져와 보관
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(p => {
        gpsRef.current = { lat: p.coords.latitude, lng: p.coords.longitude };
      });
    }
  }, []);

  async function fetchSuggest(slot:'from'|'to', q:string, hint:string) {
    const r = await fetch(`/api/nav/suggest?slot=${slot}&q=${encodeURIComponent(q)}&hint=${encodeURIComponent(hint)}`);
    const { items } = await r.json();
    if (slot === 'from') setChipsFrom(items || []);
    else setChipsTo(items || []);
  }

  // "근처 ~"로 시작하면 from을 "현 위치"로 강제 세팅하는 로직은 submit 함수 내에서 처리합니다.

  const examples = useMemo(() => {
    const city = trip?.embarkCountry ?? '홍콩';
    const terminal = trip?.embarkPortName
      ? `${trip.embarkPortName} 크루즈 터미널`
      : '홍콩 크루즈 터미널';
    const singlePH = 
      mode === 'general'
        ? '예) 10월 오키나와 날씨는?'
        : (mode === 'show'
          ? '보고싶은 크루즈/여행지를 입력하세요 (예: 벨리시마 , 오키나와)'
          : '도착지만 입력해도 됩니다. (예: 홍콩 크루즈 터미널 / 스타벅스)');
    return {
      originPH: "예: 인천공항 / 지룽 터미널 / 현 위치",
      destPH: "예: 근처 식당 / 관광지 / 스타벅스",
      singlePH,
    };
  }, [trip, mode]);

  const isGo = mode === 'go';
  const canSend = isGo
    ? ((from.trim().length > 0 || /현\s*위치|현재\s*위치/.test(from)) && to.trim().length > 0)
    : (to.trim().length > 0); // to 대신 input 사용

  const submit = async () => {
    if (!canSend) return;
    console.log('[InputBar] submit invoked, mode:', mode, { originText: from, destText: to }); // to 대신 input 사용

    if (mode === 'general') {
      // 일반 모드: Gemini API 로만 요청
      const userMsg: ChatMessage = { id: uid(), role:'user', text: to.trim() }; // to 대신 input 사용
      onAddMessage(userMsg);

      const res = await csrfFetch('/api/ai/gemini', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          messages: [
            { role:'system', content:'당신은 친절한 여행 도우미입니다. 답변은 한국어로 해요.' },
            // 필요 시 대화 히스토리 일부를 앞에 넣어도 됨
            { role:'user', content: to.trim() } // to 대신 input 사용
          ]
        })
      }).then(r=>r.json()).catch(()=>({ok:false,error:'network'}));

      if (res?.ok) {
        onAddMessage({ id: uid(), role:'assistant', text: res.text });
      } else {
        onAddMessage({ id: uid(), role:'assistant', text: '죄송해요. 답변을 가져오지 못했어요.' });
      }
      setGeneralInput(''); // 텍스트 필드 초기화 (setTo 대신 setInput 사용)
      return;
    }

    if (mode === 'show') {
      // “지니야 보여줘” 로직
      const raw = (to ?? '').trim(); // to 대신 input 사용
      const q = raw.split('→').pop()?.trim() ?? raw; // InputBar에서는 dest가 to 이므로 input을 사용
      if (!q) return;
      onSend({
        mode: 'show',
        text: q,
        dest: q,
      });
      setGeneralInput(''); // 텍스트 필드 초기화 (setTo 대신 setInput 사용)
      return;
    }

    // === 기존 go 모드 로직 ===
    if (mode === 'go') {
      const combinedText = [from, to].filter(Boolean).join(' → ') || to || from || ''; // to 대신 input 사용
      onSend({
        mode: 'go',
        text: combinedText,
        origin: from.trim() || undefined,
        dest: to.trim() || undefined, // to 대신 input 사용
        fromPick: fromPick || undefined,
        toPick: toPick || undefined,
        fromCoords: fromCoords || undefined,
      });
      setFrom(''); // 텍스트 필드 초기화
      setGeneralInput('');   // 텍스트 필드 초기화 (setTo 대신 setInput 사용)
      return;
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 p-3 border rounded-xl bg-white">
        {/* 도움말 버튼 */}
        <button
          aria-label="도움말"
          className="shrink-0 w-10 h-10 rounded-lg border text-gray-700 hover:bg-gray-50"
          onClick={() => setOpenHelp(true)}
          title="도움말"
        >
          ?
        </button>

        {/* 입력들 */}
        {isGo ? (
          <div className="flex-1 space-y-2">
            {/* FROM */} 
            <Input
              id="from-input"
              value={from}
              placeholder={examples.originPH}
              onFocus={() => setActiveSlot('from')}
              onChange={(e) => {
                const v = e.target.value;
                setFrom(v);
                setFromPick(null); // 입력 변경 시 칩 선택 초기화
                setFromCoords(null); // 입력 변경 시 좌표 초기화
                fetchSuggest('from', v, to.trim() || ''); // toPick?.label || '' 대신 input.trim() || '' 사용
              }}
              onKeyDown={onKey}
            />
            {activeSlot === 'from' && chipsFrom?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chipsFrom.map(it => (
                  <button key={it.id}
                    onClick={async () => {
                      if (it.id === 'current_location') {
                        try {
                          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
                            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 })
                          );
                          setFromPick({ id: it.id, label: it.label });
                          setFromCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: it.label });
                          setFrom(it.label); // 입력칸에도 표기(선택 사항)
                        } catch (error) {
                          console.error("Geolocation error:", error);
                          // 권한 거부 시: 칩만 세팅하고 서버가 텍스트로 유추하도록
                          setFromPick({ id: it.id, label: it.label });
                          setFromCoords(null);
                          setFrom(it.label); // 입력칸에도 표기
                        }
                      } else {
                        setFrom(it.label);
                        setFromPick(it); // 칩 선택 시 fromPick 업데이트
                        setFromCoords(null); // 일반 칩 선택 시 좌표 초기화
                      }
                      setActiveSlot('to'); // 다음 입력칸으로 포커스 이동을 위해 activeSlot 변경
                      document.getElementById('to-input')?.focus();
                    }}
                    className="rounded-full border px-3 py-1 hover:bg-neutral-50">
                    {it.label}{it.subtitle ? <span className="ml-1 text-xs text-neutral-500">· {it.subtitle}</span> : null}
                  </button>
                ))}
              </div>
            )}

            {/* divider */}
            <div className="text-center text-neutral-400">→</div>

            {/* TO */}
            <Input
              id="to-input"
              value={to} // to 대신 input 사용
              placeholder={examples.destPH}
              onFocus={() => setActiveSlot('to')}
              onChange={(e) => {
                const v = e.target.value;
                setTo(v); // setTo 대신 setInput 사용
                setToPick(null); // 입력 변경 시 칩 선택 초기화
                fetchSuggest('to', v, fromPick?.label || '');
              }}
              onKeyDown={onKey}
            />
            {activeSlot === 'to' && chipsTo?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chipsTo.map(it => (
                  <button key={it.id}
                    onClick={() => {
                      setTo(it.label); // setTo 대신 setInput 사용
                      setToPick(it); // 칩 선택 시 toPick 업데이트
                      // To 칩 클릭 후에는 포커스 유지 또는 전송 준비
                    }}
                    className="rounded-full border px-3 py-1 hover:bg-neutral-50">
                    {it.label}{it.subtitle ? <span className="ml-1 text-xs text-neutral-500">· {it.subtitle}</span> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Input
            id="single-input"
            value={to} // to 대신 input 사용
            placeholder={examples.singlePH}
            onChange={e=> setTo(e.target.value)} // setTo 대신 setInput 사용
            onKeyDown={onKey}
          />
        )}

        {/* 보내기 */}
        <button
  type="button"
  onClick={submit}
  disabled={!canSend}
  aria-label="보내기"
  title={!canSend ? '입력값을 확인하세요' : '메시지 보내기'}
  className={
    `ml-3 px-6 py-3 rounded-lg font-semibold text-base transition-all whitespace-nowrap
     ${canSend ? 'bg-red-600 text-white shadow' : 'bg-red-200 text-white/70'}`
  }
  style={{ zIndex: 40 }} // 필요시 조정
>
  보내기
</button>
      </div>

      <HelpModal open={openHelp} onClose={() => setOpenHelp(false)} />
    </>
  );
}

// 아주 단순한 입력/칩 UI
function Input({
  id,
  value,
  onChange,
  placeholder,
  onKeyDown,
  onFocus,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; // 이벤트 객체를 받도록 수정
  placeholder: string;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
}) {
  return (
    <input
      id={id}
      className="w-full rounded-xl border px-3 py-2 outline-none"
      value={value}
      placeholder={placeholder}
      onFocus={onFocus}
      onChange={onChange}
      onKeyDown={onKeyDown}
    />
  );
}
function Chips({items, onClick}:{items:SItem[], onClick:(it:SItem)=>void}) {
  if (!items?.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map(it=>(
        <button key={it.id}
                className="rounded-full px-3 py-1 border hover:bg-neutral-50"
                onClick={()=>onClick(it)}>
          {it.label}{it.subtitle ? <span className="ml-1 text-xs text-neutral-500">· {it.subtitle}</span> : null}
        </button>
      ))}
    </div>
  )
}
