// app/api/public/mall-settings/route.ts
// 메인몰 설정 공개 API (인증 불필요)

// 동적 API로 설정 (req.url 사용)
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET: 메인몰 설정 조회 (공개)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const section = searchParams.get('section');

    const where: any = {
      section: section || { in: ['popular-banner', 'recommended-banner', 'product-display-settings', 'menu-bar-settings', 'recommended-below-settings'] },
      isActive: true,
    };

    const contents = await prisma.mallContent.findMany({
      where,
      orderBy: { order: 'asc' },
    });

    // 섹션별로 그룹화하고 첫 번째 항목만 반환 (main 키)
    const settings: Record<string, any> = {};
    contents.forEach((content) => {
      if (content.key === 'main') {
        settings[content.section] = content.content as any;
      }
    });

    return NextResponse.json({
      ok: true,
      settings,
    });
  } catch (error: any) {
    console.error('[Public Mall Settings API] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '설정을 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
