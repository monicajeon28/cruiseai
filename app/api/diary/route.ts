// ⬇️ 절대법칙: Prisma 사용 API는 반드시 nodejs runtime과 force-dynamic 필요
export const runtime = 'nodejs';        // Edge Runtime 금지 (Prisma 사용)
export const dynamic = 'force-dynamic'; // 동적 데이터는 캐시 X

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

// GET: 다이어리 기록 조회
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) {
      return NextResponse.json({ ok: false, message: 'UNAUTHORIZED' }, { status: 401 });
    }

    const sess = await prisma.session.findUnique({
      where: { id: sid },
      select: { userId: true },
    });

    if (!sess?.userId) {
      return NextResponse.json({ ok: false, message: 'UNAUTHORIZED' }, { status: 401 });
    }

    // URL 파라미터에서 국가 코드 추출
    const { searchParams } = new URL(req.url);
    const countryCode = searchParams.get('countryCode');
    const tripId = searchParams.get('tripId');

    // 쿼리 조건 구성
    const where: any = {
      userId: sess.userId,
    };

    if (countryCode) {
      where.countryCode = countryCode;
    }

    if (tripId) {
      where.tripId = parseInt(tripId);
    }

    // 다이어리 기록 조회
    const entries = await prisma.travelDiaryEntry.findMany({
      where,
      orderBy: {
        visitDate: 'desc',
      },
      include: {
        trip: {
          select: {
            id: true,
            cruiseName: true,
            destination: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, entries });
  } catch (error) {
    logger.error('[Diary] GET error:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: 다이어리 기록 작성
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) {
      return NextResponse.json({ ok: false, message: 'UNAUTHORIZED' }, { status: 401 });
    }

    const sess = await prisma.session.findUnique({
      where: { id: sid },
      select: { userId: true },
    });

    if (!sess?.userId) {
      return NextResponse.json({ ok: false, message: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const { tripId, countryCode, countryName, title, content, visitDate } = body;

    // 필수 필드 검증
    if (!countryCode || !countryName || !title || !content) {
      return NextResponse.json(
        { ok: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 다이어리 기록 생성
    const entry = await prisma.travelDiaryEntry.create({
      data: {
        userId: sess.userId,
        tripId: tripId ? parseInt(tripId) : null,
        countryCode,
        countryName,
        title,
        content,
        visitDate: visitDate ? new Date(visitDate) : new Date(),
      },
    });

    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    logger.error('[Diary] POST error:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

