export const dynamic = 'force-dynamic';

// app/api/partner/contracts/route.ts
// 파트너 계약서 목록 조회 API (대리점장만 사용 가능)

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext, PartnerApiError } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext();

    console.log('[Partner Contracts] Profile:', { id: profile.id, type: profile.type, userId: profile.userId });

    // 대리점장만 사용 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      console.log('[Partner Contracts] Not a branch manager:', profile.type);
      return NextResponse.json(
        { ok: false, message: '대리점장만 계약서 목록을 조회할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 대리점장이 초대한 계약서 + 대리점장 자신의 계약서 조회
    const user = await prisma.user.findUnique({
      where: { id: profile.userId },
      select: { id: true },
    });

    const contracts = await prisma.affiliateContract.findMany({
      where: {
        OR: [
          { invitedByProfileId: profile.id }, // 대리점장이 초대한 계약서
          { userId: user?.id }, // 대리점장 자신의 계약서
        ],
        status: {
          in: ['submitted', 'completed', 'rejected'], // 제출됨, 완료됨, 거부됨 상태
        },
      },
      include: {
        User_AffiliateContract_userIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        AffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            affiliateCode: true,
            branchLabel: true,
            contactPhone: true,
            contactEmail: true,
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    // 프론트엔드 형식에 맞게 변환
    const formattedContracts = contracts.map((contract) => {
      const metadata = contract.metadata as any;
      return {
        id: contract.id,
        userId: contract.userId,
        name: contract.name,
        phone: contract.phone,
        email: contract.email || contract.User_AffiliateContract_userIdToUser?.email,
        status: contract.status,
        submittedAt: contract.submittedAt?.toISOString() || null,
        completedAt: metadata?.completedAt || null,
        invitedByProfileId: contract.invitedByProfileId,
        metadata: contract.metadata,
        // 담당 멘토 정보 (대리점장 = 본인)
        mentor: contract.AffiliateProfile ? {
          id: contract.AffiliateProfile.id,
          displayName: contract.AffiliateProfile.displayName,
          affiliateCode: contract.AffiliateProfile.affiliateCode,
          branchLabel: contract.AffiliateProfile.branchLabel,
          contactPhone: contract.AffiliateProfile.contactPhone,
          contactEmail: contract.AffiliateProfile.contactEmail,
        } : null,
      };
    });

    return NextResponse.json({
      ok: true,
      contracts: formattedContracts,
    });
  } catch (error: any) {
    console.error('[Partner Contracts] GET error:', error);
    const status = error instanceof PartnerApiError ? error.status : 500;
    return NextResponse.json(
      { ok: false, message: error.message || '계약서 목록을 불러오는 중 오류가 발생했습니다.' },
      { status }
    );
  }
}
