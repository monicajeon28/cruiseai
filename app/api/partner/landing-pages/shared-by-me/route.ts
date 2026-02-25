export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { requirePartnerContext } from '@/app/api/partner/_utils';

// GET: 대리점장이 공유한 랜딩페이지 개수 조회
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

    // 대리점장이 소유한 랜딩페이지 중 공유된 것의 개수
    const ownedPages = await prisma.landingPage.findMany({
      where: {
        adminId: user.id,
      },
      select: {
        id: true,
      },
    });

    const ownedPageIds = ownedPages.map(p => p.id);

    if (ownedPageIds.length === 0) {
      return NextResponse.json({
        ok: true,
        count: 0,
      });
    }

    const sharedCount = await prisma.sharedLandingPage.count({
      where: {
        landingPageId: { in: ownedPageIds },
      },
    });

    return NextResponse.json({
      ok: true,
      count: sharedCount,
    });
  } catch (error: any) {
    console.error('[Partner Landing Pages Shared By Me] Error:', error);
    return NextResponse.json(
      { ok: false, error: '공유 개수를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
