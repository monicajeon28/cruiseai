// components/en/PathFinder.tsx
'use client';
import { useState } from 'react';
import { FaMapMarkedAlt, FaTimes, FaSearch, FaExternalLinkAlt, FaStar, FaExpandArrowsAlt } from 'react-icons/fa';

export default function PathFinder({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isDriverMode, setIsDriverMode] = useState(false); // 기사님 확대 모드 상태

  const handleSearch = async () => {
    if (!input) return;
    setLoading(true);
    try {
      // AI에게 명확한 '도로명 주소'와 '팁'을 요청
      const res = await fetch('/api/en/genie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `I want to visit "${input}". Provide JSON with: {
            "type": "directions",
            "place_kr": "Official Korean Name",
            "place_en": "English Name",
            "address_kr": "Real Road Name Address (도로명주소)",
            "tip": "Useful travel tip (1 sentence)"
          }`
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      alert("Could not find the path. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const openMap = (service: 'naver' | 'google') => {
    if (!result) return;
    const query = encodeURIComponent(result.place_kr); // 한글명으로 검색해야 정확함
    const url = service === 'naver'
      ? `https://map.naver.com/p/search/${query}`
      : `https://www.google.com/maps/search/?api=1&query=${query}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-md z-10 animate-in fade-in zoom-in duration-300">
        <button onClick={onClose} className="absolute -top-12 right-0 text-white/50 hover:text-white text-3xl"><FaTimes /></button>

        {!result ? (
          // [State 1] 검색 화면
          <div className="bg-slate-900/90 border border-blue-500/30 rounded-3xl p-8 shadow-[0_0_50px_rgba(59,130,246,0.15)] text-center backdrop-blur-md">
            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
              <FaMapMarkedAlt className="text-3xl text-blue-400" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-white mb-2">Noble Path</h2>
            <p className="text-slate-400 text-sm mb-6">Find hidden gems & exact locations.</p>

            <div className="relative mb-6">
              <FaSearch className="absolute left-4 top-4 text-slate-500" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. N Seoul Tower"
                className="w-full bg-white/5 border border-white/10 text-white pl-12 pr-4 py-4 rounded-xl outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                autoFocus
              />
            </div>

            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl text-lg transition-all shadow-lg shadow-blue-900/50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                  Locating...
                </span>
              ) : "Find Location"}
            </button>
          </div>
        ) : (
          // [State 2] 결과 카드
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl relative">

            {/* 상단: 장소 정보 */}
            <div className="bg-blue-600 p-6 text-white relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
              <h3 className="text-3xl font-black mb-1 z-10 relative leading-tight">{result.place_kr}</h3>
              <p className="text-blue-200 font-medium z-10 relative">{result.place_en}</p>
            </div>

            <div className="p-6">
              {/* 주소 섹션 */}
              <div className="mb-6">
                 <p className="text-xs text-gray-400 font-bold uppercase mb-1">Navigation Address</p>
                 <div className="flex justify-between items-start gap-2">
                    <p className="text-lg font-bold text-slate-800 leading-snug break-keep">
                      {result.address_kr || "Address not found."}
                    </p>
                    {/* 기사님 보여주기 버튼 (확대) */}
                    <button
                      onClick={() => setIsDriverMode(true)}
                      className="text-blue-600 text-xs font-bold border border-blue-200 px-2 py-1 rounded hover:bg-blue-50 flex-shrink-0 flex items-center gap-1"
                    >
                      <FaExpandArrowsAlt /> Driver View
                    </button>
                 </div>
              </div>

              {/* AI 팁 */}
              <div className="flex gap-3 mb-6 bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                <FaStar className="text-yellow-400 text-lg flex-shrink-0 mt-0.5" />
                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                  {result.tip}
                </p>
              </div>

              {/* 지도 버튼 2개 */}
              <div className="grid grid-cols-2 gap-3 mb-2">
                <button onClick={() => openMap('naver')} className="bg-[#03C75A] hover:bg-[#02b351] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                  <span className="text-sm">NAVER Map</span> <FaExternalLinkAlt className="text-xs opacity-70"/>
                </button>
                <button onClick={() => openMap('google')} className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                  <span className="text-sm">Google Map</span> <FaExternalLinkAlt className="text-xs opacity-50"/>
                </button>
              </div>
            </div>

            {/* [State 3] 기사님 모드 (전체 화면 오버레이) */}
            {isDriverMode && (
               <div className="absolute inset-0 bg-white z-50 flex flex-col justify-center items-center p-6 text-center animate-in fade-in">
                  <button onClick={() => setIsDriverMode(false)} className="absolute top-4 right-4 text-slate-400 p-2 text-xl"><FaTimes/></button>
                  <p className="text-sm text-gray-500 font-bold uppercase tracking-widest mb-4">Destination Info</p>
                  <h1 className="text-5xl font-black text-slate-900 mb-6 leading-tight break-keep">{result.place_kr}</h1>
                  <div className="bg-slate-100 p-4 rounded-xl w-full">
                    <p className="text-2xl font-bold text-slate-800 break-keep">{result.address_kr}</p>
                  </div>
                  <p className="mt-8 text-lg font-medium text-blue-600">&quot;기사님, 여기로 가주세요.&quot;</p>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
