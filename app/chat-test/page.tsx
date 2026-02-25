// app/chat-test/page.tsx
// 테스트 모드 전용 채팅 페이지 (1101 로그인 사용자만)
// 기존 크루즈 가이드 지니 AI와 완전히 분리된 경로

import TutorialChatPage from '../chat/components/TutorialChatPage';
import { checkTestMode } from '@/lib/test-mode';
import { redirect } from 'next/navigation';

export default async function ChatTestPage() {
  // 테스트 모드 체크
  const testModeInfo = await checkTestMode();

  // 테스트 모드가 아니면 일반 채팅으로 리다이렉트
  if (!testModeInfo.isTestMode) {
    redirect('/chat');
  }

  // 테스트 모드면 튜토리얼 버전 렌더링
  return <TutorialChatPage testModeInfo={testModeInfo} />;
}

