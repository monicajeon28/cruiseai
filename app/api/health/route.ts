import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// 공개 헬스체크 엔드포인트 - UptimeRobot 등 외부 모니터링 서비스용
// Neon DB auto-suspend 방지 (5분마다 ping)
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
