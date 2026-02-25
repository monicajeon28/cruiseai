export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function PUT(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext();
    const body = await req.json();

    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { ok: false, message: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { ok: false, message: '비밀번호는 4자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: profile.userId },
      select: { id: true, password: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 현재 비밀번호 확인
    if (user.password !== currentPassword) {
      return NextResponse.json(
        { ok: false, message: '현재 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 비밀번호 변경 이벤트 기록
    await prisma.passwordEvent.create({
      data: {
        userId: user.id,
        from: user.password,
        to: newPassword,
        reason: '판매원 대시보드에서 비밀번호 변경',
      },
    });

    // 비밀번호 업데이트
    await prisma.user.update({
      where: { id: user.id },
      data: { password: newPassword },
    });

    return NextResponse.json({
      ok: true,
      message: '비밀번호가 성공적으로 변경되었습니다.',
    });
  } catch (error: any) {
    console.error('[PUT /api/partner/profile/password] error:', error);
    return NextResponse.json(
      { ok: false, message: '비밀번호 변경에 실패했습니다.' },
      { status: 500 }
    );
  }
}
