// ⬇️ 절대법칙: Prisma 사용 API는 반드시 nodejs runtime과 force-dynamic 필요
export const runtime = 'nodejs';        // Edge Runtime 금지 (Prisma 사용)
export const dynamic = 'force-dynamic'; // 동적 데이터는 캐시 X

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Health Check API
 * 서버 상태를 확인하는 엔드포인트
 * 
 * GET /api/health
 * 
 * 응답:
 * - status: "ok" | "error"
 * - database: "connected" | "disconnected"
 * - timestamp: ISO string
 * - uptime: seconds
 */
const startTime = Date.now();

export async function GET() {
  const health = {
    status: 'ok' as 'ok' | 'error',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    services: {
      database: 'unknown' as 'connected' | 'disconnected' | 'unknown',
      googleDrive: 'unknown' as 'configured' | 'not_configured' | 'unknown',
    },
    environment: process.env.NODE_ENV || 'unknown',
    version: process.env.npm_package_version || 'unknown',
  };

  try {
    // 데이터베이스 연결 확인
    try {
      await prisma.$queryRaw`SELECT 1`;
      health.services.database = 'connected';
    } catch (error) {
      health.services.database = 'disconnected';
      health.status = 'error';
    }

    // 구글 드라이브 설정 확인
    if (
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY &&
      process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID
    ) {
      health.services.googleDrive = 'configured';
    } else {
      health.services.googleDrive = 'not_configured';
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    return NextResponse.json(health, { status: statusCode });
  } catch (error: any) {
    health.status = 'error';
    return NextResponse.json(
      {
        ...health,
        error: error.message || 'Unknown error',
      },
      { status: 503 }
    );
  }
}













