export const dynamic = 'force-dynamic';

// app/api/partner/contracts/[contractId]/route.ts
// 대리점장용 계약서 상세 조회 및 삭제 API

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';

// GET: 계약서 상세 정보 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const contractId = Number(resolvedParams.contractId);
    if (!contractId || Number.isNaN(contractId)) {
      return NextResponse.json({ ok: false, message: 'Invalid contract ID' }, { status: 400 });
    }

    const { profile } = await requirePartnerContext();

    // 대리점장만 사용 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json(
        { ok: false, message: '대리점장만 계약서를 조회할 수 있습니다.' },
        { status: 403 }
      );
    }

    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      include: {
        User_AffiliateContract_userIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            mallUserId: true,
          },
        },
        User_AffiliateContract_reviewerIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        AffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            nickname: true,
            type: true,
            affiliateCode: true,
            branchLabel: true,
            contactPhone: true,
            contactEmail: true,
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                mallUserId: true,
              },
            },
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ ok: false, message: '계약서를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 대리점장이 초대한 계약서인지 확인
    if (contract.invitedByProfileId !== profile.id) {
      return NextResponse.json(
        { ok: false, message: '이 계약서에 대한 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 프론트엔드에서 기대하는 형식으로 변환
    const { User_AffiliateContract_userIdToUser, User_AffiliateContract_reviewerIdToUser, AffiliateProfile, ...rest } = contract;
    
    // AffiliateProfile 내부의 User를 user로 변환
    const transformedAffiliateProfile = AffiliateProfile ? (() => {
      const { User, ...profileRest } = AffiliateProfile;
      return {
        ...profileRest,
        user: User,
      };
    })() : null;
    
    const transformedContract = {
      ...rest,
      user: User_AffiliateContract_userIdToUser,
      reviewer: User_AffiliateContract_reviewerIdToUser,
      AffiliateProfile: transformedAffiliateProfile,
    };

    return NextResponse.json({ ok: true, contract: transformedContract });
  } catch (error: any) {
    console.error(`[Partner Contract GET] error:`, error);
    return NextResponse.json(
      { ok: false, message: error.message || '계약서 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 계약서 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const contractId = Number(resolvedParams.contractId);
    if (!contractId || Number.isNaN(contractId)) {
      return NextResponse.json({ ok: false, message: 'Invalid contract ID' }, { status: 400 });
    }

    const { profile } = await requirePartnerContext();

    // 대리점장만 사용 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json(
        { ok: false, message: '대리점장만 계약서를 삭제할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 계약서 존재 확인
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      select: { id: true, invitedByProfileId: true },
    });

    if (!contract) {
      return NextResponse.json({ ok: false, message: '계약서를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 대리점장이 초대한 계약서인지 확인
    if (contract.invitedByProfileId !== profile.id) {
      return NextResponse.json(
        { ok: false, message: '이 계약서에 대한 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 계약서 삭제
    await prisma.affiliateContract.delete({
      where: { id: contractId },
    });

    return NextResponse.json({ ok: true, message: '계약서가 삭제되었습니다.' });
  } catch (error: any) {
    console.error(`[Partner Contract DELETE] error:`, error);
    return NextResponse.json(
      { ok: false, message: error.message || '계약서 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
