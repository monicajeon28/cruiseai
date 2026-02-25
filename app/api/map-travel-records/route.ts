// ⬇️ 절대법칙: Prisma 사용 API는 반드시 nodejs runtime과 force-dynamic 필요
export const runtime = 'nodejs';        // Edge Runtime 금지 (Prisma 사용)
export const dynamic = 'force-dynamic'; // 동적 데이터는 캐시 X

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

// GET: 사용자의 지도 페이지 여행 기록 조회
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, message: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userId = parseInt(session.userId);

    // 사용자의 모든 지도 페이지 여행 기록 조회 (등록 순서대로)
    let records;
    try {
      records = await prisma.mapTravelRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' }, // 등록 순서대로 (오래된 것부터)
        select: {
          id: true,
          cruiseName: true,
          companion: true,
          destination: true,
          startDate: true,
          endDate: true,
          impressions: true,
          createdAt: true,
        },
      });
    } catch (prismaError: any) {
      console.error('[MapTravelRecords GET] Prisma 에러:', prismaError);
      // 테이블이 없는 경우 빈 배열 반환
      if (prismaError.code === 'P2021' || prismaError.message?.includes('does not exist') || prismaError.message?.includes('no such table')) {
        console.warn('[MapTravelRecords GET] MapTravelRecord 테이블이 없음, 빈 배열 반환');
        return NextResponse.json({ ok: true, trips: [] });
      }
      throw prismaError;
    }

    // Trip 인터페이스 형식으로 변환
    const formattedTrips = records.map((record) => ({
      id: record.id,
      cruiseName: record.cruiseName || '',
      companion: record.companion || '가족',
      destination: record.destination || '',
      startDate: record.startDate ? record.startDate.toISOString().split('T')[0] : '',
      endDate: record.endDate ? record.endDate.toISOString().split('T')[0] : '',
      impressions: record.impressions || '',
      createdAt: record.createdAt ? record.createdAt.toISOString() : new Date().toISOString(),
    }));

    return NextResponse.json({ ok: true, trips: formattedTrips });
  } catch (error: any) {
    console.error('[MapTravelRecords GET] 에러 발생:', error);
    console.error('[MapTravelRecords GET] 에러 스택:', error?.stack);
    console.error('[MapTravelRecords GET] 에러 코드:', error?.code);
    
    // Prisma 에러인 경우
    if (error?.code === 'P2021' || error?.message?.includes('does not exist') || error?.message?.includes('no such table')) {
      return NextResponse.json({ ok: true, trips: [] }); // 테이블이 없으면 빈 배열 반환
    }
    
    return NextResponse.json(
      { 
        ok: false, 
        message: '여행 기록 조회 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : String(error),
        code: error?.code,
      },
      { status: 500 }
    );
  }
}

// POST: 지도 페이지 여행 기록 생성
export async function POST(req: Request) {
  let body: any = {};
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, message: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userId = parseInt(session.userId);

    try {
      body = await req.json();
      console.log('[MapTravelRecords POST] 받은 데이터:', JSON.stringify(body, null, 2));
      console.log('[MapTravelRecords POST] startDate 타입:', typeof body?.startDate, '값:', body?.startDate);
      console.log('[MapTravelRecords POST] endDate 타입:', typeof body?.endDate, '값:', body?.endDate);
    } catch (parseError) {
      console.error('[MapTravelRecords POST] JSON 파싱 에러:', parseError);
      return NextResponse.json(
        { ok: false, message: '요청 데이터 형식이 올바르지 않습니다' },
        { status: 400 }
      );
    }
    
    const {
      cruiseName,
      companion,
      destination,
      startDate,
      endDate,
      impressions,
    } = body || {};

    // 날짜만 필수로 검증 (다이어리처럼 자유롭게 기록 가능하도록)
    if (!startDate || !endDate) {
      console.error('[MapTravelRecords POST] 날짜 누락:', { startDate, endDate, body });
      return NextResponse.json(
        { ok: false, message: '여행 시작일과 종료일은 필수 입력 항목입니다', details: `시작일: ${startDate}, 종료일: ${endDate}` },
        { status: 400 }
      );
    }
    
    // 날짜 타입 및 형식 검증
    if (typeof startDate !== 'string' || typeof endDate !== 'string') {
      console.error('[MapTravelRecords POST] 날짜 타입 오류:', { startDate, endDate, startDateType: typeof startDate, endDateType: typeof endDate });
      return NextResponse.json(
        { ok: false, message: '날짜는 문자열 형식이어야 합니다', details: `시작일 타입: ${typeof startDate}, 종료일 타입: ${typeof endDate}` },
        { status: 400 }
      );
    }
    
    // 날짜 문자열 공백 제거
    const cleanStartDate = startDate.trim();
    const cleanEndDate = endDate.trim();
    
    // 크루즈 이름과 목적지가 없으면 기본값 설정 (안전하게 처리)
    const finalCruiseName = (cruiseName && typeof cruiseName === 'string' && cruiseName.trim()) 
      ? cruiseName.trim() 
      : '기록된 여행';
    const finalDestination = (destination && typeof destination === 'string' && destination.trim())
      ? destination.trim()
      : '기록';
    const finalCompanion = (companion && typeof companion === 'string' && companion.trim())
      ? companion.trim()
      : '기록';
    const finalImpressions = (impressions && typeof impressions === 'string' && impressions.trim())
      ? impressions.trim()
      : null;

    // 날짜 문자열을 DateTime으로 변환 (YYYY-MM-DD 형식 직접 파싱)
    let startDateTime: Date;
    let endDateTime: Date;
    
    try {
      // YYYY-MM-DD 형식 직접 파싱 (타임존 문제 방지)
      const parseDate = (dateStr: string): Date => {
        if (!dateStr || typeof dateStr !== 'string') {
          throw new Error(`날짜 문자열이 올바르지 않습니다: ${dateStr} (타입: ${typeof dateStr})`);
        }
        
        const trimmed = dateStr.trim();
        console.log('[MapTravelRecords POST] 날짜 파싱 시도:', { 원본: dateStr, 공백제거: trimmed });
        
        // YYYY-MM-DD 형식인지 확인 (시간 부분 제거)
        const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!dateMatch) {
          throw new Error(`날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식이어야 합니다: ${trimmed}`);
        }
        
        const [, year, month, day] = dateMatch;
        const yearNum = parseInt(year, 10);
        const monthNum = parseInt(month, 10) - 1; // 월은 0부터 시작
        const dayNum = parseInt(day, 10);
        
        // 범위 검증 (다이어리 형식: 과거/미래 날짜 모두 허용)
        // 연도는 1000년~9999년까지 허용 (다이어리 형식)
        if (yearNum < 1000 || yearNum > 9999) {
          throw new Error(`연도가 유효하지 않습니다: ${yearNum} (1000-9999 범위)`);
        }
        if (monthNum < 0 || monthNum > 11) {
          throw new Error(`월이 유효하지 않습니다: ${month} (1-12 범위)`);
        }
        if (dayNum < 1 || dayNum > 31) {
          throw new Error(`일이 유효하지 않습니다: ${day} (1-31 범위)`);
        }
        
        // 유효한 날짜인지 확인
        const date = new Date(yearNum, monthNum, dayNum);
        if (date.getFullYear() !== yearNum || date.getMonth() !== monthNum || date.getDate() !== dayNum) {
          throw new Error(`유효하지 않은 날짜입니다: ${trimmed} (예: 2025-02-30은 유효하지 않음)`);
        }
        
        return date;
      };
      
      startDateTime = parseDate(cleanStartDate);
      endDateTime = parseDate(cleanEndDate);
      
      console.log('[MapTravelRecords POST] 날짜 파싱 성공:', {
        원본시작일: startDate,
        공백제거시작일: cleanStartDate,
        파싱된시작일: startDateTime.toISOString(),
        원본종료일: endDate,
        공백제거종료일: cleanEndDate,
        파싱된종료일: endDateTime.toISOString(),
      });
    } catch (dateError: any) {
      console.error('[MapTravelRecords POST] 날짜 파싱 에러:', dateError);
      return NextResponse.json(
        { 
          ok: false, 
          message: '날짜 형식이 올바르지 않습니다', 
          details: dateError?.message || String(dateError),
          hint: `받은 날짜: 시작일=${startDate}, 종료일=${endDate}. YYYY-MM-DD 형식이어야 합니다.`,
        },
        { status: 400 }
      );
    }
    
    // 다이어리 형식: 시작일 > 종료일도 허용 (과거 여행 기록, 계획된 여행 등 자유롭게 기록 가능)
    // 날짜 순서 검증 제거

    // 여행 기록 생성
    console.log('[MapTravelRecords POST] 생성 시도:', {
      userId,
      cruiseName: finalCruiseName,
      companion: finalCompanion,
      destination: finalDestination,
      startDate: startDateTime.toISOString(),
      endDate: endDateTime.toISOString(),
      impressions: finalImpressions,
    });
    
    let record;
    try {
      const now = new Date();
      record = await prisma.mapTravelRecord.create({
        data: {
          userId,
          cruiseName: finalCruiseName,
          companion: finalCompanion,
          destination: finalDestination,
          startDate: startDateTime,
          endDate: endDateTime,
          impressions: finalImpressions,
          updatedAt: now, // updatedAt 명시적으로 설정
        },
        select: {
          id: true,
          cruiseName: true,
          companion: true,
          destination: true,
          startDate: true,
          endDate: true,
          impressions: true,
          createdAt: true,
        },
      });
      console.log('[MapTravelRecords POST] 생성 성공:', record.id);
    } catch (prismaError: any) {
      console.error('[MapTravelRecords POST] Prisma 에러:', prismaError);
      console.error('[MapTravelRecords POST] 에러 코드:', prismaError.code);
      console.error('[MapTravelRecords POST] 에러 메시지:', prismaError.message);
      console.error('[MapTravelRecords POST] 에러 메타:', prismaError.meta);
      
      // 테이블이 없는 경우
      if (prismaError.code === 'P2021' || prismaError.message?.includes('does not exist') || prismaError.message?.includes('no such table')) {
        return NextResponse.json(
          { ok: false, message: '데이터베이스 테이블이 존재하지 않습니다. 관리자에게 문의하세요.', details: 'MapTravelRecord table not found' },
          { status: 503 }
        );
      }
      
      throw prismaError; // 다른 에러는 다시 throw
    }

    // Trip 형식으로 변환하여 반환
    const formattedTrip = {
      id: record.id,
      cruiseName: record.cruiseName || '',
      companion: record.companion || '가족',
      destination: record.destination || '',
      startDate: record.startDate ? record.startDate.toISOString().split('T')[0] : '',
      endDate: record.endDate ? record.endDate.toISOString().split('T')[0] : '',
      impressions: record.impressions || '',
      createdAt: record.createdAt ? record.createdAt.toISOString() : new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, trip: formattedTrip });
  } catch (error: any) {
    console.error('[MapTravelRecords POST] ========== 에러 발생 ==========');
    console.error('[MapTravelRecords POST] 에러 타입:', error?.constructor?.name);
    console.error('[MapTravelRecords POST] 에러 메시지:', error?.message);
    console.error('[MapTravelRecords POST] 에러 스택:', error?.stack);
    console.error('[MapTravelRecords POST] 에러 코드:', error?.code);
    console.error('[MapTravelRecords POST] 에러 메타:', error?.meta);
    console.error('[MapTravelRecords POST] 받은 body:', JSON.stringify(body, null, 2));
    console.error('[MapTravelRecords POST] ===============================');
    
    // Prisma 에러인 경우
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { ok: false, message: '이미 같은 여행 기록이 존재합니다', details: error?.message },
        { status: 409 }
      );
    }
    
    if (error?.code === 'P2021' || error?.message?.includes('does not exist') || error?.message?.includes('no such table')) {
      return NextResponse.json(
        { ok: false, message: '데이터베이스 테이블이 존재하지 않습니다. 관리자에게 문의하세요.', details: 'MapTravelRecord table not found' },
        { status: 503 }
      );
    }
    
    // 에러 메시지 개선
    const errorMessage = error instanceof Error 
      ? error.message 
      : String(error);
    
    console.error('[MapTravelRecords POST] 상세 에러:', {
      message: errorMessage,
      code: error?.code,
      stack: error?.stack,
      body: body,
    });
    
    return NextResponse.json(
      { 
        ok: false, 
        message: '여행 기록 저장 중 오류가 발생했습니다', 
        details: errorMessage,
        code: error?.code,
        hint: '날짜 형식이 올바른지 확인해주세요 (YYYY-MM-DD)',
      },
      { status: 500 }
    );
  }
}

// PUT: 지도 페이지 여행 기록 수정
export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, message: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userId = parseInt(session.userId);

    const body = await req.json();
    const {
      id,
      cruiseName,
      companion,
      destination,
      startDate,
      endDate,
      impressions,
    } = body || {};

    if (!id) {
      return NextResponse.json(
        { ok: false, message: '여행 기록 ID가 필요합니다' },
        { status: 400 }
      );
    }
    
    // 크루즈 이름과 목적지가 없으면 기본값 설정 (수정 시에도)
    const finalCruiseName = cruiseName !== undefined 
      ? (cruiseName && typeof cruiseName === 'string' && cruiseName.trim() ? cruiseName.trim() : '기록된 여행')
      : undefined;
    const finalDestination = destination !== undefined
      ? (destination && typeof destination === 'string' && destination.trim() ? destination.trim() : '기록')
      : undefined;

    // 여행 기록 소유권 확인
    const existing = await prisma.mapTravelRecord.findFirst({
      where: {
        id: parseInt(String(id)),
        userId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, message: '여행 기록을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 업데이트할 데이터 구성
    const updateData: any = {
      updatedAt: new Date(), // updatedAt 항상 업데이트
    };
    if (cruiseName !== undefined) updateData.cruiseName = finalCruiseName;
    if (companion !== undefined) updateData.companion = (companion && typeof companion === 'string' && companion.trim()) ? companion.trim() : '기록';
    if (destination !== undefined) updateData.destination = finalDestination;
    
    let startDateTime: Date | undefined;
    let endDateTime: Date | undefined;
    
    if (startDate !== undefined) {
      startDateTime = new Date(startDate);
      if (isNaN(startDateTime.getTime())) {
        return NextResponse.json(
          { ok: false, message: '시작일 형식이 올바르지 않습니다' },
          { status: 400 }
        );
      }
      updateData.startDate = startDateTime;
    }
    
    if (endDate !== undefined) {
      endDateTime = new Date(endDate);
      if (isNaN(endDateTime.getTime())) {
        return NextResponse.json(
          { ok: false, message: '종료일 형식이 올바르지 않습니다' },
          { status: 400 }
        );
      }
      updateData.endDate = endDateTime;
    }
    
    // 날짜 유효성 검사 (둘 다 업데이트되는 경우 또는 기존 날짜와 비교)
    if (startDateTime && endDateTime && startDateTime > endDateTime) {
      return NextResponse.json(
        { ok: false, message: '시작일이 종료일보다 늦을 수 없습니다' },
        { status: 400 }
      );
    }
    if (startDateTime && !endDateTime && existing.endDate && startDateTime > existing.endDate) {
      return NextResponse.json(
        { ok: false, message: '시작일이 종료일보다 늦을 수 없습니다' },
        { status: 400 }
      );
    }
    if (endDateTime && !startDateTime && existing.startDate && existing.startDate > endDateTime) {
      return NextResponse.json(
        { ok: false, message: '시작일이 종료일보다 늦을 수 없습니다' },
        { status: 400 }
      );
    }
    
    if (impressions !== undefined) {
      updateData.impressions = (impressions && typeof impressions === 'string' && impressions.trim()) ? impressions.trim() : null;
    }

    // 여행 기록 수정
    const record = await prisma.mapTravelRecord.update({
      where: { id: parseInt(String(id)) },
      data: updateData,
      select: {
        id: true,
        cruiseName: true,
        companion: true,
        destination: true,
        startDate: true,
        endDate: true,
        impressions: true,
        createdAt: true,
      },
    });

    // Trip 형식으로 변환하여 반환
    const formattedTrip = {
      id: record.id,
      cruiseName: record.cruiseName || '',
      companion: record.companion || '가족',
      destination: record.destination || '',
      startDate: record.startDate ? record.startDate.toISOString().split('T')[0] : '',
      endDate: record.endDate ? record.endDate.toISOString().split('T')[0] : '',
      impressions: record.impressions || '',
      createdAt: record.createdAt ? record.createdAt.toISOString() : new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, trip: formattedTrip });
  } catch (error: any) {
    console.error('MapTravelRecords PUT error:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// DELETE: 지도 페이지 여행 기록 삭제
export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, message: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userId = parseInt(session.userId);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { ok: false, message: '여행 기록 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 여행 기록 소유권 확인
    const existing = await prisma.mapTravelRecord.findFirst({
      where: {
        id: parseInt(id),
        userId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, message: '여행 기록을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 여행 기록 삭제
    await prisma.mapTravelRecord.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ ok: true, message: '여행 기록이 삭제되었습니다' });
  } catch (error) {
    console.error('MapTravelRecords DELETE error:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
