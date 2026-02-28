'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiArrowLeft, FiChevronRight } from 'react-icons/fi';

const TOOLS = [
  {
    key: 'profile',
    label: '나의 정보',
    emoji: '🧑‍✈️',
    href: '/profile',
    desc: '여행 일정, 기항지 정보 확인',
    color: 'from-purple-50 to-pink-50',
    borderColor: 'border-purple-100',
    hoverBorder: 'hover:border-purple-300',
    emojiBg: 'bg-purple-100',
  },
  {
    key: 'check',
    label: '여행준비물 체크',
    emoji: '🧳',
    href: '/checklist',
    desc: '짐 챙기기 체크리스트',
    color: 'from-blue-50 to-cyan-50',
    borderColor: 'border-blue-100',
    hoverBorder: 'hover:border-blue-300',
    emojiBg: 'bg-blue-100',
  },
  {
    key: 'currency',
    label: '환율 계산기',
    emoji: '💱',
    href: '/wallet',
    desc: '여러 나라 환율 계산',
    color: 'from-yellow-50 to-amber-50',
    borderColor: 'border-yellow-100',
    hoverBorder: 'hover:border-yellow-300',
    emojiBg: 'bg-yellow-100',
  },
  {
    key: 'translate',
    label: 'AI 통번역기',
    emoji: '🔤',
    href: '/translator',
    desc: '실시간 음성 번역',
    color: 'from-green-50 to-emerald-50',
    borderColor: 'border-green-100',
    hoverBorder: 'hover:border-green-300',
    emojiBg: 'bg-green-100',
  },
];

const TOOLS_TEST = [
  {
    key: 'profile',
    label: '나의 정보',
    emoji: '🧑‍✈️',
    href: '/profile-test',
    desc: '여행 일정, 기항지 정보 확인',
    color: 'from-purple-50 to-pink-50',
    borderColor: 'border-purple-100',
    hoverBorder: 'hover:border-purple-300',
    emojiBg: 'bg-purple-100',
  },
  {
    key: 'check',
    label: '여행준비물 체크',
    emoji: '🧳',
    href: '/checklist-test',
    desc: '짐 챙기기 체크리스트',
    color: 'from-blue-50 to-cyan-50',
    borderColor: 'border-blue-100',
    hoverBorder: 'hover:border-blue-300',
    emojiBg: 'bg-blue-100',
  },
  {
    key: 'currency',
    label: '환율 계산기',
    emoji: '💱',
    href: '/wallet-test',
    desc: '여러 나라 환율 계산',
    color: 'from-yellow-50 to-amber-50',
    borderColor: 'border-yellow-100',
    hoverBorder: 'hover:border-yellow-300',
    emojiBg: 'bg-yellow-100',
  },
  {
    key: 'translate',
    label: 'AI 통번역기',
    emoji: '🔤',
    href: '/translator-test',
    desc: '실시간 음성 번역',
    color: 'from-green-50 to-emerald-50',
    borderColor: 'border-green-100',
    hoverBorder: 'hover:border-green-300',
    emojiBg: 'bg-green-100',
  },
];

export default function ToolsPage() {
  const pathname = usePathname();
  const isTestMode = pathname?.includes('/tools-test');

  const tools = isTestMode ? TOOLS_TEST : TOOLS;
  const backHref = isTestMode ? '/chat-test' : '/chat';

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-gray-700 hover:text-black"
            prefetch={true}
          >
            <FiArrowLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold">도구함</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        <div className="flex flex-col gap-3">
          {tools.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              prefetch={true}
              className={`
                flex items-center gap-4
                bg-gradient-to-r ${t.color}
                rounded-2xl px-4 py-4
                border ${t.borderColor} ${t.hoverBorder}
                shadow-sm hover:shadow-md
                transition-all duration-150
                active:scale-[0.98]
              `}
            >
              <div className={`w-14 h-14 rounded-2xl ${t.emojiBg} flex items-center justify-center flex-shrink-0`}>
                <span className="text-3xl">{t.emoji}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base text-gray-900 leading-tight">{t.label}</div>
                <div className="text-sm text-gray-500 mt-0.5 truncate">{t.desc}</div>
              </div>
              <FiChevronRight size={20} className="text-gray-400 flex-shrink-0" />
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
