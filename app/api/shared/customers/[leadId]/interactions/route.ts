export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * POST /api/shared/customers/[leadId]/interactions
 * 통합 상담기록 추가 - 누가 작성했는지 기록됨
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser?.id) {
      return NextResponse.json({ ok: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { leadId } = await params;
    const leadIdNum = parseInt(leadId);
    if (isNaN(leadIdNum)) {
      return NextResponse.json({ ok: false, message: '유효하지 않은 고객 ID입니다.' }, { status: 400 });
    }

    const body = await req.json();
    const {
      note,
      interactionType = 'NOTE',
      occurredAt,
      nextActionAt,
      status,
      viewerType,
      viewerProfileId,
    } = body;

    if (!note || !note.trim()) {
      return NextResponse.json({ ok: false, message: '상담 내용을 입력해주세요.' }, { status: 400 });
    }

    // 사용자 정보 및 프로필 조회
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: {
        AffiliateProfile: {
          select: { id: true, type: true, managerId: true, displayName: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, message: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    const profile = user.AffiliateProfile?.[0];

    // 기존 고객 조회
    const existingLead = await prisma.affiliateLead.findUnique({
      where: { id: leadIdNum },
    });

    if (!existingLead) {
      return NextResponse.json({ ok: false, message: '고객을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 권한 체크
    let hasAccess = false;
    if (isAdmin) {
      hasAccess = true;
    } else if (profile) {
      if (profile.type === 'BRANCH_MANAGER') {
        if (existingLead.managerId === profile.id) {
          hasAccess = true;
        } else if (existingLead.agentId) {
          const agentProfile = await prisma.affiliateProfile.findFirst({
            where: { id: existingLead.agentId, managerId: profile.id },
          });
          hasAccess = !!agentProfile;
        }
      } else if (profile.type === 'SALES_AGENT') {
        hasAccess = existingLead.agentId === profile.id;
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ ok: false, message: '상담기록 작성 권한이 없습니다.' }, { status: 403 });
    }

    // 상담기록 생성
    const interaction = await prisma.affiliateInteraction.create({
      data: {
        leadId: leadIdNum,
        profileId: profile?.id || null,
        createdById: user.id,
        interactionType,
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
        note: note.trim(),
        metadata: {
          createdByType: isAdmin ? 'HQ' : profile?.type || 'UNKNOWN',
          createdByName: isAdmin ? (user.name || '본사') : (profile?.displayName || user.name),
        },
      },
      include: {
        User: {
          select: { id: true, name: true, phone: true },
        },
        AffiliateProfile: {
          select: { id: true, type: true, displayName: true },
        },
      },
    });

    // 고객 정보 업데이트 (lastContactedAt, status, nextActionAt)
    const leadUpdateData: any = {
      lastContactedAt: new Date(),
      updatedAt: new Date(),
    };

    if (status) {
      leadUpdateData.status = status;
    }

    if (nextActionAt) {
      leadUpdateData.nextActionAt = new Date(nextActionAt);
    }

    await prisma.affiliateLead.update({
      where: { id: leadIdNum },
      data: leadUpdateData,
    });

    // 응답 구성
    const responseInteraction = {
      id: interaction.id,
      interactionType: interaction.interactionType,
      occurredAt: interaction.occurredAt.toISOString(),
      note: interaction.note,
      profileId: interaction.profileId,
      createdBy: interaction.User
        ? {
            id: interaction.User.id,
            name: interaction.User.name,
            phone: interaction.User.phone,
          }
        : null,
      createdByType: isAdmin ? 'HQ' : interaction.AffiliateProfile?.type || null,
    };

    return NextResponse.json({
      ok: true,
      message: '상담 기록이 추가되었습니다.',
      interaction: responseInteraction,
    });
  } catch (error) {
    console.error('[Shared Interactions POST] Error:', error);
    return NextResponse.json({ ok: false, message: '상담 기록 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * GET /api/shared/customers/[leadId]/interactions
 * 상담기록 목록 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser?.id) {
      return NextResponse.json({ ok: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { leadId } = await params;
    const leadIdNum = parseInt(leadId);
    if (isNaN(leadIdNum)) {
      return NextResponse.json({ ok: false, message: '유효하지 않은 고객 ID입니다.' }, { status: 400 });
    }

    // 사용자 정보 및 프로필 조회
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: {
        AffiliateProfile: {
          select: { id: true, type: true, managerId: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, message: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    const profile = user.AffiliateProfile?.[0];

    // 기존 고객 조회
    const existingLead = await prisma.affiliateLead.findUnique({
      where: { id: leadIdNum },
    });

    if (!existingLead) {
      return NextResponse.json({ ok: false, message: '고객을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 권한 체크
    let hasAccess = false;
    if (isAdmin) {
      hasAccess = true;
    } else if (profile) {
      if (profile.type === 'BRANCH_MANAGER') {
        if (existingLead.managerId === profile.id) {
          hasAccess = true;
        } else if (existingLead.agentId) {
          const agentProfile = await prisma.affiliateProfile.findFirst({
            where: { id: existingLead.agentId, managerId: profile.id },
          });
          hasAccess = !!agentProfile;
        }
      } else if (profile.type === 'SALES_AGENT') {
        hasAccess = existingLead.agentId === profile.id;
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ ok: false, message: '접근 권한이 없습니다.' }, { status: 403 });
    }

    // 상담기록 조회
    const interactions = await prisma.affiliateInteraction.findMany({
      where: { leadId: leadIdNum },
      orderBy: { occurredAt: 'desc' },
      include: {
        User: {
          select: { id: true, name: true, phone: true },
        },
        AffiliateProfile: {
          select: { id: true, type: true, displayName: true },
        },
        AffiliateMedia: {
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            storagePath: true,
            googleDriveFileId: true,
          },
        },
      },
    });

    const responseInteractions = interactions.map((interaction) => ({
      id: interaction.id,
      interactionType: interaction.interactionType,
      occurredAt: interaction.occurredAt.toISOString(),
      note: interaction.note,
      profileId: interaction.profileId,
      createdBy: interaction.User
        ? {
            id: interaction.User.id,
            name: interaction.User.name,
            phone: interaction.User.phone,
          }
        : null,
      createdByType: interaction.AffiliateProfile?.type || (interaction.metadata as any)?.createdByType || null,
      media: interaction.AffiliateMedia.map((m) => ({
        id: m.id,
        fileName: m.fileName,
        fileSize: m.fileSize,
        mimeType: m.mimeType,
        url: m.storagePath,
        isBackedUp: !!m.googleDriveFileId,
        googleDriveFileId: m.googleDriveFileId,
      })),
    }));

    return NextResponse.json({
      ok: true,
      interactions: responseInteractions,
    });
  } catch (error) {
    console.error('[Shared Interactions GET] Error:', error);
    return NextResponse.json({ ok: false, message: '상담 기록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
