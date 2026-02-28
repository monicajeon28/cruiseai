"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { csrfFetch, clearAllLocalStorage } from "@/lib/csrf-client";
import tts from "@/lib/tts";
import { FiVolume2, FiVolumeX } from "react-icons/fi";

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const isTestMode = pathname?.includes('/chat-test') ||
    pathname?.includes('/tools-test') ||
    pathname?.includes('/translator-test') ||
    pathname?.includes('/profile-test') ||
    pathname?.includes('/checklist-test') ||
    pathname?.includes('/wallet-test');

  const getChatHref = () => {
    return isTestMode ? '/chat-test' : '/chat';
  };

  const getLoginHref = () => {
    return isTestMode ? '/login-test' : '/login';
  };

  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');

  // TTS 설정 로드
  useEffect(() => {
    setTtsEnabled(tts.getEnabled());
    const savedFontSize = localStorage.getItem('fontSize') as 'sm' | 'md' | 'lg' | null;
    if (savedFontSize) {
      setFontSize(savedFontSize);
      document.documentElement.setAttribute('data-font-size', savedFontSize);
    }
  }, []);

  // TTS 토글
  const toggleTTS = () => {
    const newValue = !ttsEnabled;
    setTtsEnabled(newValue);
    tts.setEnabled(newValue);
  };

  // 글씨 크기 변경
  const changeFontSize = () => {
    const sizes: Array<'sm' | 'md' | 'lg'> = ['sm', 'md', 'lg'];
    const currentIndex = sizes.indexOf(fontSize);
    const nextSize = sizes[(currentIndex + 1) % sizes.length];
    setFontSize(nextSize);
    localStorage.setItem('fontSize', nextSize);
    document.documentElement.setAttribute('data-font-size', nextSize);
  };

  const fontSizeLabel = { sm: '작게', md: '보통', lg: '크게' }[fontSize];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1e3a52] bg-gradient-to-r from-[#051C2C] to-[#0A2E46] backdrop-blur shadow-lg">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4 gap-2">
        {/* 좌측: 로고 */}
        <Link href={getChatHref()} className="flex items-center gap-2 flex-shrink-0">
          <Image
            src="/images/ai-cruise-logo.png"
            alt="크루즈닷 로고"
            width={28}
            height={28}
            priority
          />
          <span className="text-sm font-semibold tracking-tight hidden sm:inline text-white">크루즈닷</span>
        </Link>

        {/* 중앙: 타이틀 */}
        <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-bold whitespace-nowrap hidden md:block text-white">
          <span className="text-[#FDB931]">크루즈닷</span> AI
        </h1>

        {/* 우측: 설정 버튼들 */}
        <div className="flex items-center gap-2">
          {/* TTS 토글 */}
          <button
            onClick={toggleTTS}
            className="rounded-md border border-[#FDB931] px-2 py-1.5 text-sm font-medium hover:bg-[#FDB931]/10 flex items-center gap-1 text-white"
            title={ttsEnabled ? "음성 읽기 켜짐" : "음성 읽기 꺼짐"}
          >
            {ttsEnabled ? <FiVolume2 size={16} /> : <FiVolumeX size={16} />}
            <span className="hidden sm:inline text-xs">{ttsEnabled ? "음성 켜짐" : "음성 꺼짐"}</span>
          </button>

          {/* 글씨 크기 */}
          <button
            onClick={changeFontSize}
            className="rounded-md border border-[#FDB931] px-2 py-1.5 text-sm font-medium hover:bg-[#FDB931]/10 text-white"
            title="글씨 크기 변경"
          >
            <span className="text-xs">A {fontSizeLabel}</span>
          </button>

          {/* 로그아웃 */}
          <button
            onClick={async () => {
              await csrfFetch("/api/auth/logout", { method: "POST" });
              clearAllLocalStorage();
              router.replace(getLoginHref());
            }}
            className="rounded-md border border-[#FDB931] px-3 py-1.5 text-sm font-medium hover:bg-[#FDB931]/10 text-white"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
