// lib/affiliate/sales-spreadsheet.ts
// 판매 목록 Google Sheets 백업 유틸리티 (월별 시트 자동 생성)

import { google, sheets_v4 } from 'googleapis';
import { getGoogleAuth } from '@/lib/google-drive';

const SPREADSHEET_ID = '14YAucoDM9Rn6Df4Fy10SUyAmhxb9Of8DTrM3fjQkPaI';

function getSheetsClient(): sheets_v4.Sheets {
  const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);
  return google.sheets({ version: 'v4', auth });
}

/**
 * 월별 시트 이름 생성 (예: 2025-12)
 */
function getMonthlySheetName(date?: Date): string {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * 시트가 존재하는지 확인하고, 없으면 생성
 */
async function ensureMonthlySheet(sheets: sheets_v4.Sheets, sheetName: string): Promise<void> {
  try {
    // 스프레드시트 메타데이터 조회
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const existingSheets = spreadsheet.data.sheets || [];
    const sheetExists = existingSheets.some(
      (sheet) => sheet.properties?.title === sheetName
    );

    if (!sheetExists) {
      // 새 시트 생성
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });

      console.log(`[SalesSpreadsheet] Created new sheet: ${sheetName}`);

      // 헤더 행 추가
      const headers = [
        '기록일시', // A
        '판매ID', // B
        '프로필ID', // C
        '파트너코드', // D
        '이름', // E
        '구분', // F
        '상품코드', // G
        '판매금액', // H
        '판매일', // I
        '상태', // J
        '제출일시', // K
        '승인일시', // L
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:L1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers],
        },
      });

      console.log(`[SalesSpreadsheet] Headers added to sheet: ${sheetName}`);
    }
  } catch (error: any) {
    console.error(`[SalesSpreadsheet] Error ensuring sheet ${sheetName}: `, error);
    throw error;
  }
}

export type SalesRecord = {
  // 기본 정보
  recordDate: string; // 기록 일시
  saleId: number;
  // 파트너 정보
  profileId: number;
  affiliateCode: string | null;
  displayName: string | null;
  type: string; // BRANCH_MANAGER / SALES_AGENT
  // 판매 정보
  productCode: string | null;
  saleAmount: number;
  saleDate: string | null;
  status: string; // PENDING, PENDING_APPROVAL, APPROVED, REJECTED, CONFIRMED
  // 타임스탬프
  submittedAt: string | null;
  approvedAt: string | null;
};

/**
 * 판매 기록을 Google Sheets에 추가 (월별 시트에 자동 저장)
 */
export async function appendSalesRecord(record: SalesRecord, month?: string): Promise<{
  ok: boolean;
  sheetName?: string;
  error?: string;
}> {
  try {
    const sheets = getSheetsClient();

    // 월별 시트 이름 결정
    const sheetName = month || getMonthlySheetName(record.saleDate ? new Date(record.saleDate) : new Date());

    // 시트가 없으면 생성
    await ensureMonthlySheet(sheets, sheetName);

    // 행 데이터 구성 (스프레드시트 컬럼 순서에 맞춤)
    const row = [
      record.recordDate, // A: 기록일시
      record.saleId, // B: 판매ID
      record.profileId, // C: 프로필ID
      record.affiliateCode || '', // D: 파트너코드
      record.displayName || '', // E: 이름
      record.type === 'BRANCH_MANAGER' ? '대리점장' : '판매원', // F: 구분
      record.productCode || '', // G: 상품코드
      record.saleAmount, // H: 판매금액
      record.saleDate || '', // I: 판매일
      formatStatus(record.status), // J: 상태
      record.submittedAt || '', // K: 제출일시
      record.approvedAt || '', // L: 승인일시
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:L`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });

    console.log(`[SalesSpreadsheet] Record appended to ${sheetName}: ${record.displayName} - ${record.productCode}`);
    return { ok: true, sheetName };
  } catch (error: any) {
    console.error('[SalesSpreadsheet] Error appending record:', error);
    return { ok: false, error: error?.message || '스프레드시트 기록 실패' };
  }
}

/**
 * 여러 판매 기록을 한 번에 Google Sheets에 추가 (월별 시트 자동 생성)
 */
export async function appendSalesRecords(records: SalesRecord[], month?: string): Promise<{
  ok: boolean;
  count: number;
  sheetName?: string;
  error?: string;
}> {
  try {
    if (records.length === 0) {
      return { ok: true, count: 0 };
    }

    const sheets = getSheetsClient();

    // 월별 시트 이름 결정 (파라미터 또는 현재 월)
    const sheetName = month || getMonthlySheetName();

    // 시트가 없으면 생성
    await ensureMonthlySheet(sheets, sheetName);

    // 행 데이터 배열 구성
    const rows = records.map((record) => [
      record.recordDate, // A: 기록일시
      record.saleId, // B: 판매ID
      record.profileId, // C: 프로필ID
      record.affiliateCode || '', // D: 파트너코드
      record.displayName || '', // E: 이름
      record.type === 'BRANCH_MANAGER' ? '대리점장' : '판매원', // F: 구분
      record.productCode || '', // G: 상품코드
      record.saleAmount, // H: 판매금액
      record.saleDate || '', // I: 판매일
      formatStatus(record.status), // J: 상태
      record.submittedAt || '', // K: 제출일시
      record.approvedAt || '', // L: 승인일시
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:L`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rows,
      },
    });

    console.log(`[SalesSpreadsheet] ${records.length} records appended to ${sheetName}`);
    return { ok: true, count: records.length, sheetName };
  } catch (error: any) {
    console.error('[SalesSpreadsheet] Error appending records:', error);
    return { ok: false, count: 0, error: error?.message || '스프레드시트 기록 실패' };
  }
}

/**
 * 특정 월의 시트 헤더 초기화 (수동 호출용)
 */
export async function initializeSalesSpreadsheetHeaders(month?: string): Promise<{
  ok: boolean;
  sheetName?: string;
  error?: string;
}> {
  try {
    const sheets = getSheetsClient();
    const sheetName = month || getMonthlySheetName();

    // 시트 생성 및 헤더 추가
    await ensureMonthlySheet(sheets, sheetName);

    console.log(`[SalesSpreadsheet] Sheet ${sheetName} initialized`);
    return { ok: true, sheetName };
  } catch (error: any) {
    console.error('[SalesSpreadsheet] Error initializing headers:', error);
    return { ok: false, error: error?.message || '헤더 설정 실패' };
  }
}

function formatStatus(status: string): string {
  switch (status) {
    case 'PENDING':
      return '대기 중';
    case 'PENDING_APPROVAL':
      return '승인 대기';
    case 'APPROVED':
      return '승인됨';
    case 'REJECTED':
      return '거부됨';
    case 'CONFIRMED':
      return '확정됨';
    default:
      return status;
  }
}
