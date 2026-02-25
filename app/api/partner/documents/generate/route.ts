export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';

// POST: Generate document or create approval request
export async function POST(req: NextRequest) {
    try {
        const { sessionUser, profile } = await requirePartnerContext();
        if (!sessionUser || !profile) {
            return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
        }

        const body = await req.json();
        const { documentType, saleId, leadId } = body;

        if (!documentType || !['COMPARISON_QUOTE', 'PURCHASE_CONFIRMATION', 'REFUND_CERTIFICATE'].includes(documentType)) {
            return NextResponse.json(
                { ok: false, error: '올바른 문서 타입을 지정해주세요' },
                { status: 400 }
            );
        }

        // Comparison quotes are generated directly (no approval needed)
        if (documentType === 'COMPARISON_QUOTE') {
            return NextResponse.json({
                ok: true,
                message: '비교견적서는 클라이언트에서 직접 생성됩니다.',
            });
        }

        // Certificates require approval - create approval request
        if (!saleId) {
            return NextResponse.json(
                { ok: false, error: '판매 ID가 필요합니다' },
                { status: 400 }
            );
        }

        // Verify access to the sale
        const sale = await prisma.affiliateSale.findUnique({
            where: { id: saleId },
            select: {
                id: true,
                managerId: true,
                agentId: true,
                status: true,
            },
        });

        if (!sale) {
            return NextResponse.json(
                { ok: false, error: '판매 정보를 찾을 수 없습니다' },
                { status: 404 }
            );
        }

        // Check if user has access to this sale
        let hasAccess = false;

        if (profile.type === 'BRANCH_MANAGER') {
            // Branch manager can request for own sales or sales of their agents
            if (sale.managerId === profile.id) {
                hasAccess = true;
            } else if (sale.agentId) {
                // Check if the agent belongs to this manager
                const agent = await prisma.affiliateProfile.findFirst({
                    where: {
                        id: sale.agentId,
                        managerId: profile.id,
                    },
                });
                hasAccess = !!agent;
            }
        } else if (profile.type === 'SALES_AGENT') {
            // Sales agents should not request certificates (blocked by UI, but also check here)
            return NextResponse.json(
                { ok: false, error: '판매원은 인증서 승인을 요청할 수 없습니다. 점장에게 문의하세요.' },
                { status: 403 }
            );
        }

        if (!hasAccess) {
            return NextResponse.json(
                { ok: false, error: '이 판매에 대한 권한이 없습니다' },
                { status: 403 }
            );
        }

        // Create approval request
        const approval = await prisma.documentApproval.create({
            data: {
                type: documentType,
                requesterId: sessionUser.id,
                saleId: sale.id,
                leadId: leadId || null,
                status: 'PENDING',
                requestData: body,
            },
        });

        return NextResponse.json({
            ok: true,
            message: '승인 요청이 전송되었습니다. 관리자 승인 후 문서가 생성됩니다.',
            approvalId: approval.id,
        });
    } catch (error: any) {
        console.error('[Partner Documents Generate] Error:', error);
        return NextResponse.json(
            { ok: false, error: error.message || '문서 생성 중 오류가 발생했습니다' },
            { status: 500 }
        );
    }
}
