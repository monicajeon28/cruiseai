export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext, PartnerApiError } from '@/app/api/partner/_utils';
import { buildExtendedOwnershipFilter, getTeamAgentIds, partnerGroupInclude, serializePartnerGroup } from '@/app/api/partner/customer-groups/utils';

/**
 * GET /api/partner/customer-groups
 * 판매원/대리점장의 고객 그룹 목록 조회 (PartnerCustomerGroup 모델 사용)
 */
export async function GET(req: NextRequest) {
  try {
    const { profile, sessionUser } = await requirePartnerContext();

    console.log('[Partner Customer Groups GET] Profile:', { id: profile.id, type: profile.type, userId: sessionUser.id });

    // 대리점장인 경우 팀 판매원들의 ID 목록 조회 (공통 함수 사용)
    const teamAgentIds = await getTeamAgentIds(profile.id, profile.type);

    // 대리점장인 경우 자신 + 팀 판매원 그룹 모두 조회
    const ownershipFilter = buildExtendedOwnershipFilter(profile.id, teamAgentIds);
    console.log('[Partner Customer Groups GET] Ownership filter:', JSON.stringify(ownershipFilter));

    // PartnerCustomerGroup 모델 사용
    const groups = await prisma.partnerCustomerGroup.findMany({
      where: ownershipFilter,
      include: partnerGroupInclude,
      orderBy: { createdAt: 'desc' },
    });

    console.log('[Partner Customer Groups GET] Found groups:', groups.length);

    // 각 그룹의 고객 수(leadCount) 계산
    // 대리점장인 경우: 자신이 managerId인 Lead + 팀 판매원들이 agentId인 Lead
    // 판매원인 경우: 자신이 agentId인 Lead
    const groupsWithLeadCount = await Promise.all(
      groups.map(async (group) => {
        try {
          const leadCount = await prisma.affiliateLead.count({
            where: {
              groupId: group.id,
              OR: [
                { managerId: profile.id },
                { agentId: profile.id },
                // 대리점장인 경우 팀 판매원들이 관리하는 Lead도 포함
                ...(profile.type === 'BRANCH_MANAGER' && teamAgentIds.length > 0
                  ? [{ agentId: { in: teamAgentIds } }]
                  : []),
              ],
            },
          });
          return { group, leadCount };
        } catch (error) {
          console.error(`[Partner Customer Groups GET] Error counting leads for group ${group.id}:`, error);
          // 에러가 발생해도 0으로 처리하고 계속 진행
          return { group, leadCount: 0 };
        }
      })
    );

    console.log('[Partner Customer Groups GET] Groups with lead count:', groupsWithLeadCount.length);

    // serializePartnerGroup에서 발생할 수 있는 에러 처리
    const serializedGroups = groupsWithLeadCount.map(({ group, leadCount }) => {
      try {
        return serializePartnerGroup(group, leadCount);
      } catch (error) {
        console.error(`[Partner Customer Groups GET] Error serializing group ${group.id}:`, error);
        // 최소한의 정보라도 반환
        return {
          id: group.id,
          name: group.name,
          description: group.description,
          color: group.color,
          productCode: group.productCode,
          profileId: group.profileId,
          createdAt: group.createdAt instanceof Date ? group.createdAt.toISOString() : String(group.createdAt),
          updatedAt: group.updatedAt instanceof Date ? group.updatedAt.toISOString() : String(group.updatedAt),
          leadCount: leadCount ?? 0,
          funnelTalkIds: [],
          funnelSmsIds: [],
          funnelEmailIds: [],
          reEntryHandling: null,
          affiliateProfile: null,
        };
      }
    });

    return NextResponse.json({
      ok: true,
      groups: serializedGroups,
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      console.error('[Partner Customer Groups GET] PartnerApiError:', {
        message: error.message,
        status: error.status,
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    console.error('[Partner Customer Groups GET] Unexpected error:', error);
    console.error('[Partner Customer Groups GET] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : '고객 그룹 목록을 불러오지 못했습니다.',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/customer-groups
 * 판매원/대리점장의 고객 그룹 생성 (PartnerCustomerGroup 모델 사용)
 */
export async function POST(req: NextRequest) {
  try {
    const { profile, sessionUser } = await requirePartnerContext();

    console.log('[Partner Customer Groups POST] Profile:', { id: profile.id, type: profile.type, userId: sessionUser.id });

    const body = await req.json();
    const { name, description, color, productCode, funnelTalkIds, funnelSmsIds, funnelEmailIds, reEntryHandling } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: '그룹 이름은 필수입니다.' },
        { status: 400 }
      );
    }

    // PartnerCustomerGroup 생성
    const group = await prisma.partnerCustomerGroup.create({
      data: {
        profileId: profile.id,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || null,
        productCode: productCode || null,
        funnelTalkIds: Array.isArray(funnelTalkIds) && funnelTalkIds.length > 0 ? funnelTalkIds : null,
        funnelSmsIds: Array.isArray(funnelSmsIds) && funnelSmsIds.length > 0 ? funnelSmsIds : null,
        funnelEmailIds: Array.isArray(funnelEmailIds) && funnelEmailIds.length > 0 ? funnelEmailIds : null,
        reEntryHandling: reEntryHandling || null,
        updatedAt: new Date(),
      },
      include: partnerGroupInclude,
    });

    console.log('[Partner Customer Groups POST] Created group:', { id: group.id, name: group.name });

    try {
      // 새로 생성된 그룹의 leadCount 계산 (새 그룹이므로 0)
      const serializedGroup = serializePartnerGroup(group, 0);
      return NextResponse.json({ ok: true, group: serializedGroup });
    } catch (serializeError) {
      console.error('[Partner Customer Groups POST] Error serializing group:', serializeError);
      // 그룹은 생성되었지만 직렬화에 실패한 경우, 최소한의 정보라도 반환
      return NextResponse.json({
        ok: true,
        group: {
          id: group.id,
          name: group.name,
          description: group.description,
          color: group.color,
          productCode: group.productCode,
          profileId: group.profileId,
          createdAt: group.createdAt instanceof Date ? group.createdAt.toISOString() : String(group.createdAt),
          updatedAt: group.updatedAt instanceof Date ? group.updatedAt.toISOString() : String(group.updatedAt),
          leadCount: 0,
          funnelTalkIds: [],
          funnelSmsIds: [],
          funnelEmailIds: [],
          reEntryHandling: null,
          affiliateProfile: null,
        }
      });
    }
  } catch (error) {
    if (error instanceof PartnerApiError) {
      console.error('[Partner Customer Groups POST] PartnerApiError:', {
        message: error.message,
        status: error.status,
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    console.error('[Partner Customer Groups POST] Unexpected error:', error);
    console.error('[Partner Customer Groups POST] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : '고객 그룹 생성에 실패했습니다.',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined,
      },
      { status: 500 }
    );
  }
}
