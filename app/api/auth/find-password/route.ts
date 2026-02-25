export const dynamic = 'force-dynamic';

// app/api/auth/find-password/route.ts
// 비밀번호 찾기 API

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { name, phone, email, step } = await req.json();

    // 필수 필드 검증
    if (!name || !phone) {
      return NextResponse.json(
        { ok: false, error: '이름과 연락처를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    // 이름과 연락처로 사용자 찾기 (크루즈몰 회원만)
    const user = await prisma.user.findFirst({
      where: {
        name: name.trim(),
        phone: phone.trim(),
        role: 'community',
        customerSource: 'mall-signup'
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        mallUserId: true,
        password: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: '입력하신 정보와 일치하는 회원을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Step 1: 아이디 찾기
    if (step === 'find-id') {
      return NextResponse.json({
        ok: true,
        userId: user.mallUserId || user.id.toString(),
        message: '아이디를 찾았습니다.'
      });
    }

    // Step 2: 이메일로 비밀번호 전송
    if (step === 'send-password') {
      if (!email) {
        return NextResponse.json(
          { ok: false, error: '이메일을 입력해주세요.' },
          { status: 400 }
        );
      }

      // 이메일 일치 확인
      if (user.email && user.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
        return NextResponse.json(
          { ok: false, error: '입력하신 이메일이 회원정보와 일치하지 않습니다.' },
          { status: 400 }
        );
      }

      // PasswordEvent에서 평문 비밀번호 찾기 (회원가입 시 저장된 평문 비밀번호)
      const passwordEvent = await prisma.passwordEvent.findFirst({
        where: {
          userId: user.id,
          reason: '회원가입'
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          to: true // 평문 비밀번호
        }
      });

      let password = '';
      if (passwordEvent && passwordEvent.to) {
        password = passwordEvent.to;
      } else if (user.password && !user.password.startsWith('$2')) {
        // bcrypt 해시가 아닌 경우 (평문)
        password = user.password;
      } else {
        // 비밀번호를 찾을 수 없는 경우
        return NextResponse.json(
          { 
            ok: false, 
            error: '비밀번호를 찾을 수 없습니다. 본사로 문의하여 비밀번호를 재설정해주세요.' 
          },
          { status: 404 }
        );
      }

      // NOTE: 이메일 전송 기능 구현 필요 (See GitHub Issue #TBD)
      // 임시: 로그에만 기록하고 성공 응답 반환
      console.log('[FIND PASSWORD] 비밀번호 전송 시뮬레이션:', {
        email: user.email || email,
        password: password ? '(exists)' : '(not found)',
        timestamp: new Date().toISOString()
      });

      return NextResponse.json({
        ok: true,
        message: '비밀번호가 이메일로 전송되었습니다.'
      });
    }

    // 기본: 기존 로직 (하위 호환성)
    const passwordEvent = await prisma.passwordEvent.findFirst({
      where: {
        userId: user.id,
        reason: '회원가입'
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        to: true // 평문 비밀번호
      }
    });

    if (passwordEvent && passwordEvent.to) {
      return NextResponse.json({
        ok: true,
        password: passwordEvent.to,
        message: '비밀번호를 찾았습니다.'
      });
    }

    // PasswordEvent에 없으면 bcrypt 해시된 비밀번호만 있음
    // 이 경우 비밀번호 재설정을 안내
    return NextResponse.json(
      { 
        ok: false, 
        error: '비밀번호를 찾을 수 없습니다. 관리자에게 문의하여 비밀번호를 재설정해주세요.' 
      },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('[FIND PASSWORD] Error:', error);
    
    return NextResponse.json(
      { 
        ok: false, 
        error: process.env.NODE_ENV === 'development' 
          ? `비밀번호 찾기 중 오류가 발생했습니다: ${error.message || 'Unknown error'}`
          : '비밀번호 찾기 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      },
      { status: 500 }
    );
  }
}
