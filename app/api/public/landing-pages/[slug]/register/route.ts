export const dynamic = 'force-dynamic';

// app/api/public/landing-pages/[slug]/register/route.ts
// 랜딩페이지 폼 제출 API (로그인 불필요)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST: 랜딩페이지 폼 제출 처리
 * - 이름, 연락처를 입력받아 자동으로 그룹에 할당
 * - 그룹에 예약 메시지가 설정되어 있으면 자동 활성화
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> | { slug: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const slug = resolvedParams.slug;

    // 랜딩페이지 조회
    const landingPage = await prisma.landingPage.findUnique({
      where: {
        slug,
        isActive: true,
        isPublic: true,
      },
      include: {
        CustomerGroup: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!landingPage) {
      return NextResponse.json(
        { ok: false, error: '랜딩페이지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { name, phone, email, ...customFields } = body;

    // 필수 필드 검증
    if (!name || !phone) {
      return NextResponse.json(
        { ok: false, error: '이름과 연락처는 필수입니다.' },
        { status: 400 }
      );
    }

    // 전화번호 정규화
    const normalizePhone = (phone: string): string => {
      return String(phone).replace(/\D/g, '');
    };

    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone.length < 10) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 전화번호입니다.' },
        { status: 400 }
      );
    }

    // 기존 사용자 확인 또는 생성
    let user = await prisma.user.findFirst({
      where: { phone: normalizedPhone },
    });

    if (!user) {
      // 새 사용자 생성
      user = await prisma.user.create({
        data: {
          name: name.trim(),
          phone: normalizedPhone,
          email: email?.trim() || null,
          password: '3800', // 기본 비밀번호
          role: 'user',
          customerStatus: 'active',
          customerSource: 'landing-page',
        },
      });
    } else {
      // 기존 사용자 정보 업데이트
      await prisma.user.update({
        where: { id: user.id },
        data: {
          name: name.trim(),
          email: email?.trim() || user.email,
        },
      });
    }

    // 랜딩페이지 등록 데이터 저장
    const registration = await prisma.landingPageRegistration.create({
      data: {
        landingPageId: landingPage.id,
        userId: user.id,
        customerName: name.trim(),
        customerGroup: landingPage.CustomerGroup?.name || null,
        phone: normalizedPhone,
        email: email?.trim() || null,
        customFields: Object.keys(customFields).length > 0 ? customFields : null,
        metadata: {
          slug,
          registeredAt: new Date().toISOString(),
        },
      },
    });

    // 그룹 할당 (groupId 또는 additionalGroupId가 있는 경우)
    const groupIds: number[] = [];
    if (landingPage.groupId) {
      groupIds.push(landingPage.groupId);
    }
    if (landingPage.additionalGroupId) {
      groupIds.push(landingPage.additionalGroupId);
    }

    // 마케팅 자동화 그룹의 모든 카테고리(CustomerGroup)에 자동 연결
    // 랜딩페이지 관리자(adminId)가 생성한 모든 활성 CustomerGroup 조회
    const allCustomerGroups = await prisma.customerGroup.findMany({
      where: {
        adminId: landingPage.adminId,
        // 활성 그룹만 (필요시 추가 필터링)
      },
      select: {
        id: true,
        name: true,
      },
    });

    // 모든 CustomerGroup ID를 groupIds에 추가 (중복 제거)
    const allGroupIds = new Set(groupIds);
    allCustomerGroups.forEach(group => {
      allGroupIds.add(group.id);
    });

    const addedGroups: Array<{ groupId: number; groupName: string }> = [];

    for (const groupId of Array.from(allGroupIds)) {
      try {
        // 기존 멤버십 확인 (해제되지 않은 것만)
        const existingMembership = await prisma.customerGroupMember.findFirst({
          where: {
            groupId,
            userId: user.id,
            releasedAt: null, // 해제되지 않은 멤버십만 확인
          },
        });

        if (!existingMembership) {
          // 그룹 멤버 추가
          await prisma.customerGroupMember.create({
            data: {
              groupId,
              userId: user.id,
              addedAt: new Date(),
              addedBy: landingPage.adminId, // 랜딩페이지 관리자
            },
          });

          const group = await prisma.customerGroup.findUnique({
            where: { id: groupId },
            select: { name: true },
          });

          addedGroups.push({
            groupId,
            groupName: group?.name || '알 수 없음',
          });

          // 그룹에 연결된 예약 메시지 활성화 확인
          const groupWithMessages = await prisma.customerGroup.findUnique({
            where: { id: groupId },
            include: {
              ScheduledMessage: {
                where: { isActive: true },
                select: { id: true, title: true },
              },
            },
          });

          // 예약 메시지는 scheduledMessageSender.ts에서 자동으로 처리됨
          // 여기서는 로그만 기록
          if (groupWithMessages?.ScheduledMessage.length) {
            console.log(
              `[Landing Page Register] 그룹 ${groupId}에 할당된 사용자 ${user.id}에게 예약 메시지 ${groupWithMessages.ScheduledMessage.length}개가 활성화됩니다.`
            );
          }
        } else {
          // 이미 그룹에 속한 경우, addedAt만 업데이트하지 않음 (원래 유입날짜 유지)
          console.log(
            `[Landing Page Register] 사용자 ${user.id}는 이미 그룹 ${groupId}에 속해 있습니다.`
          );
        }
      } catch (error: any) {
        // Unique constraint violation은 무시 (이미 추가된 경우)
        if (error.code !== 'P2002') {
          console.error(`[Landing Page Register] 그룹 ${groupId} 추가 실패:`, error);
        }
      }
    }

    // 완료 페이지 URL
    const completionUrl = landingPage.completionPageUrl || null;

    return NextResponse.json({
      ok: true,
      message: '등록이 완료되었습니다.',
      registration: {
        id: registration.id,
        customerName: registration.customerName,
        phone: registration.phone,
        registeredAt: registration.registeredAt.toISOString(),
      },
      groups: addedGroups,
      completionUrl,
    });
  } catch (error: any) {
    console.error('[Landing Page Register] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || '등록 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
