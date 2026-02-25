export const dynamic = 'force-dynamic';

// app/api/partner/landing-pages/[id]/comments/[commentId]/route.ts
// 대리점장용 랜딩페이지 댓글 삭제 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { requirePartnerContext } from '@/app/api/partner/_utils';

/**
 * DELETE: 댓글 삭제 (대리점장만 가능)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> | { id: string; commentId: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { profile } = await requirePartnerContext();
    
    // 대리점장만 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json(
        { ok: false, error: '대리점장만 접근 가능합니다.' },
        { status: 403 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const landingPageId = parseInt(resolvedParams.id);
    const commentId = parseInt(resolvedParams.commentId);

    if (isNaN(landingPageId) || isNaN(commentId)) {
      return NextResponse.json(
        { ok: false, error: '잘못된 ID입니다.' },
        { status: 400 }
      );
    }

    // 랜딩페이지 소유권 확인
    const landingPage = await prisma.landingPage.findFirst({
      where: {
        id: landingPageId,
        adminId: user.id, // 대리점장이 생성한 랜딩페이지만
      },
    });

    if (!landingPage) {
      return NextResponse.json(
        { ok: false, error: '랜딩페이지를 찾을 수 없거나 권한이 없습니다.' },
        { status: 404 }
      );
    }

    // 댓글 조회
    const comment = await prisma.landingPageComment.findFirst({
      where: {
        id: commentId,
        landingPageId: landingPageId,
      },
    });

    if (!comment) {
      return NextResponse.json(
        { ok: false, error: '댓글을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 댓글 삭제
    await prisma.landingPageComment.delete({
      where: { id: commentId },
    });

    return NextResponse.json({
      ok: true,
      message: '댓글이 삭제되었습니다.',
    });
  } catch (error: any) {
    console.error('[Partner Landing Page Comment Delete] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || '댓글 삭제 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
