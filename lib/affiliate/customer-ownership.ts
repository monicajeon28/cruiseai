// lib/affiliate/customer-ownership.ts
// 어필리에이트 고객 소유권 확인 유틸리티

import prisma from '@/lib/prisma';

export type AffiliateOwnershipSource = 'self-profile' | 'lead-agent' | 'lead-manager' | 'fallback';

export type AffiliateOwnership = {
  ownerType: 'HQ' | 'BRANCH_MANAGER' | 'SALES_AGENT';
  ownerProfileId: number | null;
  ownerName: string | null;
  ownerNickname: string | null;
  ownerAffiliateCode: string | null;
  ownerBranchLabel: string | null;
  ownerStatus: string | null;
  ownerPhone: string | null; // 담당자 연락처
  ownerLandingSlug: string | null; // 판매원/대리점장 몰 URL용
  source: AffiliateOwnershipSource;
  managerProfile: {
    id: number;
    displayName: string | null;
    nickname: string | null;
    affiliateCode: string | null;
    branchLabel: string | null;
    status: string | null;
    contactPhone: string | null; // 대리점장 연락처
    landingSlug: string | null; // 대리점장 몰 URL용
  } | null;
  leadId?: number | null;
  leadStatus?: string | null;
  leadCreatedAt?: string | null;
  normalizedPhone?: string | null;
};

/**
 * 여러 사용자의 어필리에이트 소유권 정보를 일괄 조회
 * @param users 사용자 정보 배열 (id, phone)
 * @returns Map<userId, AffiliateOwnership | null>
 */
export async function getAffiliateOwnershipForUsers(
  users: Array<{ id: number; phone: string | null }>
): Promise<Map<number, AffiliateOwnership | null>> {
  const ownershipMap = new Map<number, AffiliateOwnership | null>();

  if (!users || users.length === 0) {
    return ownershipMap;
  }

  try {
    // 전화번호 정규화 함수
    const normalizePhone = (phone: string | null | undefined): string | null => {
      if (!phone) return null;
      // 숫자만 추출
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 0) return null;
      return digits;
    };

    // 전화번호 목록 생성 (null 제외)
    const phoneList = users
      .map(u => normalizePhone(u.phone))
      .filter((phone): phone is string => phone !== null);

    if (phoneList.length === 0) {
      // 전화번호가 없으면 모든 사용자에 대해 null 반환
      users.forEach(u => ownershipMap.set(u.id, null));
      return ownershipMap;
    }

    // AffiliateLead에서 전화번호로 검색
    const leads = await prisma.affiliateLead.findMany({
      where: {
        customerPhone: {
          in: phoneList,
        },
        status: {
          not: 'CANCELLED',
        },
      },
      include: {
        AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile: {
          select: {
            id: true,
            type: true,
            displayName: true,
            nickname: true,
            affiliateCode: true,
            branchLabel: true,
            status: true,
            contactPhone: true,
            landingSlug: true,
            User: {
              select: {
                phone: true,
              },
            },
          },
        },
        AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
          select: {
            id: true,
            type: true,
            displayName: true,
            nickname: true,
            affiliateCode: true,
            branchLabel: true,
            status: true,
            contactPhone: true,
            landingSlug: true,
            User: {
              select: {
                phone: true,
              },
            },
            AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile: {
              where: { status: 'ACTIVE' },
              select: {
                managerId: true,
                AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile: {
                  select: {
                    id: true,
                    displayName: true,
                    nickname: true,
                    affiliateCode: true,
                    branchLabel: true,
                    status: true,
                    contactPhone: true,
                    landingSlug: true,
                    User: {
                      select: {
                        phone: true,
                      },
                    },
                  },
                },
              },
              take: 1,
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // 최신 리드 우선
      },
    });

    // 전화번호 -> Lead 매핑 생성
    const phoneToLeadMap = new Map<string, typeof leads[0]>();
    leads.forEach((lead: typeof leads[0]) => {
      if (lead.customerPhone) {
        const normalized = normalizePhone(lead.customerPhone);
        if (normalized) {
          // 같은 전화번호에 여러 리드가 있으면 최신 것만 사용
          if (!phoneToLeadMap.has(normalized)) {
            phoneToLeadMap.set(normalized, lead);
          }
        }
      }
    });

    // 각 사용자에 대해 소유권 정보 생성
    users.forEach(user => {
      const normalizedPhone = normalizePhone(user.phone);
      
      if (!normalizedPhone) {
        ownershipMap.set(user.id, null);
        return;
      }

      const lead = phoneToLeadMap.get(normalizedPhone);

      if (!lead) {
        ownershipMap.set(user.id, null);
        return;
      }

      // 판매원이 있으면 판매원 정보 사용
      const agentProfile = lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile;
      if (lead.agentId && agentProfile) {
        const agent = agentProfile;
        const managerRelation = (agent as any).AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile?.[0];
        const managerProfile = managerRelation?.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile || null;

        ownershipMap.set(user.id, {
          ownerType: 'SALES_AGENT',
          ownerProfileId: agent.id,
          ownerName: agent.displayName || null,
          ownerNickname: agent.nickname || null,
          ownerAffiliateCode: agent.affiliateCode || null,
          ownerBranchLabel: agent.branchLabel || null,
          ownerStatus: agent.status || null,
          ownerPhone: agent.contactPhone || (agent as any).User?.phone || null,
          ownerLandingSlug: agent.landingSlug || null,
          source: 'lead-agent',
          managerProfile: managerProfile ? {
            id: managerProfile.id,
            displayName: managerProfile.displayName || null,
            nickname: managerProfile.nickname || null,
            affiliateCode: managerProfile.affiliateCode || null,
            branchLabel: managerProfile.branchLabel || null,
            status: managerProfile.status || null,
            contactPhone: managerProfile.contactPhone || (managerProfile as any).User?.phone || null,
            landingSlug: managerProfile.landingSlug || null,
          } : null,
          leadId: lead.id,
          leadStatus: lead.status || null,
          leadCreatedAt: lead.createdAt?.toISOString() || null,
          normalizedPhone,
        });
        return;
      }

      // 대리점장이 있으면 대리점장 정보 사용
      const leadManagerProfile = lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile;
      if (lead.managerId && leadManagerProfile) {
        const manager = leadManagerProfile;
        ownershipMap.set(user.id, {
          ownerType: 'BRANCH_MANAGER',
          ownerProfileId: manager.id,
          ownerName: manager.displayName || null,
          ownerNickname: manager.nickname || null,
          ownerAffiliateCode: manager.affiliateCode || null,
          ownerBranchLabel: manager.branchLabel || null,
          ownerStatus: manager.status || null,
          ownerPhone: manager.contactPhone || (manager as any).User?.phone || null,
          ownerLandingSlug: manager.landingSlug || null,
          source: 'lead-manager',
          managerProfile: null,
          leadId: lead.id,
          leadStatus: lead.status || null,
          leadCreatedAt: lead.createdAt?.toISOString() || null,
          normalizedPhone,
        });
        return;
      }

      // 리드는 있지만 어필리에이트 정보가 없는 경우
      ownershipMap.set(user.id, null);
    });

    return ownershipMap;
  } catch (error) {
    console.error('[getAffiliateOwnershipForUsers] Error:', error);
    // 에러 발생 시 모든 사용자에 대해 null 반환
    users.forEach(u => ownershipMap.set(u.id, null));
    return ownershipMap;
  }
}
