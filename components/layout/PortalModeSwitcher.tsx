'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

const HIDE_PATH_PREFIXES = ['/admin', '/affiliate'];

export default function PortalModeSwitcher() {
  const pathname = usePathname();

  const shouldHide = useMemo(() => {
    if (!pathname) return false;
    return HIDE_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
  }, [pathname]);

  if (shouldHide) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60]">
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-medium text-slate-500 shadow-lg backdrop-blur-sm">
        <Link href="/admin/login" className="transition-colors hover:text-blue-600">
          관리자 모드
        </Link>
        <span className="text-slate-300">|</span>
        <Link href="/affiliate/login" className="transition-colors hover:text-blue-600">
          협력사 모드
        </Link>
      </div>
    </div>
  );
}













