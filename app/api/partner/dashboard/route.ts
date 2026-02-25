export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext, PartnerApiError } from '@/app/api/partner/_utils';

/**
 * GET /api/partner/dashboard
 * 대리점장 대시보드 통계 조회
 */
export async function GET(req: NextRequest) {
    try {
        const { profile } = await requirePartnerContext({ includeManagedAgents: true });

        // 관리 중인 판매원 ID 목록
        const agentIds = profile.managedAgents?.map((a: any) => a.id) || [];
        const allProfileIds = [profile.id, ...agentIds];

        // 1. 고객 통계
        const totalCustomers = await prisma.affiliateLead.count({
            where: {
                OR: [
                    { managerId: profile.id },
                    { agentId: { in: allProfileIds } },
                ],
            },
        });

        const newCustomers = await prisma.affiliateLead.count({
            where: {
                OR: [
                    { managerId: profile.id },
                    { agentId: { in: allProfileIds } },
                ],
                status: 'NEW',
            },
        });

        const inProgressCustomers = await prisma.affiliateLead.count({
            where: {
                OR: [
                    { managerId: profile.id },
                    { agentId: { in: allProfileIds } },
                ],
                status: 'IN_PROGRESS',
            },
        });

        // 2. 매출 통계
        const salesStats = await prisma.affiliateSale.aggregate({
            where: {
                OR: [
                    { managerId: profile.id },
                    { agentId: { in: allProfileIds } },
                ],
            },
            _count: { id: true },
            _sum: {
                saleAmount: true,
                netRevenue: true,
            },
        });

        const confirmedSales = await prisma.affiliateSale.aggregate({
            where: {
                OR: [
                    { managerId: profile.id },
                    { agentId: { in: allProfileIds } },
                ],
                status: { in: ['CONFIRMED', 'PAID', 'PAYOUT_SCHEDULED'] },
            },
            _count: { id: true },
            _sum: {
                saleAmount: true,
                netRevenue: true,
            },
        });

        // 3. 이번 달 매출
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const thisMonthSales = await prisma.affiliateSale.aggregate({
            where: {
                OR: [
                    { managerId: profile.id },
                    { agentId: { in: allProfileIds } },
                ],
                saleDate: {
                    gte: startOfMonth,
                    lte: endOfMonth,
                },
            },
            _sum: {
                saleAmount: true,
                netRevenue: true,
            },
        });

        // 4. 링크 통계
        const totalLinks = await prisma.affiliateLink.count({
            where: {
                OR: [
                    { managerId: profile.id },
                    { agentId: { in: allProfileIds } },
                ],
            },
        });

        // 5. 판매원 수
        const agentCount = agentIds.length;

        return NextResponse.json({
            ok: true,
            stats: {
                customers: {
                    total: totalCustomers,
                    new: newCustomers,
                    inProgress: inProgressCustomers,
                },
                sales: {
                    totalCount: salesStats._count.id || 0,
                    totalAmount: salesStats._sum.saleAmount || 0,
                    totalRevenue: salesStats._sum.netRevenue || 0,
                    confirmedCount: confirmedSales._count.id || 0,
                    confirmedAmount: confirmedSales._sum.saleAmount || 0,
                    confirmedRevenue: confirmedSales._sum.netRevenue || 0,
                },
                thisMonth: {
                    salesAmount: thisMonthSales._sum.saleAmount || 0,
                    revenue: thisMonthSales._sum.netRevenue || 0,
                },
                links: {
                    total: totalLinks,
                },
                agents: {
                    total: agentCount,
                },
            },
        });
    } catch (error) {
        if (error instanceof PartnerApiError) {
            return NextResponse.json(
                { ok: false, message: error.message },
                { status: error.status }
            );
        }
        console.error('[GET /api/partner/dashboard] Error:', error);
        return NextResponse.json(
            { ok: false, message: '대시보드 통계를 불러오지 못했습니다.' },
            { status: 500 }
        );
    }
}
