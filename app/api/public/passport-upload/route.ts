export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET: 여권 업로드 페이지로 리다이렉트
 * 파트너가 고객에게 보낸 링크를 통해 접근
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get('leadId');
    const partnerId = searchParams.get('partnerId');

    if (!leadId) {
      return NextResponse.json(
        { ok: false, error: '고객 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 고객 정보 확인
    const lead = await prisma.affiliateLead.findUnique({
      where: { id: Number(leadId) },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
      },
    });

    if (!lead) {
      return NextResponse.json(
        { ok: false, error: '고객을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 여권 업로드 페이지로 리다이렉트 (토큰 기반)
    // 임시 토큰 생성 (실제로는 더 안전한 토큰 생성 필요)
    const token = Buffer.from(`${leadId}-${Date.now()}`).toString('base64url');
    
    // 토큰을 데이터베이스에 저장 (선택사항)
    // 여기서는 간단하게 리다이렉트만 수행
    
    const redirectUrl = `/passport/${token}?leadId=${leadId}${partnerId ? `&partnerId=${partnerId}` : ''}`;
    
    return NextResponse.redirect(new URL(redirectUrl, req.url));
  } catch (error) {
    console.error('[Public Passport Upload] GET error:', error);
    return NextResponse.json(
      { ok: false, error: '여권 업로드 페이지로 이동할 수 없습니다.' },
      { status: 500 }
    );
  }
}
