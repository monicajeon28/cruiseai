// ⬇️ 절대법칙: Prisma 사용 API는 반드시 nodejs runtime과 force-dynamic 필요
export const runtime = 'nodejs';        // Edge Runtime 금지 (Prisma 사용)
export const dynamic = 'force-dynamic'; // 동적 데이터는 캐시 X

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { getSession } from '@/lib/session';
import { logger } from '@/lib/logger';

// YYYY-MM-DD 형식을 KST 기준 Date로 파싱 (타임존 문제 방지)
function parseKSTDate(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error('날짜 문자열이 올바르지 않습니다');
  }
  const trimmed = dateStr.trim();
  const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) {
    throw new Error('날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식이어야 합니다');
  }
  const yearNum = parseInt(dateMatch[1], 10);
  const monthNum = parseInt(dateMatch[2], 10) - 1;
  const dayNum = parseInt(dateMatch[3], 10);
  if (yearNum < 1000 || yearNum > 9999) throw new Error('연도가 유효하지 않습니다 (1000-9999 범위)');
  if (monthNum < 0 || monthNum > 11) throw new Error('월이 유효하지 않습니다 (1-12 범위)');
  if (dayNum < 1 || dayNum > 31) throw new Error('일이 유효하지 않습니다 (1-31 범위)');
  const date = new Date(yearNum, monthNum, dayNum);
  if (date.getFullYear() !== yearNum || date.getMonth() !== monthNum || date.getDate() !== dayNum) {
    throw new Error('유효하지 않은 날짜입니다');
  }
  return date;
}

interface MapTravelRecordFormatInput {
  id: number;
  cruiseName: string;
  companion: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  impressions: string | null;
  createdAt: Date;
}

function formatMapTravelRecord(record: MapTravelRecordFormatInput) {
  return {
    id: record.id,
    cruiseName: record.cruiseName || '',
    companion: record.companion || '가족',
    destination: record.destination || '',
    startDate: record.startDate ? record.startDate.toISOString().split('T')[0] : '',
    endDate: record.endDate ? record.endDate.toISOString().split('T')[0] : '',
    impressions: record.impressions || '',
    createdAt: record.createdAt ? record.createdAt.toISOString() : new Date().toISOString(),
  };
}

// GET: 사용자의 지도 페이지 여행 기록 조회
export async function GET(_req: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, message: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userId = parseInt(session.userId, 10);
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json({ ok: false, message: '사용자 정보가 올바르지 않습니다' }, { status: 400 });
    }

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
      logger.error('[MapTravelRecords GET] Prisma 에러:', prismaError?.code);
      // 테이블이 없는 경우 빈 배열 반환
      if (prismaError.code === 'P2021' || prismaError.message?.includes('does not exist') || prismaError.message?.includes('no such table')) {
        return NextResponse.json({ ok: true, trips: [] });
      }
      throw prismaError;
    }

    // Trip 인터페이스 형식으로 변환
    const formattedTrips = records.map(formatMapTravelRecord);

    return NextResponse.json({ ok: true, trips: formattedTrips });
  } catch (error: any) {
    logger.error('[MapTravelRecords GET] 에러 발생:', error?.code);

    // Prisma 에러인 경우
    if (error?.code === 'P2021' || error?.message?.includes('does not exist') || error?.message?.includes('no such table')) {
      return NextResponse.json({ ok: true, trips: [] }); // 테이블이 없으면 빈 배열 반환
    }

    return NextResponse.json(
      { ok: false, message: '여행 기록 조회 중 오류가 발생했습니다' },
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

    const userId = parseInt(session.userId, 10);
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json({ ok: false, message: '사용자 정보가 올바르지 않습니다' }, { status: 400 });
    }

    try {
      body = await req.json();
    } catch (parseError) {
      logger.error('[MapTravelRecords POST] JSON 파싱 에러');
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
      return NextResponse.json(
        { ok: false, message: '여행 시작일과 종료일은 필수 입력 항목입니다' },
        { status: 400 }
      );
    }

    // 날짜 타입 및 형식 검증
    if (typeof startDate !== 'string' || typeof endDate !== 'string') {
      return NextResponse.json(
        { ok: false, message: '날짜는 문자열 형식이어야 합니다' },
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

    // 날짜 문자열을 DateTime으로 변환 (KST 기준)
    let startDateTime: Date;
    let endDateTime: Date;

    try {
      startDateTime = parseKSTDate(cleanStartDate);
      endDateTime = parseKSTDate(cleanEndDate);
    } catch (dateError: any) {
      logger.error('[MapTravelRecords POST] 날짜 파싱 에러');
      return NextResponse.json(
        {
          ok: false,
          message: '날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요',
        },
        { status: 400 }
      );
    }

    // 여행 기록 생성
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
          updatedAt: now,
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
    } catch (prismaError: any) {
      logger.error('[MapTravelRecords POST] Prisma 에러:', prismaError?.code);

      // 테이블이 없는 경우
      if (prismaError.code === 'P2021' || prismaError.message?.includes('does not exist') || prismaError.message?.includes('no such table')) {
        return NextResponse.json(
          { ok: false, message: '데이터베이스 테이블이 존재하지 않습니다. 관리자에게 문의하세요.' },
          { status: 503 }
        );
      }

      throw prismaError; // 다른 에러는 다시 throw
    }

    return NextResponse.json({ ok: true, trip: formatMapTravelRecord(record) });
  } catch (error: any) {
    logger.error('[MapTravelRecords POST] 에러 발생:', error?.code);

    // Prisma 에러인 경우
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { ok: false, message: '이미 같은 여행 기록이 존재합니다' },
        { status: 409 }
      );
    }

    if (error?.code === 'P2021' || error?.message?.includes('does not exist') || error?.message?.includes('no such table')) {
      return NextResponse.json(
        { ok: false, message: '데이터베이스 테이블이 존재하지 않습니다. 관리자에게 문의하세요.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { ok: false, message: '여행 기록 저장 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// PUT: 지도 페이지 여행 기록 수정 (원자적 소유권 검증 + 수정)
export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, message: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userId = parseInt(session.userId, 10);
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json({ ok: false, message: '사용자 정보가 올바르지 않습니다' }, { status: 400 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, message: '요청 데이터 형식이 올바르지 않습니다' }, { status: 400 });
    }
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

    // 업데이트할 데이터 구성
    type MapTravelRecordUpdateData = Pick<
      Prisma.MapTravelRecordUpdateInput,
      'cruiseName' | 'companion' | 'destination' | 'startDate' | 'endDate' | 'impressions' | 'updatedAt'
    >;
    const updateData: MapTravelRecordUpdateData = {
      updatedAt: new Date(),
    };
    if (cruiseName !== undefined && finalCruiseName !== undefined) updateData.cruiseName = finalCruiseName;
    if (companion !== undefined) updateData.companion = (companion && typeof companion === 'string' && companion.trim()) ? companion.trim() : '기록';
    if (destination !== undefined && finalDestination !== undefined) updateData.destination = finalDestination;

    if (startDate !== undefined) {
      try {
        updateData.startDate = parseKSTDate(String(startDate));
      } catch {
        return NextResponse.json(
          { ok: false, message: '시작일 형식이 올바르지 않습니다' },
          { status: 400 }
        );
      }
    }

    if (endDate !== undefined) {
      try {
        updateData.endDate = parseKSTDate(String(endDate));
      } catch {
        return NextResponse.json(
          { ok: false, message: '종료일 형식이 올바르지 않습니다' },
          { status: 400 }
        );
      }
    }

    if (impressions !== undefined) {
      updateData.impressions = (impressions && typeof impressions === 'string' && impressions.trim()) ? impressions.trim() : null;
    }

    // 원자적 소유권 검증 + 수정: $transaction으로 TOCTOU 방지
    const record = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.mapTravelRecord.findFirst({
        where: { id: parseInt(String(id), 10), userId },
      });

      if (!existing) return null;

      // 날짜 순서 검증 (기존 값과 비교)
      const resolvedStart = updateData.startDate ?? existing.startDate;
      const resolvedEnd = updateData.endDate ?? existing.endDate;
      if (resolvedStart && resolvedEnd && resolvedStart > resolvedEnd) {
        throw Object.assign(new Error('날짜_순서_오류'), { code: 'DATE_ORDER_ERROR' });
      }

      return tx.mapTravelRecord.update({
        where: { id: parseInt(String(id), 10) },
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
    });

    if (!record) {
      return NextResponse.json(
        { ok: false, message: '여행 기록을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, trip: formatMapTravelRecord(record) });
  } catch (error: any) {
    if (error?.code === 'DATE_ORDER_ERROR') {
      return NextResponse.json(
        { ok: false, message: '시작일이 종료일보다 늦을 수 없습니다' },
        { status: 400 }
      );
    }
    logger.error('[MapTravelRecords PUT] 에러 발생:', error?.code);
    return NextResponse.json(
      { ok: false, message: '여행 기록 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// DELETE: 지도 페이지 여행 기록 삭제 (원자적 소유권 검증)
export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, message: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userId = parseInt(session.userId, 10);
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json({ ok: false, message: '사용자 정보가 올바르지 않습니다' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { ok: false, message: '여행 기록 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // deleteMany: 원자적 삭제 (TOCTOU 방지) — userId 조건이 소유권 검증 포함
    const result = await prisma.mapTravelRecord.deleteMany({
      where: { id: parseInt(id, 10), userId },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { ok: false, message: '여행 기록을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, message: '여행 기록이 삭제되었습니다' });
  } catch (error: any) {
    logger.error('[MapTravelRecords DELETE] 에러 발생:', error?.code);
    return NextResponse.json(
      { ok: false, message: '여행 기록 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
