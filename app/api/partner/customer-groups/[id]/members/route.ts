export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { buildScopedGroupWhere, getTeamAgentIds } from '@/app/api/partner/customer-groups/utils';
import { schedulePartnerFunnelMessages } from '@/lib/funnel-scheduler';

/**
 * POST /api/partner/customer-groups/[id]/members
 * 그룹에 고객(AffiliateLead) 추가 - PartnerCustomerGroup 사용
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const groupId = Number(resolvedParams.id);
    if (!Number.isInteger(groupId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 그룹 ID입니다.' }, { status: 400 });
    }

    const affiliateProfile = await prisma.affiliateProfile.findFirst({
      where: { userId: sessionUser.id },
      select: { id: true, type: true },
    });

    if (!affiliateProfile) {
      return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
    }

    const body = await req.json();
    const { leadIds, userIds } = body;

    // userIds와 leadIds 모두 지원 (하위 호환성)
    const idsToAdd = userIds || leadIds;

    if (!idsToAdd || !Array.isArray(idsToAdd) || idsToAdd.length === 0) {
      return NextResponse.json(
        { ok: false, error: '추가할 고객 ID 목록이 필요합니다.' },
        { status: 400 }
      );
    }

    const normalizedLeadIds = idsToAdd
      .map((id: number) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (normalizedLeadIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: '유효한 고객 ID가 없습니다.' },
        { status: 400 }
      );
    }

    // 대리점장인 경우 팀 판매원 ID 목록 조회
    const teamAgentIds = await getTeamAgentIds(affiliateProfile.id, affiliateProfile.type || '');

    // 그룹 소유권 확인 (PartnerCustomerGroup) - 대리점장은 팀 판매원 그룹도 접근 가능
    const group = await prisma.partnerCustomerGroup.findFirst({
      where: buildScopedGroupWhere(groupId, affiliateProfile.id, teamAgentIds),
      select: { id: true },
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: '그룹을 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    // 대리점장인 경우 팀 판매원의 고객도 포함
    const leadOwnerConditions: any[] = [
      { managerId: affiliateProfile.id },
      { agentId: affiliateProfile.id },
    ];
    if (teamAgentIds.length > 0) {
      leadOwnerConditions.push({ agentId: { in: teamAgentIds } });
    }

    // 이전 그룹 정보 조회 (퍼널 발송 여부 결정용)
    const leadsBeforeUpdate = await prisma.affiliateLead.findMany({
      where: {
        id: { in: normalizedLeadIds },
        OR: leadOwnerConditions,
      },
      select: { id: true, groupId: true },
    });

    // AffiliateLead의 groupId를 업데이트 (권한 있는 고객만)
    const result = await prisma.affiliateLead.updateMany({
      where: {
        id: { in: normalizedLeadIds },
        OR: leadOwnerConditions,
      },
      data: {
        groupId: groupId,
        updatedAt: new Date(),
      },
    });

    // 퍼널 자동 발송: 새로 그룹에 추가된 고객들에게만
    let funnelScheduled = 0;
    for (const lead of leadsBeforeUpdate) {
      // 이전에 다른 그룹에 있었거나 그룹이 없었던 경우에만 퍼널 발송
      if (lead.groupId !== groupId) {
        const scheduleResult = await schedulePartnerFunnelMessages({
          leadId: lead.id,
          groupId: groupId,
          profileId: affiliateProfile.id,
          userId: sessionUser.id,
        });
        funnelScheduled += scheduleResult.scheduled;
      }
    }

    return NextResponse.json({
      ok: true,
      added: result.count,
      funnelScheduled,
      message: `${result.count}명의 고객이 그룹에 추가되었습니다.`,
    });
  } catch (error: any) {
    console.error('[Partner Customer Groups Members POST] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to add members' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/customer-groups/[id]/members
 * 그룹에서 고객(AffiliateLead) 제거 - PartnerCustomerGroup 사용
 * leadId 또는 userId 파라미터 지원 (하위 호환성)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const groupId = Number(resolvedParams.id);
    if (!Number.isInteger(groupId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 그룹 ID입니다.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    // leadId 또는 userId 파라미터 지원
    const leadIdParam = searchParams.get('leadId') || searchParams.get('userId');

    if (!leadIdParam) {
      return NextResponse.json(
        { ok: false, error: '제거할 고객 ID가 필요합니다. (leadId 또는 userId)' },
        { status: 400 }
      );
    }

    const leadId = Number(leadIdParam);
    if (!Number.isInteger(leadId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 고객 ID입니다.' }, { status: 400 });
    }

    const affiliateProfile = await prisma.affiliateProfile.findFirst({
      where: { userId: sessionUser.id },
      select: { id: true, type: true },
    });

    if (!affiliateProfile) {
      return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
    }

    // 대리점장인 경우 팀 판매원 ID 목록 조회
    const teamAgentIds = await getTeamAgentIds(affiliateProfile.id, affiliateProfile.type || '');

    // 그룹 소유권 확인 (PartnerCustomerGroup) - 대리점장은 팀 판매원 그룹도 접근 가능
    const group = await prisma.partnerCustomerGroup.findFirst({
      where: buildScopedGroupWhere(groupId, affiliateProfile.id, teamAgentIds),
      select: { id: true },
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: '그룹을 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    // 대리점장인 경우 팀 판매원의 고객도 제거 가능
    const leadOwnerConditions: any[] = [
      { managerId: affiliateProfile.id },
      { agentId: affiliateProfile.id },
    ];

    if (teamAgentIds.length > 0) {
      leadOwnerConditions.push({ agentId: { in: teamAgentIds } });
    }

    // AffiliateLead의 groupId를 null로 설정 (그룹에서 제거)
    const result = await prisma.affiliateLead.updateMany({
      where: {
        id: leadId,
        groupId: groupId,
        OR: leadOwnerConditions,
      },
      data: {
        groupId: null,
        updatedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ ok: false, error: '해당 고객을 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message: '고객이 그룹에서 제거되었습니다.' });
  } catch (error: any) {
    console.error('[Partner Customer Groups Members DELETE] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to remove member' },
      { status: 500 }
    );
  }
}
