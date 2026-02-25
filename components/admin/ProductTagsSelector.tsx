// components/admin/ProductTagsSelector.tsx
// 상품 태그 선택 컴포넌트 (최대 3개)

'use client';

import { useState } from 'react';

export interface ProductTag {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

// 후킹 강력한 태그 목록
export const PRODUCT_TAGS: ProductTag[] = [
  { id: 'weekend', label: '주말크루즈', emoji: '🎉', color: 'bg-blue-500' },
  { id: 'discount100', label: '100만원할인', emoji: '💰', color: 'bg-red-500' },
  { id: 'discount50', label: '50만원할인', emoji: '💵', color: 'bg-orange-500' },
  { id: 'discount40', label: '40만원할인', emoji: '💴', color: 'bg-pink-500' },
  { id: 'discount30', label: '30만원할인', emoji: '💶', color: 'bg-purple-500' },
  { id: 'discount10', label: '10만원할인', emoji: '💷', color: 'bg-yellow-500' },
  { id: 'free', label: '자유크루즈', emoji: '🗽', color: 'bg-green-500' },
  { id: 'premium', label: '프리미엄패키지', emoji: '👑', color: 'bg-indigo-500' },
  { id: 'couple', label: '커플추천', emoji: '💑', color: 'bg-pink-500' },
  { id: 'family', label: '가족추천', emoji: '👨‍👩‍👧‍👦', color: 'bg-blue-500' },
  { id: 'senior', label: '시니어추천', emoji: '👴', color: 'bg-gray-500' },
  { id: 'friends', label: '우정크루즈', emoji: '👯', color: 'bg-purple-500' },
  { id: 'super', label: '초특가', emoji: '🔥', color: 'bg-red-600' },
  { id: 'ultra', label: '초초초특가', emoji: '⚡', color: 'bg-red-700' },
  { id: 'must', label: '이건가야대', emoji: '⭐', color: 'bg-yellow-500' },
  { id: 'exclusive', label: '크루즈닷단독', emoji: '🎯', color: 'bg-blue-600' },
  { id: 'genie', label: '크루즈닷패키지', emoji: '🤖', color: 'bg-indigo-600' },
];

interface ProductTagsSelectorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
}

export default function ProductTagsSelector({
  selectedTags,
  onChange,
  maxTags = 3,
}: ProductTagsSelectorProps) {
  const handleTagClick = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      // 이미 선택된 태그면 제거
      onChange(selectedTags.filter(id => id !== tagId));
    } else {
      // 최대 개수 확인
      if (selectedTags.length >= maxTags) {
        alert(`태그는 최대 ${maxTags}개까지 선택할 수 있습니다.`);
        return;
      }
      // 새 태그 추가
      onChange([...selectedTags, tagId]);
    }
  };

  const getTagById = (id: string) => PRODUCT_TAGS.find(tag => tag.id === id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          후킹 태그 선택 (최대 {maxTags}개)
        </label>
        <span className="text-xs text-gray-500">
          {selectedTags.length}/{maxTags} 선택됨
        </span>
      </div>

      {/* 선택된 태그 표시 */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
          <span className="text-xs font-semibold text-gray-600 mr-2">선택된 태그:</span>
          {selectedTags.map(tagId => {
            const tag = getTagById(tagId);
            if (!tag) return null;
            return (
              <button
                key={tagId}
                onClick={() => handleTagClick(tagId)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold text-white ${tag.color} hover:opacity-80 transition-opacity`}
              >
                <span>{tag.emoji}</span>
                <span>{tag.label}</span>
                <span className="ml-1">×</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 태그 선택 버튼들 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {PRODUCT_TAGS.map(tag => {
          const isSelected = selectedTags.includes(tag.id);
          const isDisabled = !isSelected && selectedTags.length >= maxTags;

          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleTagClick(tag.id)}
              disabled={isDisabled}
              className={`
                flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm
                transition-all transform hover:scale-105 active:scale-95
                ${isSelected
                  ? `${tag.color} text-white shadow-lg ring-2 ring-offset-2 ring-blue-500`
                  : isDisabled
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-blue-500 hover:bg-blue-50'
                }
              `}
            >
              <span className="text-xl">{tag.emoji}</span>
              <span>{tag.label}</span>
              {isSelected && (
                <span className="ml-1 text-white">✓</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-500">
        💡 태그는 상품 카드에 표시되어 고객의 관심을 끌 수 있습니다. 최대 {maxTags}개까지 선택 가능합니다.
      </p>
    </div>
  );
}

