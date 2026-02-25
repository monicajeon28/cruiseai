export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/app/api/partner/_utils';

/**
 * GET /api/partner/messages/activities
 * 최근 30일간의 팀 고객 기록 업데이트 조회
 * 대리점장: 본인 + 소속 판매원의 고객 기록
 * 판매원: 본인의 고객 기록만
 *
 * 성능 최적화:
 * - 30일 이내 데이터만 조회 (자동 필터링)
 * - 페이지네이션 적용 (기본 50건)
 * - 인덱스 활용 (occurredAt, profileId)
 */
export async function GET(req: NextRequest) {
    try {
        const { sessionUser, profile } = await requirePartnerContext({ includeManagedAgents: true });

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const skip = (page - 1) * limit;

        // 30일 전 날짜
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // 조회할 프로필 ID 목록
        const profileIds: number[] = [profile.id];

        // 대리점장인 경우 소속 판매원 포함
        if (profile.type === 'BRANCH_MANAGER' && profile.managedAgents) {
            for (const agent of profile.managedAgents) {
                if (agent?.id) {
                    profileIds.push(agent.id);
                }
            }
        }

        // 총 개수 조회 (페이지네이션용)
        const totalCount = await prisma.affiliateInteraction.count({
            where: {
                profileId: { in: profileIds },
                occurredAt: { gte: thirtyDaysAgo },
            },
        });

        // 고객 기록 조회
        const activities = await prisma.affiliateInteraction.findMany({
            where: {
                profileId: { in: profileIds },
                occurredAt: { gte: thirtyDaysAgo },
            },
            include: {
                AffiliateLead: {
                    select: {
                        id: true,
                        customerName: true,
                        customerPhone: true,
                        status: true,
                    },
                },
                AffiliateProfile: {
                    select: {
                        id: true,
                        displayName: true,
                        type: true,
                        User: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
                User: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { occurredAt: 'desc' },
            skip,
            take: limit,
        });

        // 응답 포맷팅
        const formattedActivities = activities.map((activity) => ({
            id: activity.id,
            interactionType: activity.interactionType,
            note: activity.note,
            occurredAt: activity.occurredAt.toISOString(),
            // 고객 정보
            lead: activity.AffiliateLead ? {
                id: activity.AffiliateLead.id,
                customerName: activity.AffiliateLead.customerName,
                customerPhone: activity.AffiliateLead.customerPhone,
                status: activity.AffiliateLead.status,
            } : null,
            // 담당자 정보
            profile: activity.AffiliateProfile ? {
                id: activity.AffiliateProfile.id,
                displayName: activity.AffiliateProfile.displayName || activity.AffiliateProfile.User?.name,
                type: activity.AffiliateProfile.type,
            } : null,
            // 기록 작성자
            createdBy: activity.User ? {
                id: activity.User.id,
                name: activity.User.name,
            } : null,
            // 본인 기록 여부
            isOwn: activity.profileId === profile.id,
        }));

        const totalPages = Math.ceil(totalCount / limit);

        return NextResponse.json({
            ok: true,
            activities: formattedActivities,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages,
                hasMore: page < totalPages,
            },
        });
    } catch (error: any) {
        console.error('[Partner Activities] Error:', error);
        return NextResponse.json(
            { ok: false, error: error.message || 'Failed to fetch activities' },
            { status: error.status || 500 }
        );
    }
}
