export const dynamic = 'force-dynamic';

// app/api/auth/check-nickname/route.ts
// 닉네임 중복 확인 API

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const nickname = searchParams.get('nickname');

    if (!nickname || nickname.trim().length < 2) {
      return NextResponse.json({
        ok: false,
        available: false,
        message: '닉네임은 2자 이상이어야 합니다.'
      });
    }

    // 커뮤니티 전용 사용자만 확인
    // role='community' AND customerSource='mall-signup'인 사용자만 확인 (기존 고객과 완전히 격리)
    // mallNickname 필드 또는 name 필드(레거시)로 조회
    const trimmedNickname = nickname.trim();
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { mallNickname: trimmedNickname }, // 새로운 방식: mallNickname 필드
          { name: trimmedNickname } // 레거시 지원: name 필드 (기존 회원)
        ],
        role: 'community', // 커뮤니티 전용 사용자만 확인
        customerSource: 'mall-signup' // 크루즈몰 회원가입 사용자만 확인
      }
    });

    return NextResponse.json({
      ok: true,
      available: !existingUser,
      message: existingUser ? '이미 사용 중인 닉네임입니다.' : '사용 가능한 닉네임입니다.'
    });
  } catch (error: any) {
    console.error('[CHECK NICKNAME] Error:', error);
    return NextResponse.json(
      { ok: false, available: false, message: '확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
