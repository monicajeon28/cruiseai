export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { requirePartnerContext } from '@/app/api/partner/_utils';

const MAX_LANDING_PAGES = 15;

const generateSlugBase = (title: string, suffix = '') => {
  let baseSlug = title
    ?.toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!baseSlug) {
    baseSlug = `landing-${Date.now()}`;
  }

  return suffix ? `${baseSlug}-${suffix}` : baseSlug;
};

const cloneJson = (value: any) => {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
};

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const { profile } = await requirePartnerContext();

    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, error: '대리점장만 사용할 수 있는 기능입니다' }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const sourcePageId = Number(resolvedParams.id);
    if (!Number.isInteger(sourcePageId) || sourcePageId <= 0) {
      return NextResponse.json({ ok: false, error: '유효한 랜딩페이지 ID가 아닙니다' }, { status: 400 });
    }

    const existingCount = await prisma.landingPage.count({
      where: { adminId: user.id },
    });

    if (existingCount >= MAX_LANDING_PAGES) {
      return NextResponse.json(
        {
          ok: false,
          error: `대리점장은 최대 ${MAX_LANDING_PAGES}개의 랜딩페이지만 생성할 수 있습니다. 기존 페이지를 삭제한 후 다시 시도해주세요.`,
        },
        { status: 403 }
      );
    }

    const sharedEntry = await prisma.sharedLandingPage.findFirst({
      where: {
        landingPageId: sourcePageId,
        managerProfileId: profile.id,
      },
      include: {
        LandingPage: true,
      },
    });

    if (!sharedEntry || !sharedEntry.LandingPage) {
      return NextResponse.json(
        { ok: false, error: '관리자가 공유한 랜딩페이지에서만 복사할 수 있습니다.' },
        { status: 404 }
      );
    }

    const sourcePage = sharedEntry.LandingPage;

    const baseTitle = `${sourcePage.title} - 내 버전`;
    let newTitle = baseTitle;
    let titleCounter = 2;
    while (
      await prisma.landingPage.findFirst({
        where: {
          adminId: user.id,
          title: newTitle,
        },
      })
    ) {
      newTitle = `${baseTitle} (${titleCounter})`;
      titleCounter += 1;
    }

    let baseSlug = generateSlugBase(sourcePage.title, 'copy');
    let slug = baseSlug;
    let slugCounter = 1;
    while (await prisma.landingPage.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${slugCounter}`;
      slugCounter += 1;
    }

    const businessInfo = cloneJson(sourcePage.businessInfo);
    const now = new Date();

    const clonedPage = await prisma.landingPage.create({
      data: {
        adminId: user.id,
        title: newTitle,
        exposureTitle: sourcePage.exposureTitle,
        category: sourcePage.category,
        pageGroup: sourcePage.pageGroup,
        description: sourcePage.description,
        htmlContent: sourcePage.htmlContent,
        headerScript: sourcePage.headerScript,
        businessInfo,
        exposureImage: sourcePage.exposureImage,
        attachmentFile: sourcePage.attachmentFile,
        slug,
        isActive: true,
        isPublic: sourcePage.isPublic ?? true,
        marketingAccountId: null,
        marketingFunnelId: null,
        funnelOrder: null,
        groupId: null,
        additionalGroupId: null,
        checkDuplicateGroup: false,
        inputLimit: sourcePage.inputLimit,
        completionPageUrl: null,
        buttonTitle: sourcePage.buttonTitle || '신청하기',
        commentEnabled: sourcePage.commentEnabled,
        infoCollection: sourcePage.infoCollection,
        scheduledMessageId: null,
        smsNotification: false,
        viewCount: 0,
        shortcutUrl: null,
        updatedAt: now,
        createdAt: now,
      },
      include: {
        CustomerGroup: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      landingPage: clonedPage,
      remainingQuota: MAX_LANDING_PAGES - (existingCount + 1),
    });
  } catch (error: any) {
    console.error('[Partner Landing Pages] Clone error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: '공유 랜딩페이지를 복사하는 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}
