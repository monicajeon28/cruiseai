import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ approvalId: string }> }
) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const profile = await prisma.affiliateProfile.findFirst({
            where: { userId: user.id },
            select: { id: true, type: true },
        });

        if (!profile || profile.type !== 'BRANCH_MANAGER') {
            return NextResponse.json({ ok: false, error: 'Only Branch Managers can approve requests' }, { status: 403 });
        }

        const { approvalId: approvalIdStr } = await params;
        const approvalId = parseInt(approvalIdStr);

        if (isNaN(approvalId)) {
            return NextResponse.json({ ok: false, error: 'Invalid approval ID' }, { status: 400 });
        }

        // 승인 요청 확인
        const approval = await prisma.documentApproval.findUnique({
            where: { id: approvalId },
        });

        if (!approval) {
            return NextResponse.json({ ok: false, error: 'Approval request not found' }, { status: 404 });
        }

        if (approval.status !== 'PENDING') {
            return NextResponse.json({ ok: false, error: 'Request is not pending' }, { status: 400 });
        }

        // 권한 확인: 요청자가 내 팀원인지 확인
        const requesterId = approval.requesterId; // User ID
        if (!requesterId) {
            return NextResponse.json({ ok: false, error: 'Invalid requester' }, { status: 400 });
        }

        // Requester의 Profile ID 찾기
        const requesterProfile = await prisma.affiliateProfile.findFirst({
            where: { userId: requesterId },
            select: { id: true }
        });

        if (!requesterProfile) {
            return NextResponse.json({ ok: false, error: 'Requester profile not found' }, { status: 404 });
        }

        const teamRelation = await prisma.affiliateRelation.findFirst({
            where: { managerId: profile.id, agentId: requesterProfile.id, status: 'ACTIVE' },
        });

        if (!teamRelation && requesterProfile.id !== profile.id) {
            return NextResponse.json({ ok: false, error: 'You can only approve requests from your team' }, { status: 403 });
        }

        // 승인 처리
        await prisma.documentApproval.update({
            where: { id: approvalId },
            data: {
                status: 'APPROVED',
                approvedBy: user.id,
                processedAt: new Date(),
            },
        });

        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error('[Partner Document Approve] Error:', error);
        return NextResponse.json(
            { ok: false, error: 'Failed to approve request' },
            { status: 500 }
        );
    }
}
