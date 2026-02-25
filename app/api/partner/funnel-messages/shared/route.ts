export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * GET /api/partner/funnel-messages/shared
 * 나에게 공유된 퍼널 목록 조회
 *
 * 공유 조건:
 * 1. shareType = 'ALL' AND status = 'ACTIVE'
 * 2. shareType = 'BRANCH_MANAGER' AND 내가 대리점장 AND status = 'ACTIVE'
 * 3. shareType = 'SALES_AGENT' AND 내가 판매원 AND status = 'ACTIVE'
 * 4. shareType = 'SPECIFIC' AND targetProfileId = 내 프로필 ID AND status = 'ACTIVE'
 */
export async function GET(req: NextRequest) {
  try {
    console.log('[Partner Shared Funnel Messages GET] 요청 시작');

    const user = await getSessionUser();
    if (!user) {
      console.log('[Partner Shared Funnel Messages GET] 사용자 인증 실패');
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Partner Shared Funnel Messages GET] 사용자 확인:', { userId: user.id, name: user.name });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'sms', 'email', 'kakao'
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // 판매원/대리점장 프로필 확인
    const affiliateProfile = await prisma.affiliateProfile.findFirst({
      where: { userId: user.id },
      select: {
        id: true,
        type: true,
        displayName: true,
        branchLabel: true,
      },
    });

    if (!affiliateProfile) {
      console.log('[Partner Shared Funnel Messages GET] 프로필 없음:', { userId: user.id });
      return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
    }

    console.log('[Partner Shared Funnel Messages GET] 프로필 확인:', {
      profileId: affiliateProfile.id,
      type: affiliateProfile.type
    });

    // 공유 조건 구성
    const shareConditions: any[] = [
      // 1. 모든 파트너에게 공유 (ALL)
      { shareType: 'ALL', status: 'ACTIVE' },
      // 4. 나에게 직접 공유된 경우 (SPECIFIC)
      { shareType: 'SPECIFIC', targetProfileId: affiliateProfile.id, status: 'ACTIVE' },
    ];

    // 2. 대리점장인 경우
    if (affiliateProfile.type === 'BRANCH_MANAGER') {
      shareConditions.push({ shareType: 'BRANCH_MANAGER', status: 'ACTIVE' });
    }

    // 3. 판매원인 경우
    if (affiliateProfile.type === 'SALES_AGENT') {
      shareConditions.push({ shareType: 'SALES_AGENT', status: 'ACTIVE' });
    }

    console.log('[Partner Shared Funnel Messages GET] 공유 조건:', shareConditions);

    // 내가 이미 복제한 퍼널 ID 목록 조회
    const myClonedFunnels = await prisma.funnelMessage.findMany({
      where: {
        ownerProfileId: affiliateProfile.id,
        sourceId: { not: null },
      },
      select: {
        sourceId: true,
      },
    });

    const clonedSourceIds = new Set(
      myClonedFunnels.map(f => f.sourceId).filter((id): id is number => id !== null)
    );

    console.log('[Partner Shared Funnel Messages GET] 복제한 퍼널 ID:', Array.from(clonedSourceIds));

    // 퍼널 메시지 조회 조건
    const where: any = {
      shares: {
        some: {
          OR: shareConditions,
        },
      },
      isActive: true,
    };

    if (type) {
      where.messageType = type;
    }

    // 총 개수 조회
    const totalCount = await prisma.funnelMessage.count({ where });

    // 페이지네이션 적용하여 퍼널 조회
    const sharedFunnels = await prisma.funnelMessage.findMany({
      where,
      include: {
        FunnelMessageStage: {
          orderBy: { order: 'asc' },
        },
        shares: {
          where: {
            OR: shareConditions,
          },
          include: {
            sharedByProfile: {
              select: {
                id: true,
                displayName: true,
                branchLabel: true,
                type: true,
                User: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            sharedByAdmin: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        },
        ownerProfile: {
          select: {
            id: true,
            displayName: true,
            branchLabel: true,
            type: true,
            User: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        User: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    console.log('[Partner Shared Funnel Messages GET] 조회 성공:', {
      count: sharedFunnels.length,
      totalCount,
      page,
      limit,
    });

    return NextResponse.json({
      ok: true,
      funnels: sharedFunnels.map(funnel => {
        // 공유자 정보 추출
        const share = funnel.shares[0]; // 조건에 맞는 첫 번째 공유 정보
        let sharedBy = null;

        if (share) {
          if (share.sharedByProfile) {
            sharedBy = {
              type: 'partner',
              profileId: share.sharedByProfile.id,
              name: share.sharedByProfile.displayName || share.sharedByProfile.branchLabel || 'Unknown',
              partnerType: share.sharedByProfile.type,
              userId: share.sharedByProfile.User?.id,
              userName: share.sharedByProfile.User?.name,
            };
          } else if (share.sharedByAdmin) {
            sharedBy = {
              type: 'admin',
              userId: share.sharedByAdmin.id,
              name: share.sharedByAdmin.name || 'Admin',
              role: share.sharedByAdmin.role,
            };
          }
        }

        // 소유자 정보 추출
        let owner = null;
        if (funnel.ownerProfile) {
          owner = {
            type: 'partner',
            profileId: funnel.ownerProfile.id,
            name: funnel.ownerProfile.displayName || funnel.ownerProfile.branchLabel || 'Unknown',
            partnerType: funnel.ownerProfile.type,
            userId: funnel.ownerProfile.User?.id,
            userName: funnel.ownerProfile.User?.name,
          };
        } else if (funnel.User) {
          owner = {
            type: 'admin',
            userId: funnel.User.id,
            name: funnel.User.name || 'Admin',
            role: funnel.User.role,
          };
        }

        return {
          id: funnel.id,
          messageType: funnel.messageType,
          title: funnel.title,
          category: funnel.category,
          groupName: funnel.groupName,
          description: funnel.description,
          senderPhone: funnel.senderPhone,
          senderEmail: funnel.senderEmail,
          sendTime: funnel.sendTime,
          optOutNumber: funnel.optOutNumber,
          autoAddOptOut: funnel.autoAddOptOut,
          isActive: funnel.isActive,
          isTemplate: funnel.isTemplate,
          createdAt: funnel.createdAt.toISOString(),
          updatedAt: funnel.updatedAt.toISOString(),

          // 공유 정보
          shareInfo: share ? {
            id: share.id,
            shareType: share.shareType,
            sharedAt: share.createdAt.toISOString(),
          } : null,

          // 공유자 정보
          sharedBy,

          // 소유자 정보
          owner,

          // 복제 여부
          isCloned: clonedSourceIds.has(funnel.id),

          // 스테이지 정보
          stages: funnel.FunnelMessageStage.map(stage => ({
            id: stage.id,
            stageNumber: stage.stageNumber,
            daysAfter: stage.daysAfter,
            sendTime: stage.sendTime,
            content: stage.content,
            imageUrl: stage.imageUrl,
            order: stage.order,
            createdAt: stage.createdAt.toISOString(),
            updatedAt: stage.updatedAt.toISOString(),
          })),
        };
      }),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount,
      },
    });
  } catch (error: any) {
    console.error('[Partner Shared Funnel Messages GET] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: '공유된 퍼널 메시지를 불러오는데 실패했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}
