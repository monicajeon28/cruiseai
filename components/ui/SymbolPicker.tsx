'use client';

import { useState, useRef, useEffect } from 'react';
import { FiSmile } from 'react-icons/fi';

// SMS 호환 심볼 목록 (모든 기기에서 안전하게 표시되는 기본 기호만 포함)
// 그림 있는 이모티콘은 "?"로 표시되므로 ASCII 기호와 기본 기하학적 기호만 사용
const SMS_SYMBOLS = {
  '기본': ['◆', '♥', '♠', '♣', '★', '☆', '*', '-', '_', '~', '=', '+', '|', '/', '\\', '(', ')', '[', ']', '{', '}', '<', '>', '.', ',', ':', ';', '!', '?', '@', '#', '$', '%', '&', '^'],
  '화살표': ['->', '<-', '^', 'v', '=>', '<=', '>=', '==', '!=', '>>', '<<', '^^', 'vv', '->', '<-', '^', 'v', '=>', '<=', '>=', '==', '!=', '>>', '<<', '^^', 'vv', '->', '<-', '^', 'v', '=>', '<=', '>=', '==', '!=', '>>', '<<', '^^', 'vv'],
  '체크/마크': ['[V]', '[X]', '[O]', '[ ]', '[OK]', '[NO]', '[YES]', '[NO]', '[+]', '[-]', '[=]', '[>]', '[<]', '[^]', '[v]', '[~]', '[!]', '[?]', '[*]', '[#]', '[$]', '[%]', '[&]', '[V]', '[X]', '[O]', '[ ]', '[OK]', '[NO]', '[YES]', '[NO]', '[+]', '[-]', '[=]', '[>]', '[<]', '[^]', '[v]', '[~]', '[!]', '[?]', '[*]', '[#]', '[$]', '[%]', '[&]'],
  '수학/기호': ['+', '-', '*', '/', '=', '<', '>', '<=', '>=', '!=', '==', '~', '^', '&', '|', '%', '#', '$', '@', '!', '?', '.', ',', ':', ';', '(', ')', '[', ']', '{', '}', '<', '>', '/', '\\', '|', '_', '-', '=', '~', '`', '@', '#', '$', '%', '^', '&', '*'],
};

interface SymbolPickerProps {
  onSymbolSelect: (symbol: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

export default function SymbolPicker({ onSymbolSelect, textareaRef }: SymbolPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof SMS_SYMBOLS>('기본');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleSymbolClick = (symbol: string) => {
    onSymbolSelect(symbol);
    // 클릭 후에도 피커를 열어두고 싶다면 아래 줄을 주석 처리
    // setIsOpen(false);
  };

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        title="심볼 선택"
      >
        <FiSmile size={20} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-96 max-h-[500px] overflow-hidden flex flex-col">
          {/* 카테고리 탭 */}
          <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto scrollbar-hide">
            {Object.keys(SMS_SYMBOLS).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category as keyof typeof SMS_SYMBOLS)}
                className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  selectedCategory === category
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* 심볼 그리드 */}
          <div className="overflow-y-auto p-3 flex-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <div className="grid grid-cols-10 gap-1.5">
              {SMS_SYMBOLS[selectedCategory].map((symbol, index) => (
                <button
                  key={`${selectedCategory}-${index}`}
                  type="button"
                  onClick={() => handleSymbolClick(symbol)}
                  className="text-xl hover:bg-gray-100 rounded p-1.5 transition-colors cursor-pointer flex items-center justify-center font-mono"
                  title={symbol}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>

          {/* 안내 문구 */}
          <div className="border-t border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500 text-center">
              💡 SMS 호환 심볼만 표시됩니다
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

