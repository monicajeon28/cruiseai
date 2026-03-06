// app/api/schedules/route.ts
// 사용자 일정 데이터 관리 API

// ⬇️ 절대법칙: Prisma 사용 API는 반드시 nodejs runtime과 force-dynamic 필요
export const runtime = 'nodejs';        // Edge Runtime 금지 (Prisma 사용)
export const dynamic = 'force-dynamic'; // 동적 데이터는 캐시 X

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { getSession } from '@/lib/session';
import { logger } from '@/lib/logger';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM 24시간 형식
const MAX_TITLE_LENGTH = 200;

// ---- 날짜 형식 및 오버플로우 방어 ----
const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function parseDateStrict(dateStr: string): Date {
  if (typeof dateStr !== 'string' || !DATE_REGEX.test(dateStr)) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  // Date rollover 체크: "2025-02-31" → getMonth()=2(3월) → 불일치 → throw
  if (d.getMonth() !== month - 1) {
    throw new Error(`Invalid date (overflow): ${dateStr}`);
  }
  return d;
}

/**
 * GET: 사용자의 일정 데이터 조회
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const userId = parseInt(session.userId, 10);
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json({ ok: false, error: '사용자 정보가 올바르지 않습니다' }, { status: 400 });
    }
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date'); // YYYY-MM-DD 형식

    // 특정 날짜의 일정 조회
    if (date) {
      let targetDate!: Date;
      try {
        targetDate = parseDateStrict(date);
      } catch (dateError) {
        logger.error('[API] 날짜 파싱 오류:', dateError, { date });
        return NextResponse.json(
          { ok: false, error: '날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)' },
          { status: 400 }
        );
      }

      // 날짜 범위로 검색 (하루 전체)
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      logger.log('[API] Schedules GET 요청:', { userId, date, targetDate: startOfDay, endOfDay });

      const schedules = await prisma.userSchedule.findMany({
        where: {
          userId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: {
          time: 'asc',
        },
      });

      logger.log('[API] Schedules 조회 결과:', schedules.length, '개');

      return NextResponse.json({
        ok: true,
        date,
        schedules: schedules.map(s => ({
          id: s.id,
          time: s.time,
          title: s.title,
          alarm: s.alarm,
          alarmTime: s.alarmTime || null,
          date: s.date.toISOString().split('T')[0],
        })),
      });
    }

    // 사용자의 모든 일정 조회 (최근 30일)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const schedules = await prisma.userSchedule.findMany({
      where: {
        userId,
        date: {
          gte: thirtyDaysAgo,
        },
      },
      orderBy: [
        { date: 'asc' },
        { time: 'asc' },
      ],
    });

    // 날짜별로 그룹화
    const schedulesByDate: Record<string, any[]> = {};
    schedules.forEach(schedule => {
      const dateStr = schedule.date.toISOString().split('T')[0];
      if (!schedulesByDate[dateStr]) {
        schedulesByDate[dateStr] = [];
      }
      schedulesByDate[dateStr].push({
        id: schedule.id,
        time: schedule.time,
        title: schedule.title,
        alarm: schedule.alarm,
        alarmTime: schedule.alarmTime || null,
        date: dateStr,
      });
    });

    return NextResponse.json({
      ok: true,
      schedules: schedulesByDate,
    });
  } catch (error: unknown) {
    logger.error('[API] Schedules GET error:', error);
    const err = error as { code?: string; message?: string };
    // 테이블이 없는 경우 빈 배열 반환 (마이그레이션 중일 수 있음)
    if (err?.code === 'P2021' || err?.message?.includes('does not exist') || err?.message?.includes('no such table')) {
      logger.warn('[API] UserSchedule table does not exist yet, returning empty schedules');
      return NextResponse.json({
        ok: true,
        schedules: [],
      });
    }
    return NextResponse.json(
      { ok: false, error: '일정 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * POST: 일정 추가
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const userId = parseInt(session.userId, 10);

    // userId 유효성 검사
    if (isNaN(userId) || userId <= 0) {
      logger.error('[API] Schedules POST: 유효하지 않은 userId');
      return NextResponse.json({
        ok: false,
        error: '사용자 정보가 올바르지 않습니다',
      }, { status: 400 });
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      logger.error('[API] Schedules POST: 요청 본문 파싱 실패:', parseError);
      return NextResponse.json({
        ok: false,
        error: '요청 데이터 형식이 올바르지 않습니다',
      }, { status: 400 });
    }

    const { time, title, alarm, alarmTime, date } = body;

    logger.log('[API] Schedules POST 요청:', { userId, time, title, alarm, alarmTime, date });

    if (!time || !title || !date) {
      logger.error('[API] 필수 필드 누락:', { time, title, date });
      return NextResponse.json(
        { ok: false, error: '시간, 제목, 날짜는 필수입니다' },
        { status: 400 }
      );
    }

    if (!TIME_REGEX.test(time)) {
      return NextResponse.json(
        { ok: false, error: '시간은 HH:MM 형식이어야 합니다 (예: 09:30)' },
        { status: 400 }
      );
    }
    if (title.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: '제목을 입력해주세요' },
        { status: 400 }
      );
    }
    if (title.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { ok: false, error: `제목은 ${MAX_TITLE_LENGTH}자 이하여야 합니다` },
        { status: 400 }
      );
    }

    // 날짜 파싱 (YYYY-MM-DD 형식) - 오버플로우 방어 포함
    let scheduleDate: Date;
    try {
      if (typeof date === 'string') {
        scheduleDate = parseDateStrict(date);
      } else {
        throw new Error(`Invalid date type: ${typeof date}`);
      }
    } catch (dateError) {
      logger.error('[API] 날짜 파싱 오류:', dateError, { date, dateType: typeof date });
      return NextResponse.json(
        { ok: false, error: '날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    logger.log('[API] 일정 생성 시도:', { userId, time, title, alarm, date: scheduleDate });

    const schedule = await prisma.userSchedule.create({
      data: {
        userId,
        time,
        title,
        alarm: alarm ?? false,
        alarmTime: alarm && alarmTime ? alarmTime : null, // alarm이 true이고 alarmTime이 있으면 저장
        date: scheduleDate,
        updatedAt: new Date(), // updatedAt 필수 필드
      },
    });

    logger.log('[API] 일정 생성 성공:', schedule.id);

    return NextResponse.json({
      ok: true,
      schedule: {
        id: schedule.id,
        time: schedule.time,
        title: schedule.title,
        alarm: schedule.alarm,
        alarmTime: schedule.alarmTime || null,
        date: schedule.date.toISOString().split('T')[0],
      },
    });
  } catch (error: any) {
    logger.error('[API] Schedules POST error:', error?.code);

    // 테이블이 없는 경우 에러 반환
    if (error?.code === 'P2021' || error?.message?.includes('does not exist') || error?.message?.includes('no such table')) {
      return NextResponse.json(
        { ok: false, error: '일정 기능이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.' },
        { status: 503 }
      );
    }
    
    // Prisma 에러 처리
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { ok: false, error: '이미 같은 일정이 존재합니다' },
        { status: 409 }
      );
    }

    // 일반 에러
    return NextResponse.json(
      { ok: false, error: '일정 추가 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * PUT: 일정 수정
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const userId = parseInt(session.userId, 10);
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json({ ok: false, error: '사용자 정보가 올바르지 않습니다' }, { status: 400 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: '요청 데이터 형식이 올바르지 않습니다' }, { status: 400 });
    }
    const { id, time, title, alarm, alarmTime, date } = body || {};

    if (!id) {
      return NextResponse.json(
        { ok: false, error: '일정 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const scheduleId = parseInt(String(id), 10);
    if (isNaN(scheduleId) || scheduleId <= 0) {
      return NextResponse.json({ ok: false, error: '유효한 일정 ID가 필요합니다' }, { status: 400 });
    }

    // time이 있을 때만 검증
    if (time !== undefined && time !== null && !TIME_REGEX.test(time)) {
      return NextResponse.json(
        { ok: false, error: '시간은 HH:MM 형식이어야 합니다 (예: 09:30)' },
        { status: 400 }
      );
    }
    // title이 있을 때만 검증
    if (title !== undefined && title !== null) {
      if (title.trim().length === 0) {
        return NextResponse.json(
          { ok: false, error: '제목을 입력해주세요' },
          { status: 400 }
        );
      }
      if (title.length > MAX_TITLE_LENGTH) {
        return NextResponse.json(
          { ok: false, error: `제목은 ${MAX_TITLE_LENGTH}자 이하여야 합니다` },
          { status: 400 }
        );
      }
    }

    // 날짜 파싱 — $transaction 밖에서 사전 검증 (NextResponse 반환 필요)
    // date가 명시적으로 제공되면 반드시 유효해야 함 (time/title 검증과 일관성)
    let parsedDate: Date | undefined;
    if (date !== undefined && date !== null) {
      if (typeof date !== 'string') {
        return NextResponse.json(
          { ok: false, error: '날짜는 문자열이어야 합니다 (YYYY-MM-DD)' },
          { status: 400 }
        );
      }
      try {
        parsedDate = parseDateStrict(date);
      } catch {
        return NextResponse.json(
          { ok: false, error: '날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)' },
          { status: 400 }
        );
      }
    }

    // 원자적 소유권 검증 + 수정: $transaction으로 TOCTOU 방지
    const schedule = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.userSchedule.findFirst({
        where: { id: scheduleId, userId },
      });

      if (!existing) return null;

      return tx.userSchedule.update({
        where: { id: scheduleId },
        data: {
          ...(time && { time }),
          ...(title && { title }),
          ...(alarm !== undefined && { alarm }),
          ...(alarmTime !== undefined && { alarmTime: alarm && alarmTime ? alarmTime : null }),
          ...(parsedDate && { date: parsedDate }),
        },
      });
    });

    if (!schedule) {
      return NextResponse.json(
        { ok: false, error: '일정을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      schedule: {
        id: schedule.id,
        time: schedule.time,
        title: schedule.title,
        alarm: schedule.alarm,
        alarmTime: schedule.alarmTime || null,
        date: schedule.date.toISOString().split('T')[0],
      },
    });
  } catch (error) {
    logger.error('[API] Schedules PUT error:', error);
    return NextResponse.json(
      { ok: false, error: '일정 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 일정 삭제
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const userId = parseInt(session.userId, 10);
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json({ ok: false, error: '사용자 정보가 올바르지 않습니다' }, { status: 400 });
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { ok: false, error: '일정 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const scheduleId = parseInt(id, 10);
    if (isNaN(scheduleId) || scheduleId <= 0) {
      return NextResponse.json({ ok: false, error: '유효한 일정 ID가 필요합니다' }, { status: 400 });
    }

    // deleteMany: 원자적 삭제 (TOCTOU 방지) — userId 조건이 소유권 검증 포함
    const result = await prisma.userSchedule.deleteMany({
      where: { id: scheduleId, userId },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { ok: false, error: '일정을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    logger.log('[API] 일정 삭제 완료:', { id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('[API] Schedules DELETE error:', error);
    return NextResponse.json(
      { ok: false, error: '일정 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
