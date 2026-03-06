'use client';

import { logger } from '@/lib/logger';
import { showError } from '@/components/ui/Toast';
import type { ChatInputMode } from '@/lib/types';
import dynamic from 'next/dynamic';
import { ChatInputPayload } from '@/components/chat/types';
import { useState, useEffect, useRef } from 'react';
import { ChatMessage, TextMessage } from '@/lib/chat-types';
import { ChatMessageSkeleton } from '@/components/ui/Skeleton';
import { csrfFetch } from '@/lib/csrf-client';
import tts, { extractPlainText } from '@/lib/tts';
import { checkTestModeClient } from '@/lib/test-mode-client';

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
  scrollable = false,
}: {
  mode: ChatInputMode;
  scrollable?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true); // 초기 로딩 상태
  const [isSending, setIsSending] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevModeRef = useRef<ChatInputMode | null>(null); // 이전 모드 추적
  const hasLoadedHistoryRef = useRef(false); // 히스토리 로드 여부 추적
  const abortControllerRef = useRef<AbortController | null>(null); // 히스토리 fetch 취소용
  const streamAbortControllerRef = useRef<AbortController | null>(null); // 스트리밍 취소용
  const [isTestMode, setIsTestMode] = useState(false); // test 모드 여부

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

      // 이전 요청이 진행 중이면 취소 (모드 전환 레이스 컨디션 방지)
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // 5초 타임아웃
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // AbortError 여부 추적 (finally에서 조건부 처리를 위해)
      let isAborted = false;

      try {
        setIsLoading(true);
        // test 모드 확인
        const testModeInfo = await checkTestModeClient();
        // checkTestModeClient 완료 후 abort 여부 확인 (모드 전환 시 이후 fetch 방지)
        if (controller.signal.aborted) {
          isAborted = true;
          return;
        }
        const testSuffix = testModeInfo.isTestMode ? '_test' : '';

        // 모드별로 다른 sessionId 사용 (탭별 히스토리 분리 + test 모드 구분)
        const sessionId = (mode === 'general' ? 'general' :
          mode === 'go' ? 'go' :
            mode === 'show' ? 'show' :
              mode === 'translate' ? 'translate' : 'default') + testSuffix;

        const response = await fetch(`/api/chat/history?sessionId=${sessionId}`, {
          credentials: 'include',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

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
        clearTimeout(timeoutId);
        // AbortError는 정상 취소(모드 전환 또는 타임아웃)이므로 UI 에러 없이 조용히 종료
        if (error instanceof Error && error.name === 'AbortError') {
          isAborted = true;
          return;
        }
        logger.error('[ChatClientShell] 히스토리 로드 실패:', error);
      } finally {
        setIsLoading(false);
        // abort된 경우(타임아웃/모드 전환)에는 true로 세팅하지 않음 → 재로드 가능하도록 유지
        if (!isAborted) {
          hasLoadedHistoryRef.current = true;
        }
      }
    };

    // 모든 모드에서 히스토리 로드 (탭별로 분리)
    loadChatHistory();

    return () => {
      // 모드 변경 또는 언마운트 시 진행 중인 fetch 취소
      abortControllerRef.current?.abort();
      // cleanup 시점에 리셋 → Effect 재실행 시 hasLoadedHistoryRef === false 보장
      hasLoadedHistoryRef.current = false;
    };
  }, [mode]);

  // 모드가 변경될 때마다 메시지 초기화 (새로운 대화 시작)
  useEffect(() => {
    // 첫 마운트가 아닐 때만 (즉, 모드가 실제로 변경되었을 때만) 메시지 초기화
    if (prevModeRef.current !== null && prevModeRef.current !== mode) {
      if (process.env.NODE_ENV === 'development') {
        logger.log('[ChatClientShell] Mode changed from', prevModeRef.current, 'to', mode, '- Clearing messages');
      }
      // 모드 변경 시 진행 중인 스트리밍 취소
      streamAbortControllerRef.current?.abort();
      // 빈 상태 UI는 ChatWindow에서 처리하므로 메시지는 비워둠
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
      // test 모드 확인
      const testModeInfo = await checkTestModeClient();
      const testSuffix = testModeInfo.isTestMode ? '_test' : '';

      // 모드별로 다른 sessionId 사용 (탭별 히스토리 분리 + test 모드 구분)
      const sessionId = (mode === 'general' ? 'general' :
        mode === 'go' ? 'go' :
          mode === 'show' ? 'show' :
            mode === 'translate' ? 'translate' : 'default') + testSuffix;

      // ChatMessage 형식을 API 형식으로 변환
      const apiMessages = messagesToSave.map(msg => {
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

      await csrfFetch('/api/chat/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          sessionId, // 모드별 세션 ID
        }),
      });
    } catch (error) {
      logger.error('[ChatClientShell] 히스토리 저장 실패:', error);
    }
  };

  const onSend = async (payload: ChatInputPayload) => {
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

        // 이전 스트리밍 취소, 새 AbortController 생성
        streamAbortControllerRef.current?.abort();
        const streamController = new AbortController();
        streamAbortControllerRef.current = streamController;

        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(requestBody),
          signal: streamController.signal,
        });

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

        const isDev = process.env.NODE_ENV === 'development';
        if (isDev) {
          logger.log('[ChatClientShell] Starting stream read');
        }

        let readCount = 0;
        try {
          while (true) {
            if (streamController.signal.aborted) break;
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
            const lines = chunk.split('\n');
            if (isDev) {
              logger.log('[ChatClientShell] Split into', lines.length, 'lines');
            }

            for (const line of lines) {
              if (line.startsWith('0:')) {
                // 텍스트 데이터 추출
                try {
                  const jsonStr = line.substring(2);
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
                  logger.error('[ChatClientShell] JSON parse error:', e, 'line:', line.substring(0, 100));
                }
              } else if (line.trim() && isDev) {
                logger.log('[ChatClientShell] Non-matching line:', line.substring(0, 100));
              }
            }
          }
        } finally {
          reader.cancel();
        }

        // abort된 경우(모드 변경/언마운트) 완료 처리 스킵
        if (!streamController.signal.aborted) {
          // 스트리밍 완료 후 최종 메시지 ID 업데이트 및 히스토리 저장
          setMessages((prevMessages) => {
            const updated = prevMessages.map((msg) =>
              msg.id === streamingMessageId
                ? { ...msg, id: Date.now().toString() }
                : msg
            );

            // 히스토리 저장 (debounce)
            if (ENABLE_CHAT_HISTORY && saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
            }
            if (ENABLE_CHAT_HISTORY) {
              saveTimeoutRef.current = setTimeout(() => {
                saveChatHistory(updated);
              }, 1000); // 1초 후 저장
            }

            return updated;
          });

          // TTS: 스트리밍 완료 후 AI 응답을 음성으로 읽기 (사용자 설정 확인)
          if (accumulatedText && tts.getEnabled()) {
            const plainText = extractPlainText(accumulatedText);
            tts.speak(plainText);
          }
        }
      } else {
        // 다른 모드는 기존 API 사용 (구조화된 응답)
        // 이전 요청 취소 후 새 AbortController 생성
        streamAbortControllerRef.current?.abort();
        const nonStreamController = new AbortController();
        streamAbortControllerRef.current = nonStreamController;

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            text: payload.text,
            mode: currentMode,
            from: payload.from,
            to: payload.to,
          }),
          signal: nonStreamController.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to get response from server');
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
          setMessages((prevMessages) => {
            const updated = [...prevMessages, ...data.messages];

            // 히스토리 저장 (debounce)
            if (ENABLE_CHAT_HISTORY && saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
            }
            if (ENABLE_CHAT_HISTORY) {
              saveTimeoutRef.current = setTimeout(() => {
                saveChatHistory(updated);
              }, 1000); // 1초 후 저장
            }

            return updated;
          });

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
      logger.error('[ChatClientShell] Error sending message:', error);

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
  };

  // 채팅 기록 삭제 함수
  const handleDeleteChatHistory = async () => {
    setIsDeleting(true);

    try {
      const response = await csrfFetch('/api/chat/history', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        // 성공적으로 삭제되면 메시지 상태 초기화
        setMessages([]);
        setIsDeleteModalOpen(false);

        // 성공 메시지 표시 (선택사항)
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

  // 클린업: unmount 시 saveTimeout 및 스트리밍 취소
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      streamAbortControllerRef.current?.abort();
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
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
              <div className="shrink-0 px-3 pt-3 pb-2 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center gap-2 text-base font-bold mb-2">
                  <span>📁</span>
                  <span>하위 폴더에서 더 찾아보기</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory scroll-smooth mb-2">
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
                        flex-shrink-0 snap-start
                        flex flex-col items-center justify-center gap-1
                        min-w-[72px] h-16
                        px-2 py-2
                        bg-white
                        border-2 border-[#051C2C]/20
                        rounded-xl
                        shadow-sm
                        hover:shadow-lg
                        hover:border-[#FDB931]
                        text-xs font-bold
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

          <div className="shrink-0 px-3 pt-2 bg-white border-t" style={{ paddingBottom: scrollable ? 'env(safe-area-inset-bottom, 0px)' : 'calc(5rem + env(safe-area-inset-bottom))' }}>
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