export const dynamic = 'force-dynamic';

// app/api/public/affiliate-link/[code]/route.ts
// 공개 어필리에이트 링크 정보 조회 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    
    if (!code) {
      return NextResponse.json({
        ok: false,
        message: '링크 코드가 필요합니다.',
      }, { status: 400 });
    }

    // 링크 정보 조회
    const link = await prisma.affiliateLink.findUnique({
      where: { code },
      include: {
        AffiliateProfile_AffiliateLink_managerIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            affiliateCode: true,
          },
        },
        AffiliateProfile_AffiliateLink_agentIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            affiliateCode: true,
          },
        },
        AffiliateProduct: {
          select: {
            id: true,
            productCode: true,
            title: true,
          },
        },
      },
    });

    if (!link) {
      return NextResponse.json({
        ok: false,
        message: '링크를 찾을 수 없습니다.',
      }, { status: 404 });
    }

    // 링크가 만료되었는지 확인
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return NextResponse.json({
        ok: false,
        message: '만료된 링크입니다.',
      }, { status: 410 });
    }

    // 링크가 비활성화되었는지 확인
    if (link.status !== 'ACTIVE') {
      return NextResponse.json({
        ok: false,
        message: '비활성화된 링크입니다.',
      }, { status: 403 });
    }

    // metadata에서 랜딩페이지 정보 추출
    const metadata = link.metadata as any;
    const landingPageId = metadata?.landingPageId || null;
    let landingPage = null;

    if (landingPageId) {
      landingPage = await prisma.landingPage.findUnique({
        where: { id: landingPageId },
        select: {
          id: true,
          title: true,
          slug: true,
          category: true,
        },
      });
    }

    // 마지막 접근 시간 업데이트 (비동기)
    prisma.affiliateLink.update({
      where: { id: link.id },
      data: { lastAccessedAt: new Date() },
    }).catch(console.error);

    return NextResponse.json({
      ok: true,
      link: {
        id: link.id,
        code: link.code,
        title: link.title,
        productCode: link.productCode,
        campaignName: link.campaignName,
        landingPageId,
        landingPage,
        manager: link.AffiliateProfile_AffiliateLink_managerIdToAffiliateProfile,
        agent: link.AffiliateProfile_AffiliateLink_agentIdToAffiliateProfile,
        product: link.AffiliateProduct,
      },
    });
  } catch (error: any) {
    console.error('[Public Affiliate Link] GET error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        message: '링크 정보를 불러오는 중 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
