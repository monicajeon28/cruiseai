export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { requirePartnerContext } from '@/app/api/partner/_utils';

// GET: 대리점장 랜딩페이지 등록 데이터 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const { profile } = await requirePartnerContext();
    
    // 대리점장만 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, error: '대리점장만 접근 가능합니다' }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const landingPageId = parseInt(resolvedParams.id);
    if (isNaN(landingPageId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 랜딩페이지 ID입니다' }, { status: 400 });
    }

    const landingPage = await prisma.landingPage.findUnique({
      where: { id: landingPageId },
      select: {
        id: true,
        adminId: true,
        groupId: true,
        additionalGroupId: true,
      },
    });

    if (!landingPage) {
      return NextResponse.json(
        { ok: false, error: '랜딩페이지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 대리점장이 소유한 페이지인지 확인
    if (landingPage.adminId !== user.id) {
      return NextResponse.json({ ok: false, error: '권한이 없습니다' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const [registrations, total] = await Promise.all([
      prisma.landingPageRegistration.findMany({
        where: {
          landingPageId,
          deletedAt: null, // 삭제되지 않은 데이터만
        },
        orderBy: {
          registeredAt: 'desc',
        },
        skip,
        take: limit,
        include: {
          User: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
        },
      }),
      prisma.landingPageRegistration.count({
        where: {
          landingPageId,
          deletedAt: null,
        },
      }),
    ]);

    const userIds = registrations
      .map((registration) => registration.userId)
      .filter((userId): userId is number => typeof userId === 'number');

    const targetGroupIds = [landingPage.groupId, landingPage.additionalGroupId]
      .filter((groupId): groupId is number => typeof groupId === 'number');

    const membershipFilter: Record<string, unknown> = {};
    if (userIds.length > 0) {
      membershipFilter.userId = { in: userIds };
    }
    if (targetGroupIds.length > 0) {
      membershipFilter.groupId = { in: targetGroupIds };
    }

    const memberships = userIds.length > 0 && targetGroupIds.length > 0
      ? await prisma.customerGroupMember.findMany({
          where: membershipFilter,
          include: {
            CustomerGroup: {
              select: { id: true, name: true },
            },
          },
        })
      : [];

    const membershipMap = new Map<
      number,
      Array<{ groupId: number; groupName: string | null; addedAt: string; addedBy: number | null }>
    >();

    memberships.forEach((member) => {
      const list = membershipMap.get(member.userId) ?? [];
      list.push({
        groupId: member.groupId,
        groupName: member.CustomerGroup?.name ?? null,
        addedAt: member.addedAt.toISOString(),
        addedBy: member.addedBy ?? null,
      });
      membershipMap.set(member.userId, list);
    });

    const registrationsWithGroups = registrations.map((registration) => ({
      id: registration.id,
      customerName: registration.customerName,
      phone: registration.phone,
      email: registration.email,
      registeredAt: registration.registeredAt.toISOString(),
      userId: registration.userId,
      customerGroup: registration.User?.name || '-',
      groupMemberships: registration.userId
        ? membershipMap.get(registration.userId) ?? []
        : [],
    }));

    return NextResponse.json({
      ok: true,
      registrations: registrationsWithGroups,
      groupPreferences: {
        primaryGroupId: landingPage.groupId,
        additionalGroupId: landingPage.additionalGroupId,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('[Partner Landing Pages] GET registrations error:', error);
    return NextResponse.json(
      { ok: false, error: '등록 데이터를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 대리점장 랜딩페이지 등록 데이터 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const { profile } = await requirePartnerContext();
    
    // 대리점장만 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, error: '대리점장만 접근 가능합니다' }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const landingPageId = parseInt(resolvedParams.id);
    
    if (isNaN(landingPageId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 랜딩페이지 ID입니다' }, { status: 400 });
    }

    // 랜딩페이지 소유권 확인
    const landingPage = await prisma.landingPage.findUnique({
      where: { id: landingPageId },
      select: { adminId: true },
    });

    if (!landingPage) {
      return NextResponse.json({ ok: false, error: '랜딩페이지를 찾을 수 없습니다' }, { status: 404 });
    }

    if (landingPage.adminId !== user.id) {
      return NextResponse.json({ ok: false, error: '권한이 없습니다' }, { status: 403 });
    }

    let body: { registrationId?: number };
    try {
      body = await req.json();
    } catch (error) {
      return NextResponse.json({ ok: false, error: '요청 데이터를 파싱할 수 없습니다.' }, { status: 400 });
    }

    const { registrationId } = body;

    if (!registrationId || typeof registrationId !== 'number') {
      return NextResponse.json({ ok: false, error: '등록 ID가 필요합니다' }, { status: 400 });
    }

    // 등록 데이터가 해당 랜딩페이지에 속하는지 확인
    const registration = await prisma.landingPageRegistration.findUnique({
      where: { id: registrationId },
      select: { landingPageId: true, deletedAt: true },
    });

    if (!registration) {
      return NextResponse.json({ ok: false, error: '등록 데이터를 찾을 수 없습니다' }, { status: 404 });
    }

    if (registration.landingPageId !== landingPageId) {
      return NextResponse.json({ ok: false, error: '권한이 없습니다' }, { status: 403 });
    }

    if (registration.deletedAt) {
      return NextResponse.json({ ok: false, error: '이미 삭제된 등록 데이터입니다' }, { status: 400 });
    }

    await prisma.landingPageRegistration.update({
      where: { id: registrationId },
      data: {
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: '등록 데이터가 삭제되었습니다.',
    });
  } catch (error: any) {
    console.error('[Partner Landing Pages] DELETE registration error:', error);
    return NextResponse.json(
      { ok: false, error: '등록 데이터 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
