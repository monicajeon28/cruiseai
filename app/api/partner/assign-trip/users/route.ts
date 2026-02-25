import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import { getManagedUserIds } from '../_utils';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext();
    const { userIds } = await getManagedUserIds(profile);
    if (userIds.length === 0) {
      return NextResponse.json({ ok: true, users: [] });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();

    // 잠재고객 필터: 구매확정이 아닌 모든 고객 (잠재고객 모두)
    const customerStatusFilter = {
      OR: [
        { customerStatus: null },
        { customerStatus: { not: 'purchase_confirmed' } }
      ]
    };

    // 검색 필터
    let searchFilter: any = null;
    if (search) {
      searchFilter = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ]
      };
    }

    // 모든 조건을 AND로 결합
    const whereConditions: any[] = [
      { id: { in: userIds } }, // 파트너가 관리할 수 있는 사용자만
      customerStatusFilter, // 잠재고객만
    ];

    if (searchFilter) {
      whereConditions.push(searchFilter); // 검색 조건 추가
    }

    const where: any = {
      AND: whereConditions,
    };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
      },
      orderBy: { name: 'asc' },
      take: 200,
    });

    return NextResponse.json({ ok: true, users });
  } catch (error) {
    logger.error('[Partner AssignTrip] user search error:', error);
    return NextResponse.json(
      { ok: false, error: '사용자 검색에 실패했습니다.' },
      { status: 500 }
    );
  }
}
