export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

// 짧은 slug 생성 함수
function generateSlug(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext();
    
    // 기존 slug가 있으면 반환
    if (profile.littlyLinkSlug) {
      return NextResponse.json({
        ok: true,
        slug: profile.littlyLinkSlug,
        url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/l/${profile.littlyLinkSlug}`,
        message: '기존 링크를 반환했습니다.',
      });
    }

    // 새 slug 생성 (중복 체크)
    let slug = generateSlug(8);
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const existing = await prisma.affiliateProfile.findFirst({
        where: { littlyLinkSlug: slug },
      });

      if (!existing) {
        break; // 중복 없음
      }

      slug = generateSlug(8);
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { ok: false, error: '링크 생성에 실패했습니다. 다시 시도해주세요.' },
        { status: 500 }
      );
    }

    // 프로필에 slug 저장
    const updatedProfile = await prisma.affiliateProfile.update({
      where: { id: profile.id },
      data: { littlyLinkSlug: slug },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const linkUrl = `${baseUrl}/l/${slug}`;

    return NextResponse.json({
      ok: true,
      slug,
      url: linkUrl,
      message: '링크가 생성되었습니다.',
    });
  } catch (error: any) {
    console.error('[POST /api/partner/link/generate] error:', error);
    
    if (error.name === 'PartnerApiError') {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status || 403 }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: error.message || '링크 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
