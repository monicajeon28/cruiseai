import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
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

        const body = await req.json();
        const { customerId, type, customerName, birthDate, refundAmount, refundDate } = body;

        if (!customerId || !type || !customerName) {
            return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
        }

        // 고객(AffiliateLead) 확인 및 권한 체크
        const lead = await prisma.affiliateLead.findUnique({
            where: { id: customerId },
        });

        if (!lead) {
            return NextResponse.json({ ok: false, error: 'Customer not found' }, { status: 404 });
        }

        // 권한 체크 (본인 또는 팀원의 리드인지)
        let hasAccess = false;
        if (lead.managerId === profile.id || lead.agentId === profile.id) {
            hasAccess = true;
        } else if (profile.type === 'BRANCH_MANAGER') {
            const teamRelation = await prisma.affiliateRelation.findFirst({
                where: { managerId: profile.id, agentId: lead.agentId || -1, status: 'ACTIVE' },
            });
            if (teamRelation) hasAccess = true;
        }

        if (!hasAccess) {
            return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
        }

        // 해당 고객의 최근 판매 내역 찾기 (연결을 위해)
        const sale = await prisma.affiliateSale.findFirst({
            where: { leadId: lead.id, status: { not: 'CANCELLED' } },
            orderBy: { saleDate: 'desc' },
        });

        if (!sale) {
            return NextResponse.json({ ok: false, error: 'No active sale found for this customer' }, { status: 400 });
        }

        // 승인 요청 생성 (DocumentApproval)
        // 스키마에 DocumentApproval 모델이 있는지 확인 필요. 
        // 이전 대화에서 DocumentApprovalListRelationFilter가 보였으므로 모델이 존재함.
        // 필드: requesterId, approverId, status, type, etc.
        // requesterId는 AffiliateProfile ID일 가능성이 높음.

        const approval = await prisma.documentApproval.create({
            data: {
                requesterId: user.id,
                saleId: sale.id,
                leadId: lead.id,
                type: type, // 'purchase' or 'refund'
                status: 'PENDING',
                metadata: {
                    customerName,
                    birthDate,
                    refundAmount,
                    refundDate,
                },
            },
        });

        return NextResponse.json({ ok: true, approval });

    } catch (error) {
        console.error('[Partner Document Certify] Error:', error);
        return NextResponse.json(
            { ok: false, error: 'Failed to create certification request' },
            { status: 500 }
        );
    }
}
