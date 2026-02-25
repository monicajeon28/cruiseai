export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { appendSalesRecords, SalesRecord } from '@/lib/affiliate/sales-spreadsheet';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await req.json();
    const { month } = body; // optional: YYYY-MM 형식

    // 파트너 프로필 조회
    const profile = await prisma.affiliateProfile.findFirst({
      where: { userId: sessionUser.id },
      select: {
        id: true,
        affiliateCode: true,
        displayName: true,
        nickname: true,
        type: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, message: '파트너 프로필을 찾을 수 없습니다.' }, { status: 403 });
    }

    // 판매 목록 조회
    const whereClause: any = {
      OR: [
        { managerId: profile.id },
        { agentId: profile.id },
      ],
    };

    // 월별 필터링
    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
      whereClause.saleDate = {
        gte: startDate,
        lte: endDate,
      };
    }

    const sales = await prisma.affiliateSale.findMany({
      where: whereClause,
      orderBy: { saleDate: 'desc' },
      take: 500, // 최대 500건
    });

    if (sales.length === 0) {
      return NextResponse.json({
        ok: true,
        message: '백업할 판매 목록이 없습니다.',
        count: 0,
      });
    }

    // 스프레드시트에 기록할 데이터 변환
    const records: SalesRecord[] = sales.map((sale) => ({
      recordDate: new Date().toISOString(),
      saleId: sale.id,
      profileId: profile.id,
      affiliateCode: profile.affiliateCode,
      displayName: profile.displayName || profile.nickname,
      type: profile.type,
      productCode: sale.productCode,
      saleAmount: sale.saleAmount,
      saleDate: sale.saleDate?.toISOString() || null,
      status: sale.status,
      submittedAt: sale.submittedAt?.toISOString() || null,
      approvedAt: sale.approvedAt?.toISOString() || null,
    }));

    // Google Sheets에 백업
    const result = await appendSalesRecords(records);

    if (!result.ok) {
      throw new Error(result.error || '스프레드시트 백업 실패');
    }

    console.log(`[Sales Backup] ${result.count} records backed up for profile ${profile.id}`);

    return NextResponse.json({
      ok: true,
      message: `${result.count}건의 판매 목록이 백업되었습니다.`,
      count: result.count,
    });
  } catch (error: any) {
    console.error('[Sales Backup] Error:', error);
    return NextResponse.json(
      { ok: false, message: '백업 실패', error: error?.message },
      { status: 500 }
    );
  }
}
