'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { setCsrfToken, clearAllLocalStorage } from '@/lib/csrf-client';
import KakaoShareButton from '@/components/KakaoShareButton';
import KakaoChannelButton from '@/components/KakaoChannelButton';

function TestLoginPageContent() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const sp = useSearchParams();

  const [trialCode, setTrialCode] = useState<string | null>(null);
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
  const [managerCode, setManagerCode] = useState<string | null>(null);

  useEffect(() => {
    // URL 파라미터에서 메시지 확인
    const message = sp.get('message');
    if (message) {
      setError(message);
    }
    
    // 3일 체험 초대 링크 파라미터 확인
    const trial = sp.get('trial');
    const affiliate = sp.get('affiliate');
    const manager = sp.get('manager');
    
    if (trial) {
      setTrialCode(trial);
    }
    if (affiliate) {
      setAffiliateCode(affiliate);
    }
    if (manager) {
      setManagerCode(manager);
    }
    
    // 폼 필드 초기화 (브라우저 자동완성 방지)
    setPhone('');
    setPassword('');
    setName('');
  }, [sp]);

  // 연락처 입력 핸들러 - 숫자만 입력 가능하고 11자리 제한
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, ''); // 숫자만 허용
    if (value.length <= 11) {
      setPhone(value);
    }
  };

  // 연락처 유효성 검사 (10자리 또는 11자리)
  const isValidPhone = phone.length >= 10 && phone.length <= 11 && /^[0-9]{10,11}$/.test(phone);
  
  // 버튼 활성화 조건: 이름과 연락처가 모두 유효해야 함
  const isFormValid = name.trim().length > 0 && isValidPhone;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); // 에러 초기화

    // 입력값 앞뒤 공백 제거
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedPassword = password.trim();

    // 필수 필드 검증
    if (!trimmedName) {
      setError('이름을 입력해주세요.');
      return;
    }
    if (!trimmedPhone) {
      setError('연락처를 입력해주세요.');
      return;
    }
    
    // 연락처 형식 검증 (10자리 또는 11자리)
    if (!/^[0-9]{10,11}$/.test(trimmedPhone)) {
      setError('연락처는 10자리 또는 11자리 숫자로 입력해주세요.');
      return;
    }
    
    if (!trimmedPassword) {
      setError('비밀번호를 입력해주세요.');
      return;
    }

    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          phone: trimmedPhone, 
          password: trimmedPassword, 
          name: trimmedName, 
          mode: 'user',
          // 3일 체험 초대 링크 파라미터
          trialCode: trialCode,
          affiliateCode: affiliateCode,
          managerCode: managerCode,
        }),
      });
      
      const data = await r.json().catch(() => {
        return { ok: false, error: '서버 응답을 처리할 수 없습니다.' };
      });

      if (!r.ok || !data?.ok) {
        const errorMessage = data?.error ?? '로그인 실패';
        const errorDetails = data?.details ?? '';
        const errorStack = data?.stack ?? '';
        
        // 비밀번호 오류인 경우 명확한 메시지 표시
        if (r.status === 401 || errorMessage.includes('비밀번호') || errorMessage.includes('올바르지 않습니다')) {
          setError('비밀번호가 올바르지 않습니다. 테스트 모드 비밀번호를 확인해주세요.');
        } else {
          // 테스트 모드 오류인 경우 상세 정보 포함
          const fullErrorMessage = errorDetails 
            ? `${errorMessage}\n\n상세 정보: ${errorDetails}` 
            : errorMessage;
          setError(fullErrorMessage);
        }
        return; // 절대 리다이렉트하지 않음
      }

      // 새 사용자 로그인 시 이전 사용자의 localStorage 데이터 정리
      clearAllLocalStorage();

      // CSRF 토큰 저장
      if (data.csrfToken) {
        setCsrfToken(data.csrfToken);
      }

      // 서버가 알려준 next로 이동 (테스트 모드는 /chat-test로만 이동)
      const nextParam = sp.get('next');
      const decodedNext = nextParam ? decodeURIComponent(nextParam) : null;
      let next = data.next || decodedNext || '/chat-test'; // 테스트 모드는 /chat-test로 기본 이동
      
      // 안전장치: test 모드 사용자는 항상 /chat-test로만 이동
      // /chat으로 가려는 시도 차단 - /chat-test로 강제 변경
      if (next === '/chat' || next.startsWith('/chat/')) {
        next = next.replace('/chat', '/chat-test');
      }

      // 최종 안전장치: /chat-test로 시작하지 않으면 강제로 /chat-test로 변경
      if (!next.startsWith('/chat-test')) {
        next = '/chat-test';
      }

      window.location.href = next; // router.push 대신 window.location.href 사용하여 확실하게 리다이렉트
    } catch (error) {
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-sky-100 via-blue-100 to-sky-200 text-gray-900 relative overflow-hidden">
      {/* 크루즈 배경 이미지 */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-5"
          style={{
            backgroundImage: `url('${encodeURI('/크루즈정보사진/크루즈배경이미지/고화질배경이미지 (1).png')}')`,
          }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-b from-sky-50/30 via-blue-50/20 to-sky-50/30"></div>
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-[100dvh] px-4 py-4 md:py-12">
        <div className="w-full max-w-lg">
          {/* 헤더 섹션 */}
          <div className="text-center mb-4 md:mb-6 space-y-2 md:space-y-4">
            <div className="flex justify-center mb-2 md:mb-3">
              <div className="bg-white rounded-xl md:rounded-2xl p-2 md:p-4 shadow-xl border-2 border-gray-200">
                <img src="/images/ai-cruise-logo.png" alt="크루즈닷" className="h-10 md:h-14 mx-auto" />
              </div>
            </div>
            
            <div className="space-y-1 md:space-y-2">
              <h1 className="text-2xl md:text-4xl lg:text-5xl font-black text-gray-900 tracking-tight leading-tight">
                크루즈닷AI
              </h1>
              <h2 className="text-lg md:text-2xl lg:text-3xl font-bold text-gray-700 leading-tight">
                3일 무료체험
              </h2>
              <p className="text-sm md:text-lg lg:text-xl text-gray-600 font-medium max-w-md mx-auto leading-relaxed px-2">
                프리미엄 크루즈 여행을 위한 AI 파트너
              </p>
            </div>

            {/* 신뢰 배지 */}
            <div className="flex flex-wrap justify-center gap-2 md:gap-3 mt-3 md:mt-6">
              <div className="bg-white px-3 py-1.5 md:px-4 md:py-2 rounded-full border-2 border-gray-200 text-xs md:text-sm lg:text-base font-semibold text-gray-700 shadow-sm">
                🔒 안전한 로그인
              </div>
              <div className="bg-white px-3 py-1.5 md:px-4 md:py-2 rounded-full border-2 border-gray-200 text-xs md:text-sm lg:text-base font-semibold text-gray-700 shadow-sm">
                ⚡ 즉시 시작
              </div>
              <div className="bg-white px-3 py-1.5 md:px-4 md:py-2 rounded-full border-2 border-gray-200 text-xs md:text-sm lg:text-base font-semibold text-gray-700 shadow-sm">
                ✨ 무료 체험
              </div>
            </div>
          </div>

          {/* YouTube 영상 */}
          <div className="mb-4 md:mb-6 rounded-xl md:rounded-2xl overflow-hidden shadow-xl md:shadow-2xl border-2 border-gray-200 bg-white hidden md:block">
            <div className="aspect-video w-full">
              <iframe
                src="https://www.youtube.com/embed/-p_6G69MgyQ?autoplay=1&mute=1&loop=1&playlist=-p_6G69MgyQ&controls=1&modestbranding=1&rel=0&enablejsapi=1"
                title="크루즈닷AI 소개 영상"
                allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="w-full h-full"
              ></iframe>
            </div>
          </div>

          {/* 메인 콘텐츠 카드 */}
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl md:shadow-2xl border-2 border-gray-200 p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
            {/* 카카오톡 채널 추가 배너 */}
            <KakaoChannelButton variant="banner" />
            
            {/* 기능 소개 */}
            <div className="grid grid-cols-4 gap-2 md:gap-3 lg:gap-4">
              {[
                { icon: '💬', label: 'AI 채팅' },
                { icon: '✅', label: '체크리스트' },
                { icon: '🗺️', label: '여행 지도' },
                { icon: '💰', label: '가계부' },
              ].map((item, idx) => (
                <div key={idx} className="bg-gradient-to-br from-gray-50 to-white rounded-lg md:rounded-xl p-2 md:p-3 lg:p-4 border-2 border-gray-100 hover:border-blue-300 hover:shadow-md transition-all duration-200">
                  <div className="text-xl md:text-2xl lg:text-3xl mb-1 md:mb-2 text-center">{item.icon}</div>
                  <div className="text-xs md:text-sm lg:text-base font-semibold text-center text-gray-700 leading-tight">{item.label}</div>
                </div>
              ))}
            </div>

            {/* 로그인 폼 */}
            <form onSubmit={onSubmit} className="space-y-4 md:space-y-5" autoComplete="off" noValidate>
              {/* 에러 메시지 표시 */}
              {error && (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg md:rounded-xl p-3 md:p-4 lg:p-5">
                  <div className="flex items-start gap-2 md:gap-3">
                    <span className="text-red-600 text-lg md:text-xl flex-shrink-0">⚠️</span>
                    <p className="text-sm md:text-base lg:text-lg font-semibold text-red-800 leading-relaxed break-words">{error}</p>
                  </div>
                </div>
              )}
              
              <div className="space-y-4 md:space-y-5">
                <div>
                  <label className="block text-sm md:text-base lg:text-lg font-semibold text-gray-700 mb-2 md:mb-3">
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    autoComplete="off"
                    className="w-full bg-gray-50 border-2 border-gray-300 rounded-lg md:rounded-xl px-4 py-3 md:px-5 md:py-4 text-base md:text-lg lg:text-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    placeholder="이름을 입력하세요"
                    style={{ fontSize: '16px', minHeight: '48px' }}
                  />
                </div>
                
                <div>
                  <label className="block text-sm md:text-base lg:text-lg font-semibold text-gray-700 mb-2 md:mb-3">
                    연락처 <span className="text-red-500">*</span>
                    {phone.length > 0 && phone.length < 10 && (
                      <span className="text-red-500 text-xs md:text-sm ml-2">({phone.length}/10-11자리)</span>
                    )}
                    {phone.length >= 10 && phone.length <= 11 && !isValidPhone && (
                      <span className="text-red-500 text-xs md:text-sm ml-2">({phone.length}/10-11자리)</span>
                    )}
                    {isValidPhone && (
                      <span className="text-green-600 text-xs md:text-sm ml-2">✓</span>
                    )}
                  </label>
                  <input
                    name="phone"
                    value={phone}
                    onChange={handlePhoneChange}
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={11}
                    className={`w-full bg-gray-50 border-2 rounded-lg md:rounded-xl px-4 py-3 md:px-5 md:py-4 text-base md:text-lg lg:text-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                      isValidPhone 
                        ? 'border-green-500 focus:ring-green-500 focus:border-green-500' 
                        : phone.length > 0 && phone.length < 10
                        ? 'border-yellow-400 focus:ring-yellow-500 focus:border-yellow-500'
                        : phone.length > 11
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                    placeholder="연락처를 입력하세요 (10-11자리)"
                    style={{ fontSize: '16px', minHeight: '48px' }}
                  />
                  <p className="text-xs md:text-sm lg:text-base text-gray-500 mt-1 md:mt-2 ml-1 leading-relaxed">
                    {phone.length > 0 && phone.length < 10 && (
                      <span className="text-yellow-600">{phone.length}자리 입력됨 - 10자리 또는 11자리까지 입력해주세요</span>
                    )}
                    {phone.length === 10 && !isValidPhone && (
                      <span className="text-yellow-600">10자리 입력됨 - 11자리도 가능합니다</span>
                    )}
                    {phone.length === 11 && !isValidPhone && (
                      <span className="text-red-600">올바른 형식이 아닙니다</span>
                    )}
                    {isValidPhone && (
                      <span className="text-green-600">✓ 올바른 형식입니다 ({phone.length}자리)</span>
                    )}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm md:text-base lg:text-lg font-semibold text-gray-700 mb-2 md:mb-3">
                    비밀번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="off"
                    className="w-full bg-gray-50 border-2 border-gray-300 rounded-lg md:rounded-xl px-4 py-3 md:px-5 md:py-4 text-base md:text-lg lg:text-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    placeholder="비밀번호를 입력하세요"
                    style={{ fontSize: '16px', minHeight: '48px' }}
                  />
                  <p className="text-xs md:text-sm lg:text-base text-blue-600 mt-1 md:mt-2 ml-1 leading-relaxed font-medium">
                    비밀번호는 크루즈닷 상담 매니저님이 알려드려요
                  </p>
                </div>
              </div>

              {/* 3일 무료체험 시작 버튼 (로그인 제출) */}
              <button
                type="submit"
                disabled={!isFormValid}
                className="w-full bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:via-blue-800 hover:to-indigo-800 text-white font-bold text-lg md:text-xl lg:text-2xl py-4 md:py-5 lg:py-6 rounded-lg md:rounded-xl shadow-xl md:shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none relative overflow-hidden group flex items-center justify-center"
                style={{ minHeight: '52px' }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2 md:gap-3">
                  <span className="text-xl md:text-2xl lg:text-3xl">🚀</span>
                  <span>3일 무료체험 시작</span>
                  <span className="text-xl md:text-2xl lg:text-3xl">✨</span>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              </button>

              {/* 상담신청하기 버튼 */}
              <a
                href="https://www.cruisedot.co.kr/i/6nx"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-gradient-to-r from-green-600 via-green-700 to-emerald-700 hover:from-green-700 hover:via-green-800 hover:to-emerald-800 text-white font-bold text-base md:text-lg lg:text-xl py-3 md:py-4 lg:py-5 rounded-lg md:rounded-xl shadow-lg md:shadow-xl hover:shadow-green-500/50 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group flex items-center justify-center"
                style={{ minHeight: '48px' }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2 md:gap-3">
                  <span className="text-lg md:text-xl">💬</span>
                  <span>상담신청하기</span>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              </a>
            </form>

            {/* 하단 링크 */}
            <div className="pt-4 md:pt-6 border-t-2 border-gray-200 space-y-3 md:space-y-4">
              <div className="flex flex-col gap-3 md:gap-4">
                {/* 카카오톡 공유하기 버튼 */}
                <KakaoShareButton
                  title="크루즈닷AI 3일 무료체험"
                  description="프리미엄 크루즈 여행을 위한 AI 파트너와 함께하세요! 72시간 동안 모든 기능을 무료로 체험할 수 있습니다."
                  imageUrl="/images/ai-cruise-logo.png"
                  buttonText="카카오톡 친구 공유하기"
                />
                
                <a
                  href="/"
                  className="inline-flex items-center justify-center px-5 py-3 md:px-6 md:py-4 bg-gray-100 hover:bg-gray-200 border-2 border-gray-300 rounded-lg md:rounded-xl text-gray-700 font-semibold text-sm md:text-base lg:text-lg transition-all duration-200"
                  style={{ minHeight: '48px' }}
                >
                  크루즈몰 구경하기
                </a>
              </div>
              
              <p className="text-center text-xs md:text-sm lg:text-base text-gray-500 mt-3 md:mt-4 leading-relaxed">
                72시간 동안 모든 프리미엄 기능을 무료로 체험하세요
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TestLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center">로딩 중...</div>}>
      <TestLoginPageContent />
    </Suspense>
  );
}

