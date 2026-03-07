'use client';

import { logger } from '@/lib/logger';
import type { ChatInputMode } from '@/lib/types';
import dynamic from 'next/dynamic';
import { ChatInputPayload } from '@/components/chat/types';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, TextMessage } from '@/lib/chat-types';
import { ChatMessageSkeleton } from '@/components/ui/Skeleton';
import { csrfFetch } from '@/lib/csrf-client';
import tts, { extractPlainText } from '@/lib/tts';
import { checkTestModeClient } from '@/lib/test-mode-client';
import { showError } from '@/components/ui/Toast';

// 성능 최적화: 큰 컴포넌트들을 동적 임포트
const ChatWindow = dynamic(() => import('@/components/ChatWindow'), {
  loading: () => <ChatMessageSkeleton />,
  ssr: false,
});

const SuggestChips = dynamic(() => import('./suggestchips'), {
  ssr: false,
});

const InputBar = dynamic(() => import('./InputBar'), {
  ssr: false,
});

const DeleteChatHistoryModal = dynamic(() => import('./DeleteChatHistoryModal'), {
  ssr: false,
});

const ENABLE_CHAT_HISTORY = true; // 채팅 히스토리 활성화

export default function ChatClientShell({
  mode,
}: {
  mode: ChatInputMode;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true); // 초기 로딩 상태
  const [isSending, setIsSending] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOnline, setIsOnline] = useState(true); // 네트워크 상태
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null); // 스트리밍 AbortController
  const prevModeRef = useRef<ChatInputMode | null>(null); // 이전 모드 추적
  const hasLoadedHistoryRef = useRef(false); // 히스토리 로드 여부 추적
  const [isTestMode, setIsTestMode] = useState(false); // test 모드 여부
  const [keyboardPadding, setKeyboardPadding] = useState(0); // WO-MOB-10: iOS 소프트 키보드 높이

  // WO-MOB-10/11: visualViewport API — iOS에서 소프트 키보드 높이 감지 (rAF throttle + NaN 처리)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    let rafId: number | null = null;
    const handleResize = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const offsetTop = Number.isFinite(vv.offsetTop) ? vv.offsetTop : 0;
        const kbHeight = Math.max(0, window.innerHeight - vv.height - offsetTop);
        setKeyboardPadding(prev => prev === kbHeight ? prev : kbHeight);
      });
    };
    vv.addEventListener('resize', handleResize);
    return () => {
      vv.removeEventListener('resize', handleResize);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  // 네트워크 온/오프라인 감지
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    // 초기 상태 동기화
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // test 모드 확인
  useEffect(() => {
    const checkTestMode = async () => {
      try {
        const testModeInfo = await checkTestModeClient();
        setIsTestMode(testModeInfo.isTestMode);
      } catch (error) {
        logger.error('[ChatClientShell] Test mode check error:', error);
        setIsTestMode(false);
      }
    };
    checkTestMode();
  }, []);

  // 초기 마운트 시 채팅 히스토리 불러오기
  useEffect(() => {
    if (!ENABLE_CHAT_HISTORY) {
      setIsLoading(false);
      hasLoadedHistoryRef.current = true;
      return;
    }

    const loadChatHistory = async () => {
      if (hasLoadedHistoryRef.current) return; // 이미 로드했으면 스킵

      try {
        setIsLoading(true);
        // test 모드 확인
        const testModeInfo = await checkTestModeClient();
        const testSuffix = testModeInfo.isTestMode ? '_test' : '';

        // 모드별로 다른 sessionId 사용 (탭별 히스토리 분리 + test 모드 구분)
        const sessionId = (mode === 'general' ? 'general' :
          mode === 'go' ? 'go' :
            mode === 'show' ? 'show' :
              mode === 'translate' ? 'translate' : 'default') + testSuffix;

        const response = await fetch(`/api/chat/history?sessionId=${sessionId}`, {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.ok && Array.isArray(data.messages) && data.messages.length > 0) {
            // API 응답 형식을 ChatMessage 형식으로 변환
            const loadedMessages: ChatMessage[] = data.messages
              .filter((msg: any) => msg.role === 'user' || msg.role === 'assistant') // user/assistant만
              .map((msg: any) => ({
                id: msg.id || `${Date.now()}-${Math.random()}`,
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                type: msg.type || 'text',
                text: msg.text || msg.content || '',
                ...(msg.links && { links: msg.links }),
                ...(msg.images && { images: msg.images }),
                ...(msg.chips && { chips: msg.chips }),
              }));
            setMessages(loadedMessages);
            logger.log('[ChatClientShell] 히스토리 로드 완료:', loadedMessages.length, '개 메시지 (모드:', mode, ')');
          }
        }
      } catch (error) {
        logger.error('[ChatClientShell] 히스토리 로드 실패:', error);
      } finally {
        setIsLoading(false);
        hasLoadedHistoryRef.current = true;
      }
    };

    // 모든 모드에서 히스토리 로드 (탭별로 분리)
    loadChatHistory();
  }, [mode]);

  // 모드가 변경될 때마다 메시지 초기화 (새로운 대화 시작)
  useEffect(() => {
    // 첫 마운트가 아닐 때만 (즉, 모드가 실제로 변경되었을 때만) 메시지 초기화
    if (prevModeRef.current !== null && prevModeRef.current !== mode) {
      if (process.env.NODE_ENV === 'development') {
        logger.log('[ChatClientShell] Mode changed from', prevModeRef.current, 'to', mode, '- Clearing messages');
      }
      // 빈 상태 UI는 ChatWindow에서 처리하므로 메시지는 비워둠
      streamAbortRef.current?.abort(); // 진행 중인 스트리밍 취소
      setMessages([]);
      setIsSending(false);
      hasLoadedHistoryRef.current = false; // 모드 변경 시 히스토리 다시 로드 가능하도록
    }
    prevModeRef.current = mode;
  }, [mode]);

  // 메시지 저장 함수
  const saveChatHistory = async (messagesToSave: ChatMessage[]) => {
    if (!ENABLE_CHAT_HISTORY) return;
    try {
      // isTestMode state 직접 사용 (checkTestModeClient 불필요한 재호출 방지)
      const testSuffix = isTestMode ? '_test' : '';

      // 모드별로 다른 sessionId 사용 (탭별 히스토리 분리 + test 모드 구분)
      const sessionId = (mode === 'general' ? 'general' :
        mode === 'go' ? 'go' :
          mode === 'show' ? 'show' :
            mode === 'translate' ? 'translate' : 'default') + testSuffix;

      // ChatMessage 형식을 API 형식으로 변환 (최대 200개로 제한 — DB 비대화 방지)
      const apiMessages = messagesToSave.slice(-200).map(msg => {
        const base = {
          id: msg.id,
          role: msg.role,
          type: msg.type || 'text',
          text: msg.type === 'text' ? (msg.text || '') : '',
          timestamp: new Date().toISOString(),
        };

        // 타입별 속성 추가
        if (msg.type === 'map-links' && 'links' in msg) {
          return { ...base, links: msg.links };
        }
        if (msg.type === 'photo-gallery' && 'images' in msg) {
          return { ...base, images: msg.images };
        }
        // chips는 현재 타입에 없지만 API 호환성을 위해 any로 처리
        const msgAny = msg as any;
        if (msgAny.chips) {
          return { ...base, chips: msgAny.chips };
        }
        return base;
      });

      await fetch('/api/chat/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: apiMessages,
          sessionId, // 모드별 세션 ID
        }),
      });
    } catch (error) {
      logger.error('[ChatClientShell] 히스토리 저장 실패:', error);
    }
  };

  const onSend = useCallback(async (payload: ChatInputPayload) => {
    // 오프라인 상태 차단
    if (!navigator.onLine) {
      showError('인터넷 연결이 없습니다. 연결 후 다시 시도해주세요.');
      return;
    }

    // 사용자 메시지 추가
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      type: 'text',
      text: payload.text,
    };

    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setIsSending(true);

    try {
      const currentMode = payload.mode || mode;

      // 일반 대화 모드는 스트리밍 사용
      if (currentMode === 'general') {
        // 스트리밍 응답용 임시 메시지 생성
        const streamingMessageId = `streaming-${Date.now()}`;
        const streamingMessage: ChatMessage = {
          id: streamingMessageId,
          role: 'assistant',
          type: 'text',
          text: '',
        };

        setMessages((prevMessages) => [...prevMessages, streamingMessage]);

        // 이전 스트리밍 취소 후 새 AbortController 생성
        streamAbortRef.current?.abort();
        const abortCtrl = new AbortController();
        streamAbortRef.current = abortCtrl;

        // 스트리밍 API 호출
        const requestBody = {
          messages: [
            ...messages.map(m => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: (m.type === 'text' ? m.text : '') || '',
            })),
            { role: 'user', content: payload.text },
          ],
        };

        // 개발 환경에서만 디버그 로그
        if (process.env.NODE_ENV === 'development') {
          logger.log('[ChatClientShell] Sending request to /api/chat/stream:', {
            messageCount: requestBody.messages.length,
            lastMessage: requestBody.messages[requestBody.messages.length - 1]?.content?.substring(0, 50)
          });
        }

        // WO-MOB-16: 클라이언트 타임아웃 (해상 WiFi 끊김 무한 대기 방지)
        const connectTimeoutId = setTimeout(() => abortCtrl.abort(), 35000);
        try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: abortCtrl.signal,
          body: JSON.stringify(requestBody),
        });
        clearTimeout(connectTimeoutId); // 응답 도착 시 타임아웃 해제

        // 개발 환경에서만 디버그 로그
        if (process.env.NODE_ENV === 'development') {
          const responseHeaders: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });
          logger.log('[ChatClientShell] Response received:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            hasBody: !!response.body,
            headers: responseHeaders
          });
        }

        if (!response.ok) {
          clearTimeout(connectTimeoutId);
          // 에러 응답 처리
          let errorMessage = '응답을 받지 못했습니다';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.details || errorMessage;
            logger.error('[ChatClientShell] Stream API error:', errorData);
          } catch (e) {
            const errorText = await response.text().catch(() => '');
            errorMessage = errorText || errorMessage;
            logger.error('[ChatClientShell] Stream API error (text):', errorText);
          }

          // 스트리밍 메시지를 에러 메시지로 교체
          setMessages((prevMessages) =>
            prevMessages.map((msg) =>
              msg.id === streamingMessageId
                ? { ...msg, text: `❌ ${errorMessage}\n\n잠시 후 다시 시도해주세요.` }
                : msg
            )
          );
          setIsSending(false);
          return; // 에러 발생 시 함수 종료
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        // 스트리밍 응답 읽기
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';
        let clientBuffer = '';

        const isDev = process.env.NODE_ENV === 'development';
        if (isDev) {
          logger.log('[ChatClientShell] Starting stream read');
        }

        let readCount = 0;
        while (true) {
          if (abortCtrl.signal.aborted) break; // 언마운트/탭전환 시 루프 종료
          const { done, value } = await reader.read();
          readCount++;
          if (isDev) {
            logger.log('[ChatClientShell] Read #' + readCount + ', done:', done, 'hasValue:', !!value);
          }

          if (done) {
            if (isDev) {
              logger.log('[ChatClientShell] Stream done, total reads:', readCount, 'accumulated:', accumulatedText.substring(0, 100));
            }
            if (accumulatedText.length === 0) {
              // 에러는 항상 로깅
              logger.warn('[ChatClientShell] No text accumulated! This might indicate a server-side issue.');
              // 사용자에게 에러 메시지 표시
              setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                  msg.id === streamingMessageId
                    ? { ...msg, text: '죄송합니다. 응답을 받지 못했습니다. 잠시 후 다시 시도해주세요.' }
                    : msg
                )
              );
            }
            break;
          }

          if (!value) {
            if (isDev) {
              logger.warn('[ChatClientShell] No value in chunk, continuing...');
            }
            continue;
          }

          const chunk = decoder.decode(value, { stream: true });
          if (isDev) {
            logger.log('[ChatClientShell] Received chunk #' + readCount + ', length:', chunk.length, 'content:', chunk.substring(0, 200));
          }
          clientBuffer += chunk;
          const lines = clientBuffer.split('\n');
          clientBuffer = lines.pop() || ''; // 불완전 마지막 라인은 다음 청크로
          if (isDev) {
            logger.log('[ChatClientShell] Split into', lines.length, 'lines');
          }

          for (const line of lines) {
            if (line.startsWith('0:')) {
              // 텍스트 데이터 추출
              try {
                const jsonStr = line.substring(2).trim();
                const parsed = JSON.parse(jsonStr);
                if (isDev) {
                  logger.log('[ChatClientShell] Parsed text:', typeof parsed, parsed?.substring?.(0, 50));
                }

                if (parsed && typeof parsed === 'string') {
                  accumulatedText += parsed;

                  // 메시지 업데이트
                  setMessages((prevMessages) =>
                    prevMessages.map((msg) =>
                      msg.id === streamingMessageId
                        ? { ...msg, text: accumulatedText }
                        : msg
                    )
                  );
                } else {
                  if (isDev) {
                    logger.warn('[ChatClientShell] Parsed value is not a string:', typeof parsed, parsed);
                  }
                }
              } catch (e) {
                // 에러는 항상 로깅
                logger.error('[ChatClientShell] JSON parse error:', e, 'line:', line.substring(0, 100));
              }
            } else if (line.trim() && isDev) {
              logger.log('[ChatClientShell] Non-matching line:', line.substring(0, 100));
            }
          }
        }

        // 스트리밍 완료 후 최종 메시지 ID 업데이트 및 히스토리 저장 (언마운트 시 스킵)
        if (!abortCtrl.signal.aborted) {
          const finalId = Date.now().toString();
          setMessages((prevMessages) => {
            const updated = prevMessages.map((msg) =>
              msg.id === streamingMessageId
                ? { ...msg, id: finalId }
                : msg
            );
            return updated;
          });

          // 히스토리 저장은 useEffect([messages]) debounce가 자동 처리
        }

        // TTS: 스트리밍 완료 후 AI 응답을 음성으로 읽기 (언마운트/탭전환 시 차단)
        if (!abortCtrl.signal.aborted && accumulatedText && tts.getEnabled()) {
          const plainText = extractPlainText(accumulatedText);
          tts.speak(plainText);
        }
        } finally {
          clearTimeout(connectTimeoutId); // throw 경로 포함 모든 경로에서 타임아웃 해제
        }
      } else {
        // 다른 모드는 기존 API 사용 (구조화된 응답)
        streamAbortRef.current?.abort();
        const abortCtrl = new AbortController();
        streamAbortRef.current = abortCtrl;
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: abortCtrl.signal,
          body: JSON.stringify({
            text: payload.text,
            mode: currentMode,
            from: payload.from,
            to: payload.to,
          }),
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized');
          }
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        // 개발 환경에서만 디버그 로그
        if (process.env.NODE_ENV === 'development') {
          logger.log('[ChatClientShell] API Response:', {
            ok: data.ok,
            messagesCount: data.messages?.length,
            messages: data.messages
          });

          // 디버그: show-me 메시지의 subfolders 확인
          if (data.messages && Array.isArray(data.messages)) {
            data.messages.forEach((msg: any, idx: number) => {
              if (msg.type === 'show-me') {
                logger.log(`[ChatClientShell] Message ${idx} (show-me):`, {
                  id: msg.id,
                  query: msg.query,
                  hasSubfolders: !!msg.subfolders,
                  subfoldersCount: msg.subfolders?.length || 0,
                  subfolders: msg.subfolders?.map((s: any) => s.displayName) || [],
                  categoriesCount: msg.categories?.length || 0,
                  cruisePhotosCount: msg.cruisePhotos?.length || 0,
                });
              }
            });
          }
        }

        if (data.ok && Array.isArray(data.messages)) {
          setMessages((prevMessages) => [...prevMessages, ...data.messages]);

          // TTS: AI 응답 음성 재생 (텍스트 타입 메시지만, 사용자 설정 확인)
          if (tts.getEnabled()) {
            const textMessages = data.messages.filter((msg: ChatMessage): msg is TextMessage =>
              msg.role === 'assistant' && msg.type === 'text'
            );
            if (textMessages.length > 0) {
              const combinedText = textMessages.map((msg: TextMessage) => msg.text).join(' ');
              const plainText = extractPlainText(combinedText);
              tts.speak(plainText);
            }
          }
        } else {
          const errorMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            type: 'text',
            text: '죄송합니다. 응답을 처리하는 중 오류가 발생했어요.',
          };
          setMessages((prevMessages) => [...prevMessages, errorMessage]);
        }
      }
    } catch (error) {
      // AbortError: 사용자가 취소하거나 새 요청이 시작된 경우 - 에러 표시 안 함
      if (error instanceof Error && error.name === 'AbortError') {
        setMessages((prevMessages) => {
          const hasStreaming = prevMessages.some(msg => msg.id.startsWith('streaming-'));
          if (!hasStreaming) return prevMessages;
          return prevMessages.map(msg =>
            msg.id.startsWith('streaming-')
              ? { ...msg, text: '⏱️ 응답 시간이 초과되었습니다. 다시 시도해주세요.' }
              : msg
          );
        });
        setIsSending(false);
        return;
      }

      logger.error('[ChatClientShell] Error sending message:', error);

      // 오프라인 상태면 간결한 메시지
      if (!navigator.onLine) {
        setMessages((prevMessages) => {
          const hasStreamingMessage = prevMessages.some(msg => msg.id.startsWith('streaming-'));
          if (hasStreamingMessage) {
            return prevMessages.map(msg =>
              msg.id.startsWith('streaming-') ? { ...msg, text: '📡 오프라인 상태입니다. 연결 후 다시 시도해주세요.' } : msg
            );
          }
          return [...prevMessages, { id: Date.now().toString(), role: 'assistant' as const, type: 'text' as const, text: '📡 오프라인 상태입니다. 연결 후 다시 시도해주세요.' }];
        });
        setIsSending(false);
        return;
      }

      // 에러 타입에 따라 다른 메시지 표시
      let errorText = '네트워크 오류가 발생했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';

      if (error instanceof Error) {
        if (error.message.includes('Unauthorized') || error.message.includes('401')) {
          errorText = '로그인이 필요합니다. 다시 로그인해주세요.';
        } else if (error.message.includes('404') || error.message.includes('모델을 찾을 수 없습니다')) {
          errorText = '서버 설정 오류가 발생했습니다. 관리자에게 문의해주세요.';
        } else if (error.message.includes('500') || error.message.includes('Server')) {
          errorText = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else if (error.message) {
          errorText = `오류: ${error.message}`;
        }
      }

      // 스트리밍 메시지가 있으면 교체, 없으면 새로 추가
      setMessages((prevMessages) => {
        const hasStreamingMessage = prevMessages.some(msg => msg.id.startsWith('streaming-'));
        if (hasStreamingMessage) {
          return prevMessages.map((msg) =>
            msg.id.startsWith('streaming-')
              ? { ...msg, text: `❌ ${errorText}` }
              : msg
          );
        } else {
          const errorMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            type: 'text',
            text: `❌ ${errorText}`,
          };
          return [...prevMessages, errorMessage];
        }
      });
    } finally {
      setIsSending(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, messages, isTestMode, isSending]);

  // 채팅 기록 삭제 함수
  const handleDeleteChatHistory = async () => {
    setIsDeleting(true);

    try {
      // 현재 탭의 sessionId 계산 (isTestMode state 사용)
      const testSuffix = isTestMode ? '_test' : '';
      const sessionId = (mode === 'general' ? 'general' :
        mode === 'go' ? 'go' :
          mode === 'show' ? 'show' :
            mode === 'translate' ? 'translate' : 'default') + testSuffix;

      const response = await fetch(`/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setMessages([]);
        setIsDeleteModalOpen(false);
        if (process.env.NODE_ENV === 'development') {
          logger.log('채팅 기록이 삭제되었습니다.');
        }
      } else {
        logger.error('Failed to delete chat history:', response.statusText);
        showError('채팅 기록 삭제에 실패했습니다. 다시 시도해 주세요.');
      }
    } catch (error) {
      logger.error('Error deleting chat history:', error);
      showError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 채팅 기록 자동 복원 비활성화 - 새로운 화면으로 시작
  // useEffect(() => {
  //   const loadChatHistory = async () => {
  //     try {
  //       setIsLoading(true);
  //       const response = await csrfFetch('/api/chat/history', {
  //         method: 'GET',
  //         credentials: 'include',
  //       });

  //       if (response.ok) {
  //         const data = await response.json();
  //         if (data.ok && Array.isArray(data.messages) && data.messages.length > 0) {
  //           logger.log('[ChatClientShell] 채팅 히스토리 복원:', data.messages.length, '개 메시지');
  //           setMessages(data.messages);
  //         } else {
  //           logger.log('[ChatClientShell] 저장된 채팅 히스토리가 없습니다.');
  //         }
  //       } else {
  //         console.error('Failed to load chat history:', response.statusText);
  //       }
  //     } catch (error) {
  //       console.error('Error loading chat history:', error);
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   };

  //   loadChatHistory();
  // }, []); // 빈 의존성 배열: 컴포넌트 마운트 시 한 번만 실행

  // 채팅 기록 저장하기 (messages 변경 시 자동 저장, debounce 적용)
  useEffect(() => {
    // 로딩 중이거나 메시지가 비어있으면 저장하지 않음
    if (isLoading || messages.length === 0) return;

    // 이전 타이머가 있으면 취소
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 1초 후에 저장 (debounce) — saveChatHistory 재사용으로 sessionId 자동 포함
    saveTimeoutRef.current = setTimeout(() => {
      saveChatHistory(messages);
    }, 1000); // 1초 debounce

    // 클린업: 컴포넌트 언마운트 시 타이머 정리
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [messages, isLoading, mode]); // messages나 mode가 변경될 때마다 실행

  // 언마운트 시 진행 중인 스트리밍 취소
  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* 오프라인 배너 */}
      {!isOnline && (
        <div className="fixed top-12 left-0 right-0 z-40 bg-yellow-500 text-white text-center text-sm py-2 px-4 font-semibold">
          📡 인터넷 연결이 끊겼습니다. 연결 후 자동으로 복구됩니다.
        </div>
      )}
      {isLoading ? (
        <div className="flex items-center justify-center" style={{ minHeight: '60dvh' }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">대화 내역을 불러오는 중...</p>
          </div>
        </div>
      ) : (
        <>
          <ChatWindow messages={messages} mode={mode} onSend={onSend} />

          {/* 하위 폴더 버튼들 - 최근 show-me 메시지의 하위 폴더 표시 */}
          {mode === 'show' && (() => {
            // 가장 최근의 show-me 타입 메시지 찾기
            const showMeMessages = messages.filter((msg) => msg.type === 'show-me');
            if (process.env.NODE_ENV === 'development') {
              logger.log('[ChatClientShell] Show-me messages:', showMeMessages.length, showMeMessages);
            }

            const latestShowMeMessage = [...showMeMessages].reverse().find(
              (msg) => {
                const showMeMsg = msg as ChatMessage & { subfolders?: Array<{ name: string; displayName: string; icon: string; photoCount: number }> };
                const hasSubfolders = showMeMsg.subfolders && showMeMsg.subfolders.length > 0;
                if (process.env.NODE_ENV === 'development') {
                  logger.log('[ChatClientShell] Checking message:', {
                    id: showMeMsg.id,
                    type: showMeMsg.type,
                    hasSubfolders,
                    subfoldersCount: showMeMsg.subfolders?.length || 0
                  });
                }
                return hasSubfolders;
              }
            ) as ChatMessage & { subfolders?: Array<{ name: string; displayName: string; icon: string; photoCount: number }> };

            if (process.env.NODE_ENV === 'development') {
              logger.log('[ChatClientShell] Latest show-me message with subfolders:', latestShowMeMessage ? {
                id: latestShowMeMessage.id,
                subfoldersCount: latestShowMeMessage.subfolders?.length,
                subfolders: latestShowMeMessage.subfolders?.map(s => s.displayName)
              } : 'not found');
            }

            if (!latestShowMeMessage) return null;

            return (
              <div className="px-3 pt-3 pb-2 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center gap-2 text-base font-bold mb-2">
                  <span>📁</span>
                  <span>하위 폴더에서 더 찾아보기</span>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-2">
                  {latestShowMeMessage.subfolders!.slice(0, 10).map((subfolder, idx) => (
                    <button
                      key={idx}
                      onClick={async () => {
                        // 하위 폴더 클릭 시 해당 폴더의 사진을 검색하여 메시지로 전송
                        const searchQuery = subfolder.name.split('/').pop() || subfolder.displayName;
                        const payload: ChatInputPayload = {
                          text: searchQuery,
                          mode: 'show',
                          from: '',
                          to: '',
                        };
                        await onSend(payload);
                      }}
                      className="
                        flex flex-col items-center justify-center gap-1
                        px-3 py-3
                        bg-white
                        border-2 border-[#051C2C]/20
                        rounded-lg
                        shadow-sm
                        hover:shadow-lg
                        hover:border-[#FDB931]
                        text-sm font-bold
                        min-h-[80px]
                        active:scale-95
                        transition-all
                      "
                    >
                      <span className="text-2xl">{subfolder.icon}</span>
                      <span className="text-center leading-tight text-xs">{subfolder.displayName}</span>
                      <span className="text-[10px] text-gray-600 font-normal">
                        {subfolder.photoCount}장
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="px-3 pt-2 bg-white border-t" style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom) + ${keyboardPadding}px)` }}>
            <InputBar mode={mode} onSend={onSend} disabled={isSending} />
            {isSending && (
              <div className="text-center text-sm text-gray-500 mt-2">
                <span className="inline-flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  응답을 기다리는 중...
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* 삭제 확인 모달 */}
      <DeleteChatHistoryModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteChatHistory}
        isDeleting={isDeleting}
      />
    </div>
  );
}