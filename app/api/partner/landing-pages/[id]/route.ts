export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { requirePartnerContext } from '@/app/api/partner/_utils';

// GET: 대리점장의 랜딩페이지 상세 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const { profile } = await requirePartnerContext();
    
    // 대리점장만 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, error: '대리점장만 접근 가능합니다' }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const pageId = parseInt(resolvedParams.id);

    const landingPage = await prisma.landingPage.findFirst({
      where: {
        id: pageId,
        adminId: user.id, // 대리점장이 생성한 랜딩페이지만
      },
      include: {
        CustomerGroup: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!landingPage) {
      return NextResponse.json({ ok: false, error: '랜딩페이지를 찾을 수 없습니다' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      landingPage,
    });
  } catch (error: any) {
    console.error('[Partner Landing Pages] GET error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: '랜딩페이지를 불러오는 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    );
  }
}

// PUT: 대리점장의 랜딩페이지 수정
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const { profile } = await requirePartnerContext();
    
    // 대리점장만 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, error: '대리점장만 접근 가능합니다' }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const pageId = parseInt(resolvedParams.id);

    // 랜딩페이지 소유권 확인
    const existingPage = await prisma.landingPage.findFirst({
      where: {
        id: pageId,
        adminId: user.id, // 대리점장이 생성한 랜딩페이지만
      },
    });

    if (!existingPage) {
      return NextResponse.json({ ok: false, error: '랜딩페이지를 찾을 수 없거나 수정 권한이 없습니다' }, { status: 404 });
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError: any) {
      console.error('[Partner Landing Pages] JSON parse error:', parseError);
      return NextResponse.json(
        { ok: false, error: '요청 데이터를 파싱할 수 없습니다.' },
        { status: 400 }
      );
    }

    const {
      title,
      exposureTitle,
      category,
      pageGroup,
      description,
      htmlContent,
      headerScript,
      businessInfo,
      exposureImage,
      attachmentFile,
      groupId,
      additionalGroupId,
      checkDuplicateGroup,
      inputLimit,
      completionPageUrl,
      buttonTitle,
      commentEnabled,
      infoCollection,
      scheduledMessageId,
      isPublic,
      marketingAccountId,
      marketingFunnelId,
      funnelOrder,
    } = body;

    // businessInfo에서 commentSettings 추출
    let commentSettings = null;
    if (businessInfo && typeof businessInfo === 'object' && 'commentSettings' in businessInfo) {
      commentSettings = businessInfo.commentSettings;
    }

    if (!title || !htmlContent) {
      return NextResponse.json(
        { ok: false, error: '제목과 HTML 내용은 필수입니다' },
        { status: 400 }
      );
    }

    // businessInfo를 JSON으로 변환
    let businessInfoJson = null;
    if (businessInfo) {
      if (typeof businessInfo === 'string') {
        try {
          businessInfoJson = JSON.parse(businessInfo);
        } catch {
          businessInfoJson = businessInfo;
        }
      } else {
        businessInfoJson = businessInfo;
      }
    }

    const landingPage = await prisma.landingPage.update({
      where: { id: pageId },
      data: {
        title,
        exposureTitle: exposureTitle || null,
        category: category || null,
        pageGroup: pageGroup || null,
        description: description || null,
        htmlContent,
        headerScript: headerScript || null,
        businessInfo: businessInfoJson,
        exposureImage: exposureImage || null,
        attachmentFile: attachmentFile || null,
        isPublic: isPublic !== undefined ? isPublic : existingPage.isPublic,
        marketingAccountId: marketingAccountId ? parseInt(String(marketingAccountId)) : null,
        marketingFunnelId: marketingFunnelId ? parseInt(String(marketingFunnelId)) : null,
        funnelOrder: funnelOrder ? parseInt(String(funnelOrder)) : null,
        groupId: groupId ? parseInt(String(groupId)) : null,
        additionalGroupId: additionalGroupId ? parseInt(String(additionalGroupId)) : null,
        checkDuplicateGroup: checkDuplicateGroup || false,
        inputLimit: inputLimit || '무제한 허용',
        completionPageUrl: completionPageUrl || null,
        buttonTitle: buttonTitle || '신청하기',
        commentEnabled: commentEnabled || false,
        infoCollection: infoCollection || false,
        scheduledMessageId: scheduledMessageId ? parseInt(String(scheduledMessageId)) : null,
        updatedAt: new Date(),
      },
      include: {
        CustomerGroup: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      landingPage,
    });
  } catch (error: any) {
    console.error('[Partner Landing Pages] PUT error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: '랜딩페이지 수정 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    );
  }
}

// DELETE: 대리점장의 랜딩페이지 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const { profile } = await requirePartnerContext();
    
    // 대리점장만 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, error: '대리점장만 접근 가능합니다' }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const pageId = parseInt(resolvedParams.id);

    // 랜딩페이지 소유권 확인
    const existingPage = await prisma.landingPage.findFirst({
      where: {
        id: pageId,
        adminId: user.id, // 대리점장이 생성한 랜딩페이지만
      },
    });

    if (!existingPage) {
      return NextResponse.json({ ok: false, error: '랜딩페이지를 찾을 수 없거나 삭제 권한이 없습니다' }, { status: 404 });
    }

    await prisma.landingPage.delete({
      where: { id: pageId },
    });

    return NextResponse.json({
      ok: true,
      message: '랜딩페이지가 삭제되었습니다.',
    });
  } catch (error: any) {
    console.error('[Partner Landing Pages] DELETE error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: '랜딩페이지 삭제 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    );
  }
}
