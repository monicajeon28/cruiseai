
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext, PartnerApiError } from '@/app/api/partner/_utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { profile } = await requirePartnerContext();

        // Fetch all ACTIVE Branch Managers except self
        const managers = await prisma.affiliateProfile.findMany({
            where: {
                type: 'BRANCH_MANAGER',
                status: 'ACTIVE',
                id: { not: profile.id } // Exclude self
            },
            select: {
                id: true,
                displayName: true,
                affiliateCode: true,
                User: {
                    select: {
                        mallUserId: true,
                        mallNickname: true,
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const formattedManagers = managers.map(m => ({
            id: m.id,
            displayName: m.displayName || m.User?.mallNickname || m.User?.name || 'Unknown',
            affiliateCode: m.affiliateCode,
            mallUserId: m.User?.mallUserId
        }));

        return NextResponse.json({
            ok: true,
            managers: formattedManagers
        });

    } catch (error) {
        if (error instanceof PartnerApiError) {
            return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
        }
        console.error('[Branch Managers] Error:', error);
        return NextResponse.json({ ok: false, message: '대리점장 목록을 불러오지 못했습니다.' }, { status: 500 });
    }
}
