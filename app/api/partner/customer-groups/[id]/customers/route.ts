export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { buildScopedGroupWhere, getTeamAgentIds } from '@/app/api/partner/customer-groups/utils';

// GET: 그룹별 고객 리스트 조회 (PartnerCustomerGroup 사용 - AffiliateLead 기반)
export async function GET(
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

    // 대리점장인 경우 팀 판매원 ID 목록 조회
    const teamAgentIds = await getTeamAgentIds(affiliateProfile.id, affiliateProfile.type || '');

    // 그룹 소유권 확인 (PartnerCustomerGroup) - 대리점장은 팀 판매원 그룹도 접근 가능
    const where = buildScopedGroupWhere(groupId, affiliateProfile.id, teamAgentIds);
    const group = await prisma.partnerCustomerGroup.findFirst({
      where,
      select: {
        id: true,
        name: true,
        funnelTalkIds: true,
        funnelSmsIds: true,
        funnelEmailIds: true,
      },
    });

    if (!group) {
      return NextResponse.json(
        { ok: false, error: '그룹을 찾을 수 없거나 권한이 없습니다.' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // AffiliateLead에서 그룹에 속한 고객 조회
    // 대리점장인 경우 자신 + 팀 판매원의 고객 모두 조회
    const leadOwnerConditions: any[] = [
      { managerId: affiliateProfile.id },
      { agentId: affiliateProfile.id },
    ];

    // 대리점장인 경우 팀 판매원의 고객도 포함
    if (teamAgentIds.length > 0) {
      leadOwnerConditions.push({ agentId: { in: teamAgentIds } });
    }

    const leadWhere: any = {
      groupId,
      OR: leadOwnerConditions,
    };

    // 검색 필터 (고객명, 전화번호로 검색)
    if (search) {
      leadWhere.AND = {
        OR: [
          { customerName: { contains: search } },
          { customerPhone: { contains: search } },
        ],
      };
    }

    const [leads, total] = await Promise.all([
      prisma.affiliateLead.findMany({
        where: leadWhere,
        select: {
          id: true,
          customerName: true,
          customerPhone: true,
          status: true,
          source: true,
          createdAt: true,
          notes: true,
          lastContactedAt: true,
          nextActionAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.affiliateLead.count({ where: leadWhere }),
    ]);

    // 일차 계산 헬퍼 함수
    const calculateDays = (createdAt: Date): number => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const joinDate = new Date(createdAt);
      joinDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - joinDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays + 1; // 1일차부터 시작
    };

    // 펀널 메시지 ID 수집
    const allFunnelMessageIds: number[] = [];
    if (group) {
      if (Array.isArray(group.funnelTalkIds)) {
        allFunnelMessageIds.push(...group.funnelTalkIds);
      }
      if (Array.isArray(group.funnelSmsIds)) {
        allFunnelMessageIds.push(...group.funnelSmsIds);
      }
      if (Array.isArray(group.funnelEmailIds)) {
        allFunnelMessageIds.push(...group.funnelEmailIds);
      }
    }

    // 고객 정보 변환
    const customers = leads.map((lead) => ({
      id: lead.id,
      leadId: lead.id,
      customerName: lead.customerName || null,
      phone: lead.customerPhone || null,
      status: lead.status,
      source: lead.source,
      notes: lead.notes,
      groupInflowDate: lead.createdAt.toISOString().split('T')[0],
      daysSinceInflow: calculateDays(lead.createdAt),
      lastContactedAt: lead.lastContactedAt?.toISOString() || null,
      nextActionAt: lead.nextActionAt?.toISOString() || null,
      messageSentCount: 0, // PartnerCustomerGroup에서는 ScheduledMessageLog 연동이 다르므로 0으로 설정
    }));

    return NextResponse.json({
      ok: true,
      group: {
        id: group.id,
        name: group.name,
      },
      customers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Partner Customer Groups Customers GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '고객 리스트 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
