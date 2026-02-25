export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { requirePartnerContext } from '@/app/api/partner/_utils';

// GET: 파트너용 시스템 문의 목록 조회
export async function GET(req: NextRequest) {
    try {
        const { profile } = await requirePartnerContext();
        const { searchParams } = new URL(req.url);

        // Pagination
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const skip = (page - 1) * limit;

        // Month filter (YYYY-MM format)
        const month = searchParams.get('month');

        const where: any = {};

        if (profile.type === 'BRANCH_MANAGER') {
            where.managerId = profile.id;
        } else if (profile.type === 'SALES_AGENT') {
            where.agentId = profile.id;
        } else {
            where.OR = [
                { managerId: profile.id },
                { agentId: profile.id }
            ];
        }

        // Month filter
        if (month) {
            const [year, monthNum] = month.split('-');
            const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
            const endDate = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59);
            where.createdAt = {
                gte: startDate,
                lte: endDate
            };
        }

        const total = await prisma.systemConsultation.count({ where });

        const consultations = await prisma.systemConsultation.findMany({
            where,
            orderBy: {
                createdAt: 'desc',
            },
            skip,
            take: limit,
        });

        // Fetch all manager and agent profiles
        const managerIds = consultations.map(c => c.managerId).filter(Boolean) as number[];
        const agentIds = consultations.map(c => c.agentId).filter(Boolean) as number[];
        const allProfileIds = [...new Set([...managerIds, ...agentIds])];

        const profiles = await prisma.affiliateProfile.findMany({
            where: {
                id: { in: allProfileIds }
            },
            select: {
                id: true,
                displayName: true,
                affiliateCode: true,
            }
        });

        const profileMap = new Map(profiles.map(p => [p.id, p]));

        const consultationsWithProfiles = consultations.map(c => ({
            ...c,
            AffiliateProfile_SystemConsultation_managerIdToAffiliateProfile: c.managerId ? profileMap.get(c.managerId) || null : null,
            AffiliateProfile_SystemConsultation_agentIdToAffiliateProfile: c.agentId ? profileMap.get(c.agentId) || null : null,
        }));

        return NextResponse.json({
            ok: true,
            consultations: consultationsWithProfiles,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error('[Partner System Inquiry] GET Error:', error);
        return NextResponse.json(
            { ok: false, error: '목록 조회 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
