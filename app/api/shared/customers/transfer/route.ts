export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * POST /api/shared/customers/transfer
 * DB 전달 - 본사↔대리점장↔판매원 간 양방향 전달
 */
export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser?.id) {
      return NextResponse.json({ ok: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await req.json();
    const {
      leadIds,
      targetType, // 'HQ' | 'BRANCH_MANAGER' | 'SALES_AGENT'
      targetProfileId, // 대상 프로필 ID (HQ인 경우 null)
    } = body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ ok: false, message: '전달할 고객을 선택해주세요.' }, { status: 400 });
    }

    if (!targetType) {
      return NextResponse.json({ ok: false, message: '전달 대상 유형을 선택해주세요.' }, { status: 400 });
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

    // 전달 권한 체크
    if (!isAdmin && !profile) {
      return NextResponse.json({ ok: false, message: 'DB 전달 권한이 없습니다.' }, { status: 403 });
    }

    // 대상 프로필 검증
    let targetProfile = null;
    if (targetType !== 'HQ' && targetProfileId) {
      targetProfile = await prisma.affiliateProfile.findFirst({
        where: {
          id: targetProfileId,
          type: targetType,
          status: 'ACTIVE',
        },
        select: { id: true, displayName: true, affiliateCode: true, managerId: true },
      });

      if (!targetProfile) {
        return NextResponse.json({ ok: false, message: '유효하지 않은 대상입니다.' }, { status: 400 });
      }

      // 판매원인 경우, 대리점장의 소속 판매원인지 확인
      if (targetType === 'SALES_AGENT' && profile?.type === 'BRANCH_MANAGER') {
        if (targetProfile.managerId !== profile.id) {
          return NextResponse.json({ ok: false, message: '소속 판매원에게만 전달할 수 있습니다.' }, { status: 403 });
        }
      }
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
              select: { id: true, displayName: true },
            },
            AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
              select: { id: true, displayName: true },
            },
          },
        });

        if (!lead) {
          errors.push(`고객 ${leadId}: 찾을 수 없음`);
          continue;
        }

        // 전달 권한 체크
        let canTransfer = false;
        if (isAdmin) {
          canTransfer = true;
        } else if (profile?.type === 'BRANCH_MANAGER') {
          // 대리점장: 자기 고객 또는 소속 판매원의 고객만
          if (lead.managerId === profile.id) {
            canTransfer = true;
          } else if (lead.agentId) {
            const agentProfile = await prisma.affiliateProfile.findFirst({
              where: { id: lead.agentId, managerId: profile.id },
            });
            canTransfer = !!agentProfile;
          }
        } else if (profile?.type === 'SALES_AGENT') {
          // 판매원: 자기 고객만 (대리점장에게 반환만 가능)
          canTransfer = lead.agentId === profile.id && targetType === 'BRANCH_MANAGER';
        }

        if (!canTransfer) {
          errors.push(`고객 ${leadId}: 전달 권한 없음`);
          continue;
        }

        // 전달 이력 구성
        const currentMetadata = (lead.metadata as Record<string, any>) || {};
        const transferHistory = currentMetadata.transferHistory || [];

        const fromName = isAdmin
          ? '본사'
          : profile?.displayName || profile?.affiliateCode || '알 수 없음';
        const toName = targetType === 'HQ'
          ? '본사'
          : targetProfile?.displayName || targetProfile?.affiliateCode || '알 수 없음';

        transferHistory.push({
          date: new Date().toISOString(),
          fromProfileId: isAdmin ? null : profile?.id,
          fromProfileName: fromName,
          fromType: isAdmin ? 'HQ' : profile?.type,
          toProfileId: targetProfileId || null,
          toProfileName: toName,
          toType: targetType,
        });

        // 전달 실행
        const updateData: any = {
          updatedAt: new Date(),
          metadata: {
            ...currentMetadata,
            transferHistory,
            lastTransferFrom: fromName,
            lastTransferFromId: isAdmin ? null : profile?.id,
            lastTransferAt: new Date().toISOString(),
          },
        };

        if (targetType === 'HQ') {
          // 본사로 반환
          updateData.managerId = null;
          updateData.agentId = null;
        } else if (targetType === 'BRANCH_MANAGER') {
          // 대리점장에게 전달
          updateData.managerId = targetProfileId;
          updateData.agentId = null; // 판매원 해제
        } else if (targetType === 'SALES_AGENT') {
          // 판매원에게 전달
          updateData.agentId = targetProfileId;
          // managerId는 유지 (대리점장 소속 유지)
        }

        await prisma.affiliateLead.update({
          where: { id: leadId },
          data: updateData,
        });

        // 전달 기록 생성
        await prisma.affiliateInteraction.create({
          data: {
            leadId,
            profileId: isAdmin ? null : profile?.id,
            createdById: user.id,
            interactionType: 'DB_TRANSFER',
            occurredAt: new Date(),
            note: `DB 전달: ${fromName} → ${toName}`,
            metadata: {
              action: 'transfer',
              fromProfileId: isAdmin ? null : profile?.id,
              fromProfileName: fromName,
              fromType: isAdmin ? 'HQ' : profile?.type,
              toProfileId: targetProfileId,
              toProfileName: toName,
              toType: targetType,
            },
          },
        });

        successCount++;
      } catch (error) {
        console.error(`[Transfer] Error processing lead ${leadId}:`, error);
        errors.push(`고객 ${leadId}: 처리 오류`);
      }
    }

    if (successCount === 0) {
      return NextResponse.json({
        ok: false,
        message: '전달에 실패했습니다.',
        errors,
      }, { status: 400 });
    }

    const targetName = targetType === 'HQ'
      ? '본사'
      : targetProfile?.displayName || '대상';

    return NextResponse.json({
      ok: true,
      message: `${successCount}개의 DB가 ${targetName}에게 전달되었습니다.`,
      successCount,
      totalRequested: leadIds.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Transfer] Error:', error);
    return NextResponse.json({ ok: false, message: 'DB 전달 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
