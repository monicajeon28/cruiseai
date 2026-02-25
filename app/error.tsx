'use client';

import Link from 'next/link';
import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorProps) {
  useEffect(() => {
    // 개발 환경에서는 콘솔에 에러 로그 출력
    if (process.env.NODE_ENV === 'development') {
      console.error('Error boundary caught:', error);
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-6 px-6">
      <div className="text-center space-y-3">
        <p className="text-sm uppercase tracking-[0.5em] text-amber-400">Cruise Guide</p>
        <h1 className="text-5xl font-extrabold">오류가 발생했습니다</h1>
        <p className="text-base text-slate-300 max-w-lg">
          죄송합니다. 페이지를 불러오는 중 문제가 발생했습니다.
          <br />
          잠시 후 다시 시도해 주세요.
        </p>

        {/* 개발 환경에서만 에러 상세 정보 표시 */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 p-4 bg-slate-900/50 border border-red-500/30 rounded-lg text-left max-w-2xl">
            <p className="text-sm font-semibold text-red-400 mb-2">개발 모드 에러 정보:</p>
            <p className="text-xs text-slate-400 font-mono break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-slate-500 mt-2">
                Error Digest: {error.digest}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-full bg-amber-400/90 px-6 py-3 text-slate-900 font-semibold shadow-lg hover:bg-amber-300 transition"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-6 py-3 text-white font-semibold shadow-lg hover:bg-slate-700 transition"
        >
          홈으로 이동
        </Link>
      </div>
    </div>
  );
}
