// app/api/visited-countries/route.ts
// 사용자의 방문 국가 정보 조회 및 저장

// ⬇️ 절대법칙: Prisma 사용 API는 반드시 nodejs runtime과 force-dynamic 필요
export const runtime = 'nodejs';        // Edge Runtime 금지 (Prisma 사용)
export const dynamic = 'force-dynamic'; // 동적 데이터는 캐시 X

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

/**
 * GET: 사용자의 방문 국가 정보 조회
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.userId);

    // 방문 국가 조회
    const visitedCountries = await prisma.visitedCountry.findMany({
      where: { userId },
      orderBy: { visitCount: 'desc' },
    });

    // 국가별 색상 매핑 (방문 횟수에 따라)
    const colorMap: Record<string, string> = {};
    visitedCountries.forEach((country) => {
      if (country.visitCount >= 5) {
        colorMap[country.countryCode] = '#DC2626'; // 빨간색 (5회 이상)
      } else if (country.visitCount >= 3) {
        colorMap[country.countryCode] = '#F97316'; // 주황색 (3-4회)
      } else if (country.visitCount >= 2) {
        colorMap[country.countryCode] = '#FCD34D'; // 노란색 (2회)
      } else {
        colorMap[country.countryCode] = '#60A5FA'; // 파란색 (1회)
      }
    });

    return NextResponse.json({
      ok: true,
      visitedCountries,
      colorMap,
    });
  } catch (error) {
    console.error('[Visited Countries] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST: 방문 국가 저장/업데이트
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.userId);
    const body = await req.json();
    const { countryCode, countryName } = body;

    if (!countryCode || !countryName) {
      return NextResponse.json(
        { ok: false, error: 'countryCode와 countryName이 필요합니다' },
        { status: 400 }
      );
    }

    // 방문 국가 저장/업데이트
    const visitedCountry = await prisma.visitedCountry.upsert({
      where: {
        userId_countryCode: {
          userId,
          countryCode,
        },
      },
      update: {
        visitCount: { increment: 1 },
        lastVisited: new Date(),
      },
      create: {
        userId,
        countryCode,
        countryName,
        visitCount: 1,
        lastVisited: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      visitedCountry,
    });
  } catch (error: any) {
    console.error('[Visited Countries POST] Error:', error);
    return NextResponse.json(
      { ok: false, error: '방문 국가 저장 중 오류가 발생했습니다', details: error?.message },
      { status: 500 }
    );
  }
}

