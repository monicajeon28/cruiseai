// components/admin/RefundPolicyEditor.tsx
// 환불/취소 규정 에디터 (그룹 저장/불러오기)

'use client';

import { useState, useEffect } from 'react';
import { FiSave, FiFolder, FiX } from 'react-icons/fi';

interface RefundPolicyEditorProps {
  content: string;
  onChange: (content: string) => void;
}

// 기본 환불/취소 규정 템플릿
const DEFAULT_REFUND_POLICY = `121일 전 = 취소 수수료 없음

여행 출발일 기준 120일 ~ 91일 전까지 = 신청금

여행 출발일 기준 90일 ~ 71일 전까지 = 여행 총액의 25%

여행 출발일 기준 70일 ~ 46일 전까지 = 여행 총액의 50%

여행 출발일 기준 45일 ~ 21일 전까지 = 여행 총액의 75%

여행 출발일 기준 20일 ~ 출발일 = 여행 총액의 100%`;

export default function RefundPolicyEditor({
  content,
  onChange
}: RefundPolicyEditorProps) {
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [savedGroups, setSavedGroups] = useState<any[]>([]);
  const [newGroupName, setNewGroupName] = useState('');

  // content가 비어있으면 기본 템플릿 설정
  useEffect(() => {
    if (!content || content.trim() === '') {
      onChange(DEFAULT_REFUND_POLICY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 마운트 시 한 번만 실행

  // 그룹 목록 로드
  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const res = await fetch('/api/admin/refund-policy-groups', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setSavedGroups(data.groups || []);
        }
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const saveAsGroup = async () => {
    if (!newGroupName.trim()) {
      alert('그룹 이름을 입력하세요.');
      return;
    }

    if (!content.trim()) {
      alert('환불/취소 규정 내용을 입력하세요.');
      return;
    }

    try {
      const res = await fetch('/api/admin/refund-policy-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: `${content.substring(0, 50)}...`,
          content: content
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          alert('그룹이 저장되었습니다.');
          setNewGroupName('');
          setShowGroupManager(false);
          loadGroups();
        } else {
          alert(`저장 실패: ${data.error}`);
        }
      }
    } catch (error) {
      console.error('Failed to save group:', error);
      alert('그룹 저장에 실패했습니다.');
    }
  };

  const loadGroup = async (groupId: number) => {
    try {
      const res = await fetch(`/api/admin/refund-policy-groups/${groupId}`, {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.group) {
          onChange(data.group.content);
          alert('그룹이 불러와졌습니다.');
          setShowGroupManager(false);
        }
      }
    } catch (error) {
      console.error('Failed to load group:', error);
      alert('그룹 불러오기에 실패했습니다.');
    }
  };

  const deleteGroup = async (groupId: number) => {
    if (!confirm('이 그룹을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/refund-policy-groups/${groupId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          alert('그룹이 삭제되었습니다.');
          loadGroups();
        } else {
          alert(`삭제 실패: ${data.error}`);
        }
      }
    } catch (error) {
      console.error('Failed to delete group:', error);
      alert('그룹 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">환불/취소 규정</h3>
        <div className="flex gap-2">
          {content && content.trim() !== '' && (
            <button
              onClick={() => setShowGroupManager(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <FiSave size={18} />
              그룹 저장
            </button>
          )}
          <button
            onClick={() => setShowGroupManager(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <FiFolder size={18} />
            그룹 관리
          </button>
        </div>
      </div>

      {/* 그룹 관리 모달 */}
      {showGroupManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">환불/취소 규정 그룹 관리</h3>
                <button
                  onClick={() => setShowGroupManager(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* 저장된 그룹 목록 */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3">저장된 그룹 불러오기</h4>
                {savedGroups.length === 0 ? (
                  <p className="text-gray-500 text-sm">저장된 그룹이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {savedGroups.map((group) => (
                      <div
                        key={group.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">{group.name}</p>
                          {group.description && (
                            <p className="text-sm text-gray-500 mt-1">{group.description}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            저장일: {new Date(group.createdAt).toLocaleDateString('ko-KR')}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => loadGroup(group.id)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                          >
                            불러오기
                          </button>
                          <button
                            onClick={() => deleteGroup(group.id)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 새 그룹 저장 */}
              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-700 mb-3">현재 규정을 그룹으로 저장</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="그룹 이름 입력 (예: 기본 환불 규정)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveAsGroup();
                      }
                    }}
                  />
                  <button
                    onClick={saveAsGroup}
                    disabled={!content || content.trim() === ''}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiSave size={18} />
                    저장
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  현재 입력된 환불/취소 규정을 그룹으로 저장하여 나중에 재사용할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 에디터 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          환불/취소 규정 내용
        </label>
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
          placeholder="환불/취소 규정을 입력하세요...

예:
- 출발 30일 전: 전액 환불
- 출발 20일 전: 10% 위약금
- 출발 10일 전: 30% 위약금
- 출발 당일: 환불 불가

HTML 태그 사용 가능 (예: &lt;strong&gt;, &lt;ul&gt;, &lt;li&gt; 등)"
        />
        <p className="text-xs text-gray-500 mt-2">
          HTML 태그를 사용하여 서식을 지정할 수 있습니다. 저장된 그룹을 불러와서 재사용할 수 있습니다.
        </p>
      </div>

      {/* 미리보기 */}
      {content && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h4 className="font-semibold text-gray-700 mb-2">미리보기</h4>
          <div 
            className="prose prose-sm max-w-none text-gray-700"
            dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br />') }}
          />
        </div>
      )}
    </div>
  );
}




