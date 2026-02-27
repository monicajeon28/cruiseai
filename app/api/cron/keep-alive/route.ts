import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Vercel Cron: 4분마다 실행 → Neon 무료 티어 auto-suspend 방지
// vercel.json: { "path": "/api/cron/keep-alive", "schedule": "*/4 * * * *" }
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
