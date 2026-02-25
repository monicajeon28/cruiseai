export const dynamic = 'force-dynamic';

// app/api/partner/contracts/[contractId]/reject/route.ts
// 대리점장용 계약서 거부 API

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';
import { updateContractStatus } from '@/lib/affiliate/contract';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const contractId = Number(resolvedParams.contractId);
    if (!contractId || Number.isNaN(contractId)) {
      return NextResponse.json({ ok: false, message: 'Invalid contract ID' }, { status: 400 });
    }

    const { profile, sessionUser } = await requirePartnerContext();

    // 대리점장만 사용 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json(
        { ok: false, message: '대리점장만 계약서를 거부할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 계약서 조회
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
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

    const body = await req.json().catch(() => ({}));
    const reasonInput = typeof body?.reason === 'string' ? body.reason : '';
    const reason = reasonInput.trim().slice(0, 500);

    const existingMetadata = (contract.metadata ?? {}) as Record<string, unknown>;
    const rejectionHistory = Array.isArray((existingMetadata as Record<string, unknown>)?.rejections)
      ? ([...(existingMetadata as Record<string, unknown>).rejections as Array<Record<string, unknown>>] as Array<Record<
          string,
          unknown
        >>)
      : [];

    rejectionHistory.push({
      reason: reason || null,
      rejectedAt: new Date().toISOString(),
      rejectedBy: sessionUser.id,
    });

    await updateContractStatus(contractId, 'rejected', sessionUser.id, {
      notes: reason || null,
      metadata: {
        ...existingMetadata,
        rejections: rejectionHistory,
      },
    });

    return NextResponse.json({ ok: true, message: '계약서가 거부되었습니다.' });
  } catch (error: any) {
    console.error(`[Partner Contract Reject] error:`, error);
    return NextResponse.json(
      { ok: false, message: error.message || '계약서 거부 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
