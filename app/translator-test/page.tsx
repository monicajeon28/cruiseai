'use client';

import { logger } from '@/lib/logger';
import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { FiArrowLeft, FiMic, FiMicOff } from 'react-icons/fi';
import { csrfFetch } from '@/lib/csrf-client';
import { showError } from '@/components/ui/Toast';
import { PHRASE_CATEGORIES_DATA } from './PHRASE_CATEGORIES_DATA';
import { trackFeature } from '@/lib/analytics';
import TutorialCountdown from '@/app/chat/components/TutorialCountdown';
import { checkTestModeClient, TestModeInfo, getCorrectPath } from '@/lib/test-mode-client';
import { clearAllLocalStorage } from '@/lib/csrf-client';

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
      const response = await csrfFetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        clearAllLocalStorage();
        window.location.href = '/login-test';
      } else {
        showError('로그아웃에 실패했습니다. 다시 시도해주세요.');
      }
    } catch {
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

  // 마이크 권한 상태 (null=미확인, true=허용, false=거부)
  const micPermissionRef = useRef<boolean | null>(null);

  // 기본 현지어는 영어(US)로 시작(API 로드 후 교체)
  const [localLang, setLocalLang] = useState({ code: 'en-US', name: '영어', flag: '🇺🇸' });
  const [destination, setDestination] = useState<string>('확인 중...');
  const [portInfo, setPortInfo] = useState<string>('');
  const [isCruising, setIsCruising] = useState(false);

  // 튜토리얼 표시 (페이지 진입 시마다 항상 표시)
  useEffect(() => {
    const tutorialTimer = setTimeout(() => {
      setShowTutorial(true);
      setTutorialStep(0);
    }, 1000);
    return () => clearTimeout(tutorialTimer);
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
    try {
      // 최대 100개만 저장 (QuotaExceededError 방지)
      const toSave = items.slice(-100);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // QuotaExceededError: 절반 삭제 후 재시도
      try {
        const half = items.slice(-50);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(half));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [items]);

  // 음성 인식 객체
  const recRef = useRef<SpeechRecognition | null>(null);
  const isProcessingRef = useRef(false); // race condition 방지
  const isListeningRef = useRef(false); // 버튼 눌림 상태 추적용 (iOS continuous 워크어라운드)
  const interimTextRef = useRef(''); // stale closure 방지용 ref
  const currentAudioRef = useRef<HTMLAudioElement | null>(null); // 중복 재생 방지
  const audioCtxRef = useRef<AudioContext | null>(null); // iOS AudioContext 잠금 해제용
  const sourceRef = useRef<AudioBufferSourceNode | null>(null); // AudioContext 재생 중 중단용
  const [listening, setListening] = useState<'none' | 'pressing' | 'recording'>('none');
  const [preview, setPreview] = useState('');
  const [finalText, setFinalText] = useState(''); // 최종 확정된 텍스트
  const [interimText, setInterimText] = useState(''); // 인식 중인 텍스트 (실시간 업데이트)
  const [isSpeaking, setSpeaking] = useState(false); // TTS 재생 중 상태
  const audioBufferCache = useRef<Map<string, AudioBuffer>>(new Map()); // TTS AudioBuffer 캐시
  const ttsAbortCtrl = useRef<AbortController | null>(null); // TTS 이전 요청 취소용

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
      setListening('none');
      const errorType = e?.error || 'unknown';
      if (errorType === 'no-speech') return;
      if (errorType === 'not-allowed' || errorType === 'service-not-allowed') {
        micPermissionRef.current = false;
        showError('마이크 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해주세요.');
        return;
      }
      if (errorType === 'network') {
        showError('네트워크 오류로 음성 인식에 실패했습니다.');
        return;
      }
      logger.warn('[STT] error:', errorType);
    };
    recog.onend = () => {
      if (isListeningRef.current && !isProcessingRef.current) {
        // 버튼 아직 눌려있음 → iOS continuous 끊김 → 재시작
        try {
          recog.start();
          logger.debug('[PTT] iOS continuous workaround: restarting recognition');
        } catch (e) {
          // 이미 시작된 경우 무시
          logger.debug('[PTT] Recognition restart skipped:', e);
          isListeningRef.current = false;
          setListening('none');
        }
      } else {
        setListening('none');
        setPreview('');
        setFinalText('');
        setInterimText('');
      }
    };

    recRef.current = recog;

    return () => {
      isListeningRef.current = false;
      try { recog.abort(); } catch { }
      recRef.current = null;
    };
  }, []);

  // speechSynthesis + AudioContext + Audio cleanup
  useEffect(() => {
    return () => {
      ttsAbortCtrl.current?.abort();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      currentAudioRef.current?.pause();
      currentAudioRef.current = null;
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
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

      // [Pronunciation] Calling API (dev-only logging removed)
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
          // retrying pronunciation
          await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1))); // 지수 백오프
          return getPronunciation(foreignText, langCode, useCache, retryCount + 1);
        }

        return '';
      }

      const data = await res.json();
      // API response logged removed (sensitive data)

      if (!data.ok) {
        logger.error('[Pronunciation] API returned error:', data.error);

        // 재시도 (최대 2번)
        if (retryCount < 2) {
          // retrying after error
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
          // retrying after empty response
          await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1)));
          return getPronunciation(foreignText, langCode, useCache, retryCount + 1);
        }

        return '';
      }

      // 이미 괄호가 포함되어 있으면 그대로 사용
      if (pronunciation && !pronunciation.trim().startsWith('(')) {
        pronunciation = `(${pronunciation.trim()})`;
      }

      // pronunciation resolved

      // 캐시에 저장
      if (useCache && pronunciation) {
        setPronunciationCache(prev => {
          const newCache = { ...prev, [cacheKey]: pronunciation };
          // cache updated
          return newCache;
        });
      }

      return pronunciation;
    } catch (error: any) {
      logger.warn('[Pronunciation] Error:', error);

      // 재시도 (최대 2번)
      if (retryCount < 2) {
        // retrying after exception
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

      // user input text logging removed for privacy

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
        return { translated: text, pronunciation: '' };
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

  // Web Speech API fallback (Supertone 미지원 언어 또는 실패 시)
  function speakWebSpeech(text: string, langCode: string) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = langCode;
    u.rate = 0.9;
    u.onend = () => { setSpeaking(false); };
    u.onerror = (e: SpeechSynthesisErrorEvent) => {
      if (e.error !== 'interrupted') logger.warn('[TTS] WebSpeech error:', e.error);
      setSpeaking(false);
    };
    const assignVoiceAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const baseLang = langCode.split('-')[0];
        const matched =
          voices.find((v) => v.lang.startsWith(baseLang) && v.localService) ||
          voices.find((v) => v.lang.startsWith(baseLang));
        if (matched) u.voice = matched;
      }
      window.speechSynthesis.speak(u);
    };
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.addEventListener('voiceschanged', assignVoiceAndSpeak, { once: true });
    } else {
      assignVoiceAndSpeak();
    }
  }

  // 말하기(TTS) — Supertone(한/영/일) + Web Speech API fallback(기타 언어)
  // P1-2: isSpeaking state + AudioBuffer 캐시 + AbortController + iOS AudioContext 잠금 해제
  async function speak(text: string, langCode: string) {
    if (!text?.trim()) return;
    setSpeaking(true);

    ttsAbortCtrl.current?.abort();
    ttsAbortCtrl.current = new AbortController();

    if (sourceRef.current) { try { sourceRef.current.stop(); } catch { } sourceRef.current = null; }
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (AudioContextClass && !audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      const cacheKey = `${langCode}:${text.trim().slice(0, 150)}`;
      let audioBuffer = audioBufferCache.current.get(cacheKey);

      if (!audioBuffer) {
        const res = await csrfFetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text.trim(), langCode }),
          signal: ttsAbortCtrl.current.signal,
        });
        if (res.status === 204) { speakWebSpeech(text, langCode); return; }
        if (!res.ok) throw new Error(`TTS API ${res.status}`);

        const arrayBuffer = await res.arrayBuffer();

        if (audioCtxRef.current) {
          audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
          // LRU: 캐시 최대 50개 제한 (메모리 누수 방지)
          if (audioBufferCache.current.size >= 50) {
            const firstKey = audioBufferCache.current.keys().next().value;
            if (firstKey) audioBufferCache.current.delete(firstKey);
          }
          audioBufferCache.current.set(cacheKey, audioBuffer);
        } else {
          // AudioContext 미지원 환경 — HTMLAudioElement fallback
          const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          currentAudioRef.current = audio;
          // 핸들러를 play() 이전에 등록 → race condition 방지 (짧은 오디오에서 ended가 먼저 발생 가능)
          await new Promise<void>((resolve, reject) => {
            audio.onended = () => {
              URL.revokeObjectURL(url);
              if (currentAudioRef.current === audio) currentAudioRef.current = null;
              resolve();
            };
            audio.onerror = () => {
              URL.revokeObjectURL(url);
              if (currentAudioRef.current === audio) currentAudioRef.current = null;
              speakWebSpeech(text, langCode);
              resolve(); // fallback 실행 후 resolve (setSpeaking은 finally에서 처리)
            };
            audio.play().catch(reject); // play 실패 시 catch 블록으로 전달
          });
          return;
        }
      }

      if (!audioCtxRef.current || !audioBuffer) { speakWebSpeech(text, langCode); return; }

      const source = audioCtxRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtxRef.current.destination);
      sourceRef.current = source;
      source.start(0);
      await Promise.race([
        new Promise<void>(resolve => { source.onended = () => resolve(); }),
        new Promise<void>(resolve => setTimeout(resolve, (audioBuffer.duration + 2) * 1000)),
      ]);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      logger.error('[TTS] speak 오류:', e);
      currentAudioRef.current = null;
      speakWebSpeech(text, langCode);
    } finally {
      setSpeaking(false);
      sourceRef.current = null;
    }
  }

  // 공통 음성 인식 시작(길게 누르는 동안)
  async function startPressToTalk(from: { code: string; name: string; flag: string }, to: { code: string; name: string; flag: string }) {
    isListeningRef.current = true; // iOS continuous 워크어라운드: 버튼 눌림 상태 기록
    // P1-4: PTT onTouchStart 제스처 컨텍스트에서 AudioContext 미리 잠금 해제
    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (AudioContextClass && !audioCtxRef.current) audioCtxRef.current = new AudioContextClass();
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
    } catch { }
    if (!recRef.current) {
      showError('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome, Edge, Safari 등을 사용해주세요.');
      isListeningRef.current = false;
      return;
    }

    // P1-1: 이미 권한 허용된 경우 getUserMedia 건너뛰고 바로 시작
    if (micPermissionRef.current === true) {
      setListening('pressing');
      setPreview('마이크 준비 중...');
      setFinalText('');
      setInterimText('');
      try { recRef.current.abort?.(); } catch { }
    } else {
      try {
        recRef.current.abort?.();
      } catch (e) {
        logger.error("Error aborting speech recognition:", e);
      }
      setListening('pressing');
      setPreview('마이크 준비 중...');
      setFinalText('');
      setInterimText('');
    }

    // ⚡ Speech Recognition 시작 (getUserMedia 별도 호출 제거 — iOS 이중 권한 프롬프트 방지)
    try {
      // Speech Recognition 시작
      const r = recRef.current!;
      if (!r) {
        showError('음성 인식 초기화에 실패했습니다.');
        setListening('none');
        setPreview('');
        isListeningRef.current = false;
        return;
      }

      // 음성 인식 언어 설정
      r.lang = from.code;

      let accumulatedFinalText = '';

      r.onstart = () => {
        micPermissionRef.current = true; // 권한 허용 확인 — 다음 호출부터 재확인 불필요
        setPreview('말씀하세요...');
      };

      r.onresult = (e: SpeechRecognitionEvent) => {
        let newFinalText = accumulatedFinalText;
        let newInterimText = '';

        // P2-5: resultIndex 보정 (Safari/Firefox 호환성)
        const startIdx = Math.max(e.resultIndex, 0);
        for (let i = startIdx; i < e.results.length; i++) {
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
        const errorType = e?.error ?? 'unknown';
        if (errorType === 'no-speech') {
          setListening('none');
          setPreview('');
          return;
        }
        if (errorType === 'not-allowed' || errorType === 'permission-denied') {
          micPermissionRef.current = false;
          showError('마이크 권한이 필요합니다. 브라우저 설정에서 허용해주세요.');
        } else {
          logger.warn('[STT] 음성인식 오류:', errorType);
        }
        setListening('none');
        setPreview('');
      };

      // 음성 인식 시작
      try {
        r.start();
      } catch (startError: any) {
        if (startError?.name === 'NotAllowedError' || startError?.message?.includes('permission')) {
          micPermissionRef.current = false;
          showError('마이크 권한이 필요합니다. 브라우저 설정에서 허용해주세요.');
        } else {
          logger.warn('[Speech Recognition Start]', startError);
        }
        setListening('none');
        setPreview('');
        isListeningRef.current = false;
        return;
      }

      // 손을 떼면 stopListening 호출에서 번역/추가
      (r as any).__translatePair = { from, to };
      (r as any).__acc = () => {
        const combined = (accumulatedFinalText + ' ' + (interimTextRef.current || '')).trim();
        return combined || accumulatedFinalText.trim();
      };

    } catch (error: any) {
      logger.error('[Start Speech Recognition Error]', error);
      setListening('none');
      setPreview('');
      isListeningRef.current = false;

      if (error?.name === 'NotAllowedError' || error?.message?.includes('permission')) {
        micPermissionRef.current = false;
        showError('마이크 권한이 필요합니다. 브라우저 설정에서 허용해주세요.');
      } else {
        logger.error('[Speech Recognition] Unexpected error:', error);
      }
    }
  }

  async function stopPressToTalk() {
    isListeningRef.current = false; // iOS continuous 워크어라운드: 버튼 뗌 상태 기록
    if (isProcessingRef.current) return; // 중복 실행 방지
    isProcessingRef.current = true;

    // CRITICAL-3 iOS: gesture context에서 AudioContext 즉시 resume
    try {
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
    } catch { }

    const r: any = recRef.current;
    if (!r) { isProcessingRef.current = false; return; }
    try {
      r.stop();
    } catch { }
    setListening('none');
    const pair = r.__translatePair as { from: any; to: any } | undefined;
    const acc = typeof r.__acc === 'function' ? r.__acc() : '';

    // 최종 텍스트가 있으면 사용, 없으면 상태에서 가져오기
    const finalAcc = acc || (finalText + ' ' + interimText).trim();

    // 상태 초기화
    setPreview('');
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
        await speak(translated, pair.to.code); // P1-3: await 추가
      }
    } catch (error) {
      logger.error('[stopPressToTalk] Unexpected error:', error);
    } finally {
      isProcessingRef.current = false; // 예외 여부와 무관하게 항상 해제
    }
  }


  // 언어 이름을 한국어에서 영어로 변환 (API 호출용) - API와 동일한 매핑 사용
  function getEnglishLanguageName(koreanName: string): string {
    const languageMap: Record<string, string> = {
      '한국어': 'Korean',
      '영어': 'English',
      '일본어': 'Japanese',
      '중국어': 'Simplified Chinese',
      '광둥어': 'Cantonese',
      '대만어': 'Traditional Chinese',
      '태국어': 'Thai',
      '베트남어': 'Vietnamese',
      '인도네시아어': 'Indonesian',
      '말레이어': 'Malay',
      '프랑스어': 'French',
      '이탈리아어': 'Italian',
      '스페인어': 'Spanish',
      '독일어': 'German',
      '러시아어': 'Russian',
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
      <div className="text-xs text-gray-500 italic mt-1">
        💬 {pronunciation}
      </div>
    );
  }

  // 카테고리별 빠른 문장 데이터 (50대 이상 사용자 친화적)
  type PhraseCategory = {
    id: string;
    name: string;
    emoji: string;
    phrases: Array<{ ko: string; target: string; pronunciation?: string; emoji: string }>;
  };

  // 사용자가 제공한 샘플 데이터 사용 (발음 포함)
  const PHRASE_CATEGORIES: Record<string, PhraseCategory[]> = PHRASE_CATEGORIES_DATA as Record<string, PhraseCategory[]>;
  // 빠른 문장 데이터 (자주 쓰는 문장) - 하위 호환을 위해 유지
  const QUICK_PHRASES: Record<string, Array<{ ko: string; target: string; emoji: string }>> = {
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

      <div className="min-h-[100dvh] bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 text-gray-900 flex flex-col">
        {/* 헤더 */}
        <header className="sticky top-0 z-20 border-b-2 border-purple-200 bg-white/95 backdrop-blur shadow-md px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <button
              onClick={() => router.push('/tools-test')}
              className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-semibold border-2 border-purple-200 px-4 py-3 rounded-lg hover:bg-purple-50 transition-colors text-base md:text-lg"
              style={{ minHeight: '56px' }}
            >
              <FiArrowLeft size={24} />
              <span className="text-base md:text-lg">뒤로가기</span>
            </button>
            <div className="flex-1 text-center">
              <div className="flex items-center justify-center gap-3">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-2xl md:text-3xl">🌐</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent leading-tight">
                  AI 통번역기
                </h1>
              </div>
              <p className="text-sm md:text-base text-gray-500 mt-2 leading-relaxed">72시간 무료 체험</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2 min-h-[44px] rounded-md shrink-0"
            >
              로그아웃
            </button>
          </div>
          <div className="max-w-3xl mx-auto mt-3 flex flex-col sm:flex-row sm:items-center gap-3 text-base md:text-lg">
            <div className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-lg ${isCruising ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
              }`}>
              <span className="text-2xl">{isCruising ? '⛵' : '🏝️'}</span>
              <span className="font-semibold leading-relaxed">
                {isCruising ? '항해 중' : `현재 기항지: ${destination}`}
              </span>
            </div>
            {/* 언어 선택 드롭다운 */}
            <div className="relative">
              <select
                value={localLang.code}
                onChange={(e) => {
                  const selectedCode = e.target.value;
                  const selectedLang = Object.values(DESTINATION_LANGUAGE_MAP).find(lang => lang.code === selectedCode)
                    || { code: 'en-US', name: '영어', flag: '🇺🇸' };
                  setLocalLang(selectedLang);
                  setSelectedCategory(null); // 언어 변경 시 카테고리 초기화
                }}
                className="
                inline-flex items-center gap-2 px-3 py-1.5 rounded-lg 
                bg-purple-50 text-purple-700 font-semibold
                border-2 border-purple-200
                hover:border-purple-400 focus:border-purple-500
                cursor-pointer appearance-none
                pr-8 min-w-[140px]
              "
              >
                {Object.values(DESTINATION_LANGUAGE_MAP).map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
              <span className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none text-purple-700">
                ▼
              </span>
            </div>
            {portInfo && (
              <div className="text-xs text-gray-500">
                {portInfo}
              </div>
            )}
          </div>
        </header>

        {/* 본문 */}
        <main className="max-w-3xl mx-auto w-full flex-1 overflow-y-auto overscroll-contain min-h-0 px-4 py-4">
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
                {(PHRASE_CATEGORIES[localLang.code] || PHRASE_CATEGORIES['en-US'] || []).map((category) => (
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
                  {((PHRASE_CATEGORIES[localLang.code] || PHRASE_CATEGORIES['en-US'] || []).find(c => c.id === selectedCategory)?.phrases || []).map((phrase, idx) => (
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

        {/* 하단 고정 버튼들(모바일에 최적) - 크기 조정 */}
        <footer className="sticky bottom-0 z-20 border-t bg-white px-4" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="max-w-3xl mx-auto py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {BTN_PAIRS.map((p) => (
              <button
                key={p.label}
                style={{ touchAction: 'none' }}
                onPointerDown={() => { startPressToTalk(p.from, p.to); }}
                onPointerUp={stopPressToTalk}
                onPointerCancel={stopPressToTalk}
                className={`
                w-full px-4 py-4 rounded-xl text-lg font-bold shadow-lg
                min-h-[72px] md:min-h-[100px]
                ${listening === 'recording'
                    ? 'bg-gradient-to-r from-red-600 to-red-500 text-white animate-pulse'
                    : listening === 'pressing'
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                    : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600'
                  }
                active:scale-95 transition-all
              `}
              >
                <div className="flex flex-col items-center gap-2">
                  <span className="text-3xl">
                    {listening === 'recording' ? '🔴' : listening === 'pressing' ? '⏳' : '🎤'}
                  </span>
                  <span className="text-lg">{p.label}</span>
                  <span className="text-xs font-normal opacity-90">
                    {listening === 'recording' ? '(다시 누르면 번역됩니다)' : '(한 번 누르고 말하세요)'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </footer>
      </div>
    </>
  );
} 