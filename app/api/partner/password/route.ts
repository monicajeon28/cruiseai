export const dynamic = 'force-dynamic';

// app/api/partner/password/route.ts
// 파트너 비밀번호 변경 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import bcrypt from 'bcryptjs';

// PUT: 파트너 비밀번호 변경
export async function PUT(req: NextRequest) {
  try {
    const { profile, sessionUser } = await requirePartnerContext();

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!newPassword || newPassword.trim().length === 0) {
      return NextResponse.json(
        { ok: false, message: '새 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 현재 사용자 정보 조회 (비밀번호 포함)
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { 
        id: true, 
        password: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 현재 비밀번호 검증
    if (user.password) {
      if (!currentPassword || typeof currentPassword !== 'string' || currentPassword.trim().length === 0) {
        return NextResponse.json(
          { ok: false, message: '현재 비밀번호를 입력해주세요.' },
          { status: 400 }
        );
      }

      // bcrypt로 비밀번호 비교
      const isPasswordValid = await bcrypt.compare(currentPassword.trim(), user.password);
      
      if (!isPasswordValid) {
        return NextResponse.json(
          { ok: false, message: '현재 비밀번호가 일치하지 않습니다.' },
          { status: 400 }
        );
      }
    }

    // 새 비밀번호 암호화
    const hashedNewPassword = await bcrypt.hash(newPassword.trim(), 10);

    // 비밀번호 이벤트 기록 (보안상 마스킹된 값 저장)
    await prisma.passwordEvent.create({
      data: {
        userId: user.id,
        from: '***',
        to: '***',
        reason: `파트너 비밀번호 변경 (파트너 ID: ${profile.user?.mallUserId || sessionUser.id})`,
      },
    });

    // 비밀번호 업데이트 (bcrypt 해시로 저장)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedNewPassword },
    });

    return NextResponse.json({
      ok: true,
      message: '비밀번호가 변경되었습니다.',
    });
  } catch (error: any) {
    console.error('[Partner Password] PUT error:', error);
    if (error.name === 'PartnerApiError') {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status || 403 }
      );
    }
    return NextResponse.json(
      { ok: false, message: '비밀번호 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
