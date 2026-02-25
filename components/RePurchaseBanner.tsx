'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FiAlertCircle, FiX } from 'react-icons/fi';

type AccessStatus = {
  allowed: boolean;
  status: 'active' | 'grace_period' | 'expired' | 'locked';
  remainingHours?: number;
  endDate?: string;
  gracePeriodEnd?: string;
};

// 크루즈몰 경로는 배너를 표시하지 않음
const MALL_PATHS = ['/community', '/products'];

/**
 * 재구매 유도 배너
 * - 여행 종료 D-1일 알림
 * - 유예 기간 종료 알림
 * - 크루즈 가이드 지니에서만 표시 (크루즈몰에서는 표시하지 않음)
 */
export default function RePurchaseBanner() {
  const pathname = usePathname();
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // 크루즈몰 경로에서는 배너를 표시하지 않음
    if (!pathname) return;
    
    const isMallPath = MALL_PATHS.some(path => pathname === path || pathname.startsWith(path)) || pathname === '/';
    if (isMallPath) {
      setIsVisible(false);
      return;
    }

    const checkStatus = async () => {
      try {
        const response = await fetch('/api/user/access-check', {
          credentials: 'include',
        });
        const data = await response.json();

        if (data.ok) {
          setAccessStatus({
            allowed: data.allowed,
            status: data.status,
            remainingHours: data.remainingHours,
            endDate: data.endDate,
            gracePeriodEnd: data.gracePeriodEnd,
          });

          // 유예 기간 중이거나 만료된 경우 배너 표시
          if (data.status === 'grace_period' || data.status === 'expired') {
            // localStorage에서 닫힘 상태 확인
            const bannerKey = `rePurchaseBanner:${data.endDate || 'general'}`;
            const isDismissed = localStorage.getItem(bannerKey);
            if (!isDismissed) {
              setIsVisible(true);
            }
          }
        }
      } catch (error) {
        console.error('[RePurchaseBanner] Failed to check status:', error);
      }
    };

    checkStatus();
  }, [pathname]);

  const handleDismiss = () => {
    setIsVisible(false);
    setDismissed(true);
    if (accessStatus?.endDate) {
      const bannerKey = `rePurchaseBanner:${accessStatus.endDate}`;
      localStorage.setItem(bannerKey, 'true');
    }
  };

  if (!isVisible || !accessStatus || dismissed) {
    return null;
  }

  // 유예 기간 중 (여행 종료 후 1일 이내)
  if (accessStatus.status === 'grace_period') {
    const hours = accessStatus.remainingHours || 0;
    return (
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-3 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <FiAlertCircle size={24} className="flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-base">
                여행이 곧 종료됩니다! 남은 시간: 약 {hours}시간
              </p>
              <p className="text-sm opacity-90">
                다음 여행을 등록하시면 크루즈닷을 계속 만나실 수 있습니다.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://www.cruisedot.co.kr/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors whitespace-nowrap"
            >
              다음 크루즈 보러가기
            </a>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              aria-label="닫기"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 유예 기간 종료 (접근 불가 상태)
  if (accessStatus.status === 'expired') {
    return (
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-3 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <FiAlertCircle size={24} className="flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-base">
                여행이 종료되었습니다
              </p>
              <p className="text-sm opacity-90">
                새로운 여행을 등록하시면 크루즈닷을 다시 만나실 수 있습니다!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://www.daumcruise.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-white text-red-600 rounded-lg font-semibold hover:bg-red-50 transition-colors whitespace-nowrap"
            >
              다음 크루즈 보러가기
            </a>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              aria-label="닫기"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}


