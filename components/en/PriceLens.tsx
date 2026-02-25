// components/en/PriceLens.tsx
'use client';
import { useState, useRef } from 'react';
import { FaCamera, FaTimes, FaCheckCircle, FaExclamationTriangle, FaWonSign, FaDollarSign } from 'react-icons/fa';

export default function PriceLens({ onClose }: { onClose: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPreview(base64String);
      analyzeImage(base64String);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (base64: string) => {
    setLoading(true);
    try {
      const cleanBase64 = base64.split(',')[1];
      const res = await fetch('/api/en/genie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: "Analyze this price. Is it fair? Output JSON.",
          image: { inline_data: { mime_type: "image/jpeg", data: cleanBase64 } }
        }),
      });
      const data = await res.json();
      setAnalysis(data);
    } catch (e) {
      alert("Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-md z-10 animate-in fade-in zoom-in duration-300">
        <button onClick={onClose} className="absolute -top-12 right-0 text-white/50 hover:text-white text-3xl"><FaTimes /></button>

        {!preview ? (
          // [State 1] 스캐너 대기 화면
          <div className="bg-slate-900/80 border border-green-500/30 rounded-3xl p-8 shadow-[0_0_50px_rgba(34,197,94,0.1)] backdrop-blur-md text-center">
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/30 animate-pulse">
              <FaCamera className="text-3xl text-green-400" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-white mb-2">Price Guardian</h2>
            <p className="text-slate-400 text-sm mb-8">Scan menu or product to check fair price.</p>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-700 text-white font-bold py-4 rounded-xl text-lg hover:scale-[1.02] transition-transform shadow-lg shadow-green-900/50"
            >
              Activate Camera
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
          </div>
        ) : (
          // [State 2] 분석 결과 (디지털 영수증)
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl relative">
            {/* 상단: 이미지 프리뷰 */}
            <div className="relative h-48 bg-black">
              <img src={preview} alt="Scan" className="w-full h-full object-cover opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-4 left-4">
                <p className="text-xs text-green-400 font-mono tracking-widest uppercase">● AI Analysis Complete</p>
              </div>
            </div>

            {/* 하단: 분석 내용 */}
            <div className="p-6 bg-white -mt-4 rounded-t-3xl relative z-10">
              {loading ? (
                <div className="py-10 text-center">
                  <div className="animate-spin text-3xl text-green-600 mb-2">⟳</div>
                  <p className="text-gray-500 font-mono text-sm">Scanning database...</p>
                </div>
              ) : analysis ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900">{analysis.item_name || "Unknown Item"}</h3>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Product Name</p>
                    </div>
                    {/* 판정 뱃지 */}
                    {analysis.verdict?.toLowerCase().includes("trap") || analysis.verdict?.toLowerCase().includes("expensive") ? (
                      <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold border border-red-200 flex items-center gap-1">
                        <FaExclamationTriangle /> CAUTION
                      </span>
                    ) : (
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200 flex items-center gap-1">
                        <FaCheckCircle /> GOOD PRICE
                      </span>
                    )}
                  </div>

                  {/* 가격 정보 그리드 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-4 rounded-2xl">
                      <FaWonSign className="text-gray-400 text-xs mb-1" />
                      <p className="text-xl font-bold text-slate-800">{analysis.price_krw}</p>
                      <p className="text-[10px] text-gray-400">KRW</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                      <FaDollarSign className="text-green-600 text-xs mb-1" />
                      <p className="text-xl font-bold text-green-700">{analysis.price_usd}</p>
                      <p className="text-[10px] text-green-500">Approx. USD</p>
                    </div>
                  </div>

                  {/* AI 조언 */}
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <p className="text-sm text-blue-800 font-medium leading-relaxed">
                      &quot; {analysis.tips || "Always compare prices before buying."} &quot;
                    </p>
                  </div>

                  <button onClick={() => setPreview(null)} className="w-full mt-2 py-3 text-sm text-gray-400 hover:text-black transition-colors font-medium">
                    Scan Another Item
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
