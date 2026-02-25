'use client';
import { useState } from 'react';
import { FaTaxi, FaTimes, FaSearch, FaMapMarkerAlt, FaMicrophone, FaCopy, FaCheck } from 'react-icons/fa';

export default function MagicTaxi({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [copied, setCopied] = useState(false);

  // 음성 인식 (기존 코드 유지)
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Voice recognition not supported."); return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setIsListening(true);
    recognition.start();
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleGenerate(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
  };

  const handleGenerate = async (textToSearch = input) => {
    if (!textToSearch) return;
    setLoading(true);
    setCopied(false);
    try {
      const res = await fetch('/api/en/genie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Take me to: ${textToSearch}` }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      alert("Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // 주소 복사 기능
  const handleCopy = () => {
    if (result?.address_kr) {
      navigator.clipboard.writeText(result.address_kr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md z-10 animate-in fade-in zoom-in duration-300">
        <button onClick={onClose} className="absolute -top-12 right-0 text-white/50 hover:text-white text-3xl transition-colors">
          <FaTimes />
        </button>

        {!result ? (
          // [입력 화면]
          <div className="bg-slate-900/90 border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
                <FaTaxi className="text-3xl text-white" />
              </div>
              <h2 className="text-2xl font-serif font-bold text-white">Where to?</h2>
              <p className="text-slate-400 text-sm">Say anything. I&apos;ll find the place.</p>
            </div>

            <div className="relative mb-6 flex items-center gap-2">
              <div className="relative flex-1">
                <FaSearch className="absolute left-4 top-4 text-slate-500" />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  placeholder='e.g. "I am hungry", "Hongdae"'
                  className="w-full bg-white/5 border border-white/10 text-white pl-12 pr-4 py-4 rounded-xl outline-none focus:border-yellow-500 transition-colors placeholder:text-slate-600"
                  autoFocus
                />
              </div>
              <button
                onClick={startListening}
                className={`p-4 rounded-xl border transition-all ${isListening ? 'bg-red-500 text-white border-red-500 animate-pulse' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
              >
                <FaMicrophone />
              </button>
            </div>

            <button
              onClick={() => handleGenerate()}
              disabled={loading}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 text-black font-bold py-4 rounded-xl text-lg transition-all shadow-lg shadow-orange-900/50 disabled:opacity-50"
            >
              {loading ? "Analyzing Location..." : "Create Magic Card ✨"}
            </button>
          </div>
        ) : (
          // [결과 화면: 기사님 전용 모드]
          <div className="bg-[#FFC107] text-black rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(255,193,7,0.4)]">
            <div className="bg-black/10 p-4 flex justify-between items-center border-b border-black/5">
              <span className="font-bold text-xs opacity-60 tracking-widest">ROYAL CHAUFFEUR</span>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-black/20"></div>
                <div className="w-2 h-2 rounded-full bg-black/20"></div>
              </div>
            </div>

            <div className="p-8 text-center">
              <p className="text-sm font-bold opacity-60 mb-2 uppercase tracking-wide">Destination</p>

              {/* 한글 목적지 (최대 강조) */}
              <h1 className="text-5xl font-black mb-2 leading-tight break-keep drop-shadow-sm">
                {result.destination_kr}
              </h1>

              {/* 영문 장소명 */}
              <div className="inline-block bg-black/10 px-3 py-1 rounded-lg mb-8">
                <p className="text-lg font-medium">{result.destination_en}</p>
              </div>

              {/* 실제 주소 영역 + 복사 버튼 */}
              <div className="bg-white/90 rounded-2xl p-4 text-left shadow-sm border border-black/5 relative group">
                <div className="flex gap-4 items-start">
                  <FaMapMarkerAlt className="text-3xl text-red-600 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">Navigation Address</p>
                    <p className="text-xl font-bold text-slate-900 leading-snug break-keep">
                      {result.address_kr || "주소 정보를 불러오지 못했습니다."}
                    </p>
                  </div>
                </div>

                {/* 복사 버튼 (우측 하단) */}
                <button
                  onClick={handleCopy}
                  className="absolute bottom-3 right-3 bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                >
                  {copied ? <><FaCheck className="text-green-500"/> Copied</> : <><FaCopy/> Copy</>}
                </button>
              </div>
            </div>

            <div className="bg-black text-white p-6 text-center">
              <p className="text-lg font-medium">
                &quot;{result.driver_message}&quot;
              </p>
              <button
                onClick={() => setResult(null)}
                className="mt-6 text-sm text-gray-500 hover:text-white underline decoration-gray-700 underline-offset-4"
              >
                Search Another Destination
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
