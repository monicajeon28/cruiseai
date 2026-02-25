'use client';

import { useEffect, useState, useRef, useMemo } from 'react';

import { motion, useSpring, useTransform, useMotionValue, animate } from 'framer-motion';

// Framer Motion을 사용한 부드러운 숫자 애니메이션 컴포넌트
function AnimatedNumber({
  value,
  duration = 1,
  delay = 0,
  className = "",
  prefix = "",
  suffix = ""
}: {
  value: number;
  duration?: number;
  delay?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { damping: 30, stiffness: 100 });
  const displayValue = useTransform(springValue, (latest) => {
    return prefix + Math.floor(latest).toLocaleString('ko-KR') + suffix;
  });

  useEffect(() => {
    // 초기 애니메이션 및 값 변경 시 애니메이션
    const controls = animate(motionValue, value, {
      duration: duration,
      delay: delay,
      ease: "easeOut"
    });

    return () => controls.stop();
  }, [value, duration, delay, motionValue]);

  return <motion.span className={className}>{displayValue}</motion.span>;
}

// 라이브 스탯 훅 (값 관리만 담당)
function useLiveStatsValue(
  initialTarget: number,
  incrementAmount: number = 0,
  incrementInterval: number = 0
) {
  const [currentValue, setCurrentValue] = useState(0); // 0부터 시작
  const [targetValue, setTargetValue] = useState(initialTarget);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // 마운트 시 0 -> initialTarget으로 애니메이션 트리거
    // 약간의 지연을 두어 렌더링 후 애니메이션 시작
    const timer = setTimeout(() => {
      setCurrentValue(initialTarget);
    }, 100);
    return () => clearTimeout(timer);
  }, [initialTarget]);

  useEffect(() => {
    if (!isMounted || incrementInterval === 0 || incrementAmount === 0) return;

    const intervalId = setInterval(() => {
      setCurrentValue(prev => prev + incrementAmount);
    }, incrementInterval);

    return () => clearInterval(intervalId);
  }, [isMounted, incrementInterval, incrementAmount]);

  return currentValue;
}

interface CompanyStatsConfig {
  title: string;
  subtitle: string;
  satisfactionScore: number;
  topRowCards: Array<{
    icon: string;
    value: string;
    description: string;
  }>;
  bottomRowCards: Array<{
    icon: string;
    value: string;
    description: string;
    bgColor: 'blue' | 'yellow' | 'green';
    autoIncrement?: boolean;
    incrementInterval?: number;
    incrementAmount?: number;
  }>;
}



const defaultConfig: CompanyStatsConfig = {
  title: '크루즈닷의 경험과 신뢰',
  subtitle: '직접 여행해보고 꼼꼼히 따져보는 크루즈 전문',
  satisfactionScore: 4.8,
  topRowCards: [
    { icon: '👨‍💼', value: '총 67회', description: '상담 매니저 크루즈 경험' },
    { icon: '✈️', value: '11년~', description: '패키지 크루즈 인솔자 경력' },
    { icon: '🏢', value: '11년~', description: '크루즈 서비스만 연구한시간' },
  ],
  bottomRowCards: [
    { icon: '📊', value: '222명', description: '다음 크루즈 준비', bgColor: 'blue', autoIncrement: true, incrementInterval: 3, incrementAmount: 3 },
    { icon: '💬', value: '13,491', description: '지금 크루즈 문의', bgColor: 'yellow', autoIncrement: true, incrementInterval: 5, incrementAmount: 9 },
    { icon: '🎉', value: '3217명', description: '크루즈닷 회원', bgColor: 'green' },
  ],
};

export default function CompanyStatsSection({ config }: { config?: CompanyStatsConfig }) {

  // 각 숫자의 현재 값 관리 (값만 관리하고 렌더링은 AnimatedNumber에 위임)
  // 1. 222명: 5초마다 7명씩 증가
  const val1 = useLiveStatsValue(222, 7, 5000);

  // 2. 13,491: 4초마다 13씩 증가
  const val2 = useLiveStatsValue(13491, 13, 4000);

  // 3. 3217명: 5초마다 56명씩 증가
  const val3 = useLiveStatsValue(3217, 56, 5000);

  // finalConfig 복구 및 메모이제이션
  const finalConfig: CompanyStatsConfig = useMemo(() => ({
    title: config?.title || defaultConfig.title,
    subtitle: config?.subtitle || defaultConfig.subtitle,
    satisfactionScore: config?.satisfactionScore || defaultConfig.satisfactionScore,
    topRowCards: defaultConfig.topRowCards,
    bottomRowCards: defaultConfig.bottomRowCards,
  }), [config?.title, config?.subtitle, config?.satisfactionScore]);

  return (
    <section className="relative bg-white py-12 sm:py-16 md:py-20 lg:py-24 overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10">
        {/* 상단 배너 배경 이미지 */}
        <div className="relative w-full h-48 sm:h-64 md:h-80 lg:h-96 rounded-2xl overflow-hidden shadow-2xl mb-10 sm:mb-12 md:mb-16 lg:mb-20">
          <div
            className="absolute inset-0 w-full h-full bg-cover bg-center animate-subtle-zoom"
            style={{
              backgroundImage: `url('${encodeURI('/크루즈정보사진/크루즈배경이미지/고화질배경이미지 (5).png')}')`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#051C2C]/80 via-[#051C2C]/40 to-transparent"></div>

          <div className="absolute inset-0 flex flex-col items-center justify-end pb-8 sm:pb-12 md:pb-16 text-white z-10">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-2 sm:mb-4 drop-shadow-2xl text-center px-4">
              {finalConfig.title}
            </h2>
            <p className="text-lg sm:text-xl md:text-2xl font-semibold drop-shadow-lg text-center px-4 text-[#FDB931]">
              {finalConfig.subtitle}
            </p>
          </div>
        </div>

        {/* 별점 및 만족도 표시 */}
        <div className="text-center mb-10 sm:mb-12 md:mb-16 lg:mb-20">
          <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 md:gap-5 mb-6">
            <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4">
              {[...Array(4)].map((_, i) => (
                <svg
                  key={i}
                  className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 text-[#FDB931] drop-shadow-lg"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16">
                <svg
                  className="w-full h-full"
                  viewBox="0 0 20 20"
                  fill="none"
                >
                  <defs>
                    <clipPath id="halfStar">
                      <rect x="0" y="0" width="10" height="20" />
                    </clipPath>
                  </defs>
                  <path
                    d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                    fill="#d1d5db"
                  />
                  <path
                    d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                    fill="#FDB931"
                    clipPath="url(#halfStar)"
                    className="drop-shadow-lg"
                  />
                </svg>
              </div>
            </div>
            <div className="text-center px-2">
              <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-[#051C2C] font-bold mb-1 sm:mb-2">
                고객 만족도
              </p>
              <p className="text-[#E50914] text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black drop-shadow-lg">
                {finalConfig.satisfactionScore}점
              </p>
            </div>
          </div>
        </div>

        {/* 상단 통계 카드 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-10 sm:mb-12 md:mb-16">
          {finalConfig.topRowCards.map((card, idx) => (
            <div
              key={idx}
              className="group relative bg-white rounded-xl sm:rounded-2xl p-6 sm:p-8 md:p-10 shadow-lg hover:shadow-2xl border border-gray-100 hover:border-[#D4AF37] transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="relative text-center">
                <div className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-3 sm:mb-4 md:mb-6 transform group-hover:scale-110 transition-transform duration-300">
                  {card.icon}
                </div>
                <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-[#051C2C] mb-3 sm:mb-4 md:mb-6 leading-none">
                  {card.value}
                </div>
                <div className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-600 font-semibold leading-relaxed">
                  {card.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 하단 통계 카드 - 럭셔리 디자인 (Deep Ocean Bg + Gold Text) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          {finalConfig.bottomRowCards.map((card, idx) => {
            // 동적 값 표시 (AnimatedNumber 컴포넌트 사용)
            let currentValue = 0;
            let suffix = '';

            if (idx === 0) {
              currentValue = val1;
              suffix = '명';
            } else if (idx === 1) {
              currentValue = val2;
              suffix = '';
            } else if (idx === 2) {
              currentValue = val3;
              suffix = '명';
            }

            return (
              <div
                key={idx}
                className="group relative bg-[#051C2C] rounded-xl sm:rounded-2xl p-6 sm:p-8 md:p-10 text-center shadow-xl hover:shadow-2xl border border-[#051C2C] hover:border-[#D4AF37] transition-all duration-300 transform hover:-translate-y-1 overflow-hidden"
              >
                {/* 배경 패턴 */}
                <div className="absolute inset-0 bg-[url('/images/pattern-overlay.png')] opacity-10"></div>

                {/* 골드 그라데이션 보더 효과 */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D4AF37] via-[#FDB931] to-[#D4AF37] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                <div className="relative z-10">
                  <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl mb-3 sm:mb-4 md:mb-6 transform group-hover:scale-110 transition-transform duration-300">
                    {card.icon}
                  </div>
                  <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-[#FDB931] mb-2 sm:mb-3 md:mb-4 leading-none drop-shadow-sm">
                    <AnimatedNumber
                      value={currentValue}
                      suffix={suffix}
                      duration={2} // 부드러운 전환을 위해 2초 동안 애니메이션
                    />
                  </div>
                  <div className="text-sm sm:text-base md:text-lg lg:text-xl text-blue-100 font-semibold leading-relaxed">
                    {card.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
