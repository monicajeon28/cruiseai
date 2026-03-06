'use client';

import { useEffect, useRef, useState } from 'react';
import { FiX, FiSearch } from 'react-icons/fi';

export type SuggestItem = {
  id: string;
  label: string;
  subtitle?: string;
};

interface SuggestSheetProps {
  title: string;           // "출발지 선택" | "도착지 선택"
  items: SuggestItem[];
  onPick: (item: SuggestItem) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function SuggestSheet({ title, items, onPick, onClose, loading }: SuggestSheetProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 마운트 시 검색창 포커스
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  // ESC 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // 검색어 필터
  const filtered = query.trim()
    ? items.filter(it =>
        it.label.toLowerCase().includes(query.toLowerCase()) ||
        (it.subtitle?.toLowerCase().includes(query.toLowerCase()) ?? false)
      )
    : items;

  return (
    <>
      {/* 딤 배경 */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* 바텀시트 */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '75vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-gray-300" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-1 pb-3 shrink-0">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <FiX size={22} className="text-gray-600" />
          </button>
        </div>

        {/* 검색 입력 */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 border-2 border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus-within:border-blue-400">
            <FiSearch size={18} className="text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="직접 입력하거나 아래에서 선택하세요"
              className="flex-1 text-lg bg-transparent outline-none text-gray-800 placeholder-gray-400"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
                <FiX size={16} />
              </button>
            )}
          </div>
          {/* 직접 입력으로 전송 */}
          {query.trim() && (
            <button
              onClick={() => { onPick({ id: `custom:${query}`, label: query.trim() }); }}
              className="w-full mt-2 py-3 rounded-xl bg-blue-600 text-white text-lg font-semibold active:opacity-80"
            >
              "{query.trim()}" 선택
            </button>
          )}
        </div>

        {/* 버튼 목록 */}
        <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-lg">검색 결과가 없습니다</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((it) => (
                <button
                  key={it.id}
                  onClick={() => onPick(it)}
                  className="
                    flex flex-col items-start justify-center
                    px-4 py-3 min-h-[64px]
                    rounded-xl border-2 border-gray-200
                    bg-white hover:bg-blue-50 hover:border-blue-400
                    active:scale-95 transition-all shadow-sm
                    text-left
                  "
                >
                  <span className="text-lg font-bold text-gray-900 leading-tight">{it.label}</span>
                  {it.subtitle && (
                    <span className="text-sm text-gray-500 mt-0.5 leading-tight">{it.subtitle}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
