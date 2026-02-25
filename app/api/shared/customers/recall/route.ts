export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * POST /api/shared/customers/recall
 * DB 회수 - 대리점장이 판매원으로부터 회수, 본사가 대리점장으로부터 회수
 */
export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser?.id) {
      return NextResponse.json({ ok: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await req.json();
    const { leadIds } = body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ ok: false, message: '회수할 고객을 선택해주세요.' }, { status: 400 });
    }

    // 사용자 정보 및 프로필 조회
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: {
        AffiliateProfile: {
          select: { id: true, type: true, displayName: true, affiliateCode: true, managerId: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, message: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    const profile = user.AffiliateProfile?.[0];

    // 회수 권한 체크 (본사 또는 대리점장만)
    if (!isAdmin && profile?.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, message: 'DB 회수 권한이 없습니다.' }, { status: 403 });
    }

    let successCount = 0;
    const errors: string[] = [];

    for (const leadId of leadIds) {
      try {
        // 고객 조회
        const lead = await prisma.affiliateLead.findUnique({
          where: { id: leadId },
          include: {
            AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile: {
              select: { id: true, displayName: true, affiliateCode: true },
            },
            AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
              select: { id: true, displayName: true, affiliateCode: true },
            },
          },
        });

        if (!lead) {
          errors.push(`고객 ${leadId}: 찾을 수 없음`);
          continue;
        }

        // 회수 권한 체크
        let canRecall = false;
        let fromProfile = null;
        let toType: 'HQ' | 'BRANCH_MANAGER' = 'HQ';

        if (isAdmin) {
          // 본사: 대리점장/판매원으로부터 회수
          canRecall = !!(lead.managerId || lead.agentId);
          fromProfile = lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile
            || lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile;
          toType = 'HQ';
        } else if (profile?.type === 'BRANCH_MANAGER') {
          // 대리점장: 소속 판매원으로부터만 회수
          if (lead.agentId && lead.managerId === profile.id) {
            canRecall = true;
            fromProfile = lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile;
            toType = 'BRANCH_MANAGER';
          }
        }

        if (!canRecall) {
          errors.push(`고객 ${leadId}: 회수 권한 없음`);
          continue;
        }

        // 회수 이력 구성
        const currentMetadata = (lead.metadata as Record<string, any>) || {};
        const transferHistory = currentMetadata.transferHistory || [];

        const fromName = fromProfile?.displayName || fromProfile?.affiliateCode || '알 수 없음';
        const toName = isAdmin
          ? '본사'
          : profile?.displayName || profile?.affiliateCode || '대리점장';

        transferHistory.push({
          date: new Date().toISOString(),
          fromProfileId: fromProfile?.id || null,
          fromProfileName: fromName,
          fromType: lead.agentId ? 'SALES_AGENT' : 'BRANCH_MANAGER',
          toProfileId: isAdmin ? null : profile?.id,
          toProfileName: toName,
          toType,
          action: 'RECALL',
        });

        // 회수 실행
        const updateData: any = {
          updatedAt: new Date(),
          metadata: {
            ...currentMetadata,
            transferHistory,
            lastRecallFrom: fromName,
            lastRecallFromId: fromProfile?.id,
            lastRecallAt: new Date().toISOString(),
          },
        };

        if (isAdmin) {
          // 본사로 회수
          updateData.managerId = null;
          updateData.agentId = null;
        } else {
          // 대리점장으로 회수 (판매원 해제)
          updateData.agentId = null;
        }

        await prisma.affiliateLead.update({
          where: { id: leadId },
          data: updateData,
        });

        // 회수 기록 생성
        await prisma.affiliateInteraction.create({
          data: {
            leadId,
            profileId: isAdmin ? null : profile?.id,
            createdById: user.id,
            interactionType: 'DB_RECALL',
            occurredAt: new Date(),
            note: `DB 회수: ${fromName} → ${toName}`,
            metadata: {
              action: 'recall',
              fromProfileId: fromProfile?.id,
              fromProfileName: fromName,
              fromType: lead.agentId ? 'SALES_AGENT' : 'BRANCH_MANAGER',
              toProfileId: isAdmin ? null : profile?.id,
              toProfileName: toName,
              toType,
            },
          },
        });

        successCount++;
      } catch (error) {
        console.error(`[Recall] Error processing lead ${leadId}:`, error);
        errors.push(`고객 ${leadId}: 처리 오류`);
      }
    }

    if (successCount === 0) {
      return NextResponse.json({
        ok: false,
        message: '회수에 실패했습니다.',
        errors,
      }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: `${successCount}개의 DB가 회수되었습니다.`,
      successCount,
      totalRequested: leadIds.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Recall] Error:', error);
    return NextResponse.json({ ok: false, message: 'DB 회수 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
