export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/app/api/partner/_utils';

// GET: 고객 그룹 관리 전용 고객 목록 조회 (PartnerCustomerGroup 사용 - AffiliateLead 기반)
// 대리점장의 고객만 보여주되, 이미 특정 그룹에 속한 고객은 제외 가능
export async function GET(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext();
    if (!profile) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '1000');
    const groupId = searchParams.get('groupId'); // 특정 그룹에 속한 고객 제외 옵션

    // 대리점장의 고객만 조회 (AffiliateLead)
    const where: any = {
      OR: [
        { managerId: profile.id },
        { agentId: profile.id },
      ],
    };

    // 특정 그룹에 속한 고객 제외 옵션
    if (groupId) {
      const groupIdNum = parseInt(groupId);
      if (!isNaN(groupIdNum)) {
        // 해당 그룹에 이미 속한 고객은 제외
        where.NOT = { groupId: groupIdNum };
      }
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { customerName: { contains: search } },
            { customerPhone: { contains: search } },
          ],
        },
      ];
    }

    // 고객 목록 조회 (AffiliateLead)
    const leads = await prisma.affiliateLead.findMany({
      where,
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        status: true,
        source: true,
        groupId: true,
        managerId: true,
        agentId: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    // 고객 정보 변환
    const customers = leads.map(lead => ({
      id: lead.id, // AffiliateLead의 id
      leadId: lead.id,
      name: lead.customerName || null,
      phone: lead.customerPhone || null,
      status: lead.status,
      source: lead.source,
      groupId: lead.groupId,
      createdAt: lead.createdAt.toISOString(),
    }));

    return NextResponse.json({
      ok: true,
      customers,
    });
  } catch (error: any) {
    console.error('[Partner Customer Groups Customers] GET error:', error);
    return NextResponse.json(
      { ok: false, error: '고객 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
