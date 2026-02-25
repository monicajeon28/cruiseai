// components/admin/IncludedExcludedEditor.tsx
// 포함/불포함 사항 편집기 (드래그앤드롭 순서 변경 지원)

'use client';

import { useState, useEffect, useRef } from 'react';
import { FiPlus, FiX, FiEdit2, FiChevronDown, FiSave, FiFolder, FiTrash2 } from 'react-icons/fi';
import suggestionsData from '@/data/included-excluded-suggestions.json';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ---------- 세트 타입 ----------

interface InclusionSet {
  id: string;
  name: string;
  includes: string[];
  excludes: string[];
  createdAt: string;
}

const STORAGE_KEY = 'inclusionSets';

function loadSets(): InclusionSet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.sets)) return [];
    return parsed.sets;
  } catch {
    return [];
  }
}

function saveSets(sets: InclusionSet[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ sets }));
}

// ---------- SortableItem ----------

interface IncludedExcludedEditorProps {
  included: string[];
  excluded: string[];
  onChange: (included: string[], excluded: string[]) => void;
}

interface SortableItemProps {
  id: string;
  item: string;
  color: 'green' | 'red';
  onEdit: () => void;
  onDelete: () => void;
  isEditing: boolean;
  onUpdateEdit: (value: string) => void;
  onCancelEdit: () => void;
}

function SortableItem({
  id,
  item,
  color,
  onEdit,
  onDelete,
  isEditing,
  onUpdateEdit,
  onCancelEdit,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const borderColor = color === 'green' ? 'border-green-300' : 'border-red-300';
  const handleColor =
    color === 'green'
      ? 'text-green-400 hover:text-green-600'
      : 'text-red-400 hover:text-red-600';
  const inputBorderColor =
    color === 'green'
      ? 'border-green-400 focus:ring-green-500 focus:border-green-500'
      : 'border-red-400 focus:ring-red-500 focus:border-red-500';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 p-4 bg-white border-2 ${borderColor} rounded-lg shadow-sm hover:shadow-md transition-shadow`}
    >
      {/* 드래그 핸들 */}
      <button
        {...attributes}
        {...listeners}
        className={`cursor-grab active:cursor-grabbing p-1 ${handleColor} flex-shrink-0 mt-0.5`}
        title="드래그하여 순서 변경"
        type="button"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="4" r="1.5" />
          <circle cx="11" cy="4" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="11" cy="12" r="1.5" />
        </svg>
      </button>

      {isEditing ? (
        <input
          type="text"
          defaultValue={item}
          onBlur={(e) => onUpdateEdit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onUpdateEdit(e.currentTarget.value);
            else if (e.key === 'Escape') onCancelEdit();
          }}
          autoFocus
          className={`flex-1 px-3 py-2 border-2 ${inputBorderColor} rounded-lg focus:ring-2`}
        />
      ) : (
        <>
          <span className="flex-1 text-base text-gray-800 font-medium">
            {item}
          </span>
          <button
            onClick={onEdit}
            className="p-2 text-green-600 hover:text-green-700 hover:bg-green-100 rounded-lg transition-colors"
            title="수정"
            type="button"
          >
            <FiEdit2 size={18} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors"
            title="삭제"
            type="button"
          >
            <FiX size={18} />
          </button>
        </>
      )}
    </div>
  );
}

// ---------- SetToolbar (세트 저장/불러오기 툴바) ----------

interface SetToolbarProps {
  included: string[];
  excluded: string[];
  onLoad: (set: InclusionSet) => void;
}

function SetToolbar({ included, excluded, onLoad }: SetToolbarProps) {
  const [sets, setSets] = useState<InclusionSet[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    setSets(loadSets());
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  function handleSave() {
    if (included.length === 0 && excluded.length === 0) {
      alert('저장할 포함/불포함 항목이 없습니다.');
      return;
    }
    const name = window.prompt('세트 이름을 입력하세요.\n예: 지중해 표준, 카리브해 기본', '');
    if (!name || !name.trim()) return;

    const newSet: InclusionSet = {
      id: `set_${Date.now()}`,
      name: name.trim(),
      includes: [...included],
      excludes: [...excluded],
      createdAt: new Date().toISOString(),
    };
    const updated = [...sets, newSet];
    saveSets(updated);
    setSets(updated);
    alert(`"${name.trim()}" 세트가 저장되었습니다.`);
  }

  function handleLoad(set: InclusionSet) {
    const confirmed = window.confirm(
      `"${set.name}" 세트를 불러오시겠습니까?\n현재 포함/불포함 항목이 모두 교체됩니다.`
    );
    if (!confirmed) return;
    onLoad(set);
    setShowDropdown(false);
  }

  function handleDelete(set: InclusionSet, e: React.MouseEvent) {
    e.stopPropagation();
    const confirmed = window.confirm(`"${set.name}" 세트를 삭제하시겠습니까?`);
    if (!confirmed) return;
    const updated = sets.filter((s) => s.id !== set.id);
    saveSets(updated);
    setSets(updated);
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }

  if (!isMounted) return null;

  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 mb-6 flex-wrap">
      <span className="text-sm font-semibold text-gray-600 mr-1">포함/불포함 세트:</span>

      {/* 현재 내용 세트로 저장 */}
      <button
        type="button"
        onClick={handleSave}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
      >
        <FiSave size={14} />
        현재 내용 저장
      </button>

      {/* 세트 불러오기 드롭다운 */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setShowDropdown((prev) => !prev)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
        >
          <FiFolder size={14} />
          세트 불러오기
          <FiChevronDown
            size={14}
            className={showDropdown ? 'rotate-180 transition-transform' : 'transition-transform'}
          />
        </button>

        {showDropdown && (
          <div className="absolute left-0 top-full mt-1 z-50 min-w-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {sets.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                저장된 세트가 없습니다.
              </div>
            ) : (
              <ul className="max-h-64 overflow-y-auto">
                {sets.map((set) => (
                  <li key={set.id} className="flex items-center group hover:bg-blue-50 transition-colors">
                    <button
                      type="button"
                      onClick={() => handleLoad(set)}
                      className="flex-1 flex flex-col min-w-0 px-4 py-2.5 text-left"
                    >
                      <span className="text-sm font-medium text-gray-800 truncate">{set.name}</span>
                      <span className="text-xs text-gray-400">
                        포함 {set.includes.length}개 · 불포함 {set.excludes.length}개 · {formatDate(set.createdAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(set, e)}
                      className="mr-2 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      title="세트 삭제"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {(included.length > 0 || excluded.length > 0) && (
        <span className="ml-auto text-xs text-gray-400">
          현재: 포함 {included.length}개 · 불포함 {excluded.length}개
        </span>
      )}
    </div>
  );
}

// ---------- 메인 컴포넌트 ----------

export default function IncludedExcludedEditor({
  included,
  excluded,
  onChange,
}: IncludedExcludedEditorProps) {
  const [editingIncludedIndex, setEditingIncludedIndex] = useState<number | null>(null);
  const [editingExcludedIndex, setEditingExcludedIndex] = useState<number | null>(null);
  const [newIncludedItem, setNewIncludedItem] = useState('');
  const [newExcludedItem, setNewExcludedItem] = useState('');
  const [showIncludedDropdown, setShowIncludedDropdown] = useState(false);
  const [showExcludedDropdown, setShowExcludedDropdown] = useState(false);
  const [includedSuggestions, setIncludedSuggestions] = useState<string[]>([]);
  const [excludedSuggestions, setExcludedSuggestions] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // 추천 항목 필터링
  useEffect(() => {
    if (newIncludedItem.trim()) {
      const filtered = suggestionsData.included
        .filter((item) => item.toLowerCase().includes(newIncludedItem.toLowerCase()))
        .slice(0, 30);
      setIncludedSuggestions(filtered);
      setShowIncludedDropdown(filtered.length > 0);
    } else {
      setIncludedSuggestions(suggestionsData.included.slice(0, 30));
      setShowIncludedDropdown(false);
    }
  }, [newIncludedItem]);

  useEffect(() => {
    if (newExcludedItem.trim()) {
      const filtered = suggestionsData.excluded
        .filter((item) => item.toLowerCase().includes(newExcludedItem.toLowerCase()))
        .slice(0, 30);
      setExcludedSuggestions(filtered);
      setShowExcludedDropdown(filtered.length > 0);
    } else {
      setExcludedSuggestions(suggestionsData.excluded.slice(0, 30));
      setShowExcludedDropdown(false);
    }
  }, [newExcludedItem]);

  const addIncludedItem = (item?: string) => {
    const itemToAdd = item || newIncludedItem.trim();
    if (itemToAdd) {
      onChange([...included, itemToAdd], excluded);
      setNewIncludedItem('');
      setShowIncludedDropdown(false);
    }
  };

  const addExcludedItem = (item?: string) => {
    const itemToAdd = item || newExcludedItem.trim();
    if (itemToAdd) {
      onChange(included, [...excluded, itemToAdd]);
      setNewExcludedItem('');
      setShowExcludedDropdown(false);
    }
  };

  const updateIncludedItem = (index: number, value: string) => {
    const newIncluded = [...included];
    newIncluded[index] = value;
    onChange(newIncluded, excluded);
    setEditingIncludedIndex(null);
  };

  const updateExcludedItem = (index: number, value: string) => {
    const newExcluded = [...excluded];
    newExcluded[index] = value;
    onChange(included, newExcluded);
    setEditingExcludedIndex(null);
  };

  const removeIncludedItem = (index: number) => {
    if (confirm('이 항목을 삭제하시겠습니까?')) {
      const newIncluded = included.filter((_, i) => i !== index);
      onChange(newIncluded, excluded);
    }
  };

  const removeExcludedItem = (index: number) => {
    if (confirm('이 항목을 삭제하시겠습니까?')) {
      const newExcluded = excluded.filter((_, i) => i !== index);
      onChange(included, newExcluded);
    }
  };

  // 세트 불러오기: 현재 포함/불포함 항목을 세트 내용으로 교체
  const handleLoadSet = (set: InclusionSet) => {
    onChange([...set.includes], [...set.excludes]);
  };

  // 중복 텍스트 대비 인덱스 포함 고유 ID
  const includedIds = included.map((item, index) => `${item}::${index}`);
  const excludedIds = excluded.map((item, index) => `${item}::${index}`);

  const handleIncludedDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = includedIds.indexOf(active.id as string);
      const newIdx = includedIds.indexOf(over.id as string);
      if (oldIdx !== -1 && newIdx !== -1) {
        onChange(arrayMove(included, oldIdx, newIdx), excluded);
      }
    }
  };

  const handleExcludedDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = excludedIds.indexOf(active.id as string);
      const newIdx = excludedIds.indexOf(over.id as string);
      if (oldIdx !== -1 && newIdx !== -1) {
        onChange(included, arrayMove(excluded, oldIdx, newIdx));
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* 세트 저장/불러오기 툴바 */}
      <SetToolbar
        included={included}
        excluded={excluded}
        onLoad={handleLoadSet}
      />

      {/* 포함 사항 */}
      <div className="space-y-4 bg-green-50 p-6 rounded-lg border-2 border-green-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-green-700 flex items-center gap-2">
            <span className="text-2xl">✅</span>
            포함 사항 설정
          </h3>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleIncludedDragEnd}
        >
          <SortableContext items={includedIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 mb-4">
              {included.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-white rounded-lg border-2 border-dashed border-green-300">
                  포함 사항이 없습니다. 아래에서 추가해주세요.
                </div>
              ) : (
                included.map((item, index) => (
                  <SortableItem
                    key={includedIds[index]}
                    id={includedIds[index]}
                    item={item}
                    color="green"
                    isEditing={editingIncludedIndex === index}
                    onEdit={() => setEditingIncludedIndex(index)}
                    onDelete={() => removeIncludedItem(index)}
                    onUpdateEdit={(value) => updateIncludedItem(index, value)}
                    onCancelEdit={() => setEditingIncludedIndex(null)}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </DndContext>

        <div className="relative flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newIncludedItem}
              onChange={(e) => setNewIncludedItem(e.target.value)}
              onFocus={() => setShowIncludedDropdown(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addIncludedItem();
                } else if (e.key === 'Escape') {
                  setShowIncludedDropdown(false);
                }
              }}
              placeholder="포함 사항을 입력하거나 추천 항목을 선택하세요..."
              className="w-full px-4 py-3 pr-10 border-2 border-green-400 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-base"
            />
            <button
              type="button"
              onClick={() => setShowIncludedDropdown(!showIncludedDropdown)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            >
              <FiChevronDown
                size={20}
                className={showIncludedDropdown ? 'rotate-180 transition-transform' : ''}
              />
            </button>
            {showIncludedDropdown && includedSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border-2 border-green-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                {includedSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => addIncludedItem(suggestion)}
                    className="w-full text-left px-4 py-2 hover:bg-green-50 focus:bg-green-50 focus:outline-none transition-colors text-base"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => addIncludedItem()}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-base flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <FiPlus size={20} />
            <span>추가</span>
          </button>
        </div>
      </div>

      {/* 불포함 사항 */}
      <div className="space-y-4 bg-red-50 p-6 rounded-lg border-2 border-red-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-red-700 flex items-center gap-2">
            <span className="text-2xl">❌</span>
            불포함 사항 설정
          </h3>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleExcludedDragEnd}
        >
          <SortableContext items={excludedIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 mb-4">
              {excluded.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-white rounded-lg border-2 border-dashed border-red-300">
                  불포함 사항이 없습니다. 아래에서 추가해주세요.
                </div>
              ) : (
                excluded.map((item, index) => (
                  <SortableItem
                    key={excludedIds[index]}
                    id={excludedIds[index]}
                    item={item}
                    color="red"
                    isEditing={editingExcludedIndex === index}
                    onEdit={() => setEditingExcludedIndex(index)}
                    onDelete={() => removeExcludedItem(index)}
                    onUpdateEdit={(value) => updateExcludedItem(index, value)}
                    onCancelEdit={() => setEditingExcludedIndex(null)}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </DndContext>

        <div className="relative flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newExcludedItem}
              onChange={(e) => setNewExcludedItem(e.target.value)}
              onFocus={() => setShowExcludedDropdown(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addExcludedItem();
                } else if (e.key === 'Escape') {
                  setShowExcludedDropdown(false);
                }
              }}
              placeholder="불포함 사항을 입력하거나 추천 항목을 선택하세요..."
              className="w-full px-4 py-3 pr-10 border-2 border-red-400 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-base"
            />
            <button
              type="button"
              onClick={() => setShowExcludedDropdown(!showExcludedDropdown)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            >
              <FiChevronDown
                size={20}
                className={showExcludedDropdown ? 'rotate-180 transition-transform' : ''}
              />
            </button>
            {showExcludedDropdown && excludedSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border-2 border-red-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                {excludedSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => addExcludedItem(suggestion)}
                    className="w-full text-left px-4 py-2 hover:bg-red-50 focus:bg-red-50 focus:outline-none transition-colors text-base"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => addExcludedItem()}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-base flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <FiPlus size={20} />
            <span>추가</span>
          </button>
        </div>
      </div>
    </div>
  );
}
