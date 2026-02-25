import prisma from '@/lib/prisma';

function normalizePhoneDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits || null;
}

function toPhoneVariants(digits: string): string[] {
  if (!digits) return [];
  const variants = new Set<string>();
  variants.add(digits);
  if (digits.length === 11) {
    variants.add(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`);
  } else if (digits.length === 10) {
    variants.add(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
  }
  return Array.from(variants);
}

export async function getManagedUserIds(profile: { id: number; type: string }) {
  const teamAgentIds: number[] = [];
  if (profile.type === 'BRANCH_MANAGER') {
    const relations = await prisma.affiliateRelation.findMany({
      where: {
        managerId: profile.id,
        status: 'ACTIVE',
      },
      select: { agentId: true },
    });
    relations.forEach((relation) => {
      if (relation.agentId) {
        teamAgentIds.push(relation.agentId);
      }
    });
  }

  const leadConditions: any[] = [
    { managerId: profile.id },
    { agentId: profile.id },
  ];

  if (profile.type === 'BRANCH_MANAGER' && teamAgentIds.length > 0) {
    leadConditions.push({ agentId: { in: teamAgentIds } });
  }

  const leads = await prisma.affiliateLead.findMany({
    where: {
      OR: leadConditions,
    },
    select: {
      customerPhone: true,
    },
  });

  const userIds = new Set<number>();
  const phoneDigits = new Set<string>();

  leads.forEach((lead) => {
    const digits = normalizePhoneDigits(lead.customerPhone);
    if (digits) {
      phoneDigits.add(digits);
    }
  });

  if (phoneDigits.size > 0) {
    const allVariants = Array.from(phoneDigits).flatMap((digits) => toPhoneVariants(digits));
    const usersFromPhones = await prisma.user.findMany({
      where: {
        phone: { in: allVariants },
      },
      select: { id: true },
    });
    usersFromPhones.forEach((user) => userIds.add(user.id));
  }

  return {
    userIds: Array.from(userIds),
  };
}
