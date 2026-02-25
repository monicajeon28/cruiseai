export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

// Helper: Check Authentication
async function checkAuth() {
    try {
        const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
        if (!sid) return null;

        const session = await prisma.session.findUnique({
            where: { id: sid },
            include: {
                User: {
                    include: {
                        AffiliateProfile: true,
                    },
                },
            },
        });

        if (!session || !session.User) return null;
        if (!['admin', 'manager', 'agent'].includes(session.User.role) && !session.User.AffiliateProfile) return null;

        return {
            userId: session.User.id,
            role: session.User.role,
            name: session.User.name,
            profile: session.User.AffiliateProfile,
        };
    } catch (error) {
        console.error('[Recipients API] Auth check error:', error);
        return null;
    }
}

// GET: Fetch available recipients based on user role
export async function GET(req: NextRequest) {
    try {
        const user = await checkAuth();
        if (!user) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        console.log(`[Recipients API] User ${user.userId} (${user.role}, profile: ${user.profile?.type}) requesting recipients`);

        const recipients = [];

        // Get all users with affiliate profiles
        const affiliateUsers = await prisma.user.findMany({
            where: {
                AND: [
                    { id: { not: user.userId } }, // Exclude self
                    {
                        OR: [
                            { role: { in: ['admin', 'manager', 'agent'] } },
                            { AffiliateProfile: { isNot: null } },
                        ],
                    },
                ],
            },
            include: {
                AffiliateProfile: true,
            },
            orderBy: [
                { role: 'asc' },
                { name: 'asc' },
            ],
        });

        // Filter based on user's role and profile type
        for (const recipient of affiliateUsers) {
            let shouldInclude = false;
            let recipientType = 'HQ';

            // Determine recipient type
            if (recipient.AffiliateProfile) {
                if (recipient.AffiliateProfile.type === 'SALES_AGENT') {
                    recipientType = 'SALES_AGENT';
                } else if (recipient.AffiliateProfile.type === 'BRANCH_MANAGER') {
                    recipientType = 'BRANCH_MANAGER';
                }
            } else if (recipient.role === 'admin') {
                recipientType = 'HQ';
            }

            // Apply role-based filtering
            if (user.role === 'admin' || !user.profile) {
                // Admin/HQ can send to everyone
                shouldInclude = true;
            } else if (user.profile.type === 'BRANCH_MANAGER') {
                // Branch managers can send to:
                // - Their sales agents
                // - Other branch managers
                // - HQ/Admin
                if (recipientType === 'SALES_AGENT') {
                    // Check if this agent belongs to this manager
                    const agent = await prisma.affiliateProfile.findFirst({
                        where: {
                            id: recipient.AffiliateProfile!.id,
                            parentId: user.profile.id,
                        },
                    });
                    shouldInclude = !!agent;
                } else {
                    // Other managers and HQ
                    shouldInclude = true;
                }
            } else if (user.profile.type === 'SALES_AGENT') {
                // Sales agents can send to:
                // - Their manager
                // - HQ/Admin
                if (recipientType === 'BRANCH_MANAGER') {
                    // Check if this is their manager
                    shouldInclude = recipient.AffiliateProfile!.id === user.profile.parentId;
                } else if (recipientType === 'HQ') {
                    shouldInclude = true;
                }
            }

            if (shouldInclude) {
                recipients.push({
                    userId: recipient.id,
                    name: recipient.name,
                    role: recipient.role,
                    profileType: recipientType,
                    mallUserId: recipient.mallUserId || `user${recipient.id}`,
                    phone: recipient.phone,
                });
            }
        }

        console.log(`[Recipients API] Found ${recipients.length} available recipients for user ${user.userId}`);

        return NextResponse.json({
            ok: true,
            recipients,
        });

    } catch (error: any) {
        console.error('[Recipients API] Error:', error);
        return NextResponse.json({ ok: false, error: 'Failed to fetch recipients' }, { status: 500 });
    }
}
