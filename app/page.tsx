'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setCsrfToken, clearAllLocalStorage } from '@/lib/csrf-client';

/* ─────── 상수 ─────── */
const FEATURES = [
  { icon: '🤖', title: '크루즈닷AI 채팅', desc: '기항지·음식·관광·교통 무엇이든 실시간으로', gradient: 'from-blue-500 to-cyan-500', glow: 'rgba(59,130,246,0.35)' },
  { icon: '🌤️', title: '날씨 브리핑', desc: '매일 새벽 기항지 날씨와 체감온도 미리 알림', gradient: 'from-amber-400 to-orange-500', glow: 'rgba(245,158,11,0.35)' },
  { icon: '🗺️', title: '스마트 길찾기', desc: '터미널에서 관광지까지 최적 경로 안내', gradient: 'from-emerald-500 to-teal-500', glow: 'rgba(16,185,129,0.35)' },
  { icon: '✅', title: '여행 체크리스트', desc: '출국부터 귀국까지 빠짐없는 스마트 체크', gradient: 'from-violet-500 to-purple-500', glow: 'rgba(139,92,246,0.35)' },
  { icon: '📸', title: '여행 다이어리', desc: '소중한 크루즈 추억을 사진과 함께 기록', gradient: 'from-pink-500 to-rose-500', glow: 'rgba(236,72,153,0.35)' },
  { icon: '💰', title: '환율 & 지갑', desc: '항구별 실시간 환율과 지출 관리 한 번에', gradient: 'from-teal-400 to-cyan-500', glow: 'rgba(20,184,166,0.35)' },
];

const TYPING_PHRASES = [
  '오늘 기항지는 홍콩 카이탁 터미널입니다. 🛳️',
  '이탈리아 정찬 레스토랑 예약을 도와드릴게요. 🍝',
  '다음 기항지까지 14시간 항해 중입니다. 🌊',
  '짐 보관소는 Deck 4 좌현에 있습니다. 🧳',
  '나가사키 날씨: 맑음, 최고 22°C 입니다. ☀️',
  '오늘 현지 일몰 시간은 18:42입니다. 🌅',
];

/* ─────── 파티클 배경 ─────── */
type Particle = { x: number; y: number; size: number; delay: number; dur: number; color: string };

function Particles() {
  const [pts, setPts] = useState<Particle[]>([]);
  useEffect(() => {
    const colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#a78bfa', '#60a5fa'];
    setPts(Array.from({ length: 32 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3.5 + 1,
      delay: Math.random() * 10,
      dur: Math.random() * 10 + 8,
      color: colors[Math.floor(Math.random() * colors.length)],
    })));
  }, []);
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {pts.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: `${p.size}px`, height: `${p.size}px`,
            background: p.color, opacity: 0.28,
            animation: `cg-float ${p.dur}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ─────── 타이핑 효과 ─────── */
function TypingEffect() {
  const [text, setText] = useState('');
  const [idx, setIdx] = useState(0);
  const [char, setChar] = useState(0);
  const [del, setDel] = useState(false);

  useEffect(() => {
    const cur = TYPING_PHRASES[idx];
    let t: ReturnType<typeof setTimeout>;
    if (!del && char < cur.length) {
      t = setTimeout(() => { setText(cur.slice(0, char + 1)); setChar(c => c + 1); }, 55);
    } else if (!del && char === cur.length) {
      t = setTimeout(() => setDel(true), 2400);
    } else if (del && char > 0) {
      t = setTimeout(() => { setText(cur.slice(0, char - 1)); setChar(c => c - 1); }, 25);
    } else {
      setDel(false);
      setIdx(i => (i + 1) % TYPING_PHRASES.length);
    }
    return () => clearTimeout(t);
  }, [char, del, idx]);

  return (
    <span className="text-blue-300 font-medium text-sm">
      {text}
      <span className="inline-block w-[2px] h-[14px] bg-blue-400 ml-0.5 rounded-full align-middle" style={{ animation: 'cg-blink 1s step-end infinite' }} />
    </span>
  );
}

/* ─────── 기능 카드 ─────── */
function FeatureCard({ icon, title, desc, gradient, glow, index }: {
  icon: string; title: string; desc: string; gradient: string; glow: string; index: number;
}) {
  const [vis, setVis] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.05 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="group relative bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 overflow-hidden cursor-default select-none transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
      style={{
        opacity: vis ? 1 : 0,
        transform: vis ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
        transition: `opacity 0.5s ease ${index * 0.07}s, transform 0.5s ease ${index * 0.07}s, box-shadow 0.3s, border-color 0.3s`,
        '--glow': glow,
      } as React.CSSProperties}
    >
      {/* Hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
        style={{ boxShadow: `inset 0 0 0 1.5px ${glow.replace('0.35', '0.8')}`, background: `radial-gradient(ellipse at top left, ${glow.replace('0.35', '0.06')}, transparent 70%)` }}
      />
      {/* Icon */}
      <div
        className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-lg mb-3 shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}
      >
        {icon}
      </div>
      <h3 className="font-bold text-gray-900 text-[13px] sm:text-sm mb-1 leading-snug">{title}</h3>
      <p className="text-gray-400 text-[11px] sm:text-xs leading-relaxed">{desc}</p>
    </div>
  );
}

/* ─────── 메인 콘텐츠 ─────── */
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
    <div className="min-h-screen bg-white relative overflow-x-hidden">

      {/* ── 배경 그라디언트 오브 (4D 부유 효과) ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-0" aria-hidden>
        <div className="absolute -top-60 -left-60 w-[700px] h-[700px] rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.22) 0%, rgba(99,102,241,0.12) 60%, transparent 80%)', animation: 'cg-orb 18s ease-in-out infinite' }} />
        <div className="absolute top-1/2 -right-60 w-[600px] h-[600px] rounded-full blur-[100px]"
          style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.18) 0%, rgba(236,72,153,0.08) 60%, transparent 80%)', animation: 'cg-orb 22s ease-in-out 4s infinite reverse' }} />
        <div className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] rounded-full blur-[90px]"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, rgba(59,130,246,0.08) 60%, transparent 80%)', animation: 'cg-orb 15s ease-in-out 8s infinite' }} />
      </div>

      <Particles />

      {/* ── HERO ── */}
      <section className="relative z-10 px-4 sm:px-6 pt-8 sm:pt-12 pb-6 flex flex-col items-center">

        {/* AI 온라인 배지 */}
        <div className="mb-5 inline-flex items-center gap-2 bg-white/80 backdrop-blur-md border border-blue-100 rounded-full px-4 py-2 shadow-sm cg-slide-up" style={{ animationDelay: '0s' }}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs sm:text-sm font-semibold text-gray-700">AI 온라인 · 실시간 응답 중</span>
        </div>

        {/* 로고 + 헤드라인 */}
        <div className="flex flex-col items-center mb-5 cg-slide-up" style={{ animationDelay: '0.08s' }}>
          <div className="relative mb-4">
            {/* 펄싱 링 효과 */}
            <div className="absolute inset-0 rounded-2xl opacity-50" style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', filter: 'blur(14px)', transform: 'scale(1.15)', animation: 'cg-pulse-glow 3s ease-in-out infinite' }} />
            <div className="relative bg-white rounded-2xl p-4 shadow-xl border border-gray-100/80">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/ai-cruise-logo.png" alt="크루즈닷AI" className="h-12 sm:h-14 object-contain" />
            </div>
          </div>

          {/* 그라디언트 타이틀 */}
          <h1 className="text-[2.6rem] sm:text-5xl lg:text-6xl font-black text-center tracking-tight leading-[1.1] cg-gradient-text">
            크루즈닷AI
          </h1>
          <p className="text-gray-500 text-base sm:text-lg mt-2.5 text-center font-medium leading-snug">
            프리미엄 크루즈 여행을 위한 AI 파트너
          </p>
        </div>

        {/* AI 채팅 미리보기 — 다크 터미널 스타일 */}
        <div className="w-full max-w-[460px] mb-6 cg-slide-up" style={{ animationDelay: '0.18s' }}>
          <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }}>
            {/* Glow border */}
            <div className="absolute inset-0 rounded-2xl" style={{ boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.4)' }} />
            <div className="p-4">
              {/* Mac-style dots */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-400 opacity-80" />
                  <span className="w-3 h-3 rounded-full bg-yellow-400 opacity-80" />
                  <span className="w-3 h-3 rounded-full bg-green-400 opacity-80" />
                </div>
                <span className="text-slate-500 text-xs font-mono ml-1">cruisedot.ai</span>
                <div className="ml-auto flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: 'cg-blink 2s step-end infinite' }} />
                  <span className="text-emerald-400 text-[10px] font-semibold">LIVE</span>
                </div>
              </div>
              {/* Chat bubble */}
              <div className="rounded-xl p-3 sm:p-3.5" style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm shadow-lg" style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>🤖</div>
                  <div className="flex-1 min-w-0 pt-1">
                    <TypingEffect />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MAIN GRID: 영상 + 로그인 ── */}
      <section className="relative z-10 px-4 sm:px-6 pb-10 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8 cg-slide-up" style={{ animationDelay: '0.28s' }}>

          {/* YouTube 영상 */}
          <div className="relative group">
            <div className="absolute -inset-1.5 rounded-3xl blur-lg opacity-25 group-hover:opacity-40 transition-opacity duration-500" style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }} />
            <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-black" style={{ aspectRatio: '16/9' }}>
              <iframe
                src="https://www.youtube.com/embed/-p_6G69MgyQ?autoplay=1&mute=1&loop=1&playlist=-p_6G69MgyQ&controls=1&modestbranding=1&rel=0"
                title="크루즈닷AI 소개 영상"
                allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </div>

          {/* 로그인 카드 — glassmorphism */}
          <div className="relative">
            <div className="absolute -inset-1.5 rounded-3xl blur-xl opacity-0 hover:opacity-30 transition-opacity duration-500" style={{ background: 'linear-gradient(135deg, #6366f1, #3b82f6)' }} />
            <div className="relative rounded-2xl shadow-2xl border border-white/60 p-6 sm:p-8" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(24px)' }}>

              <div className="text-center mb-5">
                <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-full px-3.5 py-1 mb-3">
                  <span className="text-blue-600 text-xs font-bold">✨ 크루즈닷AI 전용</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-gray-900">지금 바로 시작하세요</h2>
                <p className="text-gray-400 text-xs mt-1">비밀번호는 담당 가이드에게 받으세요</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 mb-4 flex items-start gap-2.5">
                  <span className="flex-shrink-0 text-base">⚠️</span>
                  <p className="text-red-700 text-sm font-medium leading-snug">{error}</p>
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-3.5" autoComplete="off">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">이름 <span className="text-red-400">*</span></label>
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)} required
                    autoComplete="name"
                    className="w-full bg-white/90 border border-gray-200 rounded-xl px-4 py-[14px] text-[16px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200"
                    placeholder="이름을 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">전화번호 <span className="text-red-400">*</span></label>
                  <input
                    type="tel" value={phone} onChange={e => setPhone(e.target.value)} required
                    inputMode="tel" autoComplete="tel"
                    className="w-full bg-white/90 border border-gray-200 rounded-xl px-4 py-[14px] text-[16px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200"
                    placeholder="전화번호를 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">비밀번호 <span className="text-red-400">*</span></label>
                  <input
                    type="password" value={password} onChange={e => setPassword(e.target.value)} required
                    autoComplete="off"
                    className="w-full bg-white/90 border border-gray-200 rounded-xl px-4 py-[14px] text-[16px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200"
                    placeholder="담당 가이드에게 받으세요"
                  />
                </div>

                {/* 로그인 버튼 */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full relative overflow-hidden text-white font-bold py-[18px] rounded-xl shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-base sm:text-lg mt-1 group"
                  style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)', boxShadow: '0 8px 30px rgba(79,70,229,0.35)' }}
                >
                  {/* 버튼 shine 효과 */}
                  <div className="absolute inset-0 -skew-x-12 bg-white/15 translate-x-[-200%] group-hover:translate-x-[300%] transition-transform duration-700 ease-in-out" />
                  {loading ? (
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      로그인 중...
                    </span>
                  ) : (
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      🚀 크루즈닷AI 시작하기
                    </span>
                  )}
                </button>
              </form>

              <div className="mt-4 flex items-center justify-center gap-4">
                <a href="https://cruisedot.co.kr" target="_blank" rel="noopener noreferrer"
                  className="text-xs text-gray-400 hover:text-blue-500 transition-colors">
                  크루즈닷 쇼핑몰 →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="relative z-10 px-4 sm:px-6 pb-16 max-w-5xl mx-auto">
        <div className="text-center mb-8 cg-slide-up" style={{ animationDelay: '0.4s' }}>
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-full px-4 py-1.5 mb-3">
            <span className="text-blue-600 text-xs font-bold">✨ 핵심 기능</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">크루즈 여행의 모든 것</h2>
          <p className="text-gray-400 text-sm sm:text-base">크루즈닷AI가 함께하는 스마트한 여행</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title} desc={f.desc} gradient={f.gradient} glow={f.glow} index={i} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <a href="/admin/login" className="text-xs text-gray-300 hover:text-gray-500 transition-colors">
            관리자 로그인
          </a>
        </div>
      </section>

      {/* ── 전역 CSS 애니메이션 ── */}
      <style>{`
        @keyframes cg-float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-18px) scale(1.12); }
        }
        @keyframes cg-orb {
          0%, 100% { transform: translate(0, 0) scale(1) rotate(0deg); }
          25% { transform: translate(40px, -50px) scale(1.05) rotate(5deg); }
          50% { transform: translate(-25px, 30px) scale(0.95) rotate(-5deg); }
          75% { transform: translate(20px, -20px) scale(1.02) rotate(3deg); }
        }
        @keyframes cg-pulse-glow {
          0%, 100% { opacity: 0.45; transform: scale(1.12); }
          50% { opacity: 0.7; transform: scale(1.22); }
        }
        @keyframes cg-slideup {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cg-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes cg-gradient-flow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .cg-slide-up {
          opacity: 0;
          animation: cg-slideup 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .cg-gradient-text {
          background: linear-gradient(135deg, #1d4ed8 0%, #4f46e5 35%, #7c3aed 65%, #2563eb 100%);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: cg-gradient-flow 5s ease infinite;
        }
      `}</style>
    </div>
  );
}

/* ─────── Export ─────── */
export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="relative">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-blue-100 border-t-blue-600" />
          <div className="absolute inset-0 rounded-full animate-ping border border-blue-200 opacity-30" />
        </div>
      </div>
    }>
      <LandingContent />
    </Suspense>
  );
}
