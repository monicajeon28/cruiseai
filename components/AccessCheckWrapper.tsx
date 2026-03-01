'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

type AccessStatus = {
  allowed: boolean;
  status: 'active' | 'grace_period' | 'expired' | 'locked';
  reason?: string;
  message?: string;
  remainingHours?: number;
};

// 접근 체크를 건너뛸 공개 경로
const PUBLIC_PATHS = ['/login', '/login-test', '/admin/login', '/mall/login', '/mall/signup'];
// 관리자 경로는 접근 체크 건너뛰기 (관리자는 AdminLayout에서 인증 확인)
const ADMIN_PATHS = ['/admin'];
// 크루즈몰 경로는 "다음 여행 등록" 메시지를 표시하지 않음 (상태 표시만)
const MALL_PATHS = ['/community', '/products'];
// 어필리에이트 경로는 접근 체크 건너뛰기 (어필리에이트는 별도 인증)
const AFFILIATE_PATHS = ['/affiliate', '/partner'];
// 판매원 개인몰 경로 (동적 경로: /[mallUserId]/dashboard, /[mallUserId]/shop 등)
const PARTNER_MALL_PATHS = ['/dashboard', '/shop', '/customers', '/payment', '/profile'];
// 테스트 모드 경로 (3일 체험) - 공개 경로로 처리
// -test로 끝나는 모든 경로는 접근 체크 건너뛰기
const isTestModePath = (pathname: string) => pathname.endsWith('-test') || pathname.includes('/-test/');

const ACCESS_CACHE_KEY = 'app-access-check';
const ACCESS_CACHE_TTL = 5 * 60 * 1000; // 5분

const getCachedAccess = () => {
  try {
    const cached = sessionStorage.getItem(ACCESS_CACHE_KEY);
    if (cached) {
      const { data, ts } = JSON.parse(cached);
      if (Date.now() - ts < ACCESS_CACHE_TTL) return data;
    }
  } catch { }
  return null;
};

const setCachedAccess = (data: unknown) => {
  try {
    sessionStorage.setItem(ACCESS_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch { }
};

export default function AccessCheckWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // pathname이 아직 로드되지 않았으면 대기
    if (!pathname) {
      return;
    }

    // 공개 경로는 접근 체크 건너뛰기 (즉시 처리)
    if (PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path))) {
      setIsChecking(false);
      setAccessStatus({
        allowed: true,
        status: 'active',
      });
      return;
    }

    // 테스트 모드 경로도 3일 체험 만료 체크 필요
    // -test로 끝나는 경로는 별도의 체험 만료 체크 수행
    if (isTestModePath(pathname)) {
      const checkTestAccess = async () => {
        // sessionStorage 캐시 확인 (페이지 전환마다 API 호출 제거)
        const cachedData = getCachedAccess();
        if (cachedData) {
          if (!cachedData.allowed && cachedData.reason === 'trial_expired') {
            setAccessStatus({ allowed: false, status: 'expired', reason: cachedData.reason, message: cachedData.message });
            setShowModal(true);
          } else {
            setAccessStatus({ allowed: true, status: 'active' });
          }
          setIsChecking(false);
          return;
        }

        try {
          const response = await fetch('/api/user/access-check', {
            credentials: 'include',
          });
          const data = await response.json();
          setCachedAccess(data);

          if (data.ok) {
            // 3일 체험 만료 체크 (reason: 'trial_expired')
            if (!data.allowed && data.reason === 'trial_expired') {
              setAccessStatus({
                allowed: false,
                status: 'expired',
                reason: data.reason,
                message: data.message || '3일 체험이 종료되었습니다.',
              });
              setShowModal(true);
            } else {
              // 체험 중이거나 다른 이유로 허용
              setAccessStatus({
                allowed: true,
                status: 'active',
              });
            }
          } else {
            // 체크 실패 시 허용 (세션 없음 등)
            setAccessStatus({
              allowed: true,
              status: 'active',
            });
          }
        } catch (error) {
          console.error('[AccessCheck] Test mode check failed:', error);
          // 에러 시 허용
          setAccessStatus({
            allowed: true,
            status: 'active',
          });
        } finally {
          setIsChecking(false);
        }
      };

      checkTestAccess();
      return;
    }

    // 관리자 경로는 접근 체크 건너뛰기 (AdminLayout에서 인증 확인)
    if (ADMIN_PATHS.some(path => pathname.startsWith(path))) {
      setIsChecking(false);
      setAccessStatus({ allowed: true, status: 'active' });
      return;
    }

    // 어필리에이트 경로는 접근 체크 건너뛰기 (어필리에이트는 별도 인증)
    if (AFFILIATE_PATHS.some(path => pathname.startsWith(path))) {
      setIsChecking(false);
      setAccessStatus({ allowed: true, status: 'active' });
      return;
    }

    // 판매원 개인몰 경로는 접근 체크 건너뛰기
    const pathSegments = pathname.split('/').filter(Boolean);
    if (pathSegments.length >= 2 && PARTNER_MALL_PATHS.includes(`/${pathSegments[1]}`)) {
      setIsChecking(false);
      setAccessStatus({ allowed: true, status: 'active' });
      return;
    }

    // 크루즈몰 경로는 모달 표시하지 않음
    if (MALL_PATHS.some(path => pathname === path || pathname.startsWith(path)) || pathname === '/') {
      setIsChecking(false);
      setAccessStatus({ allowed: true, status: 'active' });
      return;
    }

    // 공개 경로가 아닌 경우에만 접근 체크
    const checkAccess = async () => {
      // sessionStorage 캐시 확인 (페이지 전환마다 200-500ms 절약)
      const cachedData = getCachedAccess();
      if (cachedData?.ok) {
        setAccessStatus({
          allowed: cachedData.allowed,
          status: cachedData.status,
          reason: cachedData.reason,
          message: cachedData.message,
          remainingHours: cachedData.remainingHours,
        });
        if (!cachedData.allowed) setShowModal(true);
        setIsChecking(false);
        return;
      }

      try {
        const response = await fetch('/api/user/access-check', {
          credentials: 'include',
        });
        const data = await response.json();

        if (data.ok) {
          setCachedAccess(data);
          setAccessStatus({
            allowed: data.allowed,
            status: data.status,
            reason: data.reason,
            message: data.message,
            remainingHours: data.remainingHours,
          });

          if (!data.allowed) {
            setShowModal(true);
          }
        } else {
          setAccessStatus({ allowed: true, status: 'active' });
        }
      } catch {
        setAccessStatus({ allowed: true, status: 'active' });
      } finally {
        setIsChecking(false);
      }
    };

    checkAccess();
  }, [pathname]);

  // 체크 중이면 로딩 표시하지 않음 (기존 기능 유지)
  if (isChecking) {
    return <>{children}</>;
  }

  // 접근 허용이면 기존 기능 그대로 표시
  if (accessStatus?.allowed) {
    return <>{children}</>;
  }

  // 접근 불가 시 모달 표시 및 재구매 유도 (크루즈 가이드 지니에서만 표시)
  // 크루즈몰 경로에서는 모달을 표시하지 않음
  const isMallPath = MALL_PATHS.some(path => pathname === path || pathname.startsWith(path)) || pathname === '/';

  // 3일 체험 만료 여부 확인
  const isTrialExpired = accessStatus?.reason === 'trial_expired';

  return (
    <>
      {children}
      {showModal && !isMallPath && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-2 ${isTrialExpired ? 'border-orange-200' : 'border-red-200'}`}>
            <div className="text-center mb-6">
              <div className={`w-16 h-16 ${isTrialExpired ? 'bg-orange-100' : 'bg-red-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                <span className="text-3xl">{isTrialExpired ? '🎁' : '⏰'}</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {isTrialExpired ? '3일 무료체험이 종료되었습니다' : '여행이 종료되었습니다'}
              </h2>
              <p className="text-gray-600">
                {accessStatus?.message || (isTrialExpired
                  ? '3일 체험 기간이 만료되었습니다.'
                  : '여행 종료 후 사용 기간이 만료되었습니다.')}
              </p>
            </div>

            <div className={`${isTrialExpired ? 'bg-orange-50' : 'bg-blue-50'} rounded-lg p-4 mb-6`}>
              <p className="text-sm text-gray-700 text-center">
                {isTrialExpired
                  ? '크루즈 여행을 구매하시면 크루즈닷의 모든 기능을 이용하실 수 있습니다!'
                  : '새로운 여행을 등록하시면 크루즈닷을 다시 만나실 수 있습니다!'}
              </p>
            </div>

            <div className="space-y-3">
              <Link
                href="/products"
                className={`block w-full px-6 py-3 ${isTrialExpired ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg font-semibold text-center`}
              >
                {isTrialExpired ? '크루즈 여행 둘러보기' : '다음 여행 등록하기'}
              </Link>
              <button
                onClick={() => {
                  // 모달 닫기 (하지만 여전히 접근 불가)
                  setShowModal(false);
                }}
                className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}






