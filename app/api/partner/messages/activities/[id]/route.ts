export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/app/api/partner/_utils';

/**
 * DELETE /api/partner/messages/activities/[id]
 * 고객 기록(AffiliateInteraction) 삭제
 * 본인 또는 소속 판매원의 기록만 삭제 가능
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { sessionUser, profile } = await requirePartnerContext({ includeManagedAgents: true });
        const { id } = await params;
        const activityId = parseInt(id);

        if (isNaN(activityId)) {
            return NextResponse.json({ ok: false, error: 'Invalid activity ID' }, { status: 400 });
        }

        // 삭제할 기록 조회
        const activity = await prisma.affiliateInteraction.findUnique({
            where: { id: activityId },
            select: { id: true, profileId: true },
        });

        if (!activity) {
            return NextResponse.json({ ok: false, error: 'Activity not found' }, { status: 404 });
        }

        // 권한 확인: 본인 기록이거나 대리점장이 소속 판매원 기록인 경우만 삭제 가능
        const allowedProfileIds: number[] = [profile.id];

        if (profile.type === 'BRANCH_MANAGER' && profile.managedAgents) {
            for (const agent of profile.managedAgents) {
                if (agent?.id) {
                    allowedProfileIds.push(agent.id);
                }
            }
        }

        if (!allowedProfileIds.includes(activity.profileId)) {
            return NextResponse.json({ ok: false, error: '삭제 권한이 없습니다.' }, { status: 403 });
        }

        // 삭제 실행
        await prisma.affiliateInteraction.delete({
            where: { id: activityId },
        });

        console.log(`[Partner Activities] Deleted activity ${activityId} by user ${sessionUser.id}`);

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('[Partner Activities DELETE] Error:', error);
        return NextResponse.json(
            { ok: false, error: error.message || 'Failed to delete activity' },
            { status: error.status || 500 }
        );
    }
}
