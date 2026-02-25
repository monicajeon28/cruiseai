import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';

// google-drive와 googleapis는 동적 임포트로 사용 (빌드 시 메모리 절약)
// init.ts → layout.tsx 체인에서 googleapis 로드 방지

/**
 * 구글 스프레드시트 백업 스케줄러
 * 매일 오전 12시에 모든 APIS 스프레드시트를 구글 드라이브 백업 폴더에 엑셀 파일로 저장합니다.
 */

interface SpreadsheetBackupResult {
  ok: boolean;
  spreadsheetId: string;
  tripId?: number;
  productCode?: string;
  fileName?: string;
  fileId?: string;
  error?: string;
}

interface SpreadsheetBackupLog {
  timestamp: string;
  totalSpreadsheets: number;
  successCount: number;
  failureCount: number;
  results: SpreadsheetBackupResult[];
  duration: number; // milliseconds
}

/**
 * 구글 시트 API 클라이언트 생성 (동적 임포트 사용)
 */
async function getSheetsClient() {
  // googleapis와 google-drive 모두 동적 임포트
  const { google } = await import('googleapis');
  const { getGoogleAuth } = await import('@/lib/google-drive');

  const auth = getGoogleAuth([
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/drive.file',
  ]);

  return google.sheets({ version: 'v4', auth });
}

/**
 * 구글 스프레드시트 데이터를 엑셀 버퍼로 변환
 */
async function spreadsheetToExcelBuffer(
  spreadsheetId: string
): Promise<Buffer> {
  const sheets = await getSheetsClient();

  // 스프레드시트 메타데이터 가져오기
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  const workbook = XLSX.utils.book_new();
  const spreadsheetTitle = spreadsheet.data.properties?.title || 'Sheet';

  // 각 시트의 데이터 가져오기
  if (spreadsheet.data.sheets) {
    for (const sheet of spreadsheet.data.sheets) {
      const sheetTitle = sheet.properties?.title || 'Sheet1';
      const sheetId = sheet.properties?.sheetId || 0;

      try {
        // 시트 데이터 가져오기 (A1부터 Z1000까지, 필요시 확장 가능)
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: sheetTitle,
        });

        const values = response.data.values || [];

        if (values.length === 0) {
          // 빈 시트 생성
          const emptySheet = XLSX.utils.aoa_to_sheet([['No data']]);
          XLSX.utils.book_append_sheet(workbook, emptySheet, sheetTitle);
        } else {
          // 데이터를 시트로 변환
          const worksheet = XLSX.utils.aoa_to_sheet(values);
          XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle);
        }
      } catch (error: any) {
        console.error(
          `[Spreadsheet Backup] Error reading sheet ${sheetTitle}:`,
          error
        );
        // 에러 발생 시 에러 메시지가 포함된 시트 생성
        const errorSheet = XLSX.utils.aoa_to_sheet([
          [`Error: ${error.message || 'Failed to read sheet'}`],
        ]);
        // 시트 이름이 너무 길면 잘라내기 (구글 시트는 최대 100자)
        const safeSheetTitle = sheetTitle.substring(0, 31);
        XLSX.utils.book_append_sheet(workbook, errorSheet, safeSheetTitle);
      }
    }
  }

  // 엑셀 버퍼 생성
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

/**
 * 특정 스프레드시트 백업
 */
async function backupSpreadsheet(
  spreadsheetId: string,
  backupFolderId: string,
  tripId?: number,
  productCode?: string
): Promise<SpreadsheetBackupResult> {
  try {
    // 동적 임포트
    const { uploadFileToDrive } = await import('@/lib/google-drive');

    // 스프레드시트 메타데이터 가져오기
    const sheets = await getSheetsClient();
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const spreadsheetTitle =
      spreadsheet.data.properties?.title || `Spreadsheet_${spreadsheetId}`;

    // 스프레드시트를 엑셀 버퍼로 변환
    const excelBuffer = await spreadsheetToExcelBuffer(spreadsheetId);

    // 파일명 생성
    const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
    const fileName = `${spreadsheetTitle}_${timestamp}.xlsx`;
    const safeFileName = fileName.replace(/[\/\\?%*:|"<>]/g, '_');

    // 구글 드라이브에 업로드
    const uploadResult = await uploadFileToDrive({
      folderId: backupFolderId,
      fileName: safeFileName,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: excelBuffer,
      makePublic: false,
    });

    if (!uploadResult.ok) {
      return {
        ok: false,
        spreadsheetId,
        tripId,
        productCode,
        error: uploadResult.error || 'Upload failed',
      };
    }

    return {
      ok: true,
      spreadsheetId,
      tripId,
      productCode,
      fileName: safeFileName,
      fileId: uploadResult.fileId,
    };
  } catch (error: any) {
    console.error(
      `[Spreadsheet Backup] Error backing up spreadsheet ${spreadsheetId}:`,
      error
    );
    return {
      ok: false,
      spreadsheetId,
      tripId,
      productCode,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * 모든 스프레드시트 백업 실행
 */
export async function runSpreadsheetBackup(): Promise<SpreadsheetBackupLog> {
  const startTime = Date.now();
  console.log('[Spreadsheet Backup] Starting backup...');

  try {
    // 동적 임포트
    const { findOrCreateFolder } = await import('@/lib/google-drive');

    // 백업 폴더 생성 또는 찾기
    const today = dayjs().format('YYYY-MM-DD');
    const monthFolder = dayjs().format('YYYY-MM');

    // 월별 폴더 생성
    const monthFolderResult = await findOrCreateFolder(
      `APIS_Spreadsheet_Backup_${monthFolder}`
    );
    if (!monthFolderResult.ok || !monthFolderResult.folderId) {
      throw new Error('Failed to create/find month folder');
    }

    // 일별 폴더 생성
    const dayFolderResult = await findOrCreateFolder(
      `Backup_${today}`,
      monthFolderResult.folderId
    );
    if (!dayFolderResult.ok || !dayFolderResult.folderId) {
      throw new Error('Failed to create/find day folder');
    }

    const backupFolderId = dayFolderResult.folderId;
    console.log(
      `[Spreadsheet Backup] Backup folder ID: ${backupFolderId}`
    );

    // 모든 Trip에서 spreadsheetId가 있는 것들 조회
    const trips = await prisma.trip.findMany({
      where: {
        spreadsheetId: {
          not: null,
        },
      },
      select: {
        id: true,
        productCode: true,
        spreadsheetId: true,
      },
    });

    console.log(
      `[Spreadsheet Backup] Found ${trips.length} trips with spreadsheets`
    );

    // 모든 스프레드시트 백업
    const results: SpreadsheetBackupResult[] = [];
    for (const trip of trips) {
      if (!trip.spreadsheetId) continue;

      console.log(
        `[Spreadsheet Backup] Backing up spreadsheet: ${trip.spreadsheetId} (Trip ID: ${trip.id})`
      );
      const result = await backupSpreadsheet(
        trip.spreadsheetId,
        backupFolderId,
        trip.id,
        trip.productCode || undefined
      );
      results.push(result);
    }

    // 결과 집계
    const successCount = results.filter((r) => r.ok).length;
    const failureCount = results.filter((r) => !r.ok).length;
    const duration = Date.now() - startTime;

    const backupLog: SpreadsheetBackupLog = {
      timestamp: dayjs().toISOString(),
      totalSpreadsheets: trips.length,
      successCount,
      failureCount,
      results,
      duration,
    };

    console.log('[Spreadsheet Backup] Backup completed:', {
      successCount,
      failureCount,
      duration: `${(duration / 1000).toFixed(2)}s`,
    });

    // 백업 로그를 DB에 저장 (선택사항)
    try {
      await prisma.adminActionLog.create({
        data: {
          adminId: 1, // 시스템 관리자 ID (1번으로 가정)
          action: 'SPREADSHEET_BACKUP',
          details: backupLog,
        },
      });
    } catch (logError) {
      console.error(
        '[Spreadsheet Backup] Failed to log backup:',
        logError
      );
    }

    return backupLog;
  } catch (error: any) {
    console.error('[Spreadsheet Backup] Backup failed:', error);

    const duration = Date.now() - startTime;
    const backupLog: SpreadsheetBackupLog = {
      timestamp: dayjs().toISOString(),
      totalSpreadsheets: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
      duration,
    };

    // 실패 로그도 DB에 저장
    try {
      await prisma.adminActionLog.create({
        data: {
          adminId: 1,
          action: 'SPREADSHEET_BACKUP_FAILED',
          details: {
            ...backupLog,
            error: error.message || 'Backup process failed',
          },
        },
      });
    } catch (logError) {
      console.error(
        '[Spreadsheet Backup] Failed to log backup failure:',
        logError
      );
    }

    return backupLog;
  }
}

/**
 * 수동 실행용 함수
 */
export async function manualRunSpreadsheetBackup(): Promise<SpreadsheetBackupLog> {
  console.log('[Spreadsheet Backup] Manual backup triggered');
  return await runSpreadsheetBackup();
}

/**
 * 구글 스프레드시트 백업 스케줄러 시작
 * 매일 오전 12시에 자동 백업 실행
 */
export function startSpreadsheetBackupScheduler() {
  const cron = require('node-cron');

  // 매일 오전 12시에 실행 (KST 기준)
  cron.schedule(
    '0 0 * * *',
    async () => {
      console.log(
        '[Spreadsheet Backup Scheduler] Starting scheduled backup...'
      );
      try {
        const result = await runSpreadsheetBackup();
        console.log('[Spreadsheet Backup Scheduler] Backup completed:', {
          successCount: result.successCount,
          failureCount: result.failureCount,
          duration: `${(result.duration / 1000).toFixed(2)}s`,
        });
      } catch (error) {
        console.error(
          '[Spreadsheet Backup Scheduler] Backup failed:',
          error
        );
      }
    },
    {
      timezone: 'Asia/Seoul', // 한국 시간 기준
    }
  );

  console.log(
    '📊 [Spreadsheet Backup Scheduler] Started - Will run daily at 12:00 AM KST'
  );
}
