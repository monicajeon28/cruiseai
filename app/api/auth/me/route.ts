export const dynamic = 'force-dynamic';

// app/api/auth/me/route.ts
// 현재 로그인한 사용자 정보 조회

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getSession();

    if (!session || !session.userId) {
      return NextResponse.json({
        ok: false,
        user: null
      });
    }

    // session.userId는 문자열이므로 정수로 변환
    const userId = parseInt(session.userId);
    if (isNaN(userId)) {
      return NextResponse.json({
        ok: false,
        user: null
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        mallUserId: true,
        AffiliateProfile: {
          select: {
            id: true,
            type: true,
            displayName: true,
          },
        },
      }
    });

    if (!user) {
      return NextResponse.json({
        ok: false,
        user: null
      });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone, // phone 필드 추가
        username: user.phone, // phone 필드에 username 저장 (하위 호환성)
        role: user.role,
        mallUserId: user.mallUserId,
        affiliateProfile: user.AffiliateProfile ? {
          id: user.AffiliateProfile.id,
          type: user.AffiliateProfile.type,
          displayName: user.AffiliateProfile.displayName,
        } : null,
      }
    });
  } catch (error: any) {
    console.error('[AUTH ME] Error:', error);
    console.error('[AUTH ME] Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    
    // 개발 환경에서는 더 자세한 에러 정보 제공
    return NextResponse.json({
      ok: false,
      user: null,
      error: process.env.NODE_ENV === 'development' ? error?.message : '사용자 정보를 가져올 수 없습니다.',
    }, { status: 500 });
  }
}
