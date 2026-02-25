export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { requirePartnerContext } from '@/app/api/partner/_utils';

// GET: 대리점장 목록 조회 (대리점장끼리 공유용)
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const { profile } = await requirePartnerContext();
    
    // 대리점장만 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, error: '대리점장만 접근 가능합니다' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'BRANCH_MANAGER';
    const status = searchParams.get('status') || 'ACTIVE';

    const where: any = {
      type,
      status,
      id: { not: profile.id }, // 자기 자신은 제외
    };

    const profiles = await prisma.affiliateProfile.findMany({
      where,
      select: {
        id: true,
        displayName: true,
        branchLabel: true,
        affiliateCode: true,
        nickname: true,
      },
      orderBy: {
        displayName: 'asc',
      },
    });

    return NextResponse.json({
      ok: true,
      profiles,
    });
  } catch (error: any) {
    console.error('[Partner Affiliate Profiles] Error:', error);
    return NextResponse.json(
      { ok: false, error: '대리점장 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
