'use client';
import type { ChatMessage } from '@/lib/chat-types';
import Image from 'next/image';
import { useRef, useEffect, useState } from 'react';
import MapModal from './MapModal'; // MapModal import
import { csrfFetch } from '@/lib/csrf-client';

function safeHtml(html: string) {
  // 아주 간단한 화이트리스트( b, strong, i, em, br, a )
  return html
    .replace(/<(?!\/?(b|strong|i|em|br|a)(\s|>|\/))/gi, '&lt;')
    .replace(/on\w+=\\\"[^\\\"]*\\\"/gi, '') // onClick 등 제거
    .replace(/javascript:/gi, '');
}

export default function ChatMessages({ messages, appendMessages }: { messages: ChatMessage[]; appendMessages: (messages:ChatMessage[])=>void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapPorts, setMapPorts] = useState<{ id: string; name: string; lat: number; lng: number; }[]>([]);

  const onClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest('[data-action]');
    if (!el) return;
    const action = el.getAttribute('data-action');
    if (action==='pick-terminal'){
      const id = el.getAttribute('data-id');
      const r = await csrfFetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'pick-terminal',id})});
      const j = await r.json();
      appendMessages(j.messages??[]);
    }
  };

  return (
    <div ref={ref} className="mt-4 space-y-3" onClick={onClick}>
      {messages.map((m, i) => (
        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}> {/* 역할에 따라 정렬 */}
          {m.role === 'user' && m.type === 'text' ? (
            <div className="chat-bubble max-w-md px-4 py-3 rounded-2xl shadow-md bg-blue-600 text-white rounded-br-none whitespace-pre-wrap">{m.text}</div>
          ) : (
            // 지니의 응답 메시지 렌더러
            m.type === 'map-links' ? (
              <div className="bg-white border rounded-xl p-3 max-w-md">
                {m.title && <div className="font-bold mb-2 text-[17px]">{m.title}</div>}
                <div className="flex flex-wrap gap-2">
                  {m.links.map((l:any, k:number)=>( // any 대신 {label:string;href:string} 사용 가능
                    <a key={k} href={l.href} target="_blank" rel="noreferrer"
                       className="px-3 py-3 min-h-[48px] text-[16px] rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">
                      {l.label}
                    </a>
                  ))}
                  {/* 지도 보기 버튼 추가 */}
                  <button
                    onClick={() => {
                      // 예시 포트 데이터 (실제 데이터는 m.links에서 파싱)
                      if (m.ports) {
                        setMapPorts(m.ports);
                      }
                      setShowMapModal(true);
                    }}
                    className="px-3 py-3 min-h-[48px] text-[16px] rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700"
                  >
                    지도 보기
                  </button>
                </div>
                {m.note && <div className="mt-3 text-sm bg-yellow-50 text-yellow-900 rounded-md px-3 py-2">{m.note}</div>} {/* note 추가 */}
              </div>
            ) : m.type === 'photos' ? (
              <div className="bg-white border rounded-xl p-3 max-w-md">
                {m.title && <div className="font-bold mb-2 text-[17px]">{m.title}</div>}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  {m.photos.map((p:any, k:number)=>( // any 대신 {url:string;alt?:string} 사용 가능
                    <img key={k} src={p.url} alt={p.alt||''}
                         className="w-full h-44 object-cover rounded-xl border" />
                  ))}
                </div>
              </div>
            ) : m.type === 'photo-gallery' ? (
              <div className="bg-white border rounded-xl p-3 max-w-md">
                {m.title && <div className="font-bold mb-2 text-[17px]">{m.title}</div>}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  {m.images.map((url:string, k:number)=>( // images는 string[]
                    <img key={k} src={url} alt={'Cruise image'}
                         className="w-full h-44 object-cover rounded-xl border" />
                  ))}
                </div>
              </div>
            ) : m.type === 'go-actions' ? (
              <div className="bg-white border rounded-xl p-3 max-w-md">
                <div className="font-bold mb-2 text-[17px]">선택하신 목적지로 가는 방법입니다.</div>
                <p className="text-gray-700">출발지: {m.originText}</p>
                <p className="text-gray-700">도착지: {m.destText}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <a href={m.urls.driving} target="_blank" rel="noreferrer"
                     className="px-3 py-3 min-h-[48px] text-[16px] rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">
                    차량 {m.destText}까지
                  </a>
                  <a href={m.urls.transit} target="_blank" rel="noreferrer"
                     className="px-3 py-3 min-h-[48px] text-[16px] rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700">
                    대중교통 {m.destText}까지
                  </a>
                  <a href={m.urls.walking} target="_blank" rel="noreferrer"
                     className="px-3 py-3 min-h-[48px] text-[16px] rounded-lg bg-yellow-600 text-white font-semibold hover:bg-yellow-700">
                    도보 {m.destText}까지
                  </a>
                </div>
              </div>
            ) : m.type === 'text' ? ( /* 글자 크기 조정 */
              <div className="chat-bubble bg-white border rounded-xl p-3 whitespace-pre-wrap max-w-md prose prose-sm max-w-none"
                   dangerouslySetInnerHTML={{ __html: safeHtml(m.text) }} />
            ) : null // 알려지지 않은 타입은 렌더링하지 않음
          )}
        </div>
      ))}

      <MapModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        ports={mapPorts}
      />
    </div>
  );
}
