'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

type Props = { onPick?: (cmd: string) => void };

const TOOLS = [
  { key: 'profile',   label: '나의 정보',        emoji: '🧑‍✈️', cmd: '나의 정보 보기', href: '/profile' },
  { key: 'check',     label: '여행준비물 체크',   emoji: '🧳',    cmd: '여행준비물 체크', href: '/checklist' },
  { key: 'currency',  label: '환율 계산기',      emoji: '💱',    cmd: '환율 계산기',    href: '/wallet' },
  { key: 'translate', label: '번역기',           emoji: '🔤',    cmd: '번역기',         href: '/translator' },
];

export default function QuickTools({ onPick }: Props) {
  const pathname = usePathname();
  const isTestMode = pathname?.includes('/chat-test') || 
                     pathname?.includes('/tools-test') || 
                     pathname?.includes('/translator-test') || 
                     pathname?.includes('/profile-test') ||
                     pathname?.includes('/checklist-test') ||
                     pathname?.includes('/wallet-test');
  
  const btn =
    'rounded-2xl border bg-white p-4 shadow-sm hover:shadow transition ' +
    'text-[16px] md:text-[17px] font-semibold flex items-center justify-center';

  // 테스트 모드일 때 테스트 버전 경로로 변경
  const getToolHref = (tool: typeof TOOLS[0]) => {
    if (isTestMode) {
      if (tool.key === 'profile') return '/profile-test';
      if (tool.key === 'translate') return '/translator-test';
      if (tool.key === 'check') return '/checklist-test';
      if (tool.key === 'currency') return '/wallet-test';
    }
    return tool.href;
  };

  return (
    <div className="px-4 py-3 border-b bg-white/85 backdrop-blur sticky top-[var(--top-offset,0px)] z-20">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {TOOLS.map(t => (
          <Link
            key={t.key}
            href={getToolHref(t)}
            prefetch
            {...(t.key === 'profile' ? {} : { onClick: () => onPick?.(t.cmd) })}
            className={btn}
            aria-label={t.label}
          >
            <span className="text-[20px]" aria-hidden>{t.emoji}</span>
            <span>{t.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
} 
