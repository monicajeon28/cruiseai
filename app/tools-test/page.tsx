'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { FiArrowLeft } from 'react-icons/fi';

const TOOLS = [
  { key: 'profile', label: '나의 정보', emoji: '🧑‍✈️', href: '/profile', desc: '여행 일정, 기항지 정보 확인' },
  { key: 'check', label: '여행준비물 체크', emoji: '🧳', href: '/checklist', desc: '짐 챙기기 체크리스트' },
  { key: 'currency', label: '환율 계산기', emoji: '💱', href: '/wallet', desc: '여러 나라 환율 계산' },
  { key: 'translate', label: 'AI 통번역기', emoji: '🔤', href: '/translator', desc: '실시간 음성 번역' },
];

const TOOLS_TEST = [
  { key: 'profile', label: '나의 정보', emoji: '🧑‍✈️', href: '/profile-test', desc: '여행 일정, 기항지 정보 확인' },
  { key: 'check', label: '여행준비물 체크', emoji: '🧳', href: '/checklist-test', desc: '짐 챙기기 체크리스트' },
  { key: 'currency', label: '환율 계산기', emoji: '💱', href: '/wallet-test', desc: '여러 나라 환율 계산' },
  { key: 'translate', label: 'AI 통번역기', emoji: '🔤', href: '/translator-test', desc: '실시간 음성 번역' },
];

export default function ToolsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const isTestMode = pathname?.includes('/tools-test');

  const tools = isTestMode ? TOOLS_TEST : TOOLS;

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-gray-700 hover:text-black"
          >
            <FiArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">도구함</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 gap-4">
          {tools.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all"
            >
              <div className="text-4xl mb-3">{t.emoji}</div>
              <div className="font-bold text-lg text-gray-900 mb-1">{t.label}</div>
              <div className="text-sm text-gray-500">{t.desc}</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
