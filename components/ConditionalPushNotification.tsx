'use client';

import { usePathname } from 'next/navigation';
import PushNotificationPrompt from './PushNotificationPrompt';

// 푸시 알림 프롬프트를 표시할 경로 (화이트리스트 방식)
// 오직 지니가이드와 지니가이드 3일체험에서만 표시
// 주의: /chat와 /chat-test는 ChatInteractiveUI 내부에서 직접 PushNotificationPrompt를 사용하므로
// 전역 ConditionalPushNotification에서는 제외합니다 (중복 방지)
const SHOW_PUSH_PROMPT_PATHS = [
  '/chat',      // 지니가이드 (크루즈 가이드 지니 AI) - ChatInteractiveUI에서 직접 사용
  '/chat-test', // 지니가이드 3일체험 - ChatInteractiveUI에서 직접 사용
];

/**
 * 경로가 정확히 일치하거나 하위 경로인지 확인
 * 예: /chat 또는 /chat/xxx 는 true, /chat-bot 또는 /chats 는 false
 */
function isPathMatch(pathname: string, allowedPath: string): boolean {
  if (!pathname) return false;
  
  // 정확히 일치하는 경우
  if (pathname === allowedPath) return true;
  
  // 하위 경로인 경우 (예: /chat/something)
  if (pathname.startsWith(allowedPath + '/')) return true;
  
  return false;
}

export default function ConditionalPushNotification() {
  const pathname = usePathname();

  // /chat와 /chat-test는 ChatInteractiveUI에서 이미 PushNotificationPrompt를 직접 사용하고 있으므로
  // 전역 ConditionalPushNotification에서는 제외 (중복 표시 방지)
  // 나머지 모든 경로(새로운 랜딩페이지 포함)에서도 표시하지 않음
  // 결과: 전역 ConditionalPushNotification은 비활성화됨
  // 푸시 알림은 오직 /chat와 /chat-test의 ChatInteractiveUI 내부에서만 표시됨
  if (!pathname || SHOW_PUSH_PROMPT_PATHS.some((path) => isPathMatch(pathname, path))) {
    return null;
  }

  return null; // 모든 경로에서 표시하지 않음 (ChatInteractiveUI에서만 처리)
}