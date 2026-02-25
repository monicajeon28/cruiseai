export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { buildScopedGroupWhere, getTeamAgentIds, partnerGroupInclude, serializePartnerGroup } from '@/app/api/partner/customer-groups/utils';

/**
 * GET /api/partner/customer-groups/[id]
 * 특정 그룹 조회 (PartnerCustomerGroup 모델 사용)
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

    const affiliateProfile = await prisma.affiliateProfile.findFirst({
      where: { userId: user.id },
      select: { id: true, type: true },
    });

    if (!affiliateProfile) {
      return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
    }

    const resolvedParams = await Promise.resolve(params);
    const groupId = Number(resolvedParams.id);
    if (!Number.isInteger(groupId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 그룹 ID입니다.' }, { status: 400 });
    }

    // 대리점장인 경우 팀 판매원 ID 목록 조회
    const teamAgentIds = await getTeamAgentIds(affiliateProfile.id, affiliateProfile.type || '');

    const group = await prisma.partnerCustomerGroup.findFirst({
      where: buildScopedGroupWhere(groupId, affiliateProfile.id, teamAgentIds),
      include: partnerGroupInclude,
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: '그룹을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 고객 수 계산 (대리점장인 경우 팀 판매원 고객도 포함)
    const leadOwnerConditions: any[] = [
      { managerId: affiliateProfile.id },
      { agentId: affiliateProfile.id },
    ];
    if (teamAgentIds.length > 0) {
      leadOwnerConditions.push({ agentId: { in: teamAgentIds } });
    }

    const leadCount = await prisma.affiliateLead.count({
      where: {
        groupId: group.id,
        OR: leadOwnerConditions,
      },
    });

    return NextResponse.json({ ok: true, group: serializePartnerGroup(group, leadCount) });
  } catch (error) {
    console.error('[Partner Customer Groups GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch customer group' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/partner/customer-groups/[id]
 * 그룹 수정 (PartnerCustomerGroup 모델 사용)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const affiliateProfile = await prisma.affiliateProfile.findFirst({
      where: { userId: user.id },
      select: { id: true, type: true },
    });

    if (!affiliateProfile) {
      return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
    }

    const resolvedParams = await Promise.resolve(params);
    const groupId = Number(resolvedParams.id);
    if (!Number.isInteger(groupId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 그룹 ID입니다.' }, { status: 400 });
    }

    // 대리점장인 경우 팀 판매원 ID 목록 조회
    const teamAgentIds = await getTeamAgentIds(affiliateProfile.id, affiliateProfile.type || '');

    const existingGroup = await prisma.partnerCustomerGroup.findFirst({
      where: buildScopedGroupWhere(groupId, affiliateProfile.id, teamAgentIds),
    });

    if (!existingGroup) {
      return NextResponse.json({ ok: false, error: '그룹을 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    const body = await req.json();
    const { name, description, color, productCode, funnelTalkIds, funnelSmsIds, funnelEmailIds, reEntryHandling } = body;

    const group = await prisma.partnerCustomerGroup.update({
      where: { id: groupId },
      data: {
        name: name?.trim() || existingGroup.name,
        description:
          description !== undefined
            ? description?.trim() || null
            : existingGroup.description,
        color: color !== undefined ? color || null : existingGroup.color,
        productCode: productCode !== undefined ? productCode || null : existingGroup.productCode,
        funnelTalkIds: funnelTalkIds !== undefined
          ? (Array.isArray(funnelTalkIds) && funnelTalkIds.length > 0 ? funnelTalkIds : null)
          : existingGroup.funnelTalkIds,
        funnelSmsIds: funnelSmsIds !== undefined
          ? (Array.isArray(funnelSmsIds) && funnelSmsIds.length > 0 ? funnelSmsIds : null)
          : existingGroup.funnelSmsIds,
        funnelEmailIds: funnelEmailIds !== undefined
          ? (Array.isArray(funnelEmailIds) && funnelEmailIds.length > 0 ? funnelEmailIds : null)
          : existingGroup.funnelEmailIds,
        reEntryHandling: reEntryHandling !== undefined ? (reEntryHandling || null) : existingGroup.reEntryHandling,
        updatedAt: new Date(),
      },
      include: partnerGroupInclude,
    });

    // 고객 수 계산 (대리점장인 경우 팀 판매원 고객도 포함)
    const leadOwnerConditions: any[] = [
      { managerId: affiliateProfile.id },
      { agentId: affiliateProfile.id },
    ];
    if (teamAgentIds.length > 0) {
      leadOwnerConditions.push({ agentId: { in: teamAgentIds } });
    }

    const leadCount = await prisma.affiliateLead.count({
      where: {
        groupId: group.id,
        OR: leadOwnerConditions,
      },
    });

    return NextResponse.json({ ok: true, group: serializePartnerGroup(group, leadCount) });
  } catch (error) {
    console.error('[Partner Customer Groups PUT] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to update customer group' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/customer-groups/[id]
 * 그룹 삭제 (PartnerCustomerGroup 모델 사용)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const affiliateProfile = await prisma.affiliateProfile.findFirst({
      where: { userId: user.id },
      select: { id: true, type: true },
    });

    if (!affiliateProfile) {
      return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
    }

    const resolvedParams = await Promise.resolve(params);
    const groupId = Number(resolvedParams.id);
    if (!Number.isInteger(groupId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 그룹 ID입니다.' }, { status: 400 });
    }

    // 대리점장인 경우 팀 판매원 ID 목록 조회
    const teamAgentIds = await getTeamAgentIds(affiliateProfile.id, affiliateProfile.type || '');

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

    // 그룹에 속한 고객들의 groupId를 null로 설정 (고객은 삭제되지 않음)
    await prisma.affiliateLead.updateMany({
      where: {
        groupId: groupId,
        OR: leadOwnerConditions,
      },
      data: {
        groupId: null,
      },
    });

    // 그룹 삭제
    await prisma.partnerCustomerGroup.delete({
      where: { id: groupId },
    });

    return NextResponse.json({ ok: true, message: '그룹이 삭제되었습니다. 그룹에 속한 고객은 그룹만 해제되었습니다.' });
  } catch (error) {
    console.error('[Partner Customer Groups DELETE] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to delete customer group' },
      { status: 500 }
    );
  }
}
