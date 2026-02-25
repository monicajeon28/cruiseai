import { Prisma } from '@prisma/client';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { leadStatusOptions, type AffiliateLeadStatus } from './constants';

// Prisma 스키마에서 enum이 아닌 String으로 정의되어 있으므로 직접 타입 정의
export type { AffiliateLeadStatus };
export type AffiliateType = 'HQ' | 'BRANCH_MANAGER' | 'SALES_AGENT' | 'CRUISE_STAFF' | 'PRIMARKETER';
export { leadStatusOptions };

export class PartnerApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'PartnerApiError';
    this.status = status;
  }
}

type PartnerContextOptions = {
  includeManagedAgents?: boolean;
};

export async function requirePartnerContext(options: PartnerContextOptions = {}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    console.log('[requirePartnerContext] No session user');
    throw new PartnerApiError('로그인이 필요합니다.', 401);
  }

  console.log('[requirePartnerContext] Session user:', { id: sessionUser.id, name: sessionUser.name });

  const include: Prisma.AffiliateProfileInclude = {
    User: {
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        mallUserId: true,
        mallNickname: true,
      },
    },
    AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile: {
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        managerId: true,
        agentId: true,
        status: true,
        AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile: {
          select: {
            id: true,
            affiliateCode: true,
            type: true,
            displayName: true,
            branchLabel: true,
            User: {
              select: {
                mallUserId: true,
              },
            },
          },
        },
      },
    },
  };

  if (options.includeManagedAgents) {
    include.AffiliateRelation_AffiliateRelation_managerIdToAffiliateProfile = {
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        managerId: true,
        agentId: true,
        status: true,
        AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile: {
          select: {
            id: true,
            affiliateCode: true,
            type: true,
            displayName: true,
            branchLabel: true,
          },
        },
      },
    };
  }

  const profile = await prisma.affiliateProfile.findFirst({
    where: {
      userId: sessionUser.id,
      status: 'ACTIVE',
    },
    include,
    orderBy: { updatedAt: 'desc' },
  });

  console.log('[requirePartnerContext] Profile found:', profile ? { id: profile.id, type: profile.type, userId: profile.userId } : 'null');

  if (!profile) {
    console.log('[requirePartnerContext] No profile found for user:', sessionUser.id);
    throw new PartnerApiError('파트너 권한이 필요합니다. 관리자에게 문의해주세요.', 403);
  }

  // Prisma 필드명을 편의 속성으로 매핑하여 새 객체 생성
  const profileWithRelations: any = {
    ...profile,
  };

  // managedRelations 매핑 (manager가 관리하는 agent들)
  if (options.includeManagedAgents && profile.AffiliateRelation_AffiliateRelation_managerIdToAffiliateProfile) {
    const managedRelations = profile.AffiliateRelation_AffiliateRelation_managerIdToAffiliateProfile.map(
      (rel: any) => ({
        agent: rel.AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile,
      })
    );
    profileWithRelations.managedRelations = managedRelations;
    // 편의를 위해 managedAgents도 매핑 (agent 객체 배열)
    profileWithRelations.managedAgents = managedRelations.map((rel: any) => rel.agent).filter((a: any) => a);
  }

  // agentRelations 매핑 (agent가 속한 manager 관계들)
  if (profile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile) {
    profileWithRelations.agentRelations = profile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile;
  }

  return { sessionUser, profile: profileWithRelations };
}

export const partnerLeadInclude = {
  AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile: {
    select: {
      id: true,
      affiliateCode: true,
      type: true,
      displayName: true,
      branchLabel: true,
    },
  },
  AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
    select: {
      id: true,
      affiliateCode: true,
      type: true,
      displayName: true,
      branchLabel: true,
    },
  },
  AffiliateInteraction: {
    orderBy: { occurredAt: 'desc' },
    select: {
      id: true,
      interactionType: true,
      occurredAt: true,
      note: true,
      profileId: true,
      createdById: true,
      leadId: true,
      User: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
      AffiliateMedia: {
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          storagePath: true,
          metadata: true,
        },
      },
    },
  },
  AffiliateSale: {
    orderBy: [{ saleDate: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      saleAmount: true,
      netRevenue: true,
      saleDate: true,
      status: true,
      createdAt: true,
      leadId: true,
    },
  },
} satisfies Prisma.AffiliateLeadInclude;

export type PartnerLeadPayload = Prisma.AffiliateLeadGetPayload<{
  include: typeof partnerLeadInclude;
}>;

export function normalizePhoneInput(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return null;
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

export function serializeLead(
  lead: PartnerLeadPayload,
  extras: Record<string, unknown> = {},
) {
  return {
    id: lead.id,
    managerId: lead.managerId,
    agentId: lead.agentId,
    customerName: lead.customerName ?? null,
    customerPhone: lead.customerPhone ?? null,
    status: lead.status,
    source: lead.source ?? null,
    passportRequestedAt: lead.passportRequestedAt?.toISOString() ?? null,
    passportCompletedAt: lead.passportCompletedAt?.toISOString() ?? null,
    lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
    nextActionAt: lead.nextActionAt?.toISOString() ?? null,
    notes: lead.notes ?? null,
    metadata: lead.metadata ?? null,
    groupId: lead.groupId ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    manager: lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile
      ? {
          id: lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile.id,
          affiliateCode: lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile.affiliateCode,
          type: lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile.type,
          displayName: lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile.displayName,
          branchLabel: lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile.branchLabel,
        }
      : null,
    agent: lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile
      ? {
          id: lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile.id,
          affiliateCode: lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile.affiliateCode,
          type: lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile.type,
          displayName: lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile.displayName,
          branchLabel: lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile.branchLabel,
        }
      : null,
    interactions:
      lead.AffiliateInteraction?.map((interaction) => ({
        id: interaction.id,
        interactionType: interaction.interactionType,
        occurredAt: interaction.occurredAt.toISOString(),
        note: interaction.note ?? null,
        profileId: interaction.profileId,
        createdById: interaction.createdById,
        leadId: interaction.leadId,
        createdBy: interaction.User
          ? {
              id: interaction.User.id,
              name: interaction.User.name,
              phone: interaction.User.phone,
            }
          : null,
        media: interaction.AffiliateMedia?.map((m) => ({
          id: m.id,
          fileName: m.fileName,
          fileSize: m.fileSize,
          mimeType: m.mimeType,
          url: m.storagePath,
          isBackedUp: !!(m.metadata as any)?.googleDriveFileId,
          googleDriveFileId: (m.metadata as any)?.googleDriveFileId || null,
        })) ?? [],
      })) ?? [],
    sales:
      lead.AffiliateSale?.map((sale) => ({
        id: sale.id,
        saleAmount: sale.saleAmount,
        netRevenue: sale.netRevenue,
        saleDate: sale.saleDate?.toISOString() ?? null,
        status: sale.status,
        createdAt: sale.createdAt.toISOString(),
        leadId: sale.leadId,
      })) ?? [],
    ...extras,
  };
}


export function ensureValidLeadStatus(status?: string | null) {
  if (!status) return null;
  const matched = leadStatusOptions.find((option) => option.value === status);
  return matched?.value ?? null;
}

export function phoneSearchVariants(raw: string) {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return [];
  const variants = new Set<string>([digits]);
  if (digits.length === 11) {
    variants.add(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`);
  }
  if (digits.length === 10) {
    variants.add(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
  }
  return Array.from(variants);
}

export function resolveOwnership(profileId: number, lead: PartnerLeadPayload) {
  if (lead.agentId === profileId) return 'AGENT';
  if (lead.managerId === profileId) return 'MANAGER';
  return 'UNKNOWN';
}

export function resolveCounterpart(
  profileType: AffiliateType,
  lead: PartnerLeadPayload,
) {
  if (profileType === 'SALES_AGENT') {
    return lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile
      ? {
          label: lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile.displayName ?? '담당 대리점장',
          affiliateCode: lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile.affiliateCode,
          branchLabel: lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile.branchLabel,
        }
      : null;
  }
  if (profileType === 'BRANCH_MANAGER') {
    return lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile
      ? {
          label: lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile.displayName ?? '담당 판매원',
          affiliateCode: lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile.affiliateCode,
          branchLabel: lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile.branchLabel,
        }
      : null;
  }
  return null;
}

type LeadFetchOptions = {
  interactions?: number;
  sales?: number;
};

export async function getPartnerLead(
  profileId: number,
  leadId: number,
  options: LeadFetchOptions = {},
  profileType?: string,
) {
  const include: Prisma.AffiliateLeadInclude = {
    ...partnerLeadInclude,
    AffiliateInteraction: {
      ...partnerLeadInclude.AffiliateInteraction,
      take: options.interactions ?? 20,
    },
    AffiliateSale: {
      ...partnerLeadInclude.AffiliateSale,
      take: options.sales ?? 20,
    },
  };

  // 권한에 따라 where 조건 설정
  let whereCondition: Prisma.AffiliateLeadWhereInput = { id: leadId };

  if (profileType === 'HQ') {
    // 본사는 모든 고객 접근 가능
    whereCondition = { id: leadId };
  } else if (profileType === 'BRANCH_MANAGER') {
    // 대리점장은 자신이 담당하거나, 자기 팀 판매원이 담당하는 고객 접근 가능
    // 팀 판매원 ID 조회
    const teamRelations = await prisma.affiliateRelation.findMany({
      where: {
        managerId: profileId,
        status: 'ACTIVE',
      },
      select: { agentId: true },
    });
    const teamAgentIds = teamRelations
      .map((r) => r.agentId)
      .filter((id): id is number => id !== null);

    whereCondition = {
      id: leadId,
      OR: [
        { managerId: profileId },
        { agentId: profileId },
        ...(teamAgentIds.length > 0 ? [{ agentId: { in: teamAgentIds } }] : []),
      ],
    };
  } else {
    // 판매원은 자신이 담당하는 고객만 접근 가능
    whereCondition = {
      id: leadId,
      OR: [{ managerId: profileId }, { agentId: profileId }],
    };
  }

  const lead = await prisma.affiliateLead.findFirst({
    where: whereCondition,
    include,
  });

  if (!lead) {
    throw new PartnerApiError('고객 정보를 찾을 수 없습니다.', 404);
  }

  return lead;
}
