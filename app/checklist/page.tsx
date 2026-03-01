'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { FiChevronLeft, FiTrash2, FiPlus, FiCheck, FiChevronDown, FiChevronUp, FiX, FiVolume2, FiPause, FiPlay } from 'react-icons/fi';
import { hapticClick, hapticSuccess, hapticImpact } from '@/lib/haptic';
import { useKeyboardHandler, useViewportHeight } from '@/lib/keyboard-handler';
import { trackFeature } from '@/lib/analytics';
import { checkTestModeClient, getCorrectPath } from '@/lib/test-mode-client';

// 체크리스트 아이템 타입 정의 (API 응답 형식에 맞춤)
type ChecklistItem = {
  id: number | string; // 서버는 number, 클라이언트는 string일 수 있음
  text: string;
  completed: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export default function ChecklistPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  const [textScale, setTextScale] = useState<1 | 2 | 3>(3); // 1(보통) 2(큼) 3(아주 큼) - 기본값 3으로 변경
  const [isProhibitedItemsExpanded, setIsProhibitedItemsExpanded] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [speakingCategory, setSpeakingCategory] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const hasCreatedDefaultsRef = useRef(false); // 기본 항목 생성 플래그

  // 경로 보호: 테스트 모드 사용자는 /checklist-test로 리다이렉트
  useEffect(() => {
    const checkPath = async () => {
      const testModeInfo = await checkTestModeClient();
      const correctPath = getCorrectPath(pathname || '/checklist', testModeInfo);

      if (correctPath !== pathname) {
        router.replace(correctPath);
      }
    };

    checkPath();
  }, [pathname, router]);

  const startSpeaking = (text: string, category: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('이 브라우저는 음성 읽기 기능을 지원하지 않습니다.');
      return;
    }

    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      // 무시
    }

    setSpeakingCategory(category);
    setIsPaused(false);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.9; // 읽기 속도 (조금 느리게)
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => {
      utteranceRef.current = null;
      setSpeakingCategory(null);
      setIsPaused(false);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      utteranceRef.current = null;
      setSpeakingCategory(null);
      setIsPaused(false);
      // pause/resume 관련 오류는 사용자에게 알리지 않음
      if (event.error !== 'interrupted' && event.error !== 'canceled') {
        alert('음성 읽기 중 오류가 발생했습니다.');
      }
    };

    try {
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Speak error:', error);
      utteranceRef.current = null;
      setSpeakingCategory(null);
      setIsPaused(false);
      alert('음성 읽기를 시작할 수 없습니다.');
    }
  };

  const handleSpeechToggle = (category: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('이 브라우저는 음성 읽기 기능을 지원하지 않습니다.');
      return;
    }

    const synth = window.speechSynthesis;

    // 동일 카테고리에서 토글
    if (speakingCategory === category) {
      try {
        if (isPaused) {
          synth.resume();
          setIsPaused(false);
        } else if (synth.speaking || synth.pending) {
          synth.pause();
          setIsPaused(true);
        } else {
          // 이미 끝난 상태라면 다시 시작
          startSpeaking(text, category);
        }
      } catch (error) {
        console.error('Pause/Resume error:', error);
        try {
          synth.cancel();
        } catch (e) {
          /* noop */
        }
        setSpeakingCategory(null);
        setIsPaused(false);
      }
      return;
    }

    startSpeaking(text, category);
  };

  // iOS 키보드 및 viewport 처리
  useKeyboardHandler();
  useViewportHeight();

  // 기능 사용 추적
  useEffect(() => {
    trackFeature('checklist');
  }, []);

  // 기본 체크리스트 항목들 (핵심 15개 - 추가/삭제 기능으로 커스텀 가능)
  const getDefaultItems = (): ChecklistItem[] => [
    { id: Date.now() + 1, text: '여권 (유효기간 6개월 이상)', completed: false },
    { id: Date.now() + 2, text: 'E-티켓 또는 승선권', completed: false },
    { id: Date.now() + 3, text: '신용카드 (해외 사용 가능)', completed: false },
    { id: Date.now() + 4, text: '현금 (달러 또는 현지 화폐)', completed: false },
    { id: Date.now() + 5, text: '여행자 보험 증서', completed: false },
    { id: Date.now() + 6, text: '선상 정장 (캡틴 디너용)', completed: false },
    { id: Date.now() + 7, text: '편한 신발 (관광용)', completed: false },
    { id: Date.now() + 8, text: '수영복', completed: false },
    { id: Date.now() + 9, text: '휴대폰 충전기', completed: false },
    { id: Date.now() + 10, text: '보조배터리', completed: false },
    { id: Date.now() + 11, text: '멀티 어댑터', completed: false },
    { id: Date.now() + 12, text: '상비약 (소화제, 진통제)', completed: false },
    { id: Date.now() + 13, text: '멀미약', completed: false },
    { id: Date.now() + 14, text: '세면도구 (칫솔, 치약)', completed: false },
    { id: Date.now() + 15, text: '선글라스', completed: false },
  ];

  // 기본 항목을 서버에 저장하는 함수 (한 번만 실행되도록 보호)
  const createDefaultItemsOnServer = async (defaultItems: ChecklistItem[]) => {
    // 이미 실행 중이면 중복 실행 방지
    if (hasCreatedDefaultsRef.current && items.length > 0) {
      return;
    }

    const results = await Promise.allSettled(
      defaultItems.map(async (item) => {
        const res = await fetch('/api/checklist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ text: item.text }),
        });

        if (!res.ok) {
          throw new Error(`Failed to create item: ${res.status}`);
        }

        const serverItem = await res.json();
        const finalItem = serverItem.item || serverItem;

        // 서버에서 받은 ID로 업데이트
        setItems(prev =>
          prev.map(localItem => (localItem.id === item.id ? finalItem : localItem))
        );

        return finalItem;
      })
    );

    const failedCount = results.filter(r => r.status === 'rejected').length;
    if (failedCount > 0) {
      console.error(`[Checklist] ${failedCount}개 기본 항목 서버 저장 실패`);
    }
  };

  // localStorage 동기화 함수 제거 - 이제 API만 사용

  // API: 체크리스트 목록 불러오기 (API 전용)
  const loadItems = async (skipError = false) => {
    setIsLoading(true);
    if (!skipError) {
      setError(null);
    }

    try {
      const res = await fetch('/api/checklist', {
        credentials: 'include',
      });

      if (!res.ok) {
        // 401이나 429 오류는 재시도하지 않음
        if (res.status === 401) {
          throw new Error('인증이 필요합니다. 로그인 후 다시 시도해주세요.');
        }
        if (res.status === 429) {
          throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
        }
        throw new Error('체크리스트를 불러올 수 없습니다.');
      }

      const data = await res.json();
      const items = data.items || data;

      if (Array.isArray(items)) {
        // 서버에서 받은 항목을 클라이언트 형식으로 변환 (id: number 유지)
        const formattedItems = items.map((item: any) => ({
          id: typeof item.id === 'number' ? item.id : parseInt(item.id) || item.id,
          text: item.text || '',
          completed: item.completed || false,
        }));

        // 항목이 없으면 기본 항목 생성 (한 번만)
        if (formattedItems.length === 0 && !skipError && !hasCreatedDefaultsRef.current) {
          hasCreatedDefaultsRef.current = true;
          const defaultItems = getDefaultItems();
          setItems(defaultItems);
          // 백그라운드에서 서버에 저장 (한 번만 실행되도록 플래그 사용)
          createDefaultItemsOnServer(defaultItems).catch(console.error);
        } else {
          setItems(formattedItems);
        }
      } else {
        throw new Error('잘못된 데이터 형식입니다.');
      }
    } catch (err: any) {
      // 에러는 항상 로깅
      console.error('[Checklist] Error loading from API:', err);

      const errorMessage = err?.message || '';

      // 429 에러(요청 과다)만 에러 메시지 표시
      if (!skipError && errorMessage.includes('너무 많')) {
        setError(`요청이 너무 많습니다. 잠시 후 다시 시도해주세요.`);
      }

      // 429 오류가 아니면 기본 항목 표시 (인증 오류 시에도 기본 항목 표시)
      if (!errorMessage.includes('너무 많') && !hasCreatedDefaultsRef.current) {
        hasCreatedDefaultsRef.current = true;
        const defaultItems = getDefaultItems();
        setItems(defaultItems);
        // 백그라운드에서 서버에 저장 시도 (실패해도 UI에는 표시됨)
        createDefaultItemsOnServer(defaultItems).catch(console.error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 마운트 시 불러오기
  useEffect(() => {
    loadItems();
    // iOS 키보드 가림 방지용 safest area 여백
    document.body.classList.add('pb-24', 'sm:pb-0');
    return () => {
      document.body.classList.remove('pb-24', 'sm:pb-0');
      // 컴포넌트 언마운트 시 음성 읽기 중지
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch (e) {
          /* noop */
        }
      }
      utteranceRef.current = null;
      setSpeakingCategory(null);
      setIsPaused(false);
    };
  }, []);

  // 아이템 추가 (API 전용)
  const handleAdd = async (value?: string) => {
    const text = (value !== undefined ? value : newText).trim();
    if (!text) return;

    if (value === undefined) setNewText('');

    setIsLoading(true);
    setError(null);
    hapticClick();

    try {
      const res = await fetch('/api/checklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const errorData = res.status === 401 || res.status === 429
          ? { error: res.status === 401 ? '인증이 필요합니다' : '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }
          : await res.json().catch(() => ({ error: '항목 추가 실패' }));

        throw new Error(errorData.error || '항목 추가 실패');
      }

      const serverItem = await res.json();
      const finalItem = serverItem.item || serverItem;

      // 서버에서 받은 항목을 상태에 추가
      setItems(prev => [...prev, finalItem]);
    } catch (err: any) {
      // 에러는 항상 로깅
      console.error('[Checklist] Error adding item:', err);
      setError(`항목 추가 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 완료 토글 (API 전용)
  const handleToggle = async (id: number | string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const newCompleted = !item.completed;
    const oldCompleted = item.completed;

    // 즉시 UI 업데이트 (낙관적 업데이트)
    setItems(prev => prev.map(i =>
      i.id === id ? { ...i, completed: newCompleted } : i
    ));

    if (!item.completed) {
      hapticSuccess();
    } else {
      hapticClick();
    }

    setIsLoading(true);
    setError(null);

    try {
      // PATCH 메서드 사용 (체크리스트 API는 PATCH 사용)
      // id를 숫자로 변환 (서버는 number를 기대)
      const numericId = typeof id === 'string' ? parseInt(id) : id;
      const res = await fetch('/api/checklist', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ id: numericId, completed: newCompleted }),
      });

      if (!res.ok) {
        // 상태 롤백
        setItems(prev => prev.map(i =>
          i.id === id ? { ...i, completed: oldCompleted } : i
        ));

        const errorData = res.status === 401 || res.status === 429
          ? { error: res.status === 401 ? '인증이 필요합니다' : '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }
          : await res.json().catch(() => ({ error: '상태 변경 실패' }));

        throw new Error(errorData.error || '상태 변경 실패');
      }

      const result = await res.json();
      const updatedItem = result.item || result;

      // 서버에서 받은 업데이트된 항목으로 상태 업데이트
      setItems(prev => prev.map(i =>
        i.id === id ? updatedItem : i
      ));
    } catch (err: any) {
      // 에러는 항상 로깅
      console.error('[Checklist] Error toggling item:', err);
      setError('작업에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 항목 수정 (API 전용)
  const handleUpdate = async (id: number | string, newText: string) => {
    const trimmedText = newText.trim();
    if (!trimmedText) {
      setEditingItemId(null);
      return;
    }

    const item = items.find(i => i.id === id);
    const oldText = item?.text || '';

    // 즉시 UI 업데이트 (낙관적 업데이트)
    setItems(prev => prev.map(i =>
      i.id === id ? { ...i, text: trimmedText } : i
    ));

    setEditingItemId(null);
    setIsLoading(true);
    setError(null);

    try {
      // 체크리스트 API는 PATCH 메서드 사용
      // id를 숫자로 변환 (서버는 number를 기대)
      const numericId = typeof id === 'string' ? parseInt(id) : id;
      const res = await fetch('/api/checklist', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ id: numericId, text: trimmedText }),
      });

      if (!res.ok) {
        // 상태 롤백
        setItems(prev => prev.map(i =>
          i.id === id ? { ...i, text: oldText } : i
        ));

        const errorData = res.status === 401 || res.status === 429
          ? { error: res.status === 401 ? '인증이 필요합니다' : '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }
          : await res.json().catch(() => ({ error: '수정 실패' }));

        throw new Error(errorData.error || '수정 실패');
      }

      const result = await res.json();
      const updatedItem = result.item || result;

      // 서버에서 받은 업데이트된 항목으로 상태 업데이트
      setItems(prev => prev.map(i =>
        i.id === id ? updatedItem : i
      ));
    } catch (err: any) {
      // 에러는 항상 로깅
      console.error('[Checklist] Error updating item:', err);
      setError('작업에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 편집 시작
  const handleStartEdit = (item: ChecklistItem) => {
    setEditingItemId(item.id);
    setEditingText(item.text);
  };

  // 편집 취소
  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditingText('');
  };

  // 체크리스트 초기화 (리셋) - API 전용
  const handleReset = async () => {
    if (!window.confirm('체크리스트를 초기 상태로 리셋하시겠습니까?\n모든 항목과 체크 상태가 삭제되고 기본 항목으로 다시 시작됩니다.')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // API에서 모든 항목 삭제
      const currentItems = items;
      for (const item of currentItems) {
        try {
          const res = await fetch('/api/checklist', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ id: item.id }),
          });

          if (!res.ok) {
            // 개별 삭제 실패는 경고만 (전체 실패는 아님)
            // 개발 환경에서만 로깅
            if (process.env.NODE_ENV === 'development') {
              console.warn(`[Checklist] Failed to delete item ${item.id}`);
            }
          }
        } catch (e) {
          // 개별 삭제 실패는 무시 (개발 환경에서만 로깅)
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[Checklist] Error deleting item ${item.id}:`, e);
          }
        }
      }

      // 기본 항목 생성
      const defaultItems = getDefaultItems();

      // 상태 업데이트
      setItems(defaultItems);

      // 서버에 기본 항목 저장
      await createDefaultItemsOnServer(defaultItems);

    } catch (err: any) {
      // 에러는 항상 로깅
      console.error('[Checklist] Reset error:', err);
      setError(`리셋 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`);
      // 에러 발생 시 다시 로드
      await loadItems();
    } finally {
      setIsLoading(false);
    }
  };

  // 삭제 (API 전용)
  const handleDelete = async (id: number | string) => {
    hapticImpact();

    const item = items.find(i => i.id === id);
    if (!item) return;

    // 즉시 UI에서 제거 (낙관적 업데이트)
    setItems(prev => prev.filter(i => i.id !== id));

    setIsLoading(true);
    setError(null);

    try {
      // id를 숫자로 변환 (서버는 number를 기대)
      const numericId = typeof id === 'string' ? parseInt(id) : id;
      const res = await fetch('/api/checklist', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ id: numericId }),
      });

      if (!res.ok) {
        // 상태 롤백 (항목 다시 추가)
        setItems(prev => [...prev, item]);

        const errorData = res.status === 401 || res.status === 429
          ? { error: res.status === 401 ? '인증이 필요합니다' : '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }
          : await res.json().catch(() => ({ error: '삭제 실패' }));

        throw new Error(errorData.error || '삭제 실패');
      }

      // 서버에서 삭제 성공 (이미 UI에서 제거됨)
    } catch (err: any) {
      // 에러는 항상 로깅
      console.error('[Checklist] Error deleting item:', err);
      setError('작업에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const completed = useMemo(() => items.filter(i => i.completed).length, [items]);
  const total = items.length;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

  // 미완료 → 완료 순서로 정렬
  const sorted = useMemo(
    () => [...items].sort((a, b) => Number(a.completed) - Number(b.completed)),
    [items]
  );

  const fontCls =
    textScale === 3 ? 'text-2xl' : textScale === 2 ? 'text-xl' : 'text-lg'; // 글씨 크기 증가 (30대 이상 가독성 향상)

  const quickChips = [
    '여권·신분증', 'E-티켓', '신용카드', '상비약',
    '선상 정장', '편한 신발', '수영복', '충전기·어댑터',
  ];

  // 금지 물품 정보
  const prohibitedItems = {
    flight: {
      title: '비행기 승선 시 금지 물품',
      items: [
        '액체류 (100ml 초과, 총 1L 초과)',
        '날카로운 물건 (가위, 면도기, 칼 등)',
        '전자 담배 (기내 휴대 금지)',
        '무기류 (총, 칼, 폭발물 등)',
        '가연성 물질 (라이터(개인용 1개만 가능), 성냥 등)',
        '압축 가스 (스프레이, 발포제 등)',
        '유독 물질 및 화학 약품',
      ],
      specialItems: [
        {
          title: '🔋 보조배터리 (Power Bank) - 반입 가능하지만 규정 준수 필수!',
          details: [
            '✅ 휴대 가능: 100Wh 이하 (약 27,000mAh 이하)',
            '✅ 기내 휴대: 반드시 기내 휴대만 가능 (수하물 금지)',
            '✅ 개수 제한: 보통 2개까지 (항공사마다 다름)',
            '✅ 용량 표시: 용량(mAh) 또는 전력량(Wh)이 명확히 표시된 것만',
            '⚠️ 주의: 손상된 배터리, 용량 표시 불명확한 배터리는 반입 금지',
            '⚠️ 주의: 100Wh 초과 배터리는 항공사 사전 승인 필요 (최대 160Wh)',
            '💡 팁: 출발 전 항공사 홈페이지에서 최신 규정 확인 필수',
          ],
        },
      ],
    },
    cruise: {
      title: '크루즈 승선 시 금지 물품',
      items: [
        '무기류 (총, 칼, 나이프 등)',
        '전자 담배 (선내 흡연 금지 구역)',
        '알코올 음료 (선내에서 구매 가능)',
        '가연성 물질 (라이터, 성냥 대량 등)',
        '유해 화학 약품',
        '동물 (서비스 동물 제외)',
        '전기 라면 냄비 (선내 전기 규정 위반)',
      ],
      specialItems: [
        {
          title: '🔋 보조배터리 (Power Bank) - 크루즈에서는 비교적 자유롭게 반입 가능',
          details: [
            '✅ 반입 가능: 용량 제한 없이 일반적으로 반입 가능',
            '✅ 수하물 허용: 기내 휴대뿐만 아니라 수하물에도 가능 (비행기와 다름)',
            '✅ 사용 가능: 선내에서 충전 및 사용 가능',
            '⚠️ 주의: 손상된 배터리나 발열이 심한 배터리는 반입 금지',
            '⚠️ 주의: 멀티탭 3구 이하 추천 (여행용)',
            '⚠️ 주의: 일부 크루즈 선사는 특정 용량 이상 제한할 수 있음',
            '💡 팁: 크루즈 여행은 기간이 길어 보조배터리 필수! 충전기와 함께 준비',
            '💡 팁: 해외 여행 시 현지 전압 확인 (110V/220V) 및 어댑터 필요',
          ],
        },
      ],
    },
    countries: {
      title: '나라별 주의 물품',
      items: [
        '🇸🇬 싱가포르: 껌 반입 금지, 무단 흡연 벌금',
        '🇦🇺 호주/뉴질랜드: 식품, 농산물 엄격한 검역',
        '🇯🇵 일본: 일부 과일, 육류 반입 금지',
        '🇨🇳 중국: 불법 서적, 종교 서적 제한',
        '🇸🇦 사우디: 알코올, 돼지고기 전면 금지',
        '🇦🇪 UAE: 알코올 제한, 노출 의상 주의',
        '🇹🇭 태국: 마약 엄격 금지, 최고 사형',
        '🇮🇩 인도네시아: 마약 최고 사형, 알코올 제한 지역 있음',
      ],
    },
  };

  return (
    <main className="min-h-screen bg-[#F5F7FA]">
      {/* 상단 고정 헤더 */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b">
        <div className="mx-auto max-w-3xl px-4 py-4 md:py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/tools"
              className="inline-flex items-center gap-1 rounded-xl border px-4 md:px-5 py-2 md:py-2.5 hover:bg-gray-50 text-base md:text-lg font-semibold"
              aria-label="뒤로가기"
            >
              <FiChevronLeft className="text-xl md:text-2xl" />
              <span className="font-semibold">뒤로가기</span>
            </Link>
            <h1 className="ml-2 text-xl md:text-2xl lg:text-3xl font-extrabold leading-tight">
              꼼꼼한 크루즈닷의 여행 준비물 체크리스트
            </h1>
          </div>
          <Link
            href="/chat"
            className="hidden sm:inline-flex items-center rounded-xl border px-4 md:px-5 py-2 md:py-2.5 hover:bg-gray-50 text-base md:text-lg font-semibold"
          >
            크루즈닷과 대화하기
          </Link>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mx-auto max-w-3xl px-4 pb-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              ⚠️ {error}
            </div>
          </div>
        )}

        {/* 진행률 */}
        <div className="mx-auto max-w-3xl px-4 pb-4 md:pb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xl md:text-2xl text-gray-600 font-semibold leading-relaxed">
              진행률 <span className="text-gray-900">{completed}</span> / {total}
            </span>
            <span className="text-3xl md:text-4xl font-extrabold text-blue-600">{progress}%</span>
          </div>
          <div className="h-4 md:h-5 w-full rounded-full bg-gray-200 overflow-hidden shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#FDB931] to-[#E1A21E] transition-all shadow-md"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="mx-auto max-w-3xl px-4 py-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600">체크리스트를 불러오는 중...</p>
        </div>
      )}

      {/* 컨텐츠 */}
      {!isLoading && (
        <div className="mx-auto max-w-3xl px-4 py-4 sm:py-6">
          {/* 글자 크기 조절 및 리셋 */}
          <div className="mb-4 md:mb-5 flex items-center gap-3 flex-wrap">
            <span className="text-lg md:text-xl text-gray-700 font-semibold">글자 크기</span>
            <div className="flex overflow-hidden rounded-xl border-2">
              <button
                className={`px-4 md:px-5 py-2 md:py-2.5 text-base md:text-lg font-semibold ${textScale === 1 ? 'bg-[#051C2C] text-white' : 'bg-white text-gray-800'}`}
                onClick={() => setTextScale(1)}
              >
                작게
              </button>
              <button
                className={`px-4 md:px-5 py-2 md:py-2.5 text-base md:text-lg font-semibold ${textScale === 2 ? 'bg-[#051C2C] text-white' : 'bg-white text-gray-800'}`}
                onClick={() => setTextScale(2)}
              >
                보통
              </button>
              <button
                className={`px-4 md:px-5 py-2 md:py-2.5 text-base md:text-lg font-semibold ${textScale === 3 ? 'bg-[#051C2C] text-white' : 'bg-white text-gray-800'}`}
                onClick={() => setTextScale(3)}
              >
                크게
              </button>
            </div>
            <button
              onClick={handleReset}
              disabled={isLoading}
              className="ml-auto px-4 md:px-5 py-2 md:py-2.5 text-base md:text-lg font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              aria-label="체크리스트 초기화"
            >
              🔄 리셋
            </button>
          </div>

          {/* 안내 메시지 */}
          <div className="mb-6 md:mb-8 bg-[#FDB931]/10 border-2 border-[#FDB931]/30 rounded-xl p-5 md:p-6 shadow-md">
            <p className="text-xl md:text-2xl text-blue-900 font-semibold leading-relaxed">
              ✓ 준비한 항목을 체크하세요
            </p>
            <p className="text-lg md:text-xl text-blue-700 mt-2 leading-relaxed">
              체크한 내용은 자동으로 저장됩니다
            </p>
          </div>

          {/* 금지 물품 정보 (접기/펼치기) */}
          <div className="mb-6 bg-yellow-50 border-2 border-yellow-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setIsProhibitedItemsExpanded(!isProhibitedItemsExpanded)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-yellow-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚠️</span>
                <span className="text-xl font-bold text-yellow-900">
                  가져가면 안 되는 물건 확인하기
                </span>
              </div>
              {isProhibitedItemsExpanded ? (
                <FiChevronUp className="text-2xl text-yellow-700" />
              ) : (
                <FiChevronDown className="text-2xl text-yellow-700" />
              )}
            </button>

            {isProhibitedItemsExpanded && (
              <div className="px-4 pb-4 space-y-4">
                {/* 비행기 금지 물품 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      <span>✈️</span>
                      {prohibitedItems.flight.title}
                    </h3>
                    <button
                      onClick={() => {
                        const flightText = `${prohibitedItems.flight.title}. ${prohibitedItems.flight.items.join(', ')}. ${prohibitedItems.flight.specialItems?.[0]?.title || ''}. ${prohibitedItems.flight.specialItems?.[0]?.details.join('. ') || ''}`;
                        handleSpeechToggle('flight', flightText);
                      }}
                      className={`flex items-center justify-center w-16 h-16 rounded-full transition-all shadow-lg border-4 ${speakingCategory === 'flight'
                        ? (isPaused ? 'bg-yellow-500 border-yellow-600 text-white' : 'bg-red-600 border-red-700 text-white animate-pulse')
                        : 'bg-yellow-400 border-yellow-500 hover:bg-yellow-500 text-white shadow-xl'
                        }`}
                      aria-label={speakingCategory === 'flight' ? (isPaused ? '음성 재개' : '음성 일시정지') : '음성으로 듣기'}
                      title={speakingCategory === 'flight' ? (isPaused ? '재개' : '일시정지') : '음성으로 듣기'}
                    >
                      {speakingCategory === 'flight'
                        ? (isPaused ? <FiPlay className="text-3xl font-bold" /> : <FiPause className="text-3xl font-bold" />)
                        : <FiVolume2 className="text-3xl font-bold" />}
                    </button>
                  </div>
                  <ul className="space-y-2 ml-6">
                    {prohibitedItems.flight.items.map((item, idx) => (
                      <li key={idx} className="text-lg text-gray-700 list-disc">
                        {item}
                      </li>
                    ))}
                  </ul>

                  {/* 보조배터리 상세 정보 */}
                  {prohibitedItems.flight.specialItems && prohibitedItems.flight.specialItems.map((special, idx) => (
                    <div key={idx} className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-lg font-bold text-blue-900">
                          {special.title}
                        </h4>
                        <button
                          onClick={() => {
                            const batteryText = `${special.title}. ${special.details.join('. ')}`;
                            handleSpeechToggle('flight-battery', batteryText);
                          }}
                          className={`flex items-center justify-center w-16 h-16 rounded-full transition-all shadow-lg border-4 ${speakingCategory === 'flight-battery'
                            ? (isPaused ? 'bg-yellow-500 border-yellow-600 text-white' : 'bg-blue-600 border-blue-700 text-white animate-pulse')
                            : 'bg-blue-500 border-blue-600 hover:bg-blue-600 text-white shadow-xl'
                            }`}
                          aria-label={speakingCategory === 'flight-battery' ? (isPaused ? '음성 재개' : '음성 일시정지') : '음성으로 듣기'}
                          title={speakingCategory === 'flight-battery' ? (isPaused ? '재개' : '일시정지') : '음성으로 듣기'}
                        >
                          {speakingCategory === 'flight-battery'
                            ? (isPaused ? <FiPlay className="text-3xl font-bold" /> : <FiPause className="text-3xl font-bold" />)
                            : <FiVolume2 className="text-3xl font-bold" />}
                        </button>
                      </div>
                      <ul className="space-y-2 ml-4">
                        {special.details.map((detail, detailIdx) => (
                          <li key={detailIdx} className="text-base text-blue-800">
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* 크루즈 금지 물품 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      <span>🚢</span>
                      {prohibitedItems.cruise.title}
                    </h3>
                    <button
                      onClick={() => {
                        const cruiseText = `${prohibitedItems.cruise.title}. ${prohibitedItems.cruise.items.join(', ')}. ${prohibitedItems.cruise.specialItems?.[0]?.title || ''}. ${prohibitedItems.cruise.specialItems?.[0]?.details.join('. ') || ''}`;
                        handleSpeechToggle('cruise', cruiseText);
                      }}
                      className={`flex items-center justify-center w-16 h-16 rounded-full transition-all shadow-lg border-4 ${speakingCategory === 'cruise'
                        ? (isPaused ? 'bg-yellow-500 border-yellow-600 text-white' : 'bg-red-600 border-red-700 text-white animate-pulse')
                        : 'bg-yellow-400 border-yellow-500 hover:bg-yellow-500 text-white shadow-xl'
                        }`}
                      aria-label={speakingCategory === 'cruise' ? (isPaused ? '음성 재개' : '음성 일시정지') : '음성으로 듣기'}
                      title={speakingCategory === 'cruise' ? (isPaused ? '재개' : '일시정지') : '음성으로 듣기'}
                    >
                      {speakingCategory === 'cruise'
                        ? (isPaused ? <FiPlay className="text-3xl font-bold" /> : <FiPause className="text-3xl font-bold" />)
                        : <FiVolume2 className="text-3xl font-bold" />}
                    </button>
                  </div>
                  <ul className="space-y-2 ml-6">
                    {prohibitedItems.cruise.items.map((item, idx) => (
                      <li key={idx} className="text-lg text-gray-700 list-disc">
                        {item}
                      </li>
                    ))}
                  </ul>

                  {/* 보조배터리 상세 정보 */}
                  {prohibitedItems.cruise.specialItems && prohibitedItems.cruise.specialItems.map((special, idx) => (
                    <div key={idx} className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-lg font-bold text-blue-900">
                          {special.title}
                        </h4>
                        <button
                          onClick={() => {
                            const batteryText = `${special.title}. ${special.details.join('. ')}`;
                            handleSpeechToggle('cruise-battery', batteryText);
                          }}
                          className={`flex items-center justify-center w-16 h-16 rounded-full transition-all shadow-lg border-4 ${speakingCategory === 'cruise-battery'
                            ? (isPaused ? 'bg-yellow-500 border-yellow-600 text-white' : 'bg-blue-600 border-blue-700 text-white animate-pulse')
                            : 'bg-blue-500 border-blue-600 hover:bg-blue-600 text-white shadow-xl'
                            }`}
                          aria-label={speakingCategory === 'cruise-battery' ? (isPaused ? '음성 재개' : '음성 일시정지') : '음성으로 듣기'}
                          title={speakingCategory === 'cruise-battery' ? (isPaused ? '재개' : '일시정지') : '음성으로 듣기'}
                        >
                          {speakingCategory === 'cruise-battery'
                            ? (isPaused ? <FiPlay className="text-3xl font-bold" /> : <FiPause className="text-3xl font-bold" />)
                            : <FiVolume2 className="text-3xl font-bold" />}
                        </button>
                      </div>
                      <ul className="space-y-2 ml-4">
                        {special.details.map((detail, detailIdx) => (
                          <li key={detailIdx} className="text-base text-blue-800">
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* 나라별 주의 물품 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      <span>🌍</span>
                      {prohibitedItems.countries.title}
                    </h3>
                    <button
                      onClick={() => {
                        const countriesText = `${prohibitedItems.countries.title}. ${prohibitedItems.countries.items.join('. ')}`;
                        handleSpeechToggle('countries', countriesText);
                      }}
                      className={`flex items-center justify-center w-16 h-16 rounded-full transition-all shadow-lg border-4 ${speakingCategory === 'countries'
                        ? (isPaused ? 'bg-yellow-500 border-yellow-600 text-white' : 'bg-red-600 border-red-700 text-white animate-pulse')
                        : 'bg-yellow-400 border-yellow-500 hover:bg-yellow-500 text-white shadow-xl'
                        }`}
                      aria-label={speakingCategory === 'countries' ? (isPaused ? '음성 재개' : '음성 일시정지') : '음성으로 듣기'}
                      title={speakingCategory === 'countries' ? (isPaused ? '재개' : '일시정지') : '음성으로 듣기'}
                    >
                      {speakingCategory === 'countries'
                        ? (isPaused ? <FiPlay className="text-3xl font-bold" /> : <FiPause className="text-3xl font-bold" />)
                        : <FiVolume2 className="text-3xl font-bold" />}
                    </button>
                  </div>
                  <ul className="space-y-2 ml-6">
                    {prohibitedItems.countries.items.map((item, idx) => (
                      <li key={idx} className="text-lg text-gray-700 list-disc">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-3 pt-3 border-t border-yellow-300">
                  <p className="text-base text-yellow-800 italic">
                    💡 주의: 규정은 항공사 및 크루즈 회사, 국가별로 다를 수 있으니 출발 전 반드시 확인하세요.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 빠른 추가 칩 */}
          <div className="mb-4 flex flex-wrap gap-2">
            {quickChips.map(chip => (
              <button
                key={chip}
                onClick={() => handleAdd(chip)}
                className="rounded-full border bg-white px-4 py-2 text-base font-semibold hover:bg-gray-50"
                disabled={isLoading}
              >
                + {chip}
              </button>
            ))}
          </div>

          {/* 리스트 */}
          <ul className="space-y-3">
            {sorted.map(item => (
              <li
                key={item.id}
                className={`flex items-center gap-3 rounded-2xl border bg-white px-3 sm:px-4 py-3 sm:py-3.5 shadow-sm
                          ${item.completed ? 'opacity-80' : ''}`}
              >
                <button
                  aria-label={item.completed ? '완료 해제' : '완료 처리'}
                  onClick={() => {
                    if (editingItemId === item.id) {
                      // 편집 중이면 체크 클릭 시 수정 완료
                      handleUpdate(item.id, editingText);
                    } else {
                      // 편집 중이 아니면 완료 토글
                      handleToggle(item.id);
                    }
                  }}
                  className={`flex-shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-full border
                            ${item.completed ? 'bg-green-50 border-green-300' : 'bg-white'}
                            ${editingItemId === item.id ? 'bg-blue-50 border-blue-300' : ''}
                            active:scale-[0.98] transition-transform`}
                  disabled={isLoading}
                >
                  {editingItemId === item.id ? (
                    <FiCheck className="text-blue-600 text-2xl" />
                  ) : item.completed ? (
                    <FiCheck className="text-green-600 text-2xl" />
                  ) : (
                    <span className="block h-5 w-5 rounded-md border" />
                  )}
                </button>

                {editingItemId === item.id ? (
                  // 편집 모드
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdate(item.id, editingText);
                        } else if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                      autoFocus
                      className={`flex-1 rounded-lg border-2 border-blue-300 px-3 py-2 ${fontCls} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      disabled={isLoading}
                    />
                    <button
                      onClick={handleCancelEdit}
                      className="flex-shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 active:scale-95 transition-transform"
                      aria-label="취소"
                    >
                      <FiX className="text-lg text-gray-600" />
                    </button>
                  </div>
                ) : (
                  // 표시 모드
                  <div
                    className={`flex-1 ${fontCls} cursor-pointer`}
                    onClick={() => handleStartEdit(item)}
                  >
                    <span className={`${item.completed ? 'line-through text-gray-400' : 'text-gray-900'} font-bold hover:text-blue-600 transition-colors`}>
                      {item.text}
                    </span>
                  </div>
                )}

                <button
                  aria-label="삭제"
                  onClick={() => handleDelete(item.id)}
                  className="ml-1 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-95 transition-transform"
                  disabled={isLoading || editingItemId === item.id}
                >
                  <FiTrash2 className="text-lg" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 하단 고정 입력 바 (모바일에 특히 편함) */}
      <div className="fixed inset-x-0 bottom-[max(0px,env(safe-area-inset-bottom))] z-30 border-t bg-white/95 backdrop-blur supports-[padding:max(0px)]:pb-[max(env(safe-area-inset-bottom),0px)]">
        <div className="mx-auto max-w-3xl px-4 py-3 flex gap-2">
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="새로운 준비물을 입력하세요…"
            className="h-12 flex-1 rounded-xl border px-4 text-lg"
            disabled={isLoading}
          />
          <button
            onClick={() => handleAdd()}
            disabled={isLoading || !newText.trim()}
            className="h-12 rounded-xl bg-gradient-to-r from-[#FDB931] to-[#E1A21E] px-4 text-[#051C2C] text-lg font-semibold hover:shadow-lg inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiPlus className="text-xl" />
            추가
          </button>
        </div>
      </div>
    </main>
  );
}
