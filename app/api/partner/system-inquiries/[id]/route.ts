export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET: 시스템 상담 상세 조회 (파트너용)
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);

    if (isNaN(id)) {
      return NextResponse.json({ ok: false, message: '유효한 ID가 필요합니다.' }, { status: 400 });
    }

    // 파트너 프로필 조회
    const profile = await prisma.affiliateProfile.findFirst({
      where: { userId: sessionUser.id, status: 'ACTIVE' },
      select: { id: true, type: true },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, message: '파트너 권한이 없습니다.' }, { status: 403 });
    }

    // 상담 조회 - 파트너에게 배정된 것만
    const whereClause: any = { id };

    if (profile.type === 'BRANCH_MANAGER') {
      whereClause.managerId = profile.id;
    } else if (profile.type === 'SALES_AGENT') {
      whereClause.agentId = profile.id;
    }

    const consultation = await prisma.systemConsultation.findFirst({
      where: whereClause,
    });

    if (!consultation) {
      return NextResponse.json({ ok: false, message: '상담 신청을 찾을 수 없습니다.' }, { status: 404 });
    }

    // manager/agent 프로필 조회
    const profileIds = [consultation.managerId, consultation.agentId].filter((id): id is number => id !== null);
    const profiles = profileIds.length > 0
      ? await prisma.affiliateProfile.findMany({
          where: { id: { in: profileIds } },
          select: { id: true, displayName: true, affiliateCode: true },
        })
      : [];
    const profileMap = new Map(profiles.map(p => [p.id, p]));

    return NextResponse.json({
      ok: true,
      inquiry: {
        id: consultation.id,
        name: consultation.name,
        phone: consultation.phone,
        message: consultation.message,
        status: consultation.status,
        createdAt: consultation.createdAt.toISOString(),
        updatedAt: consultation.updatedAt?.toISOString() || consultation.createdAt.toISOString(),
        manager: consultation.managerId ? profileMap.get(consultation.managerId) || null : null,
        agent: consultation.agentId ? profileMap.get(consultation.agentId) || null : null,
      },
    });
  } catch (error) {
    console.error('[Partner System Inquiry Detail] GET Error:', error);
    return NextResponse.json({ ok: false, message: '상담 정보를 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PATCH: 시스템 상담 수정 (파트너용 - 노트/상태 업데이트)
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);

    if (isNaN(id)) {
      return NextResponse.json({ ok: false, message: '유효한 ID가 필요합니다.' }, { status: 400 });
    }

    // 파트너 프로필 조회
    const profile = await prisma.affiliateProfile.findFirst({
      where: { userId: sessionUser.id, status: 'ACTIVE' },
      select: { id: true, type: true, displayName: true },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, message: '파트너 권한이 없습니다.' }, { status: 403 });
    }

    // 상담 조회 - 파트너에게 배정된 것만 수정 가능
    const whereClause: any = { id };

    if (profile.type === 'BRANCH_MANAGER') {
      whereClause.managerId = profile.id;
    } else if (profile.type === 'SALES_AGENT') {
      whereClause.agentId = profile.id;
    }

    const consultation = await prisma.systemConsultation.findFirst({
      where: whereClause,
    });

    if (!consultation) {
      return NextResponse.json({ ok: false, message: '수정 권한이 없거나 상담을 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await req.json();
    const { message, status, notes } = body;

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (message !== undefined) updateData.message = message;
    if (notes !== undefined) updateData.message = notes; // notes를 message 필드에 저장
    if (status !== undefined) updateData.status = status;

    await prisma.systemConsultation.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      message: '수정되었습니다.',
    });
  } catch (error) {
    console.error('[Partner System Inquiry Detail] PATCH Error:', error);
    return NextResponse.json({ ok: false, message: '수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE: 시스템 상담 삭제 (파트너용)
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);

    if (isNaN(id)) {
      return NextResponse.json({ ok: false, message: '유효한 ID가 필요합니다.' }, { status: 400 });
    }

    // 파트너 프로필 조회
    const profile = await prisma.affiliateProfile.findFirst({
      where: { userId: sessionUser.id, status: 'ACTIVE' },
      select: { id: true, type: true },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, message: '파트너 권한이 없습니다.' }, { status: 403 });
    }

    // 상담 조회 - 파트너에게 배정된 것만 삭제 가능
    const whereClause: any = { id };

    if (profile.type === 'BRANCH_MANAGER') {
      whereClause.managerId = profile.id;
    } else if (profile.type === 'SALES_AGENT') {
      whereClause.agentId = profile.id;
    }

    const consultation = await prisma.systemConsultation.findFirst({
      where: whereClause,
    });

    if (!consultation) {
      return NextResponse.json({ ok: false, message: '삭제 권한이 없거나 상담을 찾을 수 없습니다.' }, { status: 404 });
    }

    await prisma.systemConsultation.delete({
      where: { id },
    });

    return NextResponse.json({
      ok: true,
      message: '삭제되었습니다.',
    });
  } catch (error) {
    console.error('[Partner System Inquiry Detail] DELETE Error:', error);
    return NextResponse.json({ ok: false, message: '삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
