export const dynamic = 'force-dynamic';

// app/api/push/unsubscribe/route.ts
// 푸시 알림 구독 해제 API

import { NextResponse } from 'next/server';
import { deletePushSubscription } from '@/lib/push/server';

export async function POST(req: Request) {
  try {
    const { endpoint } = await req.json();

    if (!endpoint) {
      return NextResponse.json(
        { ok: false, error: 'Endpoint required' },
        { status: 400 }
      );
    }

    const deleted = await deletePushSubscription(endpoint);

    if (deleted) {
      return NextResponse.json({
        ok: true,
        message: 'Push subscription removed successfully',
      });
    } else {
      return NextResponse.json(
        { ok: false, error: 'Failed to remove subscription' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Push Unsubscribe API] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
