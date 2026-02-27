// app/api/cron/sync-images/route.ts
// 구글 드라이브 크루즈정보사진 → DB ImageCache 동기화 트리거
// Vercel Cron 또는 관리자가 수동으로 호출

import { NextRequest, NextResponse } from 'next/server';
import { syncImageCache } from '@/lib/image-cache-sync';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5분 (Vercel Pro)

export async function GET(req: NextRequest) {
  try {
    // 인증: Vercel Cron 헤더 또는 CRON_SECRET 쿼리 파라미터
    const authHeader = req.headers.get('authorization');
    const querySecret = new URL(req.url).searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET;

    const isVercelCron = authHeader === `Bearer ${cronSecret}`;
    const isManualTrigger = querySecret === cronSecret && !!cronSecret;

    if (!isVercelCron && !isManualTrigger) {
      logger.warn('[SyncImages] Unauthorized access attempt');
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    logger.log('[SyncImages] 이미지 동기화 시작...');
    const result = await syncImageCache();

    logger.log('[SyncImages] 완료:', result);
    return NextResponse.json({
      ok: result.success,
      ...result,
    });
  } catch (error: any) {
    logger.error('[SyncImages] 오류:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
