'use client';

import { FiCheckCircle, FiClock, FiShoppingBag, FiUser, FiMessageSquare, FiPhone, FiLink, FiRefreshCw, FiRepeat } from 'react-icons/fi';

interface CustomerStatusBadgesProps {
  testModeStartedAt: string | null | undefined;
  customerStatus: string | null | undefined;
  customerSource?: string | null | undefined; // 고객 출처 추가
  mallUserId: string | null | undefined;
  totalTripCount?: number; // 재구매 횟수
  className?: string;
}

/**
 * 고객 상태 딱지 컴포넌트
 * - 3일 체험 중: testModeStartedAt이 있으면 표시
 * - 일반 크루즈 가이드: testModeStartedAt이 없고 customerStatus가 'active' 또는 'package'면 표시
 * - 크루즈몰 가입: mallUserId가 있으면 표시
 */
export default function CustomerStatusBadges({
  testModeStartedAt,
  customerStatus,
  customerSource,
  mallUserId,
  totalTripCount = 0,
  className = '',
}: CustomerStatusBadgesProps) {
  // 크루즈가이드 지니 3일 체험: customerStatus: 'test' 또는 'test-locked', customerSource: 'test-guide'
  const isTrialUser = !!testModeStartedAt ||
    (customerStatus === 'test' && customerSource === 'test-guide') ||
    (customerStatus === 'test-locked' && customerSource === 'test-guide');
  // 크루즈가이드 지니 (결제 고객): customerStatus: 'active' 또는 'package', customerSource: 'cruise-guide'
  // test-locked 상태가 아니어야 함 (3일 체험 완료 고객은 제외)
  const isRegularGenie = !testModeStartedAt &&
    customerStatus !== 'test' &&
    customerStatus !== 'test-locked' &&
    (customerStatus === 'active' || customerStatus === 'package') &&
    customerSource === 'cruise-guide';
  const isMallUser = !!mallUserId;

  const badges = [];

  // 3일체험
  if (isTrialUser) {
    badges.push({
      label: '3일체험',
      icon: <FiClock className="w-3 h-3" />,
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700',
      borderColor: 'border-orange-200',
    });
  }

  // 지니체험 (결제 고객)
  if (isRegularGenie) {
    badges.push({
      label: '크루즈닷체험',
      icon: <FiUser className="w-3 h-3" />,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-200',
    });
  }

  // B2B유입
  if (customerSource === 'B2B_INFLOW') {
    badges.push({
      label: 'B2B유입',
      icon: <FiUser className="w-3 h-3" />,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-200',
    });
  }

  // B2B시스템
  if (customerSource === 'TRIAL_DASHBOARD') {
    badges.push({
      label: 'B2B시스템',
      icon: <FiMessageSquare className="w-3 h-3" />,
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      borderColor: 'border-green-200',
    });
  }

  // B2B유입 (파트너 랜딩)
  if (customerSource === 'B2B_LANDING') {
    badges.push({
      label: 'B2B유입',
      icon: <FiUser className="w-3 h-3" />,
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      borderColor: 'border-purple-200',
    });
  }

  // 크루즈몰
  if (isMallUser) {
    badges.push({
      label: '크루즈몰',
      icon: <FiShoppingBag className="w-3 h-3" />,
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      borderColor: 'border-purple-200',
    });
  }

  // 전화문의
  if (customerSource === 'phone-consultation') {
    badges.push({
      label: '전화문의',
      icon: <FiPhone className="w-3 h-3" />,
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700',
      borderColor: 'border-yellow-200',
    });
  }

  // 랜딩유입
  if (customerSource === 'landing-page') {
    badges.push({
      label: '랜딩유입',
      icon: <FiLink className="w-3 h-3" />,
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-700',
      borderColor: 'border-indigo-200',
    });
  }

  // 구매확정
  if (customerStatus === 'purchase_confirmed') {
    badges.push({
      label: '구매확정',
      icon: <FiCheckCircle className="w-3 h-3" />,
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      borderColor: 'border-green-200',
    });
  }

  // 환불
  if (customerStatus === 'refunded') {
    badges.push({
      label: '환불',
      icon: <FiRefreshCw className="w-3 h-3" />,
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
      borderColor: 'border-red-200',
    });
  }

  // 재구매N회 (2회 이상)
  if (totalTripCount >= 2) {
    badges.push({
      label: `재구매${totalTripCount}회`,
      icon: <FiRepeat className="w-3 h-3" />,
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-700',
      borderColor: 'border-emerald-200',
    });
  }

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {badges.map((badge, index) => (
        <span
          key={index}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border ${badge.bgColor} ${badge.textColor} ${badge.borderColor}`}
        >
          {badge.icon}
          {badge.label}
        </span>
      ))}
    </div>
  );
}


