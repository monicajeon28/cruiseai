'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { FiArrowLeft, FiMic, FiMicOff } from 'react-icons/fi';
import { csrfFetch } from '@/lib/csrf-client';
import { loadPhrasesForLang } from '@/app/translator/phrases';
import type { PhraseCategory } from '@/app/translator/phrases';
import { trackFeature } from '@/lib/analytics';
import TutorialCountdown from '@/app/chat/components/TutorialCountdown';
import { checkTestModeClient, TestModeInfo, getCorrectPath } from '@/lib/test-mode-client';
import { clearAllLocalStorage } from '@/lib/csrf-client';
import { showError, showWarning } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';

// 국가별 → 현지어 매핑
const DESTINATION_LANGUAGE_MAP: Record<string, { code: string; name: string; flag: string }> = {
  일본: { code: 'ja-JP', name: '일본어', flag: '🇯🇵' },
  중국: { code: 'zh-CN', name: '중국어', flag: '🇨🇳' },
  홍콩: { code: 'zh-HK', name: '광둥어', flag: '🇭🇰' },
  대만: { code: 'zh-TW', name: '대만어', flag: '🇹🇼' },
  미국: { code: 'en-US', name: '영어', flag: '🇺🇸' },
  // 영어는 US만 사용 (50대 이상 사용자 혼란 방지)
  // 영국: { code: 'en-GB', name: '영어', flag: '🇬🇧' },
  // 싱가포르: { code: 'en-SG', name: '영어', flag: '🇸🇬' },
  태국: { code: 'th-TH', name: '태국어', flag: '🇹🇭' },
  베트남: { code: 'vi-VN', name: '베트남어', flag: '🇻🇳' },
  // 필리핀: { code: 'en-PH', name: '영어', flag: '🇵🇭' },
  인도네시아: { code: 'id-ID', name: '인도네시아어', flag: '🇮🇩' },
  말레이시아: { code: 'ms-MY', name: '말레이어', flag: '🇲🇾' },
  프랑스: { code: 'fr-FR', name: '프랑스어', flag: '🇫🇷' },
  이탈리아: { code: 'it-IT', name: '이탈리아어', flag: '🇮🇹' },
  스페인: { code: 'es-ES', name: '스페인어', flag: '🇪🇸' },
  독일: { code: 'de-DE', name: '독일어', flag: '🇩🇪' },
  러시아: { code: 'ru-RU', name: '러시아어', flag: '🇷🇺' },
  // 지중해/유럽 추가
  그리스: { code: 'el-GR', name: '그리스어', flag: '🇬🇷' },
  크로아티아: { code: 'hr-HR', name: '크로아티아어', flag: '🇭🇷' },
  포르투갈: { code: 'pt-PT', name: '포르투갈어', flag: '🇵🇹' },
  // 북유럽 추가
  노르웨이: { code: 'nb-NO', name: '노르웨이어', flag: '🇳🇴' },
  스웨덴: { code: 'sv-SE', name: '스웨덴어', flag: '🇸🇪' },
  덴마크: { code: 'da-DK', name: '덴마크어', flag: '🇩🇰' },
  핀란드: { code: 'fi-FI', name: '핀란드어', flag: '🇫🇮' },
};

type ConversationItem = {
  id: string;
  from: { flag: string; name: string; code?: string };
  to: { flag: string; name: string; code?: string };
  source: string;
  translated: string;
  pronunciation?: string;
  when: string;
  kind: 'speech' | 'photo';
  isError?: boolean;
};

type UserData = {
  user?: { name?: string };
  trip?: { destination?: string };
};

const STORAGE_KEY = 'translator:conversation';

export default function TranslatorPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [testModeInfo, setTestModeInfo] = useState<TestModeInfo | null>(null);

  useEffect(() => {
    // 테스트 모드 정보 로드 및 경로 보호
    const loadTestModeInfo = async () => {
      const info = await checkTestModeClient();
      setTestModeInfo(info);

      // 경로 보호: 일반 사용자는 /translator로 리다이렉트
      const correctPath = getCorrectPath(pathname || '/translator-test', info);
      if (correctPath !== pathname) {
        router.replace(correctPath);
      }
    };
    loadTestModeInfo();
  }, [pathname, router]);

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        clearAllLocalStorage();
        window.location.href = '/login-test';
      } else {
        logger.error('로그아웃 실패');
        showError('로그아웃에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      logger.error('로그아웃 요청 중 오류 발생:', error);
      showError('로그아웃 중 오류가 발생했습니다.');
    }
  };

  // 튜토리얼 상태
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<number>(0); // 0: 음성, 1: 사진, 2: 상황별 도우미

  // 카테고리 선택 상태
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // 상황별 번역도우미 접기/펼치기 상태 - 기본값을 false로 설정하여 닫혀있게
  const [isPhraseHelperExpanded, setIsPhraseHelperExpanded] = useState(false);
  // 발음 캐시 (phrase.target -> pronunciation)
  const [pronunciationCache, setPronunciationCache] = useState<Record<string, string>>({});

  // 마이크 권한 상태 (전역으로 관리하여 모든 에러 핸들러에서 접근 가능)
  const micPermissionRef = useRef<boolean>(false);
  // 마이크 스트림 캐시 (권한 팝업 반복 방지)
  const micStreamRef = useRef<MediaStream | null>(null);

  // 기본 현지어는 영어(US)로 시작(API 로드 후 교체)
  const [localLang, setLocalLang] = useState({ code: 'en-US', name: '영어', flag: '🇺🇸' });
  const [currentPhrases, setCurrentPhrases] = useState<PhraseCategory[]>([]);

  // 현재 언어의 회화 데이터 동적 로딩 (cleanup: race condition 방지)
  useEffect(() => {
    let cancelled = false;
    loadPhrasesForLang(localLang.code)
      .then((phrases) => { if (!cancelled) setCurrentPhrases(phrases); })
      .catch(() => { if (!cancelled) setCurrentPhrases([]); });
    return () => { cancelled = true; };
  }, [localLang.code]);

  const [destination, setDestination] = useState<string>('확인 중...');
  const [portInfo, setPortInfo] = useState<string>('');
  const [isCruising, setIsCruising] = useState(false);

  // 튜토리얼 표시 (페이지 진입 시마다 항상 표시)
  useEffect(() => {
    setTimeout(() => {
      setShowTutorial(true);
      setTutorialStep(0);
    }, 1000);
  }, []);

  const handleTutorialNext = () => {
    if (tutorialStep < 2) {
      setTutorialStep(tutorialStep + 1);
    } else {
      setShowTutorial(false);
      // localStorage 저장 제거 - 페이지 진입 시마다 항상 표시
    }
  };

  const handleTutorialSkip = () => {
    setShowTutorial(false);
    // localStorage 저장 제거 - 페이지 진입 시마다 항상 표시
  };

  // 회의록
  const [items, setItems] = useState<ConversationItem[]>([]);
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setItems(parsed);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // 음성 인식 객체
  const recRef = useRef<SpeechRecognition | null>(null);
  const isProcessingRef = useRef(false); // race condition 방지
  const interimTextRef = useRef(''); // stale closure 방지용 ref
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // speak setTimeout cleanup
  const [listening, setListening] = useState<'none' | 'pressing' | 'recording'>('none');
  const [preview, setPreview] = useState('');
  const [finalText, setFinalText] = useState(''); // 최종 확정된 텍스트
  const [interimText, setInterimText] = useState(''); // 인식 중인 텍스트 (실시간 업데이트)


  // 기능 사용 추적
  useEffect(() => {
    trackFeature('translator');
  }, []);

  // 현재 날짜의 기항지 정보를 읽어 현지어 자동 설정
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/itinerary/current', { credentials: 'include' });
        const data = await res.json();

        if (!data.ok) {
          setDestination('여행 정보 없음');
          return;
        }

        if (!data.hasTrip) {
          setDestination('여행 미등록');
          return;
        }

        if (data.isCruising) {
          setDestination('항해 중 🚢');
          setPortInfo('현재 항해 중입니다');
          setIsCruising(true);
          // 항해 중에는 영어 유지
          return;
        }

        // 기항지 정보가 있는 경우
        if (data.currentPort) {
          const port = data.currentPort;
          setDestination(port.location || '알 수 없음');
          // 영어는 US로 통일 (en-GB, en-SG 등도 en-US로 변환)
          const portLang = port.language;
          if (portLang && portLang.code && portLang.code.startsWith('en-') && portLang.code !== 'en-US') {
            setLocalLang({ code: 'en-US', name: '영어', flag: '🇺🇸' });
          } else {
            setLocalLang(portLang || { code: 'en-US', name: '영어', flag: '🇺🇸' });
          }
          setIsCruising(false);

          // 기항지 상세 정보
          const arrival = port.arrival ? ` 입항 ${port.arrival}` : '';
          const departure = port.departure ? ` 출항 ${port.departure}` : '';
          setPortInfo(`${port.country || ''}${arrival}${departure}`.trim());
        } else {
          setDestination('일정 정보 없음');
        }
      } catch (error) {
        logger.error('Error loading current itinerary:', error);
        setDestination('로드 실패');
      }
    })();
  }, []);

  // 음성인식 초기화(webkit + 표준 둘 다 커버)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SR: any =
      window.webkitSpeechRecognition || (window as any).SpeechRecognition;

    if (!SR) {
      logger.warn('이 브라우저는 음성 인식을 지원하지 않습니다.');
      recRef.current = null; // 명시적으로 null 설정
      return;
    }

    const recog = new SR();
    recog.continuous = true; // 긴 문장 인식을 위해 continuous 모드 활성화
    recog.interimResults = true; // 중간 결과도 표시
    recog.maxAlternatives = 1; // 최대 대안 수
    recog.lang = 'ko-KR'; // 기본 언어 (나중에 변경됨)

    recog.onerror = (e: any) => {
      logger.warn('[SpeechRecognition error]', e?.error);
      // 권한 문제 등 친절 메시지 (TODO: 사용자에게 알림)
    };
    recog.onend = () => {
      // 버튼 뗐거나, 자동 종료
      // 이 부분은 startPressToTalk/stopPressToTalk 로직과 연동되므로 listening 상태만 idle로
      setListening('none');
      setPreview('');
      setFinalText('');
      setInterimText('');
    };

    recRef.current = recog;

    return () => {
      try { recog.abort(); } catch { }
      recRef.current = null;
      micStreamRef.current?.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
      if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
    };
  }, []);

  // 외국어를 한국어 발음으로 변환하는 함수 (캐시 포함, 재시도 로직 추가)
  async function getPronunciation(foreignText: string, langCode: string, useCache = true, retryCount = 0): Promise<string> {
    try {
      // 한국어인 경우 불필요
      if (langCode === 'ko-KR' || langCode === 'ko') {
        return '';
      }

      // 캐시 확인
      const cacheKey = `${foreignText}_${langCode}`;
      if (useCache && pronunciationCache[cacheKey]) {
        return pronunciationCache[cacheKey];
      }

      logger.log('[Pronunciation] Calling API:', { text: foreignText, langCode, cacheKey, retryCount });
      const res = await csrfFetch('/api/translation/pronunciation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: foreignText, langCode }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        logger.error('[Pronunciation] API error:', res.status, res.statusText, errorText);

        // 재시도 (최대 2번)
        if (retryCount < 2) {
          logger.log(`[Pronunciation] Retrying... (${retryCount + 1}/2)`);
          await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1))); // 지수 백오프
          return getPronunciation(foreignText, langCode, useCache, retryCount + 1);
        }

        return '';
      }

      const data = await res.json();
      logger.log('[Pronunciation] API response:', JSON.stringify(data, null, 2));

      if (!data.ok) {
        logger.error('[Pronunciation] API returned error:', data.error);

        // 재시도 (최대 2번)
        if (retryCount < 2) {
          logger.log(`[Pronunciation] Retrying after error... (${retryCount + 1}/2)`);
          await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1)));
          return getPronunciation(foreignText, langCode, useCache, retryCount + 1);
        }

        return '';
      }

      let pronunciation = data?.pronunciation || '';

      if (!pronunciation) {
        logger.error('[Pronunciation] Empty pronunciation in API response:', data);

        // 재시도 (최대 2번)
        if (retryCount < 2) {
          logger.log(`[Pronunciation] Retrying after empty response... (${retryCount + 1}/2)`);
          await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1)));
          return getPronunciation(foreignText, langCode, useCache, retryCount + 1);
        }

        return '';
      }

      // 이미 괄호가 포함되어 있으면 그대로 사용
      if (pronunciation && !pronunciation.trim().startsWith('(')) {
        pronunciation = `(${pronunciation.trim()})`;
      }

      logger.log('[Pronunciation] Final pronunciation:', pronunciation);

      // 캐시에 저장
      if (useCache && pronunciation) {
        setPronunciationCache(prev => {
          const newCache = { ...prev, [cacheKey]: pronunciation };
          logger.log('[Pronunciation] Updated cache:', newCache);
          return newCache;
        });
      }

      return pronunciation;
    } catch (error: any) {
      logger.warn('[Pronunciation] Error:', error);

      // 재시도 (최대 2번)
      if (retryCount < 2) {
        logger.log(`[Pronunciation] Retrying after exception... (${retryCount + 1}/2)`);
        await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1)));
        return getPronunciation(foreignText, langCode, useCache, retryCount + 1);
      }

      return ''; // 실패 시 빈 문자열 반환 (번역은 계속 진행)
    }
  }

  // 선택된 카테고리의 문장들 - 발음은 이미 PHRASE_CATEGORIES에 포함되어 있으므로 API 호출 불필요

  // 번역(서버 측 /api/chat 사용) — "결과만" 받도록 프롬프트 + 부분 번역 지원
  async function translateText(text: string, fromLabel: string, toLabel: string) {
    try {
      // 언어 이름을 영어로 변환
      const fromEnglish = getEnglishLanguageName(fromLabel);
      const toEnglish = getEnglishLanguageName(toLabel);

      logger.log(`[Translation] Translating from ${fromLabel}(${fromEnglish}) to ${toLabel}(${toEnglish}):`, text);

      // 텍스트가 비어있거나 너무 짧으면 그대로 반환
      if (!text || text.trim().length === 0) {
        return { translated: text, pronunciation: '' };
      }

      const res = await csrfFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text, // 원문만 전달 (프롬프트 구성은 서버에서 처리)
          mode: 'translate',
          from: fromEnglish,
          to: toEnglish,
        }),
      });

      if (!res.ok) {
        logger.error('[Translation] API error:', res.status, res.statusText);
        if (res.status === 429) {
          return { translated: '⏳ 번역 서버가 바쁩니다. 잠시 후 다시 시도해주세요.', pronunciation: '', isError: true };
        }
        return { translated: '⚠️ 번역에 실패했습니다. 잠시 후 다시 시도해주세요.', pronunciation: '', isError: true };
      }

      const data = await res.json();

      // 백엔드 응답 구조에 맞춰 추출
      let translated = '';
      if (data?.messages && Array.isArray(data.messages)) {
        const textMessage = data.messages.find((m: any) => m?.type === 'text' && m?.text);
        translated = textMessage?.text || '';
      } else if (data?.message) {
        translated = data.message;
      } else if (typeof data === 'string') {
        translated = data;
      }

      // ⚠️ 중요: 번역 실패 감지
      if (!data.ok) {
        logger.error('[Translation] API returned error:', data.error);
        // 에러 시 원문 반환 (alert 제거 - 사용자 경험 개선)
        return { translated: text, pronunciation: '' };
      }

      // 에러 메시지 감지
      if (translated && (translated.includes('번역 중 오류가 발생했습니다') || translated.includes('번역에 실패했습니다'))) {
        logger.error('[Translation] Error message in response');
        return { translated: text, pronunciation: '' }; // 원문 반환
      }

      // 번역 결과가 없거나 빈 문자열인 경우
      if (!translated || translated.trim() === '') {
        logger.error('[Translation] Empty translation received');
        return { translated: text, pronunciation: '' }; // 원문 반환
      }

      // ⚠️ 중요: 번역 결과가 원문과 동일하면 실패 처리 (하지만 원문 반환)
      const trimmedTranslated = translated.trim();
      const trimmedOriginal = text.trim();

      if (trimmedTranslated === trimmedOriginal && trimmedOriginal.length > 3) {
        logger.warn('[Translation] Translation same as original - returning original');
        return { translated: text, pronunciation: '' }; // 원문 반환 (alert 제거)
      }

      return { translated: trimmedTranslated, pronunciation: '' };
    } catch (error: any) {
      logger.error('[Translation] Error:', error);
      return { translated: text, pronunciation: '' }; // 에러 시 원문 반환
    }
  }

  // 말하기(TTS)
  function speak(text: string, langCode: string) {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;

    // 이전 음성 큐 비우기
    synth.cancel();

    // 음성 목록이 로드된 경우에만 지원 여부 확인
    const voices = synth.getVoices();
    if (voices.length > 0) {
      const langPrefix = langCode.split('-')[0].toLowerCase();
      const hasVoice = voices.some(v =>
        v.lang === langCode ||
        v.lang.toLowerCase().startsWith(langPrefix)
      );
      if (!hasVoice) {
        showWarning('기기 설정에서 해당 언어 음성 팩을 설치해주세요.', `이 기기에서 ${langCode} 언어의 음성을 지원하지 않습니다.`);
        return;
      }
    }

    const u = new SpeechSynthesisUtterance(text);
    u.lang = langCode;
    u.rate = 0.9;
    u.onerror = (e) => {
      if (e.error !== 'interrupted') {
        logger.log(`[TTS] Speech error: ${e.error} for lang ${langCode}`);
      }
    };
    synth.speak(u);
  }

  // 공통 음성 인식 시작(길게 누르는 동안)
  async function startPressToTalk(from: { code: string; name: string; flag: string }, to: { code: string; name: string; flag: string }) {
    if (!recRef.current) {
      showError('Chrome, Edge, Safari 브라우저를 사용해주세요.', '이 브라우저는 음성 인식을 지원하지 않습니다.');
      return;
    }

    try {
      recRef.current.abort?.(); // 혹시 켜져있으면 끊고 시작
    } catch (e) {
      logger.error("Error aborting speech recognition:", e);
    }

    setListening('pressing');
    setPreview('마이크 준비 중...');
    setFinalText('');
    setInterimText('');

    // ⚡ 마이크 권한 확인 및 Speech Recognition 시작
    try {
      // 1단계: 실제 마이크 권한 확인 (getUserMedia로 확실하게 확인)
      micPermissionRef.current = false; // 초기화

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          // 캐시된 스트림 재사용 (권한 팝업 반복 방지)
          let stream = micStreamRef.current;
          if (!stream || stream.getTracks().every(t => t.readyState === 'ended')) {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch((err) => {
              // Permissions Policy 경고는 무시 (실제 권한은 있을 수 있음)
              logger.log('[getUserMedia] Caught error (may be Permissions Policy warning):', err);
              throw err;
            });
            micStreamRef.current = stream;
          }
          micPermissionRef.current = true; // ✅ 권한 확인됨 - 전역 상태 저장
          setPreview('✅ 마이크 준비됨! 말씀하세요...');
        } catch (mediaError: any) {
          // 권한이 실제로 거부된 경우만 false 유지
          if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
            micPermissionRef.current = false;
          } else {
            // 다른 오류는 권한은 있을 수 있으므로 true로 설정
            micPermissionRef.current = true;
          }
        }
      } else {
        // getUserMedia 지원 안 함 - 일단 시도 (권한 체크 불가능)
        micPermissionRef.current = true;
      }

      // 2단계: Speech Recognition 시작
      const r = recRef.current!;
      if (!r) {
        showError('음성 인식 초기화에 실패했습니다. 다시 시도해주세요.');
        setListening('none');
        setPreview('');
        return;
      }

      // 음성 인식 언어 설정
      r.lang = from.code;

      let accumulatedFinalText = '';

      r.onresult = (e: SpeechRecognitionEvent) => {
        let newFinalText = accumulatedFinalText;
        let newInterimText = '';

        for (let i = e.resultIndex; i < e.results.length; i++) {
          const chunk = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            newFinalText += chunk + ' ';
            accumulatedFinalText = newFinalText;
          } else {
            newInterimText = chunk;
          }
        }

        // 상태 업데이트 - 인식 과정을 실시간으로 표시
        setFinalText(newFinalText.trim());
        setInterimText(newInterimText);
        interimTextRef.current = newInterimText; // stale closure 방지

        // 프리뷰 텍스트 업데이트 (최종 + 중간 합쳐서)
        const displayText = (newFinalText.trim() + ' ' + newInterimText).trim();
        setPreview(displayText || '🎤 듣는 중...');
      };

      r.onstart = () => {
        setListening('recording');
        setPreview('🎤 말씀하세요...');
        setFinalText('');
        setInterimText('');
      };

      r.onerror = (e: any) => {
        const errorType = e?.error || 'unknown';

        // ⚡ 권한이 허용된 경우 → 모든 에러 조용히 처리 (메시지 없음)
        if (micPermissionRef.current) {
          logger.log('[Speech Recognition] Permission granted, error silently handled:', errorType);
          setListening('none');
          setPreview('');
          return; // 조용히 종료 (사용자에게 알림 안 함)
        }

        // 권한이 거부된 경우만 에러 처리
        setListening('none');
        setPreview('');

        if (errorType === 'not-allowed' || errorType === 'permission-denied') {
          showWarning('주소창 🔒 아이콘 > 마이크 허용 후 새로고침(F5)해주세요.', '마이크 권한이 필요합니다.');
        } else if (errorType === 'no-speech') {
          // 말이 없으면 조용히 처리 (알림 없음)
          logger.log('음성이 감지되지 않았습니다.');
        } else if (errorType === 'network') {
          showError('인터넷 연결을 확인해주세요.', '네트워크 오류가 발생했습니다.');
        } else {
          // 다른 에러는 조용히 로그만
          logger.error('[Speech Recognition Error]', errorType);
        }
      };

      // 음성 인식 시작
      try {
        r.start();
      } catch (startError: any) {
        // ⚡ 권한이 허용된 경우 → 에러 무시 (메시지 없음)
        if (micPermissionRef.current) {
          logger.log('[Speech Recognition Start] Permission granted, error silently handled:', startError);
          setListening('none');
          setPreview('');
          return; // 조용히 종료
        }

        // 권한이 거부된 경우만 에러 처리
        logger.error('[Speech Recognition Start Error]', startError);
        setListening('none');
        setPreview('');

        if (startError?.name === 'NotAllowedError' || startError?.message?.includes('permission')) {
          showWarning('주소창 🔒 아이콘 > 마이크 허용 후 새로고침(F5)해주세요.', '마이크 권한이 필요합니다.');
        } else {
          // 다른 오류는 조용히 처리
          logger.error('[Speech Recognition Start]', startError);
        }
        return;
      }

      // 손을 떼면 stopListening 호출에서 번역/추가
      (r as any).__translatePair = { from, to };
      (r as any).__acc = () => {
        // ref를 사용해 stale closure 문제 방지
        const combined = (accumulatedFinalText + ' ' + (interimTextRef.current || '')).trim();
        return combined || accumulatedFinalText.trim();
      };

    } catch (error: any) {
      // ⚡ 권한이 허용된 경우 → 에러 무시 (메시지 없음)
      if (micPermissionRef.current) {
        logger.log('[Speech Recognition] Permission granted, catch block error silently handled:', error);
        setListening('none');
        setPreview('');
        return; // 조용히 종료
      }

      // 권한이 거부된 경우만 에러 처리
      logger.error('[Start Speech Recognition Error]', error);
      setListening('none');
      setPreview('');

      if (error?.name === 'NotAllowedError' || error?.message?.includes('permission')) {
        showWarning('주소창 🔒 아이콘 > 마이크 허용 후 새로고침(F5)해주세요.', '마이크 권한이 필요합니다.');
      } else {
        // 예상치 못한 에러는 조용히 로그만
        logger.error('[Speech Recognition] Unexpected error:', error);
      }
    }
  }

  async function stopPressToTalk() {
    // iOS/Android gesture context 유지를 위해 즉시 cancel 호출 (speechSynthesis를 활성화)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // 마이크는 항상 멈춰야 함 (번역 중이라도)
    const r: any = recRef.current;
    if (r) {
      try { r.stop(); } catch { }
    }
    setListening('none');
    setPreview('');

    // 번역 이미 진행 중이면 마이크만 멈추고 종료 (중복 번역 방지)
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    if (!r) { isProcessingRef.current = false; return; }
    const pair = r.__translatePair as { from: any; to: any } | undefined;
    const acc = typeof r.__acc === 'function' ? r.__acc() : '';

    // 최종 텍스트가 있으면 사용, 없으면 상태에서 가져오기
    const finalAcc = acc || (finalText + ' ' + interimText).trim();

    // 상태 초기화
    setFinalText('');
    setInterimText('');

    if (!pair || !finalAcc) { isProcessingRef.current = false; return; }

    try {
      const { translated, isError } = await translateText(finalAcc, pair.from.name, pair.to.name);

      const newItem = {
        id: Date.now().toString(),
        from: { flag: pair.from.flag, name: pair.from.name, code: pair.from.code },
        to: { flag: pair.to.flag, name: pair.to.name, code: pair.to.code },
        source: finalAcc,
        translated,
        when: new Date().toLocaleTimeString('ko-KR'),
        kind: 'speech' as const,
        isError,
      };

      setItems((prev) => [newItem, ...prev]);

      // 에러 메시지는 TTS로 읽지 않음
      if (!isError) {
        // iOS/Android에서 gesture context 유지를 위해 setTimeout 사용
        if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
        speakTimeoutRef.current = setTimeout(() => {
          speak(translated, pair.to.code);
        }, 10);
      }
    } catch (error) {
      logger.error('[stopPressToTalk] Unexpected error:', error);
    } finally {
      isProcessingRef.current = false; // 예외 여부와 무관하게 항상 해제
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
    }
  }


  // 언어 이름을 한국어에서 영어로 변환 (API 호출용) - API와 동일한 매핑 사용
  function getEnglishLanguageName(koreanName: string): string {
    const languageMap: Record<string, string> = {
      '한국어': 'Korean',
      'Korean': 'Korean',
      'ko-KR': 'Korean',
      'ko': 'Korean',
      '영어': 'English',
      'English': 'English',
      'en-US': 'English',
      'en-GB': 'English',
      'en': 'English',
      '일본어': 'Japanese',
      'Japanese': 'Japanese',
      'ja-JP': 'Japanese',
      'ja': 'Japanese',
      '중국어': 'Simplified Chinese',
      'Simplified Chinese': 'Simplified Chinese',
      'zh-CN': 'Simplified Chinese',
      '광둥어': 'Cantonese',
      'Cantonese': 'Cantonese',
      'zh-HK': 'Cantonese',
      '대만어': 'Traditional Chinese',
      'Traditional Chinese': 'Traditional Chinese',
      'zh-TW': 'Traditional Chinese',
      '태국어': 'Thai',
      'Thai': 'Thai',
      'th-TH': 'Thai',
      'th': 'Thai',
      '베트남어': 'Vietnamese',
      'Vietnamese': 'Vietnamese',
      'vi-VN': 'Vietnamese',
      'vi': 'Vietnamese',
      '인도네시아어': 'Indonesian',
      'Indonesian': 'Indonesian',
      'id-ID': 'Indonesian',
      'id': 'Indonesian',
      '말레이어': 'Malay',
      'Malay': 'Malay',
      'ms-MY': 'Malay',
      'ms': 'Malay',
      '프랑스어': 'French',
      'French': 'French',
      'fr-FR': 'French',
      'fr': 'French',
      '이탈리아어': 'Italian',
      'Italian': 'Italian',
      'it-IT': 'Italian',
      'it': 'Italian',
      '스페인어': 'Spanish',
      'Spanish': 'Spanish',
      'es-ES': 'Spanish',
      'es': 'Spanish',
      '독일어': 'German',
      'German': 'German',
      'de-DE': 'German',
      'de': 'German',
      '러시아어': 'Russian',
      'Russian': 'Russian',
      'ru-RU': 'Russian',
      'ru': 'Russian',
      // 지중해/유럽
      '그리스어': 'Greek',
      'Greek': 'Greek',
      'el-GR': 'Greek',
      'el': 'Greek',
      '크로아티아어': 'Croatian',
      'Croatian': 'Croatian',
      'hr-HR': 'Croatian',
      'hr': 'Croatian',
      '포르투갈어': 'Portuguese',
      'Portuguese': 'Portuguese',
      'pt-PT': 'Portuguese',
      'pt': 'Portuguese',
      // 북유럽
      '노르웨이어': 'Norwegian',
      'Norwegian': 'Norwegian',
      'nb-NO': 'Norwegian',
      'nb': 'Norwegian',
      '스웨덴어': 'Swedish',
      'Swedish': 'Swedish',
      'sv-SE': 'Swedish',
      'sv': 'Swedish',
      '덴마크어': 'Danish',
      'Danish': 'Danish',
      'da-DK': 'Danish',
      'da': 'Danish',
      '핀란드어': 'Finnish',
      'Finnish': 'Finnish',
      'fi-FI': 'Finnish',
      'fi': 'Finnish',
    };
    return languageMap[koreanName] || koreanName;
  }

  // 발음 표시 컴포넌트 (동적 로딩)
  function PronunciationDisplay({ phrase, langCode, pronunciationCache }: {
    phrase: { target: string; pronunciation?: string };
    langCode?: string;
    pronunciationCache: Record<string, string>;
  }) {
    const cacheKey = langCode ? `${phrase.target}_${langCode}` : '';
    const pronunciation = phrase.pronunciation || (cacheKey ? pronunciationCache[cacheKey] : '');

    if (!pronunciation || langCode === 'ko-KR') return null;

    return (
      <div className="text-sm text-gray-600 italic mt-1 break-words">
        💬 {pronunciation}
      </div>
    );
  }

  // 현재 언어의 카테고리 배열 (동적 로딩으로 교체됨)
  // 빠른 문장 데이터 (자주 쓰는 문장) - 하위 호환을 위해 유지 (현재 미사용)
  const _QUICK_PHRASES: Record<string, Array<{ ko: string; target: string; emoji: string }>> = {
    'ja-JP': [ // 일본어
      { ko: '화장실이 어디에요?', target: 'トイレはどこですか？', emoji: '🚻' },
      { ko: '얼마예요?', target: 'いくらですか？', emoji: '💰' },
      { ko: '이거 주세요', target: 'これをください', emoji: '🛒' },
      { ko: '맛있어요', target: 'おいしいです', emoji: '😋' },
      { ko: '감사합니다', target: 'ありがとうございます', emoji: '🙏' },
      { ko: '천천히 말해주세요', target: 'ゆっくり話してください', emoji: '🗣️' },
      { ko: '사진 찍어도 되나요?', target: '写真を撮ってもいいですか？', emoji: '📷' },
      { ko: '도와주세요', target: '助けてください', emoji: '🆘' },
    ],
    'zh-CN': [ // 중국어
      { ko: '화장실이 어디에요?', target: '厕所在哪里？', emoji: '🚻' },
      { ko: '얼마예요?', target: '多少钱？', emoji: '💰' },
      { ko: '이거 주세요', target: '我要这个', emoji: '🛒' },
      { ko: '맛있어요', target: '好吃', emoji: '😋' },
      { ko: '감사합니다', target: '谢谢', emoji: '🙏' },
      { ko: '천천히 말해주세요', target: '请慢点说', emoji: '🗣️' },
      { ko: '사진 찍어도 되나요?', target: '可以拍照吗？', emoji: '📷' },
      { ko: '도와주세요', target: '请帮帮我', emoji: '🆘' },
    ],
    'zh-TW': [ // 대만어
      { ko: '화장실이 어디에요?', target: '洗手間在哪裡？', emoji: '🚻' },
      { ko: '얼마예요?', target: '多少錢？', emoji: '💰' },
      { ko: '이거 주세요', target: '我要這個', emoji: '🛒' },
      { ko: '맛있어요', target: '好吃', emoji: '😋' },
      { ko: '감사합니다', target: '謝謝', emoji: '🙏' },
      { ko: '천천히 말해주세요', target: '請慢點說', emoji: '🗣️' },
      { ko: '사진 찍어도 되나요?', target: '可以拍照嗎？', emoji: '📷' },
      { ko: '도와주세요', target: '請幫幫我', emoji: '🆘' },
    ],
    'en-US': [ // 영어
      { ko: '화장실이 어디에요?', target: 'Where is the bathroom?', emoji: '🚻' },
      { ko: '얼마예요?', target: 'How much is it?', emoji: '💰' },
      { ko: '이거 주세요', target: 'I\'ll take this', emoji: '🛒' },
      { ko: '맛있어요', target: 'It\'s delicious', emoji: '😋' },
      { ko: '감사합니다', target: 'Thank you', emoji: '🙏' },
      { ko: '천천히 말해주세요', target: 'Please speak slowly', emoji: '🗣️' },
      { ko: '사진 찍어도 되나요?', target: 'Can I take a photo?', emoji: '📷' },
      { ko: '도와주세요', target: 'Please help me', emoji: '🆘' },
    ],
    'it-IT': [ // 이탈리아어
      { ko: '화장실이 어디에요?', target: 'Dov\'è il bagno?', emoji: '🚻' },
      { ko: '얼마예요?', target: 'Quanto costa?', emoji: '💰' },
      { ko: '이거 주세요', target: 'Prendo questo', emoji: '🛒' },
      { ko: '맛있어요', target: 'È delizioso', emoji: '😋' },
      { ko: '감사합니다', target: 'Grazie', emoji: '🙏' },
      { ko: '천천히 말해주세요', target: 'Per favore, parli lentamente', emoji: '🗣️' },
      { ko: '사진 찍어도 되나요?', target: 'Posso fare una foto?', emoji: '📷' },
      { ko: '도와주세요', target: 'Aiuto', emoji: '🆘' },
    ],
  };

  // 버튼 정의(선택한 언어에 맞게 동적으로 생성)
  const BTN_PAIRS = [
    // 항상 한국어 ↔ 영어(US) 버튼
    { label: '🇰🇷 한국어 → 🇺🇸 영어', from: { code: 'ko-KR', name: '한국어', flag: '🇰🇷' }, to: { code: 'en-US', name: '영어', flag: '🇺🇸' } },
    { label: '🇺🇸 영어 → 🇰🇷 한국어', from: { code: 'en-US', name: '영어', flag: '🇺🇸' }, to: { code: 'ko-KR', name: '한국어', flag: '🇰🇷' } },
    // 선택한 언어에 맞는 버튼 (영어가 아닌 경우만 표시)
    ...(localLang.code !== 'en-US' ? [
      { label: `🇰🇷 한국어 → ${localLang.flag} ${localLang.name}`, from: { code: 'ko-KR', name: '한국어', flag: '🇰🇷' }, to: localLang },
      { label: `${localLang.flag} ${localLang.name} → 🇰🇷 한국어`, from: localLang, to: { code: 'ko-KR', name: '한국어', flag: '🇰🇷' } },
    ] : []),
  ];

  const isDestinationReady = destination !== '확인 중...' && destination !== '여행 미등록';

  return (
    <>
      {/* 72시간 카운트다운 배너 (상단 고정) */}
      {testModeInfo && testModeInfo.isTestMode && (
        <TutorialCountdown testModeInfo={testModeInfo} onLogout={handleLogout} />
      )}

      {/* 튜토리얼 팝업 */}
      {showTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 md:p-8 relative">
            {/* 닫기 버튼 */}
            <button
              onClick={handleTutorialSkip}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-3xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              ✕
            </button>

            {/* 단계별 내용 */}
            {tutorialStep === 0 && (
              <div className="text-center">
                <div className="text-6xl mb-4">🎤</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">음성 번역</h3>
                <p className="text-gray-700 mb-4">
                  마이크 버튼을 한 번 누르고 말하면 자동으로 번역됩니다.
                </p>
                <ul className="text-left space-y-2 text-sm text-gray-600 mb-6 bg-blue-50 rounded-lg p-4">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>한 번 누르면 녹음 시작, 다시 누르면 번역됩니다</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>🔊 버튼으로 번역된 문장을 들을 수 있습니다</span>
                  </li>
                </ul>
                <div className="bg-blue-50 rounded-lg p-3 mb-6">
                  <p className="text-sm text-blue-800">
                    <span className="font-bold">예시:</span> &quot;화장실이 어디에요?&quot;라고 말하면 자동 번역됩니다.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleTutorialSkip}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                  >
                    건너뛰기
                  </button>
                  <button
                    onClick={handleTutorialNext}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg"
                  >
                    다음
                  </button>
                </div>
                <div className="mt-4 flex justify-center gap-2">
                  <div className={`w-3 h-3 rounded-full transition-all ${(tutorialStep as number) >= 0 ? 'bg-blue-600' : 'bg-gray-300'} ${(tutorialStep as number) === 0 ? 'scale-125' : ''}`}></div>
                  <div className={`w-3 h-3 rounded-full transition-all ${(tutorialStep as number) >= 1 ? 'bg-green-600' : 'bg-gray-300'} ${(tutorialStep as number) === 1 ? 'scale-125' : ''}`}></div>
                  <div className={`w-3 h-3 rounded-full transition-all ${(tutorialStep as number) >= 2 ? 'bg-purple-600' : 'bg-gray-300'} ${(tutorialStep as number) === 2 ? 'scale-125' : ''}`}></div>
                </div>
              </div>
            )}

            {tutorialStep === 1 && (
              <div className="text-center">
                <div className="text-7xl md:text-8xl mb-5">📷</div>
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 leading-tight">사진 번역</h3>
                <p className="text-lg md:text-xl text-gray-700 mb-5 leading-relaxed">
                  메뉴판, 안내판 등 텍스트가 있는 사진을 찍으면 자동으로 번역됩니다.
                </p>
                <ul className="text-left space-y-3 text-base md:text-lg text-gray-600 mb-6 bg-green-50 rounded-lg p-5 leading-relaxed">
                  <li className="flex items-start gap-3">
                    <span className="text-green-600 font-bold text-xl flex-shrink-0">•</span>
                    <span>상단의 &quot;📷 사진으로 번역&quot; 버튼을 클릭하세요</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-600 font-bold text-xl flex-shrink-0">•</span>
                    <span>카메라로 텍스트가 있는 사진을 찍으세요</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-600 font-bold text-xl flex-shrink-0">•</span>
                    <span>사진 속 텍스트가 자동으로 인식되고 번역됩니다</span>
                  </li>
                </ul>
                <div className="bg-green-50 rounded-lg p-4 md:p-5 mb-6">
                  <p className="text-base md:text-lg text-green-800 leading-relaxed">
                    <span className="font-bold">예시:</span> 일본 식당 메뉴판을 찍으면 한국어로 번역됩니다.
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={handleTutorialSkip}
                    className="flex-1 px-5 py-4 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors text-base md:text-lg"
                    style={{ minHeight: '56px' }}
                  >
                    건너뛰기
                  </button>
                  <button
                    onClick={handleTutorialNext}
                    className="flex-1 px-5 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold hover:from-green-600 hover:to-green-700 transition-all shadow-lg text-base md:text-lg"
                    style={{ minHeight: '56px' }}
                  >
                    다음
                  </button>
                </div>
                <div className="mt-5 flex justify-center gap-3">
                  <div className={`w-3 h-3 rounded-full transition-all ${(tutorialStep as number) >= 0 ? 'bg-blue-600' : 'bg-gray-300'} ${(tutorialStep as number) === 0 ? 'scale-125' : ''}`}></div>
                  <div className={`w-3 h-3 rounded-full transition-all ${(tutorialStep as number) >= 1 ? 'bg-green-600' : 'bg-gray-300'} ${(tutorialStep as number) === 1 ? 'scale-125' : ''}`}></div>
                  <div className={`w-3 h-3 rounded-full transition-all ${(tutorialStep as number) >= 2 ? 'bg-purple-600' : 'bg-gray-300'} ${(tutorialStep as number) === 2 ? 'scale-125' : ''}`}></div>
                </div>
              </div>
            )}

            {tutorialStep === 2 && (
              <div className="text-center">
                <div className="text-7xl md:text-8xl mb-5">⚡</div>
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 leading-tight">상황별 번역 도우미</h3>
                <p className="text-lg md:text-xl text-gray-700 mb-5 leading-relaxed">
                  자주 사용하는 문장을 카테고리별로 미리 준비해두었습니다.
                </p>
                <ul className="text-left space-y-3 text-base md:text-lg text-gray-600 mb-6 bg-purple-50 rounded-lg p-5 leading-relaxed">
                  <li className="flex items-start gap-3">
                    <span className="text-purple-600 font-bold text-xl flex-shrink-0">•</span>
                    <span>카테고리(식사, 쇼핑, 교통 등)를 선택하세요</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-600 font-bold text-xl flex-shrink-0">•</span>
                    <span>원하는 문장을 클릭하면 자동으로 번역되고 재생됩니다</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-600 font-bold text-xl flex-shrink-0">•</span>
                    <span>번역 내역은 하단에 저장되어 다시 확인할 수 있습니다</span>
                  </li>
                </ul>
                <div className="bg-purple-50 rounded-lg p-4 md:p-5 mb-6">
                  <p className="text-base md:text-lg text-purple-800 leading-relaxed">
                    <span className="font-bold">팁:</span> 상황별 번역 도우미를 활용하면 빠르고 정확하게 소통할 수 있습니다!
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={handleTutorialSkip}
                    className="flex-1 px-5 py-4 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors text-base md:text-lg"
                    style={{ minHeight: '56px' }}
                  >
                    건너뛰기
                  </button>
                  <button
                    onClick={handleTutorialNext}
                    className="flex-1 px-5 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-bold hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg text-base md:text-lg"
                    style={{ minHeight: '56px' }}
                  >
                    완료
                  </button>
                </div>
                <div className="mt-5 flex justify-center gap-3">
                  <div className={`w-4 h-4 rounded-full transition-all ${(tutorialStep as number) >= 0 ? 'bg-blue-600' : 'bg-gray-300'} ${(tutorialStep as number) === 0 ? 'scale-125' : ''}`}></div>
                  <div className={`w-4 h-4 rounded-full transition-all ${(tutorialStep as number) >= 1 ? 'bg-green-600' : 'bg-gray-300'} ${(tutorialStep as number) === 1 ? 'scale-125' : ''}`}></div>
                  <div className={`w-4 h-4 rounded-full transition-all ${(tutorialStep as number) >= 2 ? 'bg-purple-600' : 'bg-gray-300'} ${(tutorialStep as number) === 2 ? 'scale-125' : ''}`}></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="h-[100dvh] bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 text-gray-900 flex flex-col overflow-hidden">
        {/* 헤더 — 1줄 압축 (모바일 최적화) */}
        <header className="flex-none z-20 border-b-2 border-purple-200 bg-white/95 backdrop-blur shadow-md">
          <div className="max-w-3xl mx-auto h-14 flex items-center gap-2 px-3">
            {/* 뒤로가기 */}
            <button
              onClick={() => router.push('/tools-test')}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-1 text-purple-600 hover:text-purple-700 flex-shrink-0"
            >
              <FiArrowLeft size={22} />
            </button>
            {/* 제목 + 부제목 */}
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent leading-none">
                AI 통번역기
              </h1>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {isCruising ? <span className="text-blue-600">⛵ 항해 중</span>
                  : (destination !== '여행 미등록' && destination !== '여행 정보 없음' && destination !== '로드 실패' && destination !== '확인 중...')
                    ? <span className="text-green-600">🏝️ {destination}</span>
                    : '72시간 무료 체험'}
              </p>
            </div>
            {/* 언어 선택 드롭다운 (우측, compact) */}
            <div className="relative flex-shrink-0">
              <select
                value={localLang.code}
                onChange={(e) => {
                  const selectedCode = e.target.value;
                  const selectedLang = Object.values(DESTINATION_LANGUAGE_MAP).find(lang => lang.code === selectedCode)
                    || { code: 'en-US', name: '영어', flag: '🇺🇸' };
                  setLocalLang(selectedLang);
                  setSelectedCategory(null);
                }}
                className="appearance-none bg-purple-50 border border-purple-200 rounded-lg
                  pl-2 pr-6 py-1.5 text-sm font-semibold text-purple-800 min-h-[44px] min-w-[100px]
                  hover:border-purple-400 focus:border-purple-500 cursor-pointer"
              >
                {Object.values(DESTINATION_LANGUAGE_MAP).map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
              <span className="absolute right-1.5 top-1/2 transform -translate-y-1/2 pointer-events-none text-purple-700 text-xs">▼</span>
            </div>
          </div>
        </header>

        {/* 본문 */}
        <main className="max-w-3xl mx-auto w-full flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {/* 프리뷰(인식 중) - 개선된 버전: 인식 과정을 실시간으로 표시 */}
          {listening !== 'none' && (
            <div className="rounded-xl border-2 border-blue-400 bg-gradient-to-r from-blue-50 to-purple-50 p-6 mb-4 shadow-lg">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className={`w-3 h-3 rounded-full ${listening === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                <span className="text-sm font-semibold text-gray-600">
                  {listening === 'recording' ? '🎤 인식 중...' : '⏳ 준비 중...'}
                </span>
              </div>
              <div className="text-center min-h-[100px] md:min-h-[120px] flex flex-col justify-center">
                {finalText || interimText ? (
                  <div className="space-y-3">
                    {/* 최종 확정된 텍스트 (검은색, 굵게) */}
                    {finalText && (
                      <div className="text-2xl sm:text-3xl font-bold text-gray-900 break-words px-2">
                        {finalText}
                      </div>
                    )}
                    {/* 인식 중인 텍스트 (회색, 기울임, 깜빡이는 커서) */}
                    {interimText && (
                      <div className="text-xl sm:text-2xl font-semibold text-gray-500 italic break-words px-2">
                        {interimText}
                        <span className="inline-block w-2 h-6 bg-gray-400 ml-1 animate-pulse">|</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xl sm:text-2xl font-semibold text-gray-600">
                    {preview || '🎤 말씀하세요...'}
                  </div>
                )}
              </div>
              {/* 진행 표시 (인식 중일 때만) */}
              {listening === 'recording' && (
                <div className="mt-4 flex items-center justify-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              )}
            </div>
          )}

          {/* ⚡ 카테고리별 빠른 문장 (50대 이상 사용자 친화적) - 더 눈에 띄게 개선 */}
          <div className="mb-6 bg-gradient-to-r from-purple-100 via-pink-100 to-orange-100 p-6 rounded-2xl border-4 border-purple-400 shadow-2xl">
            {!isDestinationReady && (
              <div className="mb-4 rounded-2xl border border-dashed border-purple-300 bg-white/70 px-4 py-3 text-sm md:text-base text-purple-900 font-semibold">
                🗺️ 여행 일정이 없어도 모든 상황별 문장을 바로 사용할 수 있어요. 위에서 원하는 국가를 선택하면 해당 언어 문장이 자동으로 준비됩니다.
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-extrabold flex items-center gap-3">
                <span className="text-4xl animate-pulse">⚡</span>
                <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  상황별 번역 도우미
                </span>
                <span className="text-sm font-normal text-purple-700 bg-purple-200 px-3 py-1 rounded-full">
                  빠른 번역
                </span>
              </h3>
              <button
                onClick={() => setIsPhraseHelperExpanded(!isPhraseHelperExpanded)}
                className="text-2xl text-purple-600 hover:text-purple-700 transition-transform duration-200"
                style={{ transform: isPhraseHelperExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
              >
                ▼
              </button>
            </div>

            {/* 카테고리 버튼 (선택된 카테고리가 없을 때) */}
            {isPhraseHelperExpanded && !selectedCategory && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {currentPhrases.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className="
                      p-6 bg-white border-3 border-purple-400 rounded-2xl
                      hover:border-purple-600 hover:shadow-xl hover:scale-105
                      active:scale-95 transition-all min-h-[80px]
                      flex flex-col items-center justify-center gap-3
                      shadow-lg
                    "
                  >
                    <span className="text-5xl">{category.emoji}</span>
                    <span className="font-bold text-lg text-center text-gray-900">{category.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* 선택된 카테고리의 문장들 */}
            {isPhraseHelperExpanded && selectedCategory && (
              <div>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="mb-4 px-5 py-2.5 bg-purple-200 hover:bg-purple-300 rounded-xl font-bold text-sm transition-all shadow-md"
                >
                  ← 카테고리 목록으로
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(currentPhrases.find(c => c.id === selectedCategory)?.phrases || []).map((phrase, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        // 발음은 이미 PHRASE_CATEGORIES에 포함되어 있음
                        setItems(prev => [{
                          id: Date.now().toString(),
                          from: { flag: '🇰🇷', name: '한국어', code: 'ko-KR' }, // 언어 코드 추가
                          to: { flag: localLang.flag, name: localLang.name, code: localLang.code }, // 언어 코드 추가
                          source: phrase.ko,
                          translated: phrase.target,
                          pronunciation: phrase.pronunciation, // 발음 추가 (이미 데이터에 포함)
                          when: new Date().toLocaleTimeString('ko-KR'),
                          kind: 'speech',
                        }, ...prev]);
                        speak(phrase.target, localLang.code);
                      }}
                      className="
                        p-4 bg-white border-2 border-blue-300 rounded-xl 
                        text-left hover:border-blue-500 hover:shadow-lg
                        active:scale-95 transition-all min-h-[100px]
                      "
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{phrase.emoji}</span>
                        <span className="font-bold text-base flex-1">{phrase.ko}</span>
                        {/* 한국어 재생 버튼 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            speak(phrase.ko, 'ko-KR');
                          }}
                          className="text-gray-500 hover:text-gray-700 active:scale-110 transition-all text-lg"
                          title="한국어로 재생"
                        >
                          🔊
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mb-1 overflow-hidden">
                        <div className="text-sm text-gray-700 font-semibold flex-1 break-words min-w-0">{phrase.target}</div>
                        {/* 외국어 재생 버튼 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            speak(phrase.target, localLang.code);
                          }}
                          className="text-blue-500 hover:text-blue-700 active:scale-110 transition-all text-lg flex-shrink-0"
                          title={`${localLang.name}로 재생`}
                        >
                          🔊
                        </button>
                      </div>
                      {/* 발음 표시 - PHRASE_CATEGORIES에 있거나 캐시에 있으면 표시 */}
                      <PronunciationDisplay
                        phrase={phrase}
                        langCode={localLang.code}
                        pronunciationCache={pronunciationCache}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 대화 기록 */}
          <div className="space-y-4">
            {items.length === 0 && (
              <div className="rounded-xl border bg-gray-50 p-6 text-center text-gray-600">
                <div className="text-5xl mb-2">🗣️</div>
                <div className="text-lg font-semibold">아래 버튼을 꾹 누르고 말씀하세요</div>
                <div className="text-sm mt-1">말씀을 마친 뒤 손을 떼면 번역 결과가 나타납니다</div>
                {isCruising && (
                  <div className="mt-4 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
                    ⛵ 현재 항해 중입니다. 기본 영어 번역 모드로 설정되어 있습니다.
                  </div>
                )}
                {!isCruising && destination !== '확인 중...' && destination !== '여행 미등록' && (
                  <div className="mt-4 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm">
                    🏝️ 오늘의 기항지 <b>{destination}</b>에 맞춰 {localLang.flag} {localLang.name} 번역이 준비되었습니다!
                  </div>
                )}
              </div>
            )}

            {items.map((it) => (
              <div key={it.id} className={`rounded-xl border p-4 shadow-sm ${it.isError ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
                <div className="text-xs text-gray-500 mb-2">{it.when} · {it.kind === 'photo' ? '📸 사진' : '🎤 음성'}{it.isError && <span className="ml-2 text-red-500">⚠️ 번역 오류</span>}</div>
                {/* 사진 번역 기능 제거됨 */}
                {it.kind === 'photo' ? null : (
                  /* 음성 번역: 원본 + 번역 함께 표시 */
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-gray-50 p-3">
                      <div className="text-xs text-gray-500 mb-1 flex items-center justify-between">
                        <span>{it.from.flag} {it.from.name}</span>
                        {/* 원문 재생 버튼 */}
                        {it.source && (
                          <button
                            onClick={() => speak(it.source, it.from.code || 'ko-KR')}
                            className="text-gray-500 hover:text-gray-700 active:scale-110 transition-all"
                            title={`${it.from.name}로 재생`}
                          >
                            🔊
                          </button>
                        )}
                      </div>
                      <div className="text-base">{it.source}</div>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-3">
                      <div className="text-xs text-blue-600 mb-1 flex items-center justify-between overflow-hidden">
                        <span className="min-w-0">{it.to.flag} {it.to.name}</span>
                        {/* 번역 결과 재생 버튼 */}
                        {it.translated && (
                          <button
                            onClick={() => speak(it.translated, it.to.code || 'en-US')}
                            className="text-blue-500 hover:text-blue-700 active:scale-110 transition-all flex-shrink-0"
                            title={`${it.to.name}로 재생`}
                          >
                            🔊
                          </button>
                        )}
                      </div>
                      <div className="text-base font-semibold break-words">{it.translated}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </main>

        {/* 하단 고정 버튼 — 컴팩트 (모바일 최적화) */}
        <footer className="flex-none border-t bg-white px-3 shadow-lg
          pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="max-w-3xl mx-auto pt-2 pb-1 grid grid-cols-2 gap-2">
            {BTN_PAIRS.map((p) => (
              <button
                key={p.label}
                onClick={async () => {
                  if (listening !== 'none') {
                    stopPressToTalk();
                  } else {
                    await startPressToTalk(p.from, p.to);
                  }
                }}
                className={`
                  w-full px-2 py-2.5 rounded-xl font-bold shadow min-h-[56px]
                  ${listening === 'recording'
                    ? 'bg-gradient-to-r from-red-600 to-red-500 text-white animate-pulse'
                    : listening === 'pressing'
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                    : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600'
                  }
                  active:scale-95 transition-all
                `}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xl">
                    {listening === 'recording' ? '🔴' : listening === 'pressing' ? '⏳' : '🎤'}
                  </span>
                  <div className="text-left">
                    <div className="font-bold text-xs leading-tight">{p.label}</div>
                    <div className="text-[10px] opacity-80 font-normal mt-0.5">
                      {listening === 'recording' ? '다시 누르면 번역' : '한 번 누르고 말하기'}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </footer>
      </div>
    </>
  );
} 