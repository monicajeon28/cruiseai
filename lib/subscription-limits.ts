// lib/subscription-limits.ts
// 구독 및 무료 체험 기능 제한 관리

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface SubscriptionInfo {
  isTrial: boolean;
  trialEndDate: Date | null;
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  endDate: Date | null;
}

/**
 * 사용자의 구독 정보 조회
 */
export async function getSubscriptionInfo(userId: number): Promise<SubscriptionInfo | null> {
  try {
    // AffiliateContract에서 SUBSCRIPTION_AGENT 타입 조회
    const contract = await prisma.affiliateContract.findFirst({
      where: {
        userId,
        metadata: {
          path: ['contractType'],
          equals: 'SUBSCRIPTION_AGENT',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!contract) {
      return null;
    }

    const metadata = (contract.metadata as any) || {};
    const now = new Date();
    const trialEndDate = metadata.trialEndDate ? new Date(metadata.trialEndDate) : null;
    const endDate = contract.contractEndDate;

    // 무료 체험 중인지 확인
    const isTrial = metadata.isTrial === true && trialEndDate && now < trialEndDate;

    // 상태 결정
    let status: 'trial' | 'active' | 'expired' | 'cancelled';
    if (isTrial) {
      status = 'trial';
    } else if (contract.status === 'completed' && endDate && now < endDate) {
      status = 'active';
    } else if (contract.status === 'terminated') {
      status = 'cancelled';
    } else {
      status = 'expired';
    }

    return {
      isTrial,
      trialEndDate,
      status,
      endDate,
    };
  } catch (error: any) {
    logger.error('[getSubscriptionInfo] Error:', error);
    return null;
  }
}

/**
 * 무료 체험 중인지 확인
 */
export async function isInTrial(userId: number): Promise<boolean> {
  const info = await getSubscriptionInfo(userId);
  return info?.isTrial === true;
}

/**
 * 기능 사용 권한 확인
 * @param userId 사용자 ID
 * @param feature 기능 이름
 * @returns 사용 가능 여부
 */
export async function canUseFeature(
  userId: number,
  feature: 'link-create' | 'sale-confirm' | 'dashboard-basic' | 'lead-view' | 'stats-basic' | 'customer-management' | 'sale-management' | 'stats-detail' | 'team-management' | 'report-advanced' | 'data-export' | 'api-access' | 'contract-invite' | 'commission-adjust' | 'advanced-settings' | 'profile-edit'
): Promise<boolean> {
  const info = await getSubscriptionInfo(userId);

  // 구독 정보가 없으면 모든 기능 사용 불가
  if (!info) {
    return false;
  }

  // 무료 체험 중인 경우 (30% 기능만)
  if (info.isTrial) {
    // 허용된 기능만 사용 가능 (30% - 판매만 가능)
    const allowedFeatures: string[] = [
      'my-mall',              // 나의 판매몰
      'link-create',         // 링크 관리
      'customer-management', // 나의 고객관리
      'purchased-customers', // 구매고객 관리
      'profile-edit',        // 프로필 수정
    ];
    return allowedFeatures.includes(feature);
  }

  // 정식 구독 중인 경우 (50% 기능만 - 보안 및 대리점장 관리 리스크 방지)
  if (info.status === 'active') {
    // 허용된 기능 (50% - 기본 판매 활동 중심)
    const allowedFeatures: string[] = [
      'my-mall',              // 나의 판매몰
      'link-create',         // 링크 관리
      'customer-management', // 나의 고객관리
      'purchased-customers', // 구매고객 관리
      'companion-registration', // 크루즈 가이드 동행인 등록
      'customer-group-management', // 고객 그룹 관리
      'profile-edit',        // 프로필 수정
      'sns-profile',         // 나의 SNS 프로필
    ];
    return allowedFeatures.includes(feature);
  }

  // 만료된 경우 모든 기능 사용 불가
  return false;
}

/**
 * 기능 타입 확인 (대리점장 전용 / 판매원 전용)
 */
export function getFeatureType(feature: string): 'branch-manager' | 'sales-agent' | 'subscription' {
  // 대리점장 전용 기능
  const branchManagerFeatures = [
    'team-management',
    'stats-detail',
    'report-advanced',
    'data-export',
    'api-access',
    'contract-invite',
    'commission-adjust',
    'advanced-settings',
    'view-contract', // 나의 계약서 보기
  ];

  // 판매원 전용 기능 (마비즈 VIP 판매원)
  const salesAgentFeatures = [
    // 판매원 전용 기능이 있다면 여기에 추가
  ];

  if (branchManagerFeatures.includes(feature)) {
    return 'branch-manager';
  }

  if (salesAgentFeatures.includes(feature)) {
    return 'sales-agent';
  }

  return 'subscription';
}

/**
 * 기능 제한 메시지 반환
 */
export function getFeatureRestrictionMessage(
  feature: string,
  isTrial: boolean = false,
  isActive: boolean = false
): string {
  const featureType = getFeatureType(feature);

  if (featureType === 'branch-manager') {
    return '대리점장님 기능입니다. 정액제는 쓸 수 없어요 ㅠㅠ 담당 점장님과 상의 해 주세요';
  }

  if (featureType === 'sales-agent') {
    return '마비즈 VIP 판매원 기능입니다. 정액제는 쓸 수 없어요 ㅠㅠ 담당 점장님과 상의 해 주세요';
  }

  // 정액제 기능이지만 사용 불가능한 경우
  if (isTrial) {
    return '지금은 무료 사용 중이십니다. 다른 기능은 사용할 수 없어요 ㅠㅠ';
  }

  if (!isActive) {
    return '이 기능은 정액제 구독 후 이용 가능합니다.';
  }

  return '이 기능은 사용할 수 없습니다.';
}

