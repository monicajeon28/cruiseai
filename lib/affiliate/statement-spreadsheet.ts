// lib/affiliate/statement-spreadsheet.ts
// 지급명세서 Google Sheets 백업 유틸리티

import { google } from 'googleapis';
import { getGoogleAuth } from '@/lib/google-drive';

const SPREADSHEET_ID = '1gt4J8qKGK6XpPVQa8u2skeUKKwIfvDMav1PO4c4oehQ';

function getSheetsClient() {
  const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);
  return google.sheets({ version: 'v4', auth });
}

export type StatementRecord = {
  // 기본 정보
  recordDate: string; // 기록 일시
  settlementId: number;
  periodStart: string; // 정산 기간 시작
  periodEnd: string; // 정산 기간 종료
  // 수령인 정보
  profileId: number;
  affiliateCode: string | null;
  displayName: string | null;
  type: string; // BRANCH_MANAGER / SALES_AGENT
  // 판매 정보
  salesCount: number;
  totalSaleAmount: number;
  // 수당 정보
  salesCommission: number;
  branchCommission: number;
  overrideCommission: number;
  grossAmount: number;
  withholdingRate: number;
  withholdingAmount: number;
  netAmount: number;
  // 계좌 정보
  bankName: string | null;
  bankAccount: string | null;
  bankAccountHolder: string | null;
  // PNG 파일 정보
  pngFileId: string | null;
  pngFileUrl: string | null;
  // 상태
  status: string; // EXPORTED, PAID 등
};

/**
 * 지급명세서 기록을 Google Sheets에 추가
 */
export async function appendStatementRecord(record: StatementRecord): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const sheets = getSheetsClient();

    // 행 데이터 구성 (스프레드시트 컬럼 순서에 맞춤)
    const row = [
      record.recordDate, // A: 기록일시
      record.settlementId, // B: 정산ID
      record.periodStart, // C: 정산시작
      record.periodEnd, // D: 정산종료
      record.profileId, // E: 프로필ID
      record.affiliateCode || '', // F: 파트너코드
      record.displayName || '', // G: 이름
      record.type === 'BRANCH_MANAGER' ? '대리점장' : '판매원', // H: 구분
      record.salesCount, // I: 판매건수
      record.totalSaleAmount, // J: 총판매금액
      record.salesCommission, // K: 판매수당
      record.branchCommission, // L: 대리점수당
      record.overrideCommission, // M: 오버라이딩
      record.grossAmount, // N: 총수당
      record.withholdingRate, // O: 원천징수율
      record.withholdingAmount, // P: 원천징수액
      record.netAmount, // Q: 실지급액
      record.bankName || '', // R: 은행명
      record.bankAccount || '', // S: 계좌번호
      record.bankAccountHolder || '', // T: 예금주
      record.pngFileUrl || '', // U: PNG파일링크
      record.status, // V: 상태
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: '지급명세서!A:V', // 시트 이름이 '지급명세서'인 경우
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });

    console.log(`[StatementSpreadsheet] Record appended: ${record.displayName} - ${record.periodStart}`);
    return { ok: true };
  } catch (error: any) {
    console.error('[StatementSpreadsheet] Error appending record:', error);
    return { ok: false, error: error?.message || '스프레드시트 기록 실패' };
  }
}

/**
 * 스프레드시트에 헤더 행 설정 (최초 1회)
 */
export async function initializeSpreadsheetHeaders(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const sheets = getSheetsClient();

    const headers = [
      '기록일시', // A
      '정산ID', // B
      '정산시작', // C
      '정산종료', // D
      '프로필ID', // E
      '파트너코드', // F
      '이름', // G
      '구분', // H
      '판매건수', // I
      '총판매금액', // J
      '판매수당', // K
      '대리점수당', // L
      '오버라이딩', // M
      '총수당', // N
      '원천징수율(%)', // O
      '원천징수액', // P
      '실지급액', // Q
      '은행명', // R
      '계좌번호', // S
      '예금주', // T
      'PNG파일링크', // U
      '상태', // V
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: '지급명세서!A1:V1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });

    console.log('[StatementSpreadsheet] Headers initialized');
    return { ok: true };
  } catch (error: any) {
    console.error('[StatementSpreadsheet] Error initializing headers:', error);
    return { ok: false, error: error?.message || '헤더 설정 실패' };
  }
}
