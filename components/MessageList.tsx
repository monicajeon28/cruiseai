'use client';
import { useEffect, useRef } from 'react';
import { MessageBubble } from './chat/MessageBubble';

type Mode = 'go'|'show'|'free'; // ChatShell에 정의된 Mode와 동일

interface MessageListProps {
  messages: any[]; // Msg[] 타입과 동일하게 처리
  onOptionClick: (payload: any) => void;
}

export default function MessageList({ messages, onOptionClick }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="space-y-3">
      {messages.map((msg, i) => (
        <div key={i} className={`flex mb-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {msg.role === "user" && (
            <div className="max-w-md px-4 py-3 rounded-2xl shadow-md bg-[#1e40af] text-white rounded-br-none whitespace-pre-wrap leading-relaxed text-[15px]">
              {msg.text}
            </div>
          )}
          {msg.role === "assistant" && (
            <MessageBubble msg={msg} onOptionClick={onOptionClick} />
          )}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}



















