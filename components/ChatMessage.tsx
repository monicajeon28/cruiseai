import { renderEmphasis } from '@/lib/utils'; // renderEmphasis 임포트
import { ReactNode } from 'react';

type ChatMessageProps = {
  role: 'user' | 'assistant';
  children: ReactNode; // 마크업 허용 (형광펜/강조 포함)
};

export default function ChatMessage({ role, children }: ChatMessageProps) {
  const bubbleBase =
    'max-w-[900px] w-full rounded-2xl px-5 py-4 leading-8 shadow-sm';
  const userStyle =
    'bg-blue-50 text-gray-900 border border-blue-200';
  const botStyle =
    'bg-white text-gray-900 border border-gray-200';

  return (
    <div className={`my-2 ${role === 'user' ? 'justify-end flex' : 'flex'}`}>
      <div
        className={`${bubbleBase} ${role === 'user' ? userStyle : botStyle}`}
        style={{ fontSize: '18px' }} // ✅ 기본 글씨 크게
      >
        {children}
      </div>
    </div>
  );
}
