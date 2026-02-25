export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { appendSystemConsultationNoteToSheet } from '@/lib/google/b2b-backup';
import {
  PartnerApiError,
  requirePartnerContext,
} from '@/app/api/partner/_utils';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET: 시스템 상담 문의의 상담기록 조회 (파트너용)
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const resolvedParams = await context.params;
    const consultationId = parseInt(resolvedParams.id);

    if (isNaN(consultationId)) {
      return NextResponse.json({ ok: false, message: '유효한 ID가 필요합니다.' }, { status: 400 });
    }

    // 파트너 프로필 조회
    const profile = await prisma.affiliateProfile.findFirst({
      where: { userId: sessionUser.id, status: 'ACTIVE' },
      select: { id: true, type: true, displayName: true },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, message: '파트너 권한이 없습니다.' }, { status: 403 });
    }

    // 시스템 상담 문의 확인 (파트너에게 배정된 것만)
    const whereClause: any = { id: consultationId };
    if (profile.type === 'BRANCH_MANAGER') {
      whereClause.managerId = profile.id;
    } else if (profile.type === 'SALES_AGENT') {
      whereClause.agentId = profile.id;
    }

    const consultation = await prisma.systemConsultation.findFirst({
      where: whereClause,
    });

    if (!consultation) {
      return NextResponse.json({ ok: false, message: '상담 문의를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 상담기록 조회
    const notes = await prisma.systemConsultationNote.findMany({
      where: { consultationId },
      orderBy: [{ consultedAt: 'desc' }, { id: 'desc' }],
    });

    // 프로필 정보 조회
    const profileIds = notes
      .map((n) => n.createdByProfileId)
      .filter((id): id is number => id !== null);

    const profiles = profileIds.length > 0
      ? await prisma.affiliateProfile.findMany({
          where: { id: { in: profileIds } },
          select: { id: true, displayName: true, type: true },
        })
      : [];
    const profileMap = new Map<number, { id: number; displayName: string | null; type: string }>(
      profiles.map((p) => [p.id, p])
    );

    const consultationNotes = notes.map((note) => {
      const noteProfile = note.createdByProfileId ? profileMap.get(note.createdByProfileId) : null;

      let createdByLabel = note.createdByType || '본사';
      if (note.createdByType === 'BRANCH_MANAGER') createdByLabel = '대리점장';
      else if (note.createdByType === 'SALES_AGENT') createdByLabel = '판매원';
      else if (note.createdByType === 'ADMIN') createdByLabel = '본사';

      return {
        id: note.id,
        content: note.content,
        consultedAt: note.consultedAt?.toISOString() || note.createdAt.toISOString(),
        nextActionDate: note.nextActionDate?.toISOString() || null,
        nextActionNote: note.nextActionNote,
        statusAfter: note.statusAfter,
        audioFileUrl: note.audioFileUrl,
        createdByName: note.createdByName || noteProfile?.displayName || '관리자',
        createdByLabel,
        createdAt: note.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      ok: true,
      consultationNotes,
    });
  } catch (error) {
    console.error('[Partner System Inquiry Consultations] GET Error:', error);
    return NextResponse.json({ ok: false, message: '상담기록 조회에 실패했습니다.' }, { status: 500 });
  }
}

// POST: 시스템 상담 문의에 상담기록 추가 (파트너용)
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const resolvedParams = await context.params;
    const consultationId = parseInt(resolvedParams.id);

    if (isNaN(consultationId)) {
      return NextResponse.json({ ok: false, message: '유효한 ID가 필요합니다.' }, { status: 400 });
    }

    // 파트너 프로필 조회
    const profile = await prisma.affiliateProfile.findFirst({
      where: { userId: sessionUser.id, status: 'ACTIVE' },
      select: { id: true, type: true, displayName: true },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, message: '파트너 권한이 없습니다.' }, { status: 403 });
    }

    // 시스템 상담 문의 확인 (파트너에게 배정된 것만)
    const whereClause: any = { id: consultationId };
    if (profile.type === 'BRANCH_MANAGER') {
      whereClause.managerId = profile.id;
    } else if (profile.type === 'SALES_AGENT') {
      whereClause.agentId = profile.id;
    }

    const consultation = await prisma.systemConsultation.findFirst({
      where: whereClause,
    });

    if (!consultation) {
      return NextResponse.json({ ok: false, message: '상담 문의를 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    const body = await req.json();
    const {
      content,
      consultedAt,
      nextActionDate,
      nextActionNote,
      statusAfter,
      audioFileUrl,
    } = body;

    if (!content?.trim()) {
      return NextResponse.json({ ok: false, message: '상담 내용을 입력해주세요.' }, { status: 400 });
    }

    const consultedAtDate = consultedAt ? new Date(consultedAt) : new Date();
    const consultantName = profile.displayName || sessionUser.name || '파트너';
    const consultantType = profile.type || 'SALES_AGENT';

    // 상담기록 저장
    const createdNote = await prisma.systemConsultationNote.create({
      data: {
        consultationId,
        content: content.trim(),
        consultedAt: consultedAtDate,
        audioFileUrl: audioFileUrl || null,
        createdByName: consultantName,
        createdByType: consultantType,
        createdByProfileId: profile.id,
        nextActionDate: nextActionDate ? new Date(nextActionDate) : null,
        nextActionNote: nextActionNote || null,
        statusAfter: statusAfter || null,
        updatedAt: new Date(),
      },
    });

    // 상태 변경이 있으면 SystemConsultation 상태도 업데이트
    if (statusAfter) {
      await prisma.systemConsultation.update({
        where: { id: consultationId },
        data: {
          status: statusAfter,
          updatedAt: new Date(),
        },
      });
    }

    const createdAtStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const consultedAtStr = consultedAtDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

    // Google 스프레드시트 백업 (동기 대기 - Vercel 서버리스 환경 필수)
    try {
      console.log('[Partner System Inquiry Consultations] 스프레드시트 백업 시작...');
      const backupResult = await appendSystemConsultationNoteToSheet({
        noteId: createdNote.id,
        consultationId,
        customerName: consultation.name,
        customerPhone: consultation.phone,
        partnerName: consultantName,
        consultedAt: consultedAtStr,
        content: content.trim(),
        consultantName,
        consultantType:
          consultantType === 'BRANCH_MANAGER' ? '대리점장' :
          consultantType === 'SALES_AGENT' ? '판매원' : '본사',
        nextActionDate: nextActionDate || null,
        nextActionNote: nextActionNote || null,
        statusAfter: statusAfter || null,
        audioFileUrl: audioFileUrl || null,
        createdAt: createdAtStr,
      });
      console.log('[Partner System Inquiry Consultations] 스프레드시트 백업 완료:', backupResult);
    } catch (backupErr: any) {
      console.error('[Partner System Inquiry Consultations] 스프레드시트 백업 실패:', backupErr?.message || backupErr);
    }

    return NextResponse.json({
      ok: true,
      message: '상담기록이 저장되었습니다.',
      consultation: {
        id: createdNote.id,
        content: createdNote.content,
        consultedAt: createdNote.consultedAt?.toISOString() || createdNote.createdAt.toISOString(),
        createdByName: consultantName,
        createdByLabel:
          consultantType === 'BRANCH_MANAGER' ? '대리점장' :
          consultantType === 'SALES_AGENT' ? '판매원' : '본사',
      },
    });
  } catch (error) {
    console.error('[Partner System Inquiry Consultations] POST Error:', error);
    return NextResponse.json({ ok: false, message: '상담기록 저장에 실패했습니다.' }, { status: 500 });
  }
}

/**
 * 파트너용 시스템 상담 문의의 상담기록 삭제 API
 * DELETE /api/partner/system-inquiries/[id]/consultations?noteId=123
 *
 * - 판매원: 본인이 작성한 상담기록만 삭제 가능
 * - 대리점장: 본인 + 산하 판매원이 작성한 상담기록 삭제 가능
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { profile, sessionUser } = await requirePartnerContext();
    const resolvedParams = await context.params;
    const consultationId = parseInt(resolvedParams.id);

    if (isNaN(consultationId)) {
      throw new PartnerApiError('유효한 ID가 필요합니다.', 400);
    }

    // URL 파라미터에서 삭제할 상담기록 ID 추출
    const url = new URL(req.url);
    const noteId = url.searchParams.get('noteId');

    if (!noteId) {
      throw new PartnerApiError('삭제할 상담기록 ID가 필요합니다.', 400);
    }

    const numericNoteId = parseInt(noteId);
    if (isNaN(numericNoteId)) {
      throw new PartnerApiError('유효하지 않은 상담기록 ID입니다.', 400);
    }

    // 시스템 상담 권한 확인
    const consultation = await prisma.systemConsultation.findUnique({
      where: { id: consultationId },
      select: { id: true, managerId: true, agentId: true },
    });

    if (!consultation) {
      throw new PartnerApiError('상담 문의를 찾을 수 없습니다.', 404);
    }

    // 대리점장 또는 해당 담당자만 접근 가능
    const hasAccess = profile.type === 'BRANCH_MANAGER' ||
      consultation.managerId === profile.id ||
      consultation.agentId === profile.id;

    if (!hasAccess) {
      throw new PartnerApiError('이 상담에 접근할 권한이 없습니다.', 403);
    }

    // 상담기록 확인
    const note = await prisma.systemConsultationNote.findUnique({
      where: { id: numericNoteId },
      select: { id: true, consultationId: true, createdByProfileId: true },
    });

    if (!note) {
      throw new PartnerApiError('상담기록을 찾을 수 없습니다.', 404);
    }

    // 해당 시스템 상담에 속한 기록인지 확인
    if (note.consultationId !== consultationId) {
      throw new PartnerApiError('해당 상담의 기록이 아닙니다.', 400);
    }

    // 권한 확인: 본인이 작성했거나 대리점장인 경우만 삭제 가능
    const canDelete = note.createdByProfileId === profile.id ||
      profile.type === 'BRANCH_MANAGER';

    if (!canDelete) {
      throw new PartnerApiError('이 상담기록을 삭제할 권한이 없습니다.', 403);
    }

    // 상담기록 삭제
    await prisma.systemConsultationNote.delete({
      where: { id: numericNoteId },
    });

    return NextResponse.json({
      ok: true,
      message: '상담기록이 삭제되었습니다.',
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error('[Partner System Inquiry Consultations] DELETE Error:', error);
    return NextResponse.json({ ok: false, message: '상담기록 삭제에 실패했습니다.' }, { status: 500 });
  }
}
