export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getAffiliateOwnershipForUsers } from '@/lib/affiliate/customer-ownership';
import prisma from '@/lib/prisma';

/**
 * GET /api/user/affiliate-mall-url
 * 사용자의 어필리에이트 소유권을 확인하고 해당 판매원/대리점장 몰 URL을 반환
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 조회
    const userFromDb = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, phone: true },
    });

    if (!userFromDb) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    // 어필리에이트 소유권 확인
    const ownershipMap = await getAffiliateOwnershipForUsers([userFromDb]);
    const ownership = ownershipMap.get(user.id);

    if (!ownership || !ownership.ownerProfileId) {
      // 어필리에이트 소유권이 없으면 본사몰(/products)로 이동
      return NextResponse.json({
        ok: true,
        hasAffiliate: false,
        mallUrl: '/products',
      });
    }

    // 어필리에이트 프로필 조회 (landingSlug 포함)
    const affiliateProfile = await prisma.affiliateProfile.findUnique({
      where: { id: ownership.ownerProfileId },
      select: {
        id: true,
        affiliateCode: true,
        landingSlug: true,
        type: true,
        displayName: true,
      },
    });

    if (!affiliateProfile) {
      return NextResponse.json({
        ok: true,
        hasAffiliate: false,
        mallUrl: '/products',
      });
    }

    // landingSlug 또는 affiliateCode를 사용하여 어필리에이트 몰 URL 생성
    // 메인페이지(`/`)에 partner 파라미터 추가 또는 `/products?partner=xxx` 형태
    let mallUrl = '/products';
    const partnerId = ownership.ownerLandingSlug || ownership.ownerAffiliateCode;
    
    if (partnerId) {
      // 메인페이지에 partner 파라미터 추가
      mallUrl = `/?partner=${encodeURIComponent(partnerId)}`;
    }

    return NextResponse.json({
      ok: true,
      hasAffiliate: true,
      mallUrl,
      ownership: {
        ownerType: ownership.ownerType,
        ownerName: ownership.ownerName,
        ownerAffiliateCode: ownership.ownerAffiliateCode,
      },
      affiliateProfile: {
        affiliateCode: affiliateProfile.affiliateCode,
        landingSlug: affiliateProfile.landingSlug,
        type: affiliateProfile.type,
        displayName: affiliateProfile.displayName,
      },
    });
  } catch (error: any) {
    console.error('[User Affiliate Mall URL] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to get affiliate mall URL', mallUrl: '/products' },
      { status: 500 }
    );
  }
}
