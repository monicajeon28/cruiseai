export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { requirePartnerContext } from '@/app/api/partner/_utils';

interface ShareRequestBody {
  managerProfileIds?: number[];
  shareToAdmin?: boolean; // 본사에게 공유
  category?: string | null;
}

interface RevokeRequestBody {
  managerProfileIds?: number[];
  revokeAll?: boolean;
}

// POST: 대리점장이 랜딩페이지를 다른 대리점장이나 본사에게 공유
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
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

    const resolvedParams = await Promise.resolve(params);
    const pageId = parseInt(resolvedParams.id);

    if (Number.isNaN(pageId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 랜딩페이지 ID입니다.' }, { status: 400 });
    }

    // 랜딩페이지 조회 및 소유권 확인
    const landingPage = await prisma.landingPage.findUnique({
      where: { id: pageId },
    });

    if (!landingPage) {
      return NextResponse.json({ ok: false, error: '랜딩페이지를 찾을 수 없습니다' }, { status: 404 });
    }

    // 대리점장이 소유한 페이지인지 확인
    if (landingPage.adminId !== user.id) {
      return NextResponse.json({ ok: false, error: '권한이 없습니다' }, { status: 403 });
    }

    let body: ShareRequestBody;
    try {
      body = await req.json();
    } catch (error) {
      console.error('[Partner Landing Pages Share] JSON parse error:', error);
      return NextResponse.json({ ok: false, error: '요청 데이터를 파싱할 수 없습니다.' }, { status: 400 });
    }

    const { managerProfileIds, shareToAdmin, category } = body;

    // 공유할 대상이 있는지 확인
    const hasManagers = Array.isArray(managerProfileIds) && managerProfileIds.length > 0;
    if (!hasManagers && !shareToAdmin) {
      return NextResponse.json({ ok: false, error: '공유할 대상을 선택해주세요.' }, { status: 400 });
    }

    // 보너스 공유 개수 확인 (10개 제한)
    const existingShares = await prisma.sharedLandingPage.count({
      where: {
        landingPageId: pageId,
        ManagerProfile: {
          type: 'BRANCH_MANAGER',
        },
      },
    });

    const newShareCount = (hasManagers ? managerProfileIds!.length : 0) + (shareToAdmin ? 1 : 0);
    if (existingShares + newShareCount > 10) {
      return NextResponse.json(
        { ok: false, error: '보너스 공유는 최대 10개까지 가능합니다.' },
        { status: 403 }
      );
    }

    const results: Array<{ type: string; id: number; name: string }> = [];

    // 대리점장에게 공유
    if (hasManagers) {
      const normalizedIds = managerProfileIds!
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);

      if (normalizedIds.length > 0) {
        const managers = await prisma.affiliateProfile.findMany({
          where: {
            id: { in: normalizedIds, not: profile.id },
            type: 'BRANCH_MANAGER',
            status: 'ACTIVE',
          },
          select: {
            id: true,
            displayName: true,
            branchLabel: true,
          },
        });

        if (managers.length > 0) {
          await prisma.$transaction(
            managers.map((manager) =>
              prisma.sharedLandingPage.upsert({
                where: {
                  landingPageId_managerProfileId: {
                    landingPageId: pageId,
                    managerProfileId: manager.id,
                  },
                },
                update: {
                  category: category?.trim() || '대리점장 보너스',
                },
                create: {
                  landingPageId: pageId,
                  managerProfileId: manager.id,
                  category: category?.trim() || '대리점장 보너스',
                },
              })
            )
          );

          managers.forEach((manager) => {
            results.push({
              type: 'BRANCH_MANAGER',
              id: manager.id,
              name: manager.displayName || manager.branchLabel || '이름 없음',
            });
          });
        }
      }
    }

    // 본사에게 공유 (관리자에게 알림을 보내는 방식으로 처리)
    // 실제로는 SharedLandingPage에 저장하지 않고, 관리자에게 알림만 보내거나
    // 별도의 테이블에 저장할 수 있습니다.
    // 여기서는 간단하게 처리하기 위해 주석 처리합니다.
    // if (shareToAdmin) {
    //   // 본사 공유 로직
    // }

    return NextResponse.json({
      ok: true,
      sharedCount: results.length,
      sharedTo: results,
    });
  } catch (error: any) {
    console.error('[Partner Landing Pages Share] POST error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: '랜딩페이지 공유 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}

// GET: 대리점장이 공유한 랜딩페이지의 공유 현황 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
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

    const resolvedParams = await Promise.resolve(params);
    const pageId = parseInt(resolvedParams.id);

    if (Number.isNaN(pageId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 랜딩페이지 ID입니다.' }, { status: 400 });
    }

    // 랜딩페이지 소유권 확인
    const landingPage = await prisma.landingPage.findUnique({
      where: { id: pageId },
      select: { adminId: true },
    });

    if (!landingPage) {
      return NextResponse.json({ ok: false, error: '랜딩페이지를 찾을 수 없습니다' }, { status: 404 });
    }

    if (landingPage.adminId !== user.id) {
      return NextResponse.json({ ok: false, error: '권한이 없습니다' }, { status: 403 });
    }

    const sharedPages = await prisma.sharedLandingPage.findMany({
      where: { landingPageId: pageId },
      include: {
        ManagerProfile: {
          select: {
            id: true,
            displayName: true,
            branchLabel: true,
            affiliateCode: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      ok: true,
      sharedLandingPages: sharedPages.map((entry) => ({
        managerProfileId: entry.managerProfileId,
        displayName: entry.ManagerProfile?.displayName ?? null,
        branchLabel: entry.ManagerProfile?.branchLabel ?? null,
        affiliateCode: entry.ManagerProfile?.affiliateCode ?? null,
        category: entry.category ?? '대리점장 보너스',
        sharedAt: entry.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('[Partner Landing Pages Share] GET error:', error);
    return NextResponse.json(
      { ok: false, error: '공유 현황을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 대리점장이 공유한 랜딩페이지 공유 회수
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
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

    const resolvedParams = await Promise.resolve(params);
    const pageId = parseInt(resolvedParams.id);

    if (Number.isNaN(pageId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 랜딩페이지 ID입니다.' }, { status: 400 });
    }

    // 랜딩페이지 소유권 확인
    const landingPage = await prisma.landingPage.findUnique({
      where: { id: pageId },
      select: { adminId: true },
    });

    if (!landingPage) {
      return NextResponse.json({ ok: false, error: '랜딩페이지를 찾을 수 없습니다' }, { status: 404 });
    }

    if (landingPage.adminId !== user.id) {
      return NextResponse.json({ ok: false, error: '권한이 없습니다' }, { status: 403 });
    }

    let body: RevokeRequestBody = {};
    try {
      body = await req.json();
    } catch (error) {
      // body optional; ignore parse errors for empty body
    }

    const normalizedIds = Array.isArray(body.managerProfileIds)
      ? body.managerProfileIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
      : [];

    const revokeAll = body.revokeAll || normalizedIds.length === 0;

    if (!revokeAll && normalizedIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: '회수할 대리점장을 선택해주세요.' },
        { status: 400 }
      );
    }

    const whereClause: { landingPageId: number; managerProfileId?: { in: number[] } } = {
      landingPageId: pageId,
    };

    if (!revokeAll) {
      whereClause.managerProfileId = { in: normalizedIds };
    }

    const result = await prisma.sharedLandingPage.deleteMany({
      where: whereClause,
    });

    return NextResponse.json({
      ok: true,
      revokedCount: result.count,
    });
  } catch (error: any) {
    console.error('[Partner Landing Pages Share] DELETE error:', error);
    return NextResponse.json(
      { ok: false, error: '랜딩페이지 공유 회수 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
