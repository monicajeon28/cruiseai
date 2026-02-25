export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { syncApisSpreadsheet } from '@/lib/google-sheets';

/**
 * POST /api/trip/sync-apis
 * APIS 엑셀 파일 생성 및 동기화
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tripId } = body;

    if (!tripId || typeof tripId !== 'number') {
      return NextResponse.json(
        { ok: false, error: 'tripId is required and must be a number' },
        { status: 400 }
      );
    }

    const result = await syncApisSpreadsheet(tripId);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: result.spreadsheetUrl,
    });
  } catch (error: any) {
    console.error('[Sync APIS API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
