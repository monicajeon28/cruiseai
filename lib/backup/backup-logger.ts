// lib/backup/backup-logger.ts
// 백업 기록 로깅 시스템 (구글 스프레드시트)

import { google } from 'googleapis';
import { getGoogleAuth } from '@/lib/google-drive';
import { getDriveFolderId } from '@/lib/config/drive-config';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// 백업 유형
export type BackupType =
  | '계약서_PDF'
  | '신분증'
  | '통장사본'
  | '서명이미지'
  | 'APIS_스프레드시트'
  | '고객활동데이터'
  | '상품조회데이터'
  | '기능사용데이터'
  | 'DB_전체백업'
  | '기타';

// 백업 상태
export type BackupStatus = '성공' | '실패' | '진행중' | '재시도중';

// 백업 로그 데이터
export interface BackupLogData {
  백업유형: BackupType;
  대상ID?: string | number;
  대상명?: string;
  파일명?: string;
  파일크기?: string;
  상태: BackupStatus;
  메시지?: string;
  드라이브URL?: string;
  처리시간?: number; // 밀리초
  담당자?: string;
}

// 스프레드시트 ID 캐시
let backupSpreadsheetId: string | null = null;

/**
 * 백업 기록 스프레드시트 ID 가져오기 (없으면 생성)
 */
async function getBackupSpreadsheetId(): Promise<string> {
  if (backupSpreadsheetId) {
    return backupSpreadsheetId;
  }

  const auth = getGoogleAuth();
  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  // 백업 폴더 ID 가져오기
  let backupFolderId: string | null = null;
  try {
    backupFolderId = await getDriveFolderId('BACKUP_LOGS');
  } catch {
    // 설정 없으면 기본 폴더 사용
    backupFolderId = await getDriveFolderId('APIS_MAIN');
  }

  // 기존 백업 기록 스프레드시트 찾기
  const searchResult = await drive.files.list({
    q: `name = '[시스템] 백업 기록' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (searchResult.data.files && searchResult.data.files.length > 0) {
    backupSpreadsheetId = searchResult.data.files[0].id!;
    return backupSpreadsheetId;
  }

  // 새 스프레드시트 생성
  const createResult = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: '[시스템] 백업 기록',
        locale: 'ko_KR',
      },
      sheets: [
        {
          properties: {
            title: '백업기록',
            gridProperties: {
              rowCount: 1000,
              columnCount: 15,
              frozenRowCount: 1,
            },
          },
        },
      ],
    },
  });

  backupSpreadsheetId = createResult.data.spreadsheetId!;

  // 폴더로 이동
  if (backupFolderId) {
    await drive.files.update({
      fileId: backupSpreadsheetId,
      addParents: backupFolderId,
      fields: 'id, parents',
      supportsAllDrives: true,
    });
  }

  // 헤더 행 추가
  await sheets.spreadsheets.values.update({
    spreadsheetId: backupSpreadsheetId,
    range: '백업기록!A1:O1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        '기록일시',
        '백업유형',
        '대상ID',
        '대상명',
        '파일명',
        '파일크기',
        '상태',
        '메시지',
        '드라이브URL',
        '처리시간(초)',
        '담당자',
        '년도',
        '월',
        '일',
        '시간',
      ]],
    },
  });

  // 헤더 스타일 적용 (굵게, 배경색)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: backupSpreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: 0,
              startRowIndex: 0,
              endRowIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
                textFormat: {
                  bold: true,
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                },
                horizontalAlignment: 'CENTER',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
          },
        },
      ],
    },
  });

  console.log(`[백업 로거] 새 스프레드시트 생성됨: ${backupSpreadsheetId}`);
  return backupSpreadsheetId;
}

/**
 * 백업 기록 추가
 */
export async function logBackup(data: BackupLogData): Promise<{ ok: boolean; error?: string }> {
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = await getBackupSpreadsheetId();
    const now = new Date();

    // 한글 날짜 포맷
    const 기록일시 = format(now, 'yyyy-MM-dd HH:mm:ss', { locale: ko });
    const 년도 = format(now, 'yyyy', { locale: ko });
    const 월 = format(now, 'MM', { locale: ko });
    const 일 = format(now, 'dd', { locale: ko });
    const 시간 = format(now, 'HH:mm', { locale: ko });

    const rowData = [
      기록일시,
      data.백업유형,
      data.대상ID?.toString() || '',
      data.대상명 || '',
      data.파일명 || '',
      data.파일크기 || '',
      data.상태,
      data.메시지 || '',
      data.드라이브URL || '',
      data.처리시간 ? (data.처리시간 / 1000).toFixed(2) : '',
      data.담당자 || '시스템',
      년도,
      월,
      일,
      시간,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: '백업기록!A:O',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowData],
      },
    });

    console.log(`[백업 로거] 기록 추가됨: ${data.백업유형} - ${data.상태}`);
    return { ok: true };

  } catch (error: any) {
    console.error('[백업 로거] 기록 실패:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * 백업 성공 기록 (편의 함수)
 */
export async function logBackupSuccess(
  백업유형: BackupType,
  옵션: {
    대상ID?: string | number;
    대상명?: string;
    파일명?: string;
    파일크기?: string;
    드라이브URL?: string;
    처리시간?: number;
    담당자?: string;
    메시지?: string;
  } = {}
): Promise<void> {
  await logBackup({
    백업유형,
    상태: '성공',
    메시지: 옵션.메시지 || '백업 완료',
    ...옵션,
  });
}

/**
 * 백업 실패 기록 (편의 함수)
 */
export async function logBackupFailure(
  백업유형: BackupType,
  에러메시지: string,
  옵션: {
    대상ID?: string | number;
    대상명?: string;
    파일명?: string;
    처리시간?: number;
    담당자?: string;
  } = {}
): Promise<void> {
  await logBackup({
    백업유형,
    상태: '실패',
    메시지: 에러메시지,
    ...옵션,
  });
}

/**
 * 백업 통계 요약 가져오기 (최근 N일)
 */
export async function getBackupSummary(days: number = 7): Promise<{
  ok: boolean;
  summary?: {
    총건수: number;
    성공: number;
    실패: number;
    유형별: Record<string, { 성공: number; 실패: number }>;
  };
  error?: string;
}> {
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = await getBackupSpreadsheetId();

    // 전체 데이터 가져오기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '백업기록!A2:O1000',
    });

    const rows = response.data.values || [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let 총건수 = 0;
    let 성공 = 0;
    let 실패 = 0;
    const 유형별: Record<string, { 성공: number; 실패: number }> = {};

    for (const row of rows) {
      const 기록일시 = row[0];
      const 백업유형 = row[1];
      const 상태 = row[6];

      if (!기록일시) continue;

      const recordDate = new Date(기록일시);
      if (recordDate < cutoffDate) continue;

      총건수++;
      if (상태 === '성공') 성공++;
      if (상태 === '실패') 실패++;

      if (백업유형) {
        if (!유형별[백업유형]) {
          유형별[백업유형] = { 성공: 0, 실패: 0 };
        }
        if (상태 === '성공') 유형별[백업유형].성공++;
        if (상태 === '실패') 유형별[백업유형].실패++;
      }
    }

    return {
      ok: true,
      summary: { 총건수, 성공, 실패, 유형별 },
    };

  } catch (error: any) {
    console.error('[백업 로거] 통계 조회 실패:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * 월별 백업 시트 생성 (대용량 데이터 아카이브용)
 */
export async function createMonthlyArchiveSheet(
  년월: string // 예: '2024-01'
): Promise<{ ok: boolean; sheetId?: number; error?: string }> {
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = await getBackupSpreadsheetId();
    const sheetTitle = `아카이브_${년월}`;

    // 시트 추가
    const addSheetResult = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetTitle,
                gridProperties: {
                  rowCount: 10000,
                  columnCount: 15,
                  frozenRowCount: 1,
                },
              },
            },
          },
        ],
      },
    });

    const newSheetId = addSheetResult.data.replies?.[0]?.addSheet?.properties?.sheetId;

    // 헤더 복사
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetTitle}!A1:O1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          '기록일시',
          '백업유형',
          '대상ID',
          '대상명',
          '파일명',
          '파일크기',
          '상태',
          '메시지',
          '드라이브URL',
          '처리시간(초)',
          '담당자',
          '년도',
          '월',
          '일',
          '시간',
        ]],
      },
    });

    console.log(`[백업 로거] 월별 아카이브 시트 생성됨: ${sheetTitle}`);
    return { ok: true, sheetId: newSheetId };

  } catch (error: any) {
    console.error('[백업 로거] 아카이브 시트 생성 실패:', error);
    return { ok: false, error: error.message };
  }
}
