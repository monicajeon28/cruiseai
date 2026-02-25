// 'use client' 쓰지 마세요 (서버 컴포넌트)
import ChatInteractiveUI from './components/ChatInteractiveUI'; // 기존 컴포넌트
import TopBar from "./components/TopBar";
import TripInfoBanner from '@/components/TripInfoBanner'; // TripInfoBanner 임포트
import { checkTestMode, getCorrectPath } from '@/lib/test-mode';
import { redirect } from 'next/navigation';

export default async function ChatPage() {
  // 경로 보호: 테스트 모드 사용자는 /chat-test로 리다이렉트
  const testModeInfo = await checkTestMode();
  const correctPath = getCorrectPath('/chat', testModeInfo);

  if (correctPath !== '/chat') {
    redirect(correctPath);
  }

  // 기존 크루즈 가이드 지니 AI (3800 로그인 사용자용)
  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <TopBar />
      <main className="mx-auto max-w-5xl px-4 pb-20">
        {/* 여행 정보 배너 (오늘의 브리핑 아래에 표시되도록 ChatInteractiveUI에서 처리) */}
        {/* 채팅 UI */}
        <ChatInteractiveUI />
      </main>
    </div>
  );
}