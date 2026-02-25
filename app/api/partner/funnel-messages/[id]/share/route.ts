export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * GET /api/partner/funnel-messages/[id]/share
 * 퍼널 메시지의 기존 공유 목록 조회 (소유자만 조회 가능)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('[Partner Funnel Share GET] 요청 시작');

    const user = await getSessionUser();
    if (!user) {
      console.log('[Partner Funnel Share GET] 사용자 인증 실패');
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const funnelMessageId = parseInt(id);

    if (isNaN(funnelMessageId)) {
      return NextResponse.json({ ok: false, error: 'Invalid funnel message ID' }, { status: 400 });
    }

    console.log('[Partner Funnel Share GET] 사용자 확인:', {
      userId: user.id,
      name: user.name,
      funnelMessageId
    });

    // 퍼널 메시지 존재 여부 및 권한 확인
    const funnelMessage = await prisma.funnelMessage.findUnique({
      where: { id: funnelMessageId },
      select: {
        id: true,
        adminId: true,
        ownerProfileId: true,
      },
    });

    if (!funnelMessage) {
      return NextResponse.json({ ok: false, error: 'Funnel message not found' }, { status: 404 });
    }

    // 권한 확인: 관리자 또는 퍼널 메시지의 소유자만 공유 목록 조회 가능
    let isAdmin = false;
    let affiliateProfile = null;

    if (user.role === 'admin') {
      isAdmin = true;
    } else {
      affiliateProfile = await prisma.affiliateProfile.findFirst({
        where: { userId: user.id },
        select: { id: true },
      });

      if (!affiliateProfile) {
        return NextResponse.json({
          ok: false,
          error: 'Affiliate profile not found'
        }, { status: 404 });
      }

      const isOwner = funnelMessage.adminId === user.id ||
                      funnelMessage.ownerProfileId === affiliateProfile.id;

      if (!isOwner) {
        return NextResponse.json({
          ok: false,
          error: 'Permission denied. You must be the owner to view shares.'
        }, { status: 403 });
      }
    }

    // 공유 목록 조회 - 본인이 공유한 것만 조회
    const whereClause: any = {
      funnelMessageId,
      status: 'ACTIVE',
    };

    if (!isAdmin) {
      whereClause.sharedByProfileId = affiliateProfile!.id;
    } else {
      whereClause.sharedByAdminId = user.id;
    }

    const shares = await prisma.funnelMessageShare.findMany({
      where: whereClause,
      include: {
        targetProfile: {
          select: {
            id: true,
            displayName: true,
            branchLabel: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('[Partner Funnel Share GET] 공유 목록 조회 성공:', {
      count: shares.length,
      funnelMessageId
    });

    return NextResponse.json({
      ok: true,
      shares: shares.map(share => ({
        id: share.id,
        shareType: share.shareType,
        targetProfile: share.targetProfile ? {
          id: share.targetProfile.id,
          displayName: share.targetProfile.displayName,
          branchLabel: share.targetProfile.branchLabel,
          type: share.targetProfile.type,
        } : null,
        sharedAt: share.createdAt.toISOString(),
        status: share.status,
      })),
    });

  } catch (error: any) {
    console.error('[Partner Funnel Share GET] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: '공유 목록 조회에 실패했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/funnel-messages/[id]/share
 * 퍼널 메시지 공유 (관리자/대리점장/판매원 모두 가능)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('[Partner Funnel Share POST] 요청 시작');

    const user = await getSessionUser();
    if (!user) {
      console.log('[Partner Funnel Share POST] 사용자 인증 실패');
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const funnelMessageId = parseInt(id);

    if (isNaN(funnelMessageId)) {
      return NextResponse.json({ ok: false, error: 'Invalid funnel message ID' }, { status: 400 });
    }

    console.log('[Partner Funnel Share POST] 사용자 확인:', {
      userId: user.id,
      name: user.name,
      funnelMessageId
    });

    const body = await req.json();
    const { shareType, targetProfileIds } = body;

    // 요청 검증
    if (!shareType || !['ALL', 'BRANCH_MANAGER', 'SALES_AGENT', 'SPECIFIC'].includes(shareType)) {
      return NextResponse.json({
        ok: false,
        error: 'Invalid shareType. Must be: ALL, BRANCH_MANAGER, SALES_AGENT, or SPECIFIC'
      }, { status: 400 });
    }

    if (shareType === 'SPECIFIC' && (!targetProfileIds || !Array.isArray(targetProfileIds) || targetProfileIds.length === 0)) {
      return NextResponse.json({
        ok: false,
        error: 'targetProfileIds is required for SPECIFIC shareType'
      }, { status: 400 });
    }

    // 퍼널 메시지 존재 여부 및 권한 확인
    const funnelMessage = await prisma.funnelMessage.findUnique({
      where: { id: funnelMessageId },
      select: {
        id: true,
        adminId: true,
        title: true,
        ownerProfileId: true,
      },
    });

    if (!funnelMessage) {
      return NextResponse.json({ ok: false, error: 'Funnel message not found' }, { status: 404 });
    }

    // 권한 확인: 관리자 또는 퍼널 메시지의 소유자만 공유 가능
    let isAdmin = false;
    let affiliateProfile = null;

    // 관리자 권한 확인
    if (user.role === 'admin') {
      isAdmin = true;
    } else {
      // 파트너 프로필 확인
      affiliateProfile = await prisma.affiliateProfile.findFirst({
        where: { userId: user.id },
        select: {
          id: true,
          type: true,
          displayName: true,
          branchLabel: true,
        },
      });

      if (!affiliateProfile) {
        return NextResponse.json({
          ok: false,
          error: 'Affiliate profile not found'
        }, { status: 404 });
      }

      // 퍼널 메시지 소유자 확인
      const isOwner = funnelMessage.adminId === user.id ||
                      funnelMessage.ownerProfileId === affiliateProfile.id;

      if (!isOwner) {
        return NextResponse.json({
          ok: false,
          error: 'Permission denied. You must be the owner to share this funnel.'
        }, { status: 403 });
      }
    }

    console.log('[Partner Funnel Share POST] 권한 확인 완료:', {
      isAdmin,
      profileId: affiliateProfile?.id,
      shareType
    });

    // 공유 생성 데이터 준비
    const sharesToCreate: Array<{
      funnelMessageId: number;
      shareType: string;
      targetProfileId?: number;
      sharedByProfileId?: number;
      sharedByAdminId?: number;
      status: string;
    }> = [];

    if (shareType === 'SPECIFIC') {
      // SPECIFIC: 특정 프로필들에게 개별 공유
      for (const targetProfileId of targetProfileIds) {
        const targetId = parseInt(targetProfileId);
        if (isNaN(targetId)) continue;

        // 대상 프로필 존재 확인
        const targetProfile = await prisma.affiliateProfile.findUnique({
          where: { id: targetId },
          select: { id: true },
        });

        if (!targetProfile) {
          console.warn(`[Partner Funnel Share POST] Target profile ${targetId} not found, skipping`);
          continue;
        }

        // 중복 공유 확인
        const existingShare = await prisma.funnelMessageShare.findFirst({
          where: {
            funnelMessageId,
            shareType: 'SPECIFIC',
            targetProfileId: targetId,
            status: 'ACTIVE',
          },
        });

        if (existingShare) {
          console.warn(`[Partner Funnel Share POST] Already shared to profile ${targetId}, skipping`);
          continue;
        }

        sharesToCreate.push({
          funnelMessageId,
          shareType: 'SPECIFIC',
          targetProfileId: targetId,
          sharedByProfileId: isAdmin ? undefined : affiliateProfile!.id,
          sharedByAdminId: isAdmin ? user.id : undefined,
          status: 'ACTIVE',
        });
      }

      if (sharesToCreate.length === 0) {
        return NextResponse.json({
          ok: false,
          error: 'No valid targets found or all already shared'
        }, { status: 400 });
      }
    } else {
      // ALL, BRANCH_MANAGER, SALES_AGENT: 단일 공유 레코드
      // 중복 공유 확인
      const existingShare = await prisma.funnelMessageShare.findFirst({
        where: {
          funnelMessageId,
          shareType,
          status: 'ACTIVE',
        },
      });

      if (existingShare) {
        return NextResponse.json({
          ok: false,
          error: `Funnel already shared with type: ${shareType}`
        }, { status: 409 });
      }

      sharesToCreate.push({
        funnelMessageId,
        shareType,
        sharedByProfileId: isAdmin ? undefined : affiliateProfile!.id,
        sharedByAdminId: isAdmin ? user.id : undefined,
        status: 'ACTIVE',
      });
    }

    // 공유 생성
    const createdShares = await prisma.$transaction(
      sharesToCreate.map(share =>
        prisma.funnelMessageShare.create({
          data: share,
          include: {
            targetProfile: {
              select: {
                id: true,
                displayName: true,
                branchLabel: true,
                type: true,
              },
            },
          },
        })
      )
    );

    console.log('[Partner Funnel Share POST] 공유 생성 성공:', {
      count: createdShares.length,
      shareType
    });

    return NextResponse.json({
      ok: true,
      message: `Successfully shared to ${createdShares.length} recipient(s)`,
      shares: createdShares.map(share => ({
        id: share.id,
        funnelMessageId: share.funnelMessageId,
        shareType: share.shareType,
        targetProfile: share.targetProfile ? {
          id: share.targetProfile.id,
          name: share.targetProfile.displayName || share.targetProfile.branchLabel,
          type: share.targetProfile.type,
        } : null,
        status: share.status,
        createdAt: share.createdAt.toISOString(),
      })),
    });

  } catch (error: any) {
    console.error('[Partner Funnel Share POST] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: '퍼널 공유에 실패했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/funnel-messages/[id]/share
 * 공유 회수 (공유했던 모든 레코드를 REVOKED 상태로 변경)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('[Partner Funnel Share DELETE] 요청 시작');

    const user = await getSessionUser();
    if (!user) {
      console.log('[Partner Funnel Share DELETE] 사용자 인증 실패');
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const funnelMessageId = parseInt(id);

    if (isNaN(funnelMessageId)) {
      return NextResponse.json({ ok: false, error: 'Invalid funnel message ID' }, { status: 400 });
    }

    console.log('[Partner Funnel Share DELETE] 사용자 확인:', {
      userId: user.id,
      name: user.name,
      funnelMessageId
    });

    // URL 파라미터로 특정 공유 타입 또는 대상 지정 가능
    const { searchParams } = new URL(req.url);
    const shareType = searchParams.get('shareType');
    const targetProfileId = searchParams.get('targetProfileId');

    // 퍼널 메시지 존재 여부 및 권한 확인
    const funnelMessage = await prisma.funnelMessage.findUnique({
      where: { id: funnelMessageId },
      select: {
        id: true,
        adminId: true,
        ownerProfileId: true,
      },
    });

    if (!funnelMessage) {
      return NextResponse.json({ ok: false, error: 'Funnel message not found' }, { status: 404 });
    }

    // 권한 확인: 관리자 또는 퍼널 메시지의 소유자만 회수 가능
    let isAdmin = false;
    let affiliateProfile = null;

    if (user.role === 'admin') {
      isAdmin = true;
    } else {
      affiliateProfile = await prisma.affiliateProfile.findFirst({
        where: { userId: user.id },
        select: { id: true },
      });

      if (!affiliateProfile) {
        return NextResponse.json({
          ok: false,
          error: 'Affiliate profile not found'
        }, { status: 404 });
      }

      const isOwner = funnelMessage.adminId === user.id ||
                      funnelMessage.ownerProfileId === affiliateProfile.id;

      if (!isOwner) {
        return NextResponse.json({
          ok: false,
          error: 'Permission denied. You must be the owner to revoke shares.'
        }, { status: 403 });
      }
    }

    // 회수할 공유 조건 설정
    const whereClause: any = {
      funnelMessageId,
      status: 'ACTIVE',
    };

    // 본인이 공유한 것만 회수 가능
    if (!isAdmin) {
      whereClause.sharedByProfileId = affiliateProfile!.id;
    } else {
      // 관리자의 경우 관리자가 공유한 것만 회수
      whereClause.sharedByAdminId = user.id;
    }

    // 선택적 필터
    if (shareType) {
      whereClause.shareType = shareType;
    }

    if (targetProfileId) {
      whereClause.targetProfileId = parseInt(targetProfileId);
    }

    // 회수할 공유 찾기
    const sharesToRevoke = await prisma.funnelMessageShare.findMany({
      where: whereClause,
      select: { id: true },
    });

    if (sharesToRevoke.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'No active shares found to revoke'
      }, { status: 404 });
    }

    // 상태를 REVOKED로 변경
    const revokedAt = new Date();
    await prisma.funnelMessageShare.updateMany({
      where: {
        id: { in: sharesToRevoke.map(s => s.id) },
      },
      data: {
        status: 'REVOKED',
        revokedAt,
        updatedAt: revokedAt,
      },
    });

    console.log('[Partner Funnel Share DELETE] 공유 회수 성공:', {
      count: sharesToRevoke.length
    });

    return NextResponse.json({
      ok: true,
      message: `Successfully revoked ${sharesToRevoke.length} share(s)`,
      count: sharesToRevoke.length,
    });

  } catch (error: any) {
    console.error('[Partner Funnel Share DELETE] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: '공유 회수에 실패했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}
