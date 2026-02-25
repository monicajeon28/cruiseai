import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-6 px-6">
      <div className="text-center space-y-3">
        <p className="text-sm uppercase tracking-[0.5em] text-amber-400">Cruise Guide</p>
        <h1 className="text-5xl font-extrabold">Page Not Found</h1>
        <p className="text-base text-slate-300 max-w-lg">
          요청하신 페이지를 찾을 수 없습니다. 주소가 올바른지 다시 확인하거나, 홈으로 돌아가 주세요.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-full bg-amber-400/90 px-6 py-3 text-slate-900 font-semibold shadow-lg hover:bg-amber-300 transition"
      >
        홈으로 이동
      </Link>
    </div>
  );
}

