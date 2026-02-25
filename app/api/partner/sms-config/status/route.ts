export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * GET /api/partner/sms-config/status
 * 판매원/대리점장의 SMS API 연결 상태 확인
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        // 판매원/대리점장 프로필 확인
        const affiliateProfile = await prisma.affiliateProfile.findFirst({
            where: { userId: user.id },
            select: { id: true, type: true },
        });

        if (!affiliateProfile) {
            return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
        }

        // SMS 설정 확인
        const smsConfig = await prisma.partnerSmsConfig.findUnique({
            where: { profileId: affiliateProfile.id },
            select: {
                id: true,
                provider: true,
                senderPhone: true,
                isActive: true,
                createdAt: true,
            },
        });

        const isConnected = !!smsConfig && smsConfig.isActive;

        return NextResponse.json({
            ok: true,
            isConnected,
            config: smsConfig ? {
                provider: smsConfig.provider,
                senderPhone: smsConfig.senderPhone,
                connectedAt: smsConfig.createdAt,
            } : null,
            profileType: affiliateProfile.type,
        });
    } catch (error: any) {
        console.error('[SMS Config Status] Error:', error);
        return NextResponse.json(
            { ok: false, error: 'Failed to check SMS config status' },
            { status: 500 }
        );
    }
}
