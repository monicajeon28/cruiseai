export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * GET /api/partner/customer-groups/[id]/message-logs
 * 대리점의 고객 그룹 예약 메시지 전송 기록 조회 (PartnerCustomerGroup 사용)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 판매원/대리점장 프로필 확인
    const affiliateProfile = await prisma.affiliateProfile.findFirst({
      where: { userId: user.id },
      select: { id: true, type: true },
    });

    if (!affiliateProfile) {
      return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
    }

    const resolvedParams = await Promise.resolve(params);
    const groupId = parseInt(resolvedParams.id);
    if (isNaN(groupId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 그룹 ID입니다.' }, { status: 400 });
    }

    // 고객 그룹 존재 및 권한 확인 (PartnerCustomerGroup)
    const group = await prisma.partnerCustomerGroup.findFirst({
      where: {
        id: groupId,
        profileId: affiliateProfile.id,
      },
      select: { id: true, name: true },
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: '고객 그룹을 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    // AffiliateLead에서 그룹 멤버 조회
    const leads = await prisma.affiliateLead.findMany({
      where: {
        groupId: groupId,
        OR: [
          { managerId: affiliateProfile.id },
          { agentId: affiliateProfile.id },
        ],
      },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        createdAt: true,
        AffiliateInteraction: {
          orderBy: { occurredAt: 'desc' },
          take: 5,
          select: {
            id: true,
            type: true,
            note: true,
            occurredAt: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const memberStats = leads.map((lead) => {
      const addedAt = new Date(lead.createdAt);
      const daysSinceAdded = Math.floor((now.getTime() - addedAt.getTime()) / (1000 * 60 * 60 * 24));

      return {
        leadId: lead.id,
        customerName: lead.customerName,
        customerPhone: lead.customerPhone,
        addedAt: addedAt.toISOString(),
        daysSinceAdded,
        interactionCount: lead.AffiliateInteraction.length,
        recentInteractions: lead.AffiliateInteraction.map((interaction) => ({
          id: interaction.id,
          type: interaction.type,
          note: interaction.note,
          occurredAt: interaction.occurredAt.toISOString(),
          status: interaction.status,
        })),
      };
    });

    return NextResponse.json({
      ok: true,
      group: {
        id: group.id,
        name: group.name,
      },
      members: memberStats,
      summary: {
        totalMembers: leads.length,
        totalInteractions: memberStats.reduce((sum, m) => sum + m.interactionCount, 0),
      },
    });
  } catch (error: any) {
    console.error('[Partner Customer Group Message Logs] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to fetch message logs',
      },
      { status: 500 }
    );
  }
}
