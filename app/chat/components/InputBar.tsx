import { logger } from '@/lib/logger';
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import HelpModal from '@/components/HelpModal';
import { type POI } from '@/lib/terminals'; // Terminal 대신 POI 임포트
import type { ChatInputMode, ChatInputPayload } from '@/components/chat/types'; // 새 임포트
import terminalsData from '@/data/terminals.json'; // terminals.json 데이터 임포트
import { hapticClick, hapticImpact } from '@/lib/haptic';
import { FiMic, FiMicOff } from 'react-icons/fi';

type SItem = { id: string; label: string; subtitle?: string; }

// 헬퍼 함수: Terminal 객체로부터 kind를 유추 -> 더 이상 필요 없음 (삭제)
// const inferKind = (t: Terminal): 'airport' | 'terminal' | 'poi' => {
//     if (t.type === 'airport') return 'airport';
//     if (t.type === 'cruise') return 'terminal';
//     if (/공항/i.test(t.name_ko) || /airport/i.test(t.name)) return 'airport';
//     if (/크루즈|터미널/i.test(t.name_ko) || /cruise|terminal/i.test(t.name)) return 'terminal';
//     return 'poi';
// };

type TerminalData = typeof terminalsData[0]; // terminals.json의 단일 객체 타입 정의

type Props = {
  mode: ChatInputMode; // ChatInputMode 사용
  trip?: {
    embarkCountry?: string;
    embarkPortName?: string;
    cruiseName?: string;
  };
  onSend: (payload: ChatInputPayload) => void; // ChatInputPayload 사용
  disabled?: boolean; // 전송 중일 때 입력 비활성화
};

export default function InputBar({ mode, trip, onSend, disabled = false }: Props) {
  const [originText, setOriginText] = useState('')
  const [destText, setDestText] = useState('')
  const [originPick, setOriginPick] = useState<null | SItem>(null)
  const [destPick, setDestPick] = useState<null | SItem>(null)
  // 초기 제안 버튼들을 바로 표시하기 위해 기본값 설정
  const [oSug, setOSug] = useState<SItem[]>([{ id: 'current_location', label: '현 위치' }])
  const [dSug, setDSug] = useState<SItem[]>([
    { id: 'convenience', label: '편의점' },
    { id: 'mart', label: '마트' },
    { id: 'tourist', label: '관광지' },
    { id: 'restaurant', label: '맛집' },
    { id: 'cafe', label: '카페' },
  ])

  // 고정 버튼 정의
  const fixedOriginButtons: SItem[] = [
    { id: 'current_location', label: '현 위치' },
  ];

  const fixedDestButtons: SItem[] = [
    { id: 'convenience', label: '편의점' },
    { id: 'mart', label: '마트' },
    { id: 'tourist', label: '관광지' },
    { id: 'restaurant', label: '맛집' },
    { id: 'cafe', label: '카페' },
  ];
  const [generalText, setGeneralText] = useState(''); // New state for general mode
  const typingO = useRef<number>()
  const typingD = useRef<number>()
  const [openHelp, setOpenHelp] = useState(false);
  const [originFocused, setOriginFocused] = useState(false);
  const [destFocused, setDestFocused] = useState(false);

  // 로딩 상태 추가
  const [originLoading, setOriginLoading] = useState(false);
  const [destLoading, setDestLoading] = useState(false);

  // 검색 결과 캐싱 (5분 유효)
  const cacheRef = useRef<Map<string, { data: SItem[]; timestamp: number }>>(new Map());
  const CACHE_DURATION = 5 * 60 * 1000; // 5분

  // 음성 인식 관련 상태
  const recRef = useRef<SpeechRecognition | null>(null);
  const [listeningOrigin, setListeningOrigin] = useState(false);
  const [listeningDest, setListeningDest] = useState(false);
  const [listeningGeneral, setListeningGeneral] = useState(false);
  const micPermissionRef = useRef<boolean>(false);

  useEffect(() => { setOriginPick(null) }, [originText])
  useEffect(() => { setDestPick(null) }, [destText])
  useEffect(() => { setGeneralText('') }, [mode]) // Clear generalText on mode change

  // Speech Recognition 초기화
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[InputBar] Speech Recognition not supported');
      return;
    }

    const recog = new SpeechRecognition();
    recog.continuous = false; // 한 번만 인식
    recog.interimResults = true; // 중간 결과도 받기
    recog.lang = 'ko-KR'; // 한국어 기본

    recog.onend = () => {
      setListeningOrigin(false);
      setListeningDest(false);
      setListeningGeneral(false);
    };

    recRef.current = recog;
  }, []);

  // 모드 변경 시 입력 필드 및 제안 초기화
  useEffect(() => {
    if (mode === 'go') {
      // 'go' 모드로 전환 시 초기 상태 설정
      setOriginText('');
      setDestText('');
      setOriginPick(null);
      setDestPick(null);
      // 초기 제안은 다음 useEffect에서 자동으로 로드됨 (originText가 빈 문자열이면 자동 실행)
      logger.log('[InputBar] Mode changed to "go", will load initial suggestions');
    }
  }, [mode])

  const fetchSuggestions = useCallback(async (role: 'origin' | 'dest', q: string, hint: string) => {
    // 캐시 키 생성
    const cacheKey = `${role}:${q}:${hint}`;
    const cached = cacheRef.current.get(cacheKey);
    const now = Date.now();

    // 캐시 확인 (5분 이내면 캐시 사용)
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      logger.log('[InputBar] ✅ Using cached suggestions:', { cacheKey, itemCount: cached.data.length });
      return cached.data;
    }

    try {
      const url = `/api/nav/suggest?slot=${role}&q=${encodeURIComponent(q)}&hint=${encodeURIComponent(hint)}`;
      logger.log('[InputBar] fetchSuggestions calling:', { url, role, q, hint });

      const res = await fetch(url);

      // HTTP 에러 처리
      if (!res.ok) {
        throw new Error(`API 요청 실패 (${res.status}): ${res.statusText}`);
      }

      const data = await res.json();

      // API 응답 에러 처리
      if (!data || !Array.isArray(data.items)) {
        throw new Error('검색 결과 형식이 올바르지 않습니다.');
      }

      logger.log('[InputBar] fetchSuggestions response:', {
        url,
        role,
        q,
        hint,
        itemsCount: data.items?.length
      });

      const mapped = (data.items || []).map((item: { id: string; label: string; subtitle?: string }) => ({
        id: item.id,
        label: item.label,
        subtitle: item.subtitle,
      }));

      // 캐시에 저장 (5분 유효)
      cacheRef.current.set(cacheKey, { data: mapped, timestamp: now });

      // 캐시 크기 제한 (최대 50개)
      if (cacheRef.current.size > 50) {
        const firstKey = cacheRef.current.keys().next().value;
        cacheRef.current.delete(firstKey);
      }

      logger.log('[InputBar] ✅ fetchSuggestions returning:', mapped.length, 'items (cached)');
      return mapped;
    } catch (error) {
      console.error('[InputBar] ❌ fetchSuggestions error:', error);

      // 사용자 친화적 에러 메시지 반환 (빈 배열 대신 에러 표시용)
      // 실제로는 빈 배열을 반환하되, UI에서 로딩 상태를 해제
      return [];
    }
  }, []);

  useEffect(() => {
    window.clearTimeout(typingO.current)
    if (mode !== 'go') {
      logger.log('[InputBar] useEffect originText: mode is not "go", skipping:', { mode });
      return; // Only fetch suggestions for 'go' mode
    }

    logger.log('[InputBar] useEffect originText triggered:', { originText, mode, destText });

    if (!originText.trim()) {
      // 텍스트 없으면 고정 버튼 + 초기 제안 (주요 공항/크루즈 터미널)
      typingO.current = window.setTimeout(async () => {
        setOriginLoading(true);
        try {
          const fetchedChips = await fetchSuggestions('origin', '', destText.trim());
          // 고정 버튼 + 초기 제안 (모든 결과 표시, 최대 11개 추가)
          const chips = [...fixedOriginButtons, ...fetchedChips.slice(0, 11)];
          logger.log('[InputBar] Initial origin suggestions (no text):', {
            fetchedCount: fetchedChips.length,
            chips: chips,
            chipsLabels: chips.map(c => c.label)
          });
          setOSug(chips);
        } catch (error) {
          // 에러 발생 시 고정 버튼만 표시
          setOSug(fixedOriginButtons);
        } finally {
          setOriginLoading(false);
        }
      }, 200);
      return;
    }

    // 텍스트 입력 시: 고정 버튼 + 연관검색 결과 (국가별 검색 시 더 많이 표시)
    typingO.current = window.setTimeout(async () => {
      const q = originText.trim()
      const hint = destText.trim();

      setOriginLoading(true);
      logger.log('[InputBar] 📡 Fetching origin suggestions for "go" mode:', { q, hint, mode });

      try {
        const fetchedChips = await fetchSuggestions('origin', q, hint);
        logger.log('[InputBar] ✅ Fetched chips from API:', {
          fetchedCount: fetchedChips.length,
          fetchedChips: fetchedChips.slice(0, 5),
          allChips: fetchedChips.map(c => c.label)
        });

        // 국가명 검색 시 (짧은 입력) 더 많은 결과 표시, 일반 검색 시 적당히 표시
        const maxResults = q.length <= 3 ? 19 : 11; // 국가명(짧은 입력)이면 19개, 아니면 11개
        // 고정 버튼 + 연관검색 결과 (국가별 검색 시 최대 19개 추가)
        const chips = [...fixedOriginButtons, ...fetchedChips.slice(0, maxResults)];
        logger.log('[InputBar] ✅ Origin suggestions final (calling setOSug):', {
          q,
          hint,
          fetchedCount: fetchedChips.length,
          chips: chips,
          chipsCount: chips.length,
          chipsLabels: chips.map(c => c.label),
          fixedButtonsCount: fixedOriginButtons.length,
          maxResults
        });
        setOSug(chips);
        logger.log('[InputBar] ✅ setOSug called with', chips.length, 'items');
      } catch (error) {
        console.error('[InputBar] ❌ Error fetching suggestions:', error);
        // 에러 발생 시에도 고정 버튼은 유지
        setOSug(fixedOriginButtons);
      } finally {
        setOriginLoading(false);
      }
    }, 200)
  }, [originText, destText, fetchSuggestions, mode])

  useEffect(() => {
    window.clearTimeout(typingD.current)
    if (mode !== 'go' && mode !== 'show') {
      logger.log('[InputBar] useEffect destText: mode is not "go" or "show", skipping:', { mode });
      return; // Only fetch suggestions for 'go' or 'show' mode
    }

    logger.log('[InputBar] useEffect destText triggered:', { destText, originText, mode });

    if (!destText.trim()) {
      // 텍스트 없으면 고정 버튼 + 초기 제안 (출발지 국가의 공항/크루즈 터미널)
      typingD.current = window.setTimeout(async () => {
        setDestLoading(true);
        try {
          const fetchedChips = await fetchSuggestions('dest', '', originText.trim());
          // 고정 버튼 + 초기 제안 (최대 7개 추가)
          const chips = [...fixedDestButtons, ...fetchedChips.slice(0, 7)];
          logger.log('[InputBar] Initial dest suggestions (no text):', {
            fetchedCount: fetchedChips.length,
            chips: chips,
            chipsLabels: chips.map(c => c.label)
          });
          setDSug(chips);
        } catch (error) {
          // 에러 발생 시 고정 버튼만 표시
          setDSug(fixedDestButtons);
        } finally {
          setDestLoading(false);
        }
      }, 180);
      return;
    }

    // 텍스트 입력 시: 고정 버튼 + 연관검색 결과 (국가별 검색 시 더 많이 표시)
    typingD.current = window.setTimeout(async () => {
      const q = destText.trim();
      const hint = originText.trim(); // 출발지를 힌트로 전달

      // 키워드 감지: 편의점, 마트, 관광지, 맛집, 카페 등
      const isKeyword = fixedDestButtons.some(btn => q === btn.label || q.includes(btn.label));

      if (isKeyword) {
        // 키워드인 경우: 고정 버튼만 표시 (연관검색 불필요)
        logger.log('[InputBar] ✅ Dest is keyword, showing fixed buttons only:', { q });
        setDSug(fixedDestButtons);
        return;
      }

      setDestLoading(true);
      logger.log('[InputBar] 📡 Fetching dest suggestions for "go" mode:', { q, hint, mode });

      try {
        const fetchedChips = await fetchSuggestions('dest', q, hint);
        logger.log('[InputBar] ✅ Fetched dest chips from API:', {
          fetchedCount: fetchedChips.length,
          fetchedChips: fetchedChips.slice(0, 5),
          allChips: fetchedChips.map(c => c.label)
        });

        // 국가명 검색 시 (짧은 입력) 더 많은 결과 표시, 일반 검색 시 적당히 표시
        const maxResults = q.length <= 3 ? 15 : 7; // 국가명(짧은 입력)이면 15개, 아니면 7개
        // 고정 버튼 + 연관검색 결과 (국가별 검색 시 최대 15개 추가)
        const chips = [...fixedDestButtons, ...fetchedChips.slice(0, maxResults)];
        logger.log('[InputBar] ✅ Dest suggestions final (calling setDSug):', {
          q,
          hint,
          fetchedCount: fetchedChips.length,
          chips: chips,
          chipsCount: chips.length,
          chipsLabels: chips.map(c => c.label),
          fixedButtonsCount: fixedDestButtons.length,
          maxResults
        });
        setDSug(chips);
        logger.log('[InputBar] ✅ setDSug called with', chips.length, 'items');
      } catch (error) {
        console.error('[InputBar] ❌ Error fetching dest suggestions:', error);
        // 에러 발생 시에도 고정 버튼은 유지
        setDSug(fixedDestButtons);
      } finally {
        setDestLoading(false);
      }
    }, 180)
  }, [destText, originText, destFocused, fetchSuggestions, mode])

  const examples = useMemo(() => {
    const city = trip?.embarkCountry ?? '홍콩';
    const terminal = trip?.embarkPortName
      ? `${trip.embarkPortName} 크루즈 터미널`
      : '홍콩 크루즈 터미널';
    return {
      originPH: '어디에서 출발하시나요? (예: 홍콩 / 미국 / HKG / 현 위치)',
      destPH:
        mode === 'show'
          ? '사진으로 보여드려요 (예: 퀀텀, 오키나와, 도쿄 보여줘)'
          : '어디에 도착하시나요? (예: 맛집 / 관광지 / 크루즈터미널)',
      singlePH:
        mode === 'show'
          ? '사진으로 보여드려요 (예: 퀀텀, 오키나와, 도쿄 보여줘)'
          : '어디에 도착하시나요? (예: 맛집 / 관광지 / 크루즈터미널)',
      generalPH: '궁금한 것을 물어보세요. (예: 환율 / 날씨 / 홍콩 보여줘)' // New placeholder for general mode
    };
  }, [trip, mode]); // mode 변경 시에도 examples 업데이트

  const canSend = useMemo(() => {
    if (mode === 'go') {
      // 출발지: 텍스트가 있거나, "현 위치" 패턴이거나, 선택된 값이 있으면 OK
      const hasOrigin = originText.trim().length > 0 ||
        /현\s*위치|현재\s*위치/i.test(originText) ||
        originPick !== null;
      // 도착지: 텍스트가 있거나, 선택된 값이 있으면 OK
      const hasDest = destText.trim().length > 0 || destPick !== null;
      return hasOrigin && hasDest;
    } else if (mode === 'show') {
      // 보여줘 모드: 도착지(검색어)만 있으면 OK
      return destText.trim().length > 0 || destPick !== null;
    } else if (mode === 'general') {
      return generalText.trim().length > 0;
    } else if (mode === 'info') { // 'info' 모드는 항상 전송 가능
      return true;
    }
    return false;
  }, [mode, originText, destText, generalText, originPick, destPick])

  const submit = () => {
    if (!canSend) {
      logger.log('[InputBar] Cannot send:', { mode, canSend, originText, destText, generalText });
      return;
    }

    if (mode === 'general') {
      onSend({ mode: 'general', text: generalText.trim() }); // mode 필드 추가
      setGeneralText('');
    } else if (mode === 'info') { // info 모드일 때 빈 메시지 전송
      onSend({ mode: 'info', text: generalText.trim() });
      setGeneralText('');
    } else {
      // 'go' 또는 'show' 모드
      // originPick이나 destPick이 있으면 그것을 우선 사용
      const finalOrigin = originPick?.label || originText.trim();
      const finalDest = destPick?.label || destText.trim();

      const combinedText = mode === 'go'
        ? [finalOrigin, finalDest].filter(Boolean).join(' → ')
        : finalDest || finalOrigin || '';

      if (!combinedText.trim()) {
        console.error('[InputBar] Empty text, cannot send');
        return;
      }

      logger.log('[InputBar] Sending:', { mode, combinedText, finalOrigin, finalDest, originPick, destPick });

      onSend({
        mode: mode === 'go' ? 'go' : 'show',
        text: combinedText,
        from: finalOrigin || undefined,
        to: finalDest || undefined,
      });

      // 전송 후 입력 필드 초기화
      setOriginText('');
      setDestText('');
      setOriginPick(null);
      setDestPick(null);
      // 연관검색 버튼은 다음 useEffect에서 자동으로 다시 로드됨 (originText가 빈 문자열이면 초기 제안 로드)
    }
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  // 음성 인식 시작 함수 (출발지용)
  async function startVoiceInputOrigin() {
    if (!recRef.current) {
      alert('❌ 이 브라우저는 음성 인식을 지원하지 않습니다.');
      return;
    }

    try {
      recRef.current.abort?.();
    } catch (e) {
      console.error('[InputBar] Error aborting speech recognition:', e);
    }

    setListeningOrigin(true);
    micPermissionRef.current = false;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch((err) => {
            logger.log('[InputBar] getUserMedia error:', err);
            throw err;
          });
          stream.getTracks().forEach(track => track.stop());
          micPermissionRef.current = true;
        } catch (mediaError: any) {
          if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
            micPermissionRef.current = false;
          } else {
            micPermissionRef.current = true;
          }
        }
      } else {
        micPermissionRef.current = true;
      }

      const r = recRef.current!;
      if (!r) {
        alert('❌ 음성 인식 초기화에 실패했습니다.');
        setListeningOrigin(false);
        return;
      }

      r.lang = 'ko-KR';
      let finalText = '';

      r.onresult = (e: SpeechRecognitionEvent) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const chunk = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            finalText += chunk;
            // 마침표 제거
            const cleanedText = finalText.replace(/\./g, '').trim();
            setOriginText(cleanedText);
            setOriginPick(null);
          }
        }
      };

      r.onstart = () => {
        logger.log('[InputBar] Voice recognition started (origin)');
      };

      r.onerror = (e: any) => {
        const errorType = e?.error || 'unknown';
        if (micPermissionRef.current) {
          logger.log('[InputBar] Permission granted, error silently handled:', errorType);
          setListeningOrigin(false);
          return;
        }
        setListeningOrigin(false);
        if (errorType === 'not-allowed' || errorType === 'permission-denied') {
          alert('❌ 마이크 권한이 필요합니다.\n\n💡 해결 방법:\n1. 브라우저 주소창 왼쪽 🔒 아이콘 클릭\n2. "마이크" → "허용" 선택\n3. 페이지 새로고침 (F5)');
        }
      };

      try {
        r.start();
      } catch (startError: any) {
        if (micPermissionRef.current) {
          logger.log('[InputBar] Permission granted, start error silently handled');
          setListeningOrigin(false);
          return;
        }
        console.error('[InputBar] Speech recognition start error:', startError);
        setListeningOrigin(false);
      }
    } catch (error: any) {
      if (micPermissionRef.current) {
        logger.log('[InputBar] Permission granted, catch error silently handled');
        setListeningOrigin(false);
        return;
      }
      console.error('[InputBar] Start voice input error:', error);
      setListeningOrigin(false);
    }
  }

  // 음성 인식 시작 함수 (도착지용)
  async function startVoiceInputDest() {
    if (!recRef.current) {
      alert('❌ 이 브라우저는 음성 인식을 지원하지 않습니다.');
      return;
    }

    try {
      recRef.current.abort?.();
    } catch (e) {
      console.error('[InputBar] Error aborting speech recognition:', e);
    }

    setListeningDest(true);
    micPermissionRef.current = false;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch((err) => {
            logger.log('[InputBar] getUserMedia error:', err);
            throw err;
          });
          stream.getTracks().forEach(track => track.stop());
          micPermissionRef.current = true;
        } catch (mediaError: any) {
          if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
            micPermissionRef.current = false;
          } else {
            micPermissionRef.current = true;
          }
        }
      } else {
        micPermissionRef.current = true;
      }

      const r = recRef.current!;
      if (!r) {
        alert('❌ 음성 인식 초기화에 실패했습니다.');
        setListeningDest(false);
        return;
      }

      r.lang = 'ko-KR';
      let finalText = '';

      r.onresult = (e: SpeechRecognitionEvent) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const chunk = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            finalText += chunk;
            // 마침표 제거
            const cleanedText = finalText.replace(/\./g, '').trim();
            setDestText(cleanedText);
            setDestPick(null);
          }
        }
      };

      r.onstart = () => {
        logger.log('[InputBar] Voice recognition started (dest)');
      };

      r.onerror = (e: any) => {
        const errorType = e?.error || 'unknown';
        if (micPermissionRef.current) {
          logger.log('[InputBar] Permission granted, error silently handled:', errorType);
          setListeningDest(false);
          return;
        }
        setListeningDest(false);
        if (errorType === 'not-allowed' || errorType === 'permission-denied') {
          alert('❌ 마이크 권한이 필요합니다.\n\n💡 해결 방법:\n1. 브라우저 주소창 왼쪽 🔒 아이콘 클릭\n2. "마이크" → "허용" 선택\n3. 페이지 새로고침 (F5)');
        }
      };

      try {
        r.start();
      } catch (startError: any) {
        if (micPermissionRef.current) {
          logger.log('[InputBar] Permission granted, start error silently handled');
          setListeningDest(false);
          return;
        }
        console.error('[InputBar] Speech recognition start error:', startError);
        setListeningDest(false);
      }
    } catch (error: any) {
      if (micPermissionRef.current) {
        logger.log('[InputBar] Permission granted, catch error silently handled');
        setListeningDest(false);
        return;
      }
      console.error('[InputBar] Start voice input error:', error);
      setListeningDest(false);
    }
  }

  // 음성 인식 시작 함수 (일반 입력용)
  async function startVoiceInputGeneral() {
    if (!recRef.current) {
      alert('❌ 이 브라우저는 음성 인식을 지원하지 않습니다.');
      return;
    }

    try {
      recRef.current.abort?.();
    } catch (e) {
      console.error('[InputBar] Error aborting speech recognition:', e);
    }

    setListeningGeneral(true);
    micPermissionRef.current = false;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch((err) => {
            logger.log('[InputBar] getUserMedia error:', err);
            throw err;
          });
          stream.getTracks().forEach(track => track.stop());
          micPermissionRef.current = true;
        } catch (mediaError: any) {
          if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
            micPermissionRef.current = false;
          } else {
            micPermissionRef.current = true;
          }
        }
      } else {
        micPermissionRef.current = true;
      }

      const r = recRef.current!;
      if (!r) {
        alert('❌ 음성 인식 초기화에 실패했습니다.');
        setListeningGeneral(false);
        return;
      }

      r.lang = 'ko-KR';
      let finalText = '';

      r.onresult = (e: SpeechRecognitionEvent) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const chunk = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            finalText += chunk;
            // 마침표 제거
            const cleanedText = finalText.replace(/\./g, '').trim();
            setGeneralText(cleanedText);
          }
        }
      };

      r.onstart = () => {
        logger.log('[InputBar] Voice recognition started (general)');
      };

      r.onerror = (e: any) => {
        const errorType = e?.error || 'unknown';
        if (micPermissionRef.current) {
          logger.log('[InputBar] Permission granted, error silently handled:', errorType);
          setListeningGeneral(false);
          return;
        }
        setListeningGeneral(false);
        if (errorType === 'not-allowed' || errorType === 'permission-denied') {
          alert('❌ 마이크 권한이 필요합니다.\n\n💡 해결 방법:\n1. 브라우저 주소창 왼쪽 🔒 아이콘 클릭\n2. "마이크" → "허용" 선택\n3. 페이지 새로고침 (F5)');
        }
      };

      try {
        r.start();
      } catch (startError: any) {
        if (micPermissionRef.current) {
          logger.log('[InputBar] Permission granted, start error silently handled');
          setListeningGeneral(false);
          return;
        }
        console.error('[InputBar] Speech recognition start error:', startError);
        setListeningGeneral(false);
      }
    } catch (error: any) {
      if (micPermissionRef.current) {
        logger.log('[InputBar] Permission granted, catch error silently handled');
        setListeningGeneral(false);
        return;
      }
      console.error('[InputBar] Start voice input error:', error);
      setListeningGeneral(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 p-4 border-2 rounded-xl bg-white shadow-sm">
        <button
          aria-label="도움말"
          className="shrink-0 w-12 h-12 rounded-lg border-2 text-gray-700 hover:bg-gray-50 text-lg font-bold"
          onClick={() => setOpenHelp(true)}
          title="도움말"
        >
          ?
        </button>

        {mode === 'go' ? (
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Input
                id="from-input"
                value={originText}
                placeholder={examples.originPH}
                onChange={v => setOriginText(v)}
                onKeyDown={onKey}
                onFocus={() => setOriginFocused(true)}
                onBlur={() => setOriginFocused(false)}
                disabled={disabled}
              />
              <button
                onClick={startVoiceInputOrigin}
                disabled={disabled || listeningOrigin}
                className={`shrink-0 w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all ${listeningOrigin
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="음성으로 입력하기"
              >
                {listeningOrigin ? <FiMicOff className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
              </button>
            </div>
            <Chips
              items={oSug}
              onClick={(it) => {
                setOriginText(it.label);
                setOriginPick(it);
                // 클릭 후에도 연관검색 버튼은 유지 (사용자가 다시 변경할 수 있도록)
                // setOSug([]) 제거 - 연관검색 결과가 계속 보이도록 함
                document.getElementById('to-input')?.focus();
              }}
              loading={originLoading}
            />
            <span className="block text-center px-1 text-neutral-400">→</span>
            <div className="flex items-center gap-2">
              <Input
                id="to-input"
                value={destText}
                placeholder={examples.destPH}
                onChange={v => setDestText(v)}
                onKeyDown={onKey}
                onFocus={() => setDestFocused(true)}
                onBlur={() => setDestFocused(false)}
                disabled={disabled}
              />
              <button
                onClick={startVoiceInputDest}
                disabled={disabled || listeningDest}
                className={`shrink-0 w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all ${listeningDest
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="음성으로 입력하기"
              >
                {listeningDest ? <FiMicOff className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
              </button>
            </div>
            <Chips
              items={dSug}
              onClick={(it) => {
                setDestText(it.label);
                setDestPick(it);
                setDSug([]);
              }}
              compact={true}
              loading={destLoading}
            />
          </div>
        ) : mode === 'general' ? (
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Input
                id="general-input"
                value={generalText}
                placeholder={examples.generalPH}
                onChange={v => setGeneralText(v)}
                onKeyDown={onKey}
                disabled={disabled}
              />
              <button
                onClick={startVoiceInputGeneral}
                disabled={disabled || listeningGeneral}
                className={`shrink-0 w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all ${listeningGeneral
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="음성으로 입력하기"
              >
                {listeningGeneral ? <FiMicOff className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
              </button>
            </div>
          </div>
        ) : mode === 'info' ? ( // info 모드일 때 메시지 입력 필드 숨김
          <Input
            id="general-input"
            value={generalText}
            placeholder=""
            onChange={v => setGeneralText(v)}
            onKeyDown={onKey}
            className="hidden"
            disabled={disabled}
          />
        ) : (
          <div className="flex-1 flex items-center gap-2">
            <Input
              id="single-input"
              value={destText}
              placeholder={examples.singlePH}
              onChange={v => setDestText(v)}
              onKeyDown={onKey}
              disabled={disabled}
            />
            <button
              onClick={startVoiceInputDest}
              disabled={disabled || listeningDest}
              className={`shrink-0 w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all ${listeningDest
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="음성으로 입력하기"
            >
              {listeningDest ? <FiMicOff className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
            </button>
          </div>
        )}

        <button
          onClick={submit}
          disabled={disabled || !canSend}
          className={`px-6 py-3 bg-gradient-to-r from-[#FDB931] to-[#E1A21E] text-[#051C2C] text-lg font-semibold rounded-lg hover:shadow-lg active:opacity-90 transition-all ${disabled || !canSend ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          title={!canSend ? '입력 내용을 확인해주세요' : '보내기'}
        >
          {disabled ? '전송 중...' : '보내기'}
        </button>
      </div>

      <HelpModal open={openHelp} onClose={() => setOpenHelp(false)} mode={mode} />
    </>
  );
}

function Input({ id, value, onChange, placeholder, onKeyDown, onFocus, onBlur, className, disabled }: {
  id: string;
  value: string,
  onChange: (v: string) => void,
  placeholder: string,
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void,
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <input id={id} className={`w-full rounded-xl border px-4 py-3 text-lg outline-none ${className}`}
      value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur} disabled={disabled} />
  )
}
function Chips({ items, onClick, compact = false, loading = false }: { items: SItem[], onClick: (it: SItem) => void, compact?: boolean, loading?: boolean }) {
  logger.log('[Chips] Rendering with items:', items?.length, items?.map(i => ({ id: i.id, label: i.label })), 'compact:', compact, 'loading:', loading);

  // 로딩 중일 때 스켈레톤 UI 표시
  if (loading) {
    if (compact) {
      return (
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-10 w-20 bg-gray-200 animate-pulse rounded-lg" />
          ))}
        </div>
      );
    }
    return (
      <div className="mt-3 grid grid-cols-2 gap-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-[70px] bg-gray-200 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (!items?.length) {
    logger.log('[Chips] No items, returning null');
    return null;
  }

  // compact 모드 (도착지 고정 버튼용): 한 줄로 작은 버튼
  if (compact) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map(it => (
          <button
            key={it.id}
            className="
              rounded-lg
              px-3 py-2
              text-base font-semibold
              border-2
              bg-white
              hover:bg-[#FDB931]/10
              hover:border-[#FDB931]
              active:scale-95
              transition-all
              shadow-sm
              hover:shadow-md
              whitespace-nowrap
            "
            onClick={() => onClick(it)}
          >
            {it.label}
          </button>
        ))}
      </div>
    );
  }

  // 일반 모드 (출발지용): 2줄 그리드
  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      {items.map(it => (
        <button
          key={it.id}
          className="
            rounded-xl
            px-5 py-4
            text-lg font-bold
            border-2
            min-h-[70px]
            bg-white
            hover:bg-[#051C2C]/5
            hover:border-[#051C2C]
            active:scale-95
            transition-all
            shadow-sm
            hover:shadow-md
          "
          onClick={() => onClick(it)}
        >
          <div className="flex flex-col items-center gap-1">
            <span>{it.label}</span>
            {it.subtitle && (
              <span className="text-xs text-gray-600 font-normal">{it.subtitle}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}