export const dynamic = 'force-dynamic';

// app/api/user/test-mode/route.ts
// 테스트 모드 정보를 반환하는 API (기존 코드 수정 없이 별도 파일)

import { NextResponse } from 'next/server';
import { checkTestMode } from '@/lib/test-mode';

export async function GET() {
  try {
    const testModeInfo = await checkTestMode();
    return NextResponse.json(testModeInfo);
  } catch (error) {
    console.error('[TestMode API] Error:', error);
    return NextResponse.json(
      {
        isTestMode: false,
        testModeStartedAt: null,
        remainingHours: null,
        testModeEndAt: null,
      },
      { status: 500 }
    );
  }
}
