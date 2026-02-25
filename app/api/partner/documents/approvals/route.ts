import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const profile = await prisma.affiliateProfile.findFirst({
            where: { userId: user.id },
            select: { id: true, type: true },
        });

        if (!profile) {
            return NextResponse.json({ ok: false, error: 'Profile not found' }, { status: 404 });
        }

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') || 'all';
        const type = searchParams.get('type') || 'all';

        let whereClause: any = {};

        // 상태 필터
        if (status !== 'all') {
            whereClause.status = status.toUpperCase();
        }

        // 유형 필터
        if (type !== 'all') {
            whereClause.type = type;
        }

        // 권한에 따른 필터링
        // 권한에 따른 필터링
        if (profile.type === 'BRANCH_MANAGER') {
            // 대리점장: 본인의 요청 + 팀원의 요청
            const teamRelations = await prisma.affiliateRelation.findMany({
                where: { managerId: profile.id, status: 'ACTIVE' },
                select: { agentId: true },
            });
            const agentProfileIds = teamRelations.map(r => r.agentId);

            // agentProfileIds에 해당하는 User ID 조회
            const agentUsers = await prisma.affiliateProfile.findMany({
                where: { id: { in: agentProfileIds } },
                select: { userId: true },
            });
            const agentUserIds = agentUsers.map(u => u.userId);

            whereClause.OR = [
                { requesterId: user.id }, // 본인 요청
                { requesterId: { in: agentUserIds } }, // 팀원 요청
            ];
        } else {
            // 판매원: 본인의 요청만
            whereClause.requesterId = user.id;
        }

        const approvals = await prisma.documentApproval.findMany({
            where: whereClause,
            include: {
                requester: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        AffiliateProfile: {
                            select: {
                                id: true,
                                displayName: true,
                                type: true,
                                branchLabel: true,
                            }
                        }
                    }
                },
                approver: {
                    select: {
                        id: true,
                        name: true,
                        AffiliateProfile: {
                            select: {
                                id: true,
                                displayName: true,
                            }
                        }
                    }
                },
                AffiliateLead: {
                    select: {
                        id: true,
                        customerName: true,
                        customerPhone: true,
                    }
                },
                AffiliateSale: {
                    select: {
                        id: true,
                        saleAmount: true,
                        saleDate: true,
                        AffiliateProduct: {
                            select: {
                                title: true,
                                CruiseProduct: { select: { packageName: true } }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
        });

        // 프론트엔드 형식에 맞게 변환
        const formattedApprovals = approvals.map(approval => ({
            id: approval.id,
            certificateType: approval.type,
            status: approval.status.toLowerCase(),
            customerName: approval.AffiliateLead?.customerName || (approval.metadata as any)?.customerName || 'Unknown',
            productName: approval.AffiliateSale?.AffiliateProduct?.CruiseProduct?.packageName || approval.AffiliateSale?.AffiliateProduct?.title || 'Unknown Product',
            paymentAmount: approval.AffiliateSale?.saleAmount || 0,
            paymentDate: approval.AffiliateSale?.saleDate ? new Date(approval.AffiliateSale.saleDate).toISOString().split('T')[0] : '',
            refundAmount: (approval.metadata as any)?.refundAmount,
            refundDate: (approval.metadata as any)?.refundDate,
            createdAt: approval.createdAt.toISOString(),
            approvedAt: approval.processedAt?.toISOString(),
            rejectedReason: approval.adminNotes,
            Requester: {
                id: approval.requester?.id,
                name: approval.requester?.AffiliateProfile?.displayName || approval.requester?.name || 'Unknown',
                phone: approval.requester?.phone || '',
                AffiliateProfile: {
                    type: approval.requester?.AffiliateProfile?.type,
                    displayName: approval.requester?.AffiliateProfile?.displayName,
                    branchLabel: approval.requester?.AffiliateProfile?.branchLabel,
                }
            },
            Customer: {
                id: approval.AffiliateLead?.id,
                name: approval.AffiliateLead?.customerName,
                phone: approval.AffiliateLead?.customerPhone,
            },
            Approver: approval.approver ? {
                id: approval.approver.id,
                name: approval.approver.AffiliateProfile?.displayName || approval.approver.name,
            } : undefined,
        }));

        return NextResponse.json({ ok: true, approvals: formattedApprovals });

    } catch (error) {
        console.error('[Partner Document Approvals] Error:', error);
        return NextResponse.json(
            { ok: false, error: 'Failed to fetch approvals' },
            { status: 500 }
        );
    }
}
