'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setCsrfToken, clearAllLocalStorage } from '@/lib/csrf-client';

/* ─────────────────────────── 상수 ─────────────────────────── */

const FEATURES = [
  { icon: '🤖', title: 'AI 지니 채팅', desc: '기항지, 음식, 관광, 교통 모든 것을 실시간으로 물어보세요' },
  { icon: '🌤️', title: '날씨 브리핑', desc: '매일 새벽 기항지 날씨와 체감온도를 미리 알려드려요' },
  { icon: '🗺️', title: '스마트 길찾기', desc: '크루즈 터미널에서 관광지까지 최적 경로를 안내해드려요' },
  { icon: '✅', title: '여행 체크리스트', desc: '출국부터 귀국까지 빠짐없이 챙기는 스마트 체크리스트' },
  { icon: '📸', title: '여행 다이어리', desc: '소중한 크루즈 추억을 사진과 함께 기록하세요' },
  { icon: '💰', title: '환율 & 지갑', desc: '항구별 통화 실시간 환율과 지출 관리를 한 번에' },
];

const TYPING_PHRASES = [
  '오늘 기항지는 홍콩 카이탁 터미널입니다. 🛳️',
  '이탈리아 정찬 레스토랑 예약을 도와드릴게요. 🍝',
  '다음 기항지까지 14시간 항해 중입니다. 🌊',
  '짐 보관소 위치를 알려드릴게요. 🧳',
  '오늘 현지 일몰 시간은 18:42입니다. 🌅',
];

/* ─────────────────────────── 타이핑 애니메이션 ─────────────────────────── */

function TypingEffect() {
  const [text, setText] = useState('');
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = TYPING_PHRASES[phraseIdx];
    let timer: ReturnType<typeof setTimeout>;

    if (!deleting && charIdx < current.length) {
      timer = setTimeout(() => { setText(current.slice(0, charIdx + 1)); setCharIdx(c => c + 1); }, 60);
    } else if (!deleting && charIdx === current.length) {
      timer = setTimeout(() => setDeleting(true), 2200);
    } else if (deleting && charIdx > 0) {
      timer = setTimeout(() => { setText(current.slice(0, charIdx - 1)); setCharIdx(c => c - 1); }, 28);
    } else {
      setDeleting(false);
      setPhraseIdx(i => (i + 1) % TYPING_PHRASES.length);
    }
    return () => clearTimeout(timer);
  }, [charIdx, deleting, phraseIdx]);

  return (
    <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
      {text}
      <span className="animate-pulse font-thin text-blue-400">|</span>
    </span>
  );
}

/* ─────────────────────────── 파티클 배경 ─────────────────────────── */

type Particle = { x: number; y: number; size: number; delay: number; duration: number };

function Particles() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: 28 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 5 + 2,
        delay: Math.random() * 6,
        duration: Math.random() * 9 + 7,
      }))
    );
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-blue-200"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: 0.25,
            animation: `cg-float ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────── 기능 카드 ─────────────────────────── */

function FeatureCard({ icon, title, desc, index }: { icon: string; title: string; desc: string; index: number }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 hover:border-blue-100 cursor-default select-none"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.55s ease ${index * 0.08}s, transform 0.55s ease ${index * 0.08}s, box-shadow 0.25s, border-color 0.25s`,
      }}
    >
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-bold text-gray-900 mb-1.5 text-sm sm:text-base">{title}</h3>
      <p className="text-gray-500 text-xs sm:text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

/* ─────────────────────────── 메인 콘텐츠 ─────────────────────────── */

function LandingContent() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const sp = useSearchParams();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const n = name.trim(), p = phone.trim(), pw = password.trim();
    if (!n) { setError('이름을 입력해주세요.'); return; }
    if (!p) { setError('전화번호를 입력해주세요.'); return; }
    if (!pw) { setError('비밀번호를 입력해주세요.'); return; }
    if (pw !== '3800' && pw !== '1101') {
      setError('비밀번호가 올바르지 않습니다. 담당 가이드에게 문의해주세요.');
      return;
    }

    setLoading(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: p, password: pw, name: n, mode: 'user' }),
      });
      const data = await r.json().catch(() => ({ ok: false, error: '서버 응답 오류' }));

      if (!r.ok || !data?.ok) {
        setError(data?.error ?? '로그인에 실패했습니다. 다시 시도해주세요.');
        return;
      }

      clearAllLocalStorage();
      if (data.csrfToken) setCsrfToken(data.csrfToken);

      const nextParam = sp.get('next');
      let next = data.next || (nextParam ? decodeURIComponent(nextParam) : null) || '/chat';
      if (pw === '1101') next = '/chat-test';
      if (next.startsWith('/onboarding')) next = '/chat';
      router.push(next);
    } catch {
      setError('네트워크 오류입니다. 인터넷 연결을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/20 to-white relative overflow-hidden">
      {/* 파티클 배경 */}
      <Particles />

      {/* 배경 오브 (빛 번짐 효과) */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-100/50 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute top-32 right-0 w-80 h-80 bg-purple-100/30 rounded-full blur-3xl pointer-events-none -z-0" />

      {/* ── HERO SECTION ── */}
      <section className="relative z-10 flex flex-col items-center px-4 pt-10 sm:pt-14 pb-14">

        {/* 로고 + 헤드라인 */}
        <div className="flex flex-col items-center mb-6 cg-slide-up" style={{ animationDelay: '0s' }}>
          <div className="bg-white rounded-2xl px-5 py-4 shadow-xl border border-gray-100 mb-4 hover:shadow-2xl transition-shadow duration-300">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/ai-cruise-logo.png" alt="크루즈닷AI" className="h-12 sm:h-14 mx-auto object-contain" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 tracking-tight text-center">
            크루즈닷AI
          </h1>
          <p className="text-gray-500 text-sm sm:text-base mt-2 text-center">
            프리미엄 크루즈 여행 AI 파트너
          </p>
        </div>

        {/* AI 타이핑 배지 */}
        <div
          className="mb-7 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl px-5 py-3 max-w-sm w-full text-center cg-slide-up"
          style={{ animationDelay: '0.15s' }}
        >
          <span className="text-blue-400 text-xs font-semibold mr-1">✨ 지니:</span>
          <TypingEffect />
        </div>

        {/* 영상 + 로그인 (PC: 2열, 모바일: 1열) */}
        <div
          className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-6 cg-slide-up"
          style={{ animationDelay: '0.3s' }}
        >
          {/* YouTube 영상 */}
          <div className="rounded-3xl overflow-hidden shadow-2xl border border-gray-100 bg-black w-full aspect-video">
            <iframe
              src="https://www.youtube.com/embed/-p_6G69MgyQ?autoplay=1&mute=1&loop=1&playlist=-p_6G69MgyQ&controls=1&modestbranding=1&rel=0"
              title="크루즈닷AI 소개 영상"
              allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>

          {/* 로그인 카드 */}
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 sm:p-8 flex flex-col justify-center">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 mb-1 text-center">지니 시작하기</h2>
            <p className="text-gray-400 text-xs text-center mb-6">비밀번호는 담당 가이드에게 받으세요</p>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-2">
                <span className="text-red-400 flex-shrink-0">⚠️</span>
                <p className="text-red-700 text-sm font-medium leading-snug">{error}</p>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  이름 <span className="text-red-400">*</span>
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="이름을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  전화번호 <span className="text-red-400">*</span>
                </label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="전화번호를 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  비밀번호 <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="off"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="담당 가이드에게 받으세요"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-lg mt-1"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    로그인 중...
                  </span>
                ) : '🚀 지니 시작하기'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── FEATURES SECTION ── */}
      <section className="relative z-10 px-4 pb-20 max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-block bg-blue-50 text-blue-600 text-xs font-semibold px-4 py-1.5 rounded-full mb-3">FEATURES</div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">이런 기능을 제공해요</h2>
          <p className="text-gray-400 text-sm sm:text-base">크루즈 여행의 모든 순간을 AI 지니가 함께합니다</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title} desc={f.desc} index={i} />
          ))}
        </div>

        {/* 하단 CTA */}
        <div className="mt-12 text-center">
          <p className="text-gray-400 text-xs">
            크루즈닷 판매몰 →{' '}
            <a href="https://cruisedot.co.kr" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              cruisedot.co.kr
            </a>
          </p>
        </div>
      </section>

      {/* ── 전역 애니메이션 CSS ── */}
      <style>{`
        @keyframes cg-float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.25; }
          50% { transform: translateY(-18px) scale(1.15); opacity: 0.08; }
        }
        @keyframes cg-slideup {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cg-slide-up {
          opacity: 0;
          animation: cg-slideup 0.7s ease forwards;
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────── 페이지 export ─────────────────────────── */

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    }>
      <LandingContent />
    </Suspense>
  );
}
