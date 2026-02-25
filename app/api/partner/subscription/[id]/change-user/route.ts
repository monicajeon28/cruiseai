export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 대리점장이 링크 사용자 변경 (이름과 연락처 수정)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } = await requirePartnerContext();

    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, message: '대리점장만 변경할 수 있습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const subscriptionId = parseInt(id);
    const { name, phone } = await req.json();

    if (!name || !phone) {
      return NextResponse.json({ ok: false, message: '이름과 연락처는 필수입니다.' }, { status: 400 });
    }

    // 계약서 조회 및 권한 확인
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: subscriptionId },
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
        return NextResponse.json({ ok: false, message: '자신의 팀 판매원만 변경할 수 있습니다.' }, { status: 403 });
      }
    }

    // DB 존재 여부 확인 (DB가 있으면 삭제 불가능)
    const profileId = contract.user.AffiliateProfile?.id;
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
        // DB가 있으면 사용자 정보만 업데이트 (삭제 불가)
        const normalizedPhone = phone.replace(/[^0-9]/g, '');
        
        await prisma.user.update({
          where: { id: contract.user.id },
          data: {
            name: name.trim(),
            phone: normalizedPhone,
          },
        });

        await prisma.affiliateContract.update({
          where: { id: subscriptionId },
          data: {
            name: name.trim(),
            phone: normalizedPhone,
          },
        });

        logger.log('[Partner Subscription Change User]', {
          subscriptionId,
          userId: contract.user.id,
          hasDb: true,
          leadCount,
          saleCount,
        });

        return NextResponse.json({
          ok: true,
          message: '사용자 정보가 변경되었습니다. (DB가 있어서 삭제는 불가능합니다)',
        });
      }
    }

    // DB가 없으면 사용자 정보 업데이트
    const normalizedPhone = phone.replace(/[^0-9]/g, '');
    
    await prisma.user.update({
      where: { id: contract.user.id },
      data: {
        name: name.trim(),
        phone: normalizedPhone,
      },
    });

    await prisma.affiliateContract.update({
      where: { id: subscriptionId },
      data: {
        name: name.trim(),
        phone: normalizedPhone,
      },
    });

    logger.log('[Partner Subscription Change User]', {
      subscriptionId,
      userId: contract.user.id,
      hasDb: false,
    });

    return NextResponse.json({
      ok: true,
      message: '사용자 정보가 변경되었습니다.',
    });
  } catch (error: any) {
    logger.error('[Partner Subscription Change User API] Error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || '변경에 실패했습니다.' },
      { status: 500 }
    );
  }
}


