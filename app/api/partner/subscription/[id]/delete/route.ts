export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 대리점장이 자신의 팀 판매원 계약서 삭제 (DB가 없을 때만 가능)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } = await requirePartnerContext();

    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, message: '대리점장만 삭제할 수 있습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const contractId = parseInt(id);

    // 계약서 조회 및 권한 확인
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      include: {
        user: {
          include: {
            AffiliateProfile: true,
          },
        },
      },
    });

    if (!contract || !contract.user) {
      return NextResponse.json({ ok: false, message: '계약서를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 대리점장의 팀에 속한 판매원인지 확인
    if (contract.invitedByProfileId !== profile.id) {
      const relation = await prisma.affiliateRelation.findFirst({
        where: {
          managerId: profile.id,
          agentId: contract.user.AffiliateProfile?.id,
          status: 'ACTIVE',
        },
      });

      if (!relation) {
        return NextResponse.json({ ok: false, message: '자신의 팀 판매원만 삭제할 수 있습니다.' }, { status: 403 });
      }
    }

    const profileId = contract.user.AffiliateProfile?.id;

    // DB 존재 여부 확인
    if (profileId) {
      const leadCount = await prisma.affiliateLead.count({
        where: {
          OR: [
            { agentId: profileId },
            { managerId: profileId },
          ],
        },
      });

      const saleCount = await prisma.affiliateSale.count({
        where: {
          OR: [
            { agentId: profileId },
            { managerId: profileId },
          ],
        },
      });

      if (leadCount > 0 || saleCount > 0) {
        return NextResponse.json({
          ok: false,
          message: 'DB가 있어서 삭제할 수 없습니다. (고객 데이터: ' + leadCount + '건, 판매 데이터: ' + saleCount + '건)',
          hasDb: true,
          leadCount,
          saleCount,
        }, { status: 400 });
      }
    }

    // DB가 없으면 삭제 가능
    await prisma.affiliateContract.delete({
      where: { id: contractId },
    });

    logger.log('[Partner Subscription Delete]', {
      contractId,
      managerId: profile.id,
      hasDb: false,
    });

    return NextResponse.json({
      ok: true,
      message: '정액제 판매원 계약서가 삭제되었습니다.',
    });
  } catch (error: any) {
    logger.error('[Partner Subscription Delete API] Error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || '삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}


