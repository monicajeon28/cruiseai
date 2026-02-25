// components/en/ConciergeChat.tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import { FaPaperPlane, FaRobot, FaChevronDown } from 'react-icons/fa';

export default function ConciergeChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'ai', text: string}[]>([
    { role: 'ai', text: "Welcome, VIP. How may I assist your journey today?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen, loading]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/en/genie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }), // type: text 자동 처리
      });
      const data = await res.json();
      // API 응답 구조에 따라 message 혹은 text 필드 사용
      const aiMsg = data.message || data.text || "I am at your service.";
      setMessages(prev => [...prev, { role: 'ai', text: aiMsg }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: "My apologies. Connection is unstable." }]);
    } finally {
      setLoading(false);
    }
  };

  // 1. 닫혀있을 때 (플로팅 버튼)
  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-40 animate-bounce-slow">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative bg-black border border-white/20 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform overflow-hidden"
        >
          {/* 금빛 광택 효과 */}
          <div className="absolute inset-0 bg-gradient-to-tr from-yellow-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>
          <FaRobot className="text-white text-2xl relative z-10" />

          {/* 알림 뱃지 */}
          <span className="absolute top-3 right-3 w-3 h-3 bg-green-500 border-2 border-black rounded-full"></span>
        </button>
      </div>
    );
  }

  // 2. 열렸을 때 (채팅창)
  return (
    <div className="fixed bottom-0 right-0 w-full sm:w-[400px] sm:bottom-6 sm:right-6 h-[85vh] sm:h-[600px] bg-[#0f172a] z-50 rounded-t-3xl sm:rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col animate-in slide-in-from-bottom-5">

      {/* Header */}
      <div className="p-5 border-b border-white/5 flex justify-between items-center bg-black/40 backdrop-blur-md rounded-t-3xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-black border border-white/10 flex items-center justify-center shadow-inner">
            <FaRobot className="text-white text-xl" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-white text-lg tracking-wide">Concierge</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-xs text-slate-400 font-medium">Online</span>
            </div>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white p-2 transition-colors">
          <FaChevronDown />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-gradient-to-b from-[#0f172a] to-black" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-lg ${
              m.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-none'
                : 'bg-white/10 text-gray-200 rounded-tl-none border border-white/5'
            }`}>
              {m.text}
            </div>
          </div>
        ))}

        {/* 타이핑 애니메이션 */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl rounded-tl-none flex gap-1.5 items-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-5 bg-black/60 backdrop-blur-xl border-t border-white/5">
        <div className="flex gap-3 relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything..."
            className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl px-5 py-4 outline-none focus:ring-1 ring-white/20 placeholder:text-slate-600 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-white text-black w-14 rounded-xl flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaPaperPlane className="text-lg" />
          </button>
        </div>
      </div>
    </div>
  );
}
