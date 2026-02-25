import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

// PartnerCustomerGroup 모델을 위한 include 설정
// PartnerCustomerGroup은 간단한 구조로 CustomerGroupMember 등 관련 테이블이 없음
export const partnerGroupInclude = {
  AffiliateProfile: {
    select: {
      id: true,
      displayName: true,
      type: true,
    },
  },
} satisfies Prisma.PartnerCustomerGroupInclude;

export type PartnerGroupWithRelations = Prisma.PartnerCustomerGroupGetPayload<{
  include: typeof partnerGroupInclude;
}>;

export const serializePartnerGroup = (group: PartnerGroupWithRelations, leadCount?: number) => ({
  id: group.id,
  name: group.name,
  description: group.description,
  color: group.color,
  productCode: group.productCode,
  profileId: group.profileId,
  createdAt: group.createdAt instanceof Date ? group.createdAt.toISOString() : group.createdAt,
  updatedAt: group.updatedAt instanceof Date ? group.updatedAt.toISOString() : group.updatedAt,
  leadCount: leadCount ?? 0,
  funnelTalkIds: Array.isArray(group.funnelTalkIds) ? group.funnelTalkIds : (group.funnelTalkIds ? [group.funnelTalkIds] : []),
  funnelSmsIds: Array.isArray(group.funnelSmsIds) ? group.funnelSmsIds : (group.funnelSmsIds ? [group.funnelSmsIds] : []),
  funnelEmailIds: Array.isArray(group.funnelEmailIds) ? group.funnelEmailIds : (group.funnelEmailIds ? [group.funnelEmailIds] : []),
  reEntryHandling: group.reEntryHandling || null,
  affiliateProfile: group.AffiliateProfile ? {
    id: group.AffiliateProfile.id,
    displayName: group.AffiliateProfile.displayName,
    type: group.AffiliateProfile.type,
  } : null,
});

// 대리점장인 경우 팀 판매원 ID 목록 조회
export async function getTeamAgentIds(profileId: number, profileType: string): Promise<number[]> {
  if (profileType !== 'BRANCH_MANAGER') {
    return [];
  }

  const teamRelations = await prisma.affiliateRelation.findMany({
    where: {
      managerId: profileId,
      status: 'ACTIVE',
    },
    select: {
      agentId: true,
    },
  });

  return teamRelations
    .map(r => r.agentId)
    .filter((id): id is number => id !== null);
}

// 기본 소유권 필터 (자신의 그룹만)
export const buildOwnershipFilter = (
  profileId: number
): Prisma.PartnerCustomerGroupWhereInput => {
  return { profileId };
};

// 대리점장인 경우 팀 판매원 그룹도 포함하는 필터
export const buildExtendedOwnershipFilter = (
  profileId: number,
  teamAgentIds: number[]
): Prisma.PartnerCustomerGroupWhereInput => {
  if (teamAgentIds.length === 0) {
    return { profileId };
  }

  return {
    OR: [
      { profileId },
      { profileId: { in: teamAgentIds } },
    ],
  };
};

export const buildScopedGroupWhere = (
  groupId: number,
  profileId: number,
  teamAgentIds?: number[]
): Prisma.PartnerCustomerGroupWhereInput => {
  const ownershipFilter = teamAgentIds && teamAgentIds.length > 0
    ? buildExtendedOwnershipFilter(profileId, teamAgentIds)
    : buildOwnershipFilter(profileId);

  return {
    AND: [{ id: groupId }, ownershipFilter],
  };
};
