export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';
import { getManagedUserIds } from '../_utils';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();

    const { userIds } = await getManagedUserIds(profile);
    if (userIds.length === 0) {
      return NextResponse.json({ ok: true, customers: [] });
    }

    const where: any = {
      id: { in: userIds },
      Reservation: { some: {} },
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const customers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        customerStatus: true,
      },
      orderBy: { name: 'asc' },
      take: 100,
    });

    return NextResponse.json({ ok: true, customers });
  } catch (error) {
    logger.error('[Partner AssignTrip] purchase customers error:', error);
    return NextResponse.json(
      { ok: false, error: '구매 고객 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
