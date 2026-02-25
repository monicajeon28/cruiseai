'use client';
import { useState } from 'react';
import { FaMicrophone, FaTimes, FaVolumeUp, FaLanguage } from 'react-icons/fa';

export default function VocalGenie({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // 🎤 음성 인식 기능 (브라우저 내장 API 사용)
  const startListening = () => {
    // 브라우저 호환성 체크
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Voice recognition is not supported in this browser. Please type.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'en-US'; // 외국인이 영어로 말함
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    recognition.start();

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setText(transcript);
      // 말 끝나자마자 바로 번역 요청
      handleTranslate(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
      alert("Could not hear you clearly.");
    };

    recognition.onend = () => setIsListening(false);
  };

  const handleTranslate = async (inputText = text) => {
    if (!inputText) return;
    setLoading(true);

    try {
      const res = await fetch('/api/en/genie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Translate this to Korean: "${inputText}"` }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      alert("Translation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-md z-10 animate-in slide-in-from-bottom-10 duration-300">
        <button onClick={onClose} className="absolute -top-12 right-0 text-white/50 hover:text-white text-3xl"><FaTimes /></button>

        {/* 메인 카드 */}
        <div className="bg-slate-900 border border-purple-500/30 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(168,85,247,0.2)]">

          <div className="bg-gradient-to-r from-purple-900 to-slate-900 p-6 border-b border-white/10">
            <div className="flex items-center gap-3 mb-1">
              <FaLanguage className="text-purple-400 text-2xl" />
              <h2 className="text-xl font-serif font-bold text-white">Elite Translator</h2>
            </div>
            <p className="text-purple-200/60 text-xs">Speak English, Show Korean</p>
          </div>

          <div className="p-6 space-y-6">
            {/* 입력창 (User) */}
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Tap mic and speak... (e.g., I lost my bag)"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-slate-500 focus:border-purple-500 outline-none resize-none h-32 transition-colors text-lg"
              />

              {/* 🎤 마이크 버튼 (애니메이션 추가) */}
              <button
                onClick={startListening}
                className={`absolute bottom-3 right-3 p-4 rounded-full shadow-lg transition-all ${
                  isListening
                    ? 'bg-red-500 animate-pulse scale-110 text-white'
                    : 'bg-purple-600 hover:bg-purple-500 text-white active:scale-95'
                }`}
              >
                {isListening ? <span className="animate-spin block">●</span> : <FaMicrophone className="text-xl"/>}
              </button>
            </div>

            {/* 로딩 표시 */}
            {loading && (
              <div className="text-center py-4">
                <span className="text-purple-400 animate-pulse">Translating...</span>
              </div>
            )}

            {/* 결과창 (AI) */}
            {result && !loading && (
              <div className="bg-white rounded-2xl p-5 relative animate-in zoom-in shadow-xl">
                <div className="absolute -top-2 left-6 w-4 h-4 bg-white rotate-45 transform"></div>

                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Show to Local</span>
                  <button className="text-gray-400 hover:text-purple-600"><FaVolumeUp /></button>
                </div>

                {/* 1. 한국어 결과 (크게) */}
                <h3 className="text-3xl font-black text-slate-900 mb-3 leading-snug break-keep">
                  {result.translated_kr}
                </h3>

                {/* 2. 발음 가이드 (읽을 수 있게) */}
                <div className="bg-slate-100 px-3 py-2 rounded-lg inline-block border border-slate-200">
                  <p className="text-sm font-medium text-slate-600">
                    &quot; {result.pronunciation} &quot;
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
