'use client';
import type { ChatMessage } from '@/lib/chat-types';
import type { TextMessage } from '@/lib/chat-types';
import Image from 'next/image';
import { useRef, useEffect } from 'react';
import DOMPurify from 'isomorphic-dompurify';

function safeHtml(html: string) {
  // DOMPurify로 안전하게 정화
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'br', 'a', 'p', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

export default function ChatMessages({ messages, appendMessages }: { messages: ChatMessage[]; appendMessages: (messages: ChatMessage[]) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  const onClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest('[data-action]');
    if (!el) return;
    const action = el.getAttribute('data-action');
    if (action === 'pick-terminal') {
      const id = el.getAttribute('data-id');
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'pick-terminal', id }) });
      const j = await r.json();
      appendMessages(j.messages ?? []);
    }
  };

  return (
    <div ref={ref} className="mt-4 space-y-3" onClick={onClick}>
      {messages.map((m, i) => (
        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}> {/* 역할에 따라 정렬 */}
          {m.role === 'user' ? (
            <div className="chat-bubble max-w-md px-4 py-3 rounded-2xl shadow-md bg-blue-600 text-white rounded-br-none whitespace-pre-wrap">{(m as TextMessage).text}</div>
          ) : (
            // 지니의 응답 메시지 렌더러
            m.type === 'map-links' ? (
              <div className="bg-white border rounded-xl p-3 max-w-md">
                {m.title && <div className="font-bold mb-2 text-[17px]">{m.title}</div>}
                <div className="flex flex-wrap gap-2">
                  {m.links.map((l: any, k: number) => ( // any 대신 {label:string;href:string} 사용 가능
                    <a key={k} href={l.href} target="_blank" rel="noreferrer"
                      className="px-3 py-3 min-h-[48px] text-[16px] rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">
                      {l.label}
                    </a>
                  ))}
                </div>
                {m.note && <div className="mt-3 text-sm bg-yellow-50 text-yellow-900 rounded-md px-3 py-2">{m.note}</div>} {/* note 추가 */}
              </div>
            ) : m.type === 'photos' ? (
              <div className="bg-white border rounded-xl p-3 max-w-md">
                {m.title && <div className="font-bold mb-2 text-[17px]">{m.title}</div>}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  {m.photos.map((p: any, k: number) => ( // any 대신 {url:string;alt?:string} 사용 가능
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img key={k} src={p.url} alt={p.alt || ''}
                      className="w-full h-44 object-cover rounded-xl border" />
                  ))}
                </div>
              </div>
            ) : ( /* 글자 크기 조정 */
              <div className="chat-bubble bg-white border rounded-xl p-3 whitespace-pre-wrap max-w-md prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: safeHtml((m as TextMessage).text) }} />
            )
          )}
        </div>
      ))}
    </div>
  );
}
