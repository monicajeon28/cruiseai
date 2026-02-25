export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { uploadFileToDrive, findOrCreateFolder } from '@/lib/google-drive';
import { getDriveFolderId } from '@/lib/config/drive-config';
import { appendStatementRecord, StatementRecord } from '@/lib/affiliate/statement-spreadsheet';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const settlementId = formData.get('settlementId') as string | null;
    const profileId = formData.get('profileId') as string | null;
    const displayName = formData.get('displayName') as string | null;
    const periodStart = formData.get('periodStart') as string | null;
    const periodEnd = formData.get('periodEnd') as string | null;

    // 추가 정보 (스프레드시트 기록용)
    const affiliateCode = formData.get('affiliateCode') as string | null;
    const type = formData.get('type') as string | null;
    const salesCount = formData.get('salesCount') as string | null;
    const totalSaleAmount = formData.get('totalSaleAmount') as string | null;
    const salesCommission = formData.get('salesCommission') as string | null;
    const branchCommission = formData.get('branchCommission') as string | null;
    const overrideCommission = formData.get('overrideCommission') as string | null;
    const grossAmount = formData.get('grossAmount') as string | null;
    const withholdingRate = formData.get('withholdingRate') as string | null;
    const withholdingAmount = formData.get('withholdingAmount') as string | null;
    const netAmount = formData.get('netAmount') as string | null;
    const bankName = formData.get('bankName') as string | null;
    const bankAccount = formData.get('bankAccount') as string | null;
    const bankAccountHolder = formData.get('bankAccountHolder') as string | null;

    if (!file || !settlementId || !profileId) {
      return NextResponse.json({ ok: false, message: '필수 파라미터가 없습니다.' }, { status: 400 });
    }

    // profileId 유효성 검증
    const targetProfileId = parseInt(profileId, 10);
    if (isNaN(targetProfileId) || targetProfileId <= 0) {
      return NextResponse.json({ ok: false, message: '잘못된 프로필 ID입니다.' }, { status: 400 });
    }

    // 관리자 또는 본인/관리자 확인 (대리점장의 팀원 포함)
    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });
    const isAdmin = dbUser?.role === 'admin';

    if (!isAdmin) {
      // 본인 프로필 확인
      const partnerProfile = await prisma.affiliateProfile.findFirst({
        where: { userId: sessionUser.id, status: 'ACTIVE' },
        select: { id: true, type: true },
      });

      if (!partnerProfile) {
        return NextResponse.json({ ok: false, message: '파트너 프로필이 없습니다.' }, { status: 403 });
      }

      // 본인인 경우 허용
      if (partnerProfile.id === targetProfileId) {
        // 본인 명세서 접근 허용
      }
      // 대리점장인 경우 팀원 확인
      else if (partnerProfile.type === 'BRANCH_MANAGER') {
        const isTeamMember = await prisma.affiliateRelation.findFirst({
          where: {
            managerId: partnerProfile.id,
            agentId: targetProfileId,
            status: 'ACTIVE',
          },
        });
        if (!isTeamMember) {
          return NextResponse.json({ ok: false, message: '팀원이 아닙니다.' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
      }
    }

    // 파일을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 월 폴더명 생성 (YYYY-MM 형식)
    const periodDate = periodStart ? new Date(periodStart) : new Date();
    const monthFolder = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, '0')}`;

    // 파일명 생성: 월_이름_정산날짜.png
    const settlementDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const safeName = (displayName || `profile_${profileId}`).replace(/[/\\?%*:|"<>]/g, '_');
    const fileName = `${monthFolder}_${safeName}_${settlementDate}.png`;

    // Google Drive 백업 폴더 ID 가져오기
    const settlementsFolderId = await getDriveFolderId('SETTLEMENTS_BACKUP');

    // 월별 서브폴더 생성/찾기
    const monthFolderResult = await findOrCreateFolder(monthFolder, settlementsFolderId);
    if (!monthFolderResult.ok || !monthFolderResult.folderId) {
      throw new Error(`월별 폴더 생성 실패: ${monthFolderResult.error}`);
    }

    // PNG 파일 업로드
    const uploadResult = await uploadFileToDrive({
      folderId: monthFolderResult.folderId,
      fileName,
      mimeType: 'image/png',
      buffer,
      makePublic: false,
    });

    if (!uploadResult.ok) {
      throw new Error(`Google Drive 업로드 실패: ${uploadResult.error}`);
    }

    console.log(`[Statements Backup] Uploaded: ${fileName} to folder ${monthFolder}`);

    // Google Sheets에 기록 추가
    const record: StatementRecord = {
      recordDate: new Date().toISOString(),
      settlementId: parseInt(settlementId, 10),
      periodStart: periodStart || '',
      periodEnd: periodEnd || periodStart || '',
      profileId: parseInt(profileId, 10),
      affiliateCode: affiliateCode,
      displayName: displayName,
      type: type || 'SALES_AGENT',
      salesCount: salesCount ? parseInt(salesCount, 10) : 0,
      totalSaleAmount: totalSaleAmount ? parseInt(totalSaleAmount, 10) : 0,
      salesCommission: salesCommission ? parseInt(salesCommission, 10) : 0,
      branchCommission: branchCommission ? parseInt(branchCommission, 10) : 0,
      overrideCommission: overrideCommission ? parseInt(overrideCommission, 10) : 0,
      grossAmount: grossAmount ? parseInt(grossAmount, 10) : 0,
      withholdingRate: withholdingRate ? parseFloat(withholdingRate) : 3.3,
      withholdingAmount: withholdingAmount ? parseInt(withholdingAmount, 10) : 0,
      netAmount: netAmount ? parseInt(netAmount, 10) : 0,
      bankName: bankName,
      bankAccount: bankAccount,
      bankAccountHolder: bankAccountHolder,
      pngFileId: uploadResult.fileId || null,
      pngFileUrl: uploadResult.url || null,
      status: 'EXPORTED',
    };

    const sheetResult = await appendStatementRecord(record);
    if (!sheetResult.ok) {
      console.warn(`[Statements Backup] Spreadsheet record failed: ${sheetResult.error}`);
    } else {
      console.log(`[Statements Backup] Spreadsheet record added: ${displayName}`);
    }

    return NextResponse.json({
      ok: true,
      message: '지급명세서가 Google Drive에 백업되고 기록되었습니다.',
      fileId: uploadResult.fileId,
      url: uploadResult.url,
      fileName,
      spreadsheetRecorded: sheetResult.ok,
    });
  } catch (error: any) {
    console.error('[Statements Backup] Error:', error);
    return NextResponse.json(
      { ok: false, message: '백업 실패', error: error?.message },
      { status: 500 }
    );
  }
}
