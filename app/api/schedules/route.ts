// app/api/schedules/route.ts
// 사용자 일정 데이터 관리 API

// ⬇️ 절대법칙: Prisma 사용 API는 반드시 nodejs runtime과 force-dynamic 필요
export const runtime = 'nodejs';        // Edge Runtime 금지 (Prisma 사용)
export const dynamic = 'force-dynamic'; // 동적 데이터는 캐시 X

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

/**
 * GET: 사용자의 일정 데이터 조회
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const userId = parseInt(session.userId);
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date'); // YYYY-MM-DD 형식

    // 특정 날짜의 일정 조회
    if (date) {
      // 날짜 파싱 (YYYY-MM-DD 형식) - 한국 시간대 고려
      let targetDate: Date;
      try {
        if (typeof date === 'string') {
          const [year, month, day] = date.split('-').map(Number);
          targetDate = new Date(year, month - 1, day, 0, 0, 0, 0);
          if (isNaN(targetDate.getTime())) {
            throw new Error(`Invalid date string: ${date}`);
          }
        } else {
          targetDate = new Date(date);
          targetDate.setHours(0, 0, 0, 0);
        }
      } catch (dateError) {
        console.error('[API] 날짜 파싱 오류:', dateError, { date });
        return NextResponse.json(
          { ok: false, error: '날짜 형식이 올바르지 않습니다', details: String(dateError) },
          { status: 400 }
        );
      }

      // 날짜 범위로 검색 (하루 전체)
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      console.log('[API] Schedules GET 요청:', { userId, date, targetDate: startOfDay, endOfDay });

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

      console.log('[API] Schedules 조회 결과:', schedules.length, '개');

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
  } catch (error: any) {
    console.error('[API] Schedules GET error:', error);
    // 테이블이 없는 경우 빈 배열 반환 (마이그레이션 중일 수 있음)
    if (error?.code === 'P2021' || error?.message?.includes('does not exist') || error?.message?.includes('no such table')) {
      console.warn('[API] UserSchedule table does not exist yet, returning empty schedules');
      return NextResponse.json({
        ok: true,
        schedules: [],
      });
    }
    return NextResponse.json(
      { ok: false, error: '일정 조회 중 오류가 발생했습니다', details: error?.message },
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
      console.error('[API] Schedules POST: 세션 없음');
      return NextResponse.json({ 
        ok: false, 
        error: '인증이 필요합니다',
        details: '세션이 만료되었거나 로그인이 필요합니다. 다시 로그인해주세요.'
      }, { status: 401 });
    }

    const userId = parseInt(session.userId);
    
    // userId 유효성 검사
    if (isNaN(userId) || userId <= 0) {
      console.error('[API] Schedules POST: 유효하지 않은 userId:', session.userId);
      return NextResponse.json({ 
        ok: false, 
        error: '사용자 정보가 올바르지 않습니다',
        details: `userId: ${session.userId}`
      }, { status: 400 });
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[API] Schedules POST: 요청 본문 파싱 실패:', parseError);
      return NextResponse.json({ 
        ok: false, 
        error: '요청 데이터 형식이 올바르지 않습니다',
        details: String(parseError)
      }, { status: 400 });
    }

    const { time, title, alarm, alarmTime, date } = body;

    console.log('[API] Schedules POST 요청:', { userId, time, title, alarm, alarmTime, date });

    if (!time || !title || !date) {
      console.error('[API] 필수 필드 누락:', { time, title, date });
      return NextResponse.json(
        { ok: false, error: '시간, 제목, 날짜는 필수입니다' },
        { status: 400 }
      );
    }

    // 날짜 파싱 (YYYY-MM-DD 형식) - 한국 시간대(KST) 고려
    let scheduleDate: Date;
    try {
      if (typeof date === 'string') {
        // YYYY-MM-DD 형식을 한국 시간대로 파싱
        const [year, month, day] = date.split('-').map(Number);
        scheduleDate = new Date(year, month - 1, day, 0, 0, 0, 0);

        if (isNaN(scheduleDate.getTime())) {
          throw new Error(`Invalid date string: ${date}`);
        }
      } else if (date instanceof Date) {
        scheduleDate = new Date(date);
        scheduleDate.setHours(0, 0, 0, 0);
      } else {
        throw new Error(`Invalid date type: ${typeof date}`);
      }
    } catch (dateError) {
      console.error('[API] 날짜 파싱 오류:', dateError, { date, dateType: typeof date });
      return NextResponse.json(
        { ok: false, error: '날짜 형식이 올바르지 않습니다', details: String(dateError) },
        { status: 400 }
      );
    }

    console.log('[API] 일정 생성 시도:', { userId, time, title, alarm, date: scheduleDate });

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

    console.log('[API] 일정 생성 성공:', schedule.id);

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
    console.error('[API] Schedules POST error:', error);
    console.error('[API] Error details:', {
      code: error?.code,
      message: error?.message,
      stack: error?.stack,
    });
    
    // 테이블이 없는 경우 에러 반환
    if (error?.code === 'P2021' || error?.message?.includes('does not exist') || error?.message?.includes('no such table')) {
      console.error('[API] UserSchedule table does not exist. Please run: npx prisma db push');
      return NextResponse.json(
        { ok: false, error: '일정 기능이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.', details: '테이블이 존재하지 않습니다' },
        { status: 503 }
      );
    }
    
    // Prisma 에러 처리
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { ok: false, error: '이미 같은 일정이 존재합니다', details: error?.message },
        { status: 409 }
      );
    }
    
    // 일반 에러
    return NextResponse.json(
      { 
        ok: false, 
        error: '일정 추가 중 오류가 발생했습니다', 
        details: error?.message || '알 수 없는 오류',
        code: error?.code,
      },
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

    const userId = parseInt(session.userId);
    const body = await req.json();
    const { id, time, title, alarm, alarmTime, date } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: '일정 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 일정 소유권 확인
    const existing = await prisma.userSchedule.findFirst({
      where: {
        id: parseInt(id),
        userId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: '일정을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const schedule = await prisma.userSchedule.update({
      where: { id: parseInt(id) },
      data: {
        ...(time && { time }),
        ...(title && { title }),
        ...(alarm !== undefined && { alarm }),
        ...(alarmTime !== undefined && { alarmTime: alarm && alarmTime ? alarmTime : null }),
        ...(date && { date: new Date(date) }),
        // updatedAt은 @updatedAt 데코레이터로 자동 관리됨
      },
    });

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
    console.error('[API] Schedules PUT error:', error);
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

    const userId = parseInt(session.userId);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { ok: false, error: '일정 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 일정 소유권 확인
    const existing = await prisma.userSchedule.findFirst({
      where: {
        id: parseInt(id),
        userId,
      },
    });

    // 일정이 없으면 이미 삭제된 것으로 간주하고 성공 반환 (멱등성)
    if (!existing) {
      console.log('[API] 일정이 이미 삭제되었거나 존재하지 않음:', id);
      return NextResponse.json({ ok: true, message: '일정이 이미 삭제되었습니다' });
    }

    await prisma.userSchedule.delete({
      where: { id: parseInt(id) },
    });

    console.log('[API] 일정 삭제 성공:', id);
    return NextResponse.json({ ok: true, message: '일정이 삭제되었습니다' });
  } catch (error) {
    console.error('[API] Schedules DELETE error:', error);
    return NextResponse.json(
      { ok: false, error: '일정 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
