export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

// POST: 사용자 활동 추적
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      // 로그인하지 않은 사용자는 추적하지 않음 (200 반환)
      return NextResponse.json({ ok: true });
    }

    const body = await req.json();
    const { action, page, metadata } = body;

    if (!action) {
      return NextResponse.json({ ok: false, error: 'Action is required' }, { status: 400 });
    }

    // page_view는 FeatureUsage에 기록하지 않음
    if (action === 'page_view') {
      // UserActivity만 기록
      await prisma.userActivity.create({
        data: {
          userId: user.id,
          action: 'page_view',
          page: page || null,
          metadata: metadata || null,
        },
      });
      return NextResponse.json({ ok: true });
    }

    // 기능 사용 매핑
    const featureMap: Record<string, string> = {
      'map': 'map',
      'translator': 'translator',
      'checklist': 'checklist',
      'wallet': 'wallet',
      'ai_chat': 'ai_chat',
    };

    const feature = featureMap[action] || action;

    // UserActivity 기록
    await prisma.userActivity.create({
      data: {
        userId: user.id,
        action,
        page: page || null,
        metadata: metadata || null,
      },
    });

    // FeatureUsage 업데이트 (page_view 제외)
    if (feature && feature !== 'page_view') {
      const now = new Date();
      await prisma.featureUsage.upsert({
        where: {
          userId_feature: {
            userId: user.id,
            feature,
          },
        },
        update: {
          usageCount: { increment: 1 },
          lastUsedAt: now,
          updatedAt: now,
        },
        create: {
          userId: user.id,
          feature,
          usageCount: 1,
          lastUsedAt: now,
          updatedAt: now,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Analytics Track] Error:', error);
    // 추적 실패는 사용자 경험에 영향 없도록 200 반환
    return NextResponse.json({ ok: true });
  }
}
