export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { buildScopedGroupWhere, getTeamAgentIds } from '@/app/api/partner/customer-groups/utils';

// PUT: 퍼널 설정 업데이트 (PartnerCustomerGroup 사용)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const resolvedParams = await params;
    const groupId = parseInt(resolvedParams.id);

    if (isNaN(groupId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 그룹 ID입니다.' }, { status: 400 });
    }

    // 판매원/대리점장 프로필 확인
    const affiliateProfile = await prisma.affiliateProfile.findFirst({
      where: {
        userId: user.id,
      },
      select: { id: true, type: true, status: true },
    });

    if (!affiliateProfile || !affiliateProfile.id) {
      return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
    }

    const body = await req.json();
    const { funnelTalkIds, funnelSmsIds, funnelEmailIds, reEntryHandling } = body;

    // 대리점장인 경우 팀 판매원 ID 목록 조회
    const teamAgentIds = await getTeamAgentIds(affiliateProfile.id, affiliateProfile.type || '');

    // 그룹 소유권 확인 (PartnerCustomerGroup) - 대리점장은 팀 판매원 그룹도 접근 가능
    const where = buildScopedGroupWhere(groupId, affiliateProfile.id, teamAgentIds);
    const existingGroup = await prisma.partnerCustomerGroup.findFirst({
      where,
    });

    if (!existingGroup) {
      return NextResponse.json({ ok: false, error: '그룹을 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    // 퍼널 설정 업데이트
    const group = await prisma.partnerCustomerGroup.update({
      where: { id: groupId },
      data: {
        funnelTalkIds: Array.isArray(funnelTalkIds) && funnelTalkIds.length > 0 ? funnelTalkIds : null,
        funnelSmsIds: Array.isArray(funnelSmsIds) && funnelSmsIds.length > 0 ? funnelSmsIds : null,
        funnelEmailIds: Array.isArray(funnelEmailIds) && funnelEmailIds.length > 0 ? funnelEmailIds : null,
        reEntryHandling: reEntryHandling || null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, group });
  } catch (error) {
    console.error('[Partner Customer Groups Funnel Settings PUT] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to update funnel settings' },
      { status: 500 }
    );
  }
}
