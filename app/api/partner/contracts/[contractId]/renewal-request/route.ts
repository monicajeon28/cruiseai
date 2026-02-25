export const dynamic = 'force-dynamic';

// app/api/partner/contracts/[contractId]/renewal-request/route.ts
// 재계약 갱신 요청 API

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext, PartnerApiError } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: { contractId: string } }
) {
  try {
    const { profile } = await requirePartnerContext();
    const contractId = parseInt(params.contractId);

    if (isNaN(contractId)) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 계약서 ID입니다.' },
        { status: 400 }
      );
    }

    // 계약서 조회
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        userId: true,
        status: true,
        reviewedAt: true,
        submittedAt: true,
        metadata: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { ok: false, message: '계약서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 본인 계약서인지 확인
    const user = await prisma.user.findUnique({
      where: { id: profile.userId },
      select: { id: true },
    });

    if (contract.userId !== user?.id) {
      return NextResponse.json(
        { ok: false, message: '본인의 계약서만 재계약 요청할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 계약서가 승인된 상태인지 확인
    if (contract.status !== 'approved' && contract.status !== 'completed') {
      return NextResponse.json(
        { ok: false, message: '승인된 계약서만 재계약 요청할 수 있습니다.' },
        { status: 400 }
      );
    }

    const metadata = (contract.metadata as any) || {};
    
    // 이미 재계약 요청이 있는지 확인
    if (metadata.renewalRequestStatus === 'PENDING') {
      return NextResponse.json(
        { ok: false, message: '이미 재계약 요청이 진행 중입니다.' },
        { status: 400 }
      );
    }

    // 재계약 요청 상태 업데이트
    await prisma.affiliateContract.update({
      where: { id: contractId },
      data: {
        metadata: {
          ...metadata,
          renewalRequestStatus: 'PENDING',
          renewalRequestedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({
      ok: true,
      message: '재계약 갱신 요청이 완료되었습니다.',
    });
  } catch (error: any) {
    console.error('[POST /api/partner/contracts/[contractId]/renewal-request] error:', error);
    const status = error instanceof PartnerApiError ? error.status : 500;
    return NextResponse.json(
      { ok: false, message: error.message || '재계약 요청 중 오류가 발생했습니다.' },
      { status }
    );
  }
}
