export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext, PartnerApiError } from '@/app/api/partner/_utils';

/**
 * GET /api/partner/statements
 * 매출 내역 조회
 */
export async function GET(req: NextRequest) {
    try {
        const { profile } = await requirePartnerContext({ includeManagedAgents: true });
        const { searchParams } = new URL(req.url);

        const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 100);
        const skip = (page - 1) * limit;

        // 관리 중인 판매원 ID 목록
        const agentIds = profile.managedAgents?.map((a: any) => a.id) || [];
        const allProfileIds = [profile.id, ...agentIds];

        const where = {
            OR: [
                { managerId: profile.id },
                { agentId: { in: allProfileIds } },
            ],
        };

        const total = await prisma.affiliateSale.count({ where });

        const sales = await prisma.affiliateSale.findMany({
            where,
            orderBy: [
                { saleDate: 'desc' },
                { createdAt: 'desc' },
            ],
            skip,
            take: limit,
            include: {
                AffiliateLead: {
                    select: {
                        id: true,
                        customerName: true,
                        customerPhone: true,
                    },
                },
                AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile: {
                    select: {
                        id: true,
                        displayName: true,
                        affiliateCode: true,
                    },
                },
                AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile: {
                    select: {
                        id: true,
                        displayName: true,
                        affiliateCode: true,
                    },
                },
                Payment: {
                    select: {
                        id: true,
                        orderId: true,
                        status: true,
                        amount: true,
                    },
                },
            },
        });

        const serialized = sales.map((sale) => ({
            id: sale.id,
            externalOrderCode: sale.externalOrderCode,
            saleAmount: sale.saleAmount,
            netRevenue: sale.netRevenue,
            commissionRate: sale.commissionRate,
            status: sale.status,
            saleDate: sale.saleDate?.toISOString() || null,
            createdAt: sale.createdAt.toISOString(),
            customer: sale.AffiliateLead ? {
                id: sale.AffiliateLead.id,
                name: sale.AffiliateLead.customerName,
                phone: sale.AffiliateLead.customerPhone,
            } : null,
            manager: sale.AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile ? {
                id: sale.AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile.id,
                displayName: sale.AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile.displayName,
                affiliateCode: sale.AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile.affiliateCode,
            } : null,
            agent: sale.AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile ? {
                id: sale.AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile.id,
                displayName: sale.AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile.displayName,
                affiliateCode: sale.AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile.affiliateCode,
            } : null,
            payment: sale.Payment ? {
                id: sale.Payment.id,
                orderId: sale.Payment.orderId,
                status: sale.Payment.status,
                amount: sale.Payment.amount,
            } : null,
        }));

        return NextResponse.json({
            ok: true,
            sales: serialized,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        if (error instanceof PartnerApiError) {
            return NextResponse.json(
                { ok: false, message: error.message },
                { status: error.status }
            );
        }
        console.error('[GET /api/partner/statements] Error:', error);
        return NextResponse.json(
            { ok: false, message: '매출 내역을 불러오지 못했습니다.' },
            { status: 500 }
        );
    }
}
