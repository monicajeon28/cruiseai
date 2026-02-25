export const dynamic = 'force-dynamic';

// app/api/auth/check-username/route.ts
// 아이디 중복 확인 API

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username || username.trim().length < 4) {
      return NextResponse.json({
        ok: false,
        available: false,
        message: '아이디는 4자 이상이어야 합니다.'
      });
    }

    // 크루즈몰 회원가입용 아이디 확인
    // role='community' AND customerSource='mall-signup'인 사용자만 확인 (기존 고객과 완전히 격리)
    // mallUserId 필드 또는 phone 필드(레거시)로 조회
    const trimmedUsername = username.trim();
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { mallUserId: trimmedUsername }, // 새로운 방식: mallUserId 필드
          { phone: trimmedUsername } // 레거시 지원: phone 필드 (기존 회원)
        ],
        role: 'community', // 크루즈몰 회원가입 사용자는 role이 'community'
        customerSource: 'mall-signup' // 크루즈몰 회원가입 사용자만 확인
      }
    });

    return NextResponse.json({
      ok: true,
      available: !existingUser,
      message: existingUser ? '이미 사용 중인 아이디입니다.' : '사용 가능한 아이디입니다.'
    });
  } catch (error: any) {
    console.error('[CHECK USERNAME] Error:', error);
    return NextResponse.json(
      { ok: false, available: false, message: '확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
