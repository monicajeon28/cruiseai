// lib/backup/index.ts
// 백업 시스템 통합 모듈

export * from './backup-logger';

import { uploadFileToDrive } from '@/lib/google-drive';
import { logBackupSuccess, logBackupFailure, BackupType } from './backup-logger';

/**
 * 파일을 구글 드라이브에 업로드하고 백업 기록 남기기
 */
export async function uploadWithLogging(params: {
  folderId?: string | null;
  fileName: string;
  mimeType?: string;
  buffer: Buffer;
  makePublic?: boolean;
  // 로깅용 추가 파라미터
  백업유형: BackupType;
  대상ID?: string | number;
  대상명?: string;
  담당자?: string;
}): Promise<{
  ok: boolean;
  fileId?: string;
  url?: string;
  error?: string;
}> {
  const startTime = Date.now();
  const { 백업유형, 대상ID, 대상명, 담당자, ...uploadParams } = params;

  try {
    const result = await uploadFileToDrive(uploadParams);
    const 처리시간 = Date.now() - startTime;

    if (result.ok) {
      // 성공 로그
      await logBackupSuccess(백업유형, {
        대상ID,
        대상명,
        파일명: params.fileName,
        파일크기: formatFileSize(params.buffer.length),
        드라이브URL: result.url,
        처리시간,
        담당자,
        메시지: '업로드 완료',
      }).catch(logError => {
        console.error('[백업] 로그 기록 실패:', logError);
      });
    } else {
      // 실패 로그
      await logBackupFailure(백업유형, result.error || '알 수 없는 오류', {
        대상ID,
        대상명,
        파일명: params.fileName,
        처리시간,
        담당자,
      }).catch(logError => {
        console.error('[백업] 로그 기록 실패:', logError);
      });
    }

    return result;
  } catch (error: any) {
    const 처리시간 = Date.now() - startTime;

    // 예외 로그
    await logBackupFailure(백업유형, error.message || '예외 발생', {
      대상ID,
      대상명,
      파일명: params.fileName,
      처리시간,
      담당자,
    }).catch(logError => {
      console.error('[백업] 로그 기록 실패:', logError);
    });

    return { ok: false, error: error.message };
  }
}

/**
 * 파일 크기 포맷팅 (KB, MB)
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

/**
 * APIS 동기화 로깅
 */
export async function logApisSyncResult(
  tripId: number,
  tripName: string,
  success: boolean,
  rowCount?: number,
  spreadsheetUrl?: string,
  error?: string
): Promise<void> {
  const { logBackup } = await import('./backup-logger');

  await logBackup({
    백업유형: 'APIS_스프레드시트',
    대상ID: tripId,
    대상명: tripName,
    상태: success ? '성공' : '실패',
    메시지: success
      ? `${rowCount || 0}개 행 동기화 완료`
      : error || '동기화 실패',
    드라이브URL: spreadsheetUrl,
    담당자: '시스템',
  }).catch(logError => {
    console.error('[백업] APIS 로그 기록 실패:', logError);
  });
}

/**
 * 계약서 PDF 백업 로깅
 */
export async function logContractPdfBackup(
  contractId: number,
  contractName: string,
  success: boolean,
  url?: string,
  error?: string,
  담당자?: string
): Promise<void> {
  const { logBackup } = await import('./backup-logger');

  await logBackup({
    백업유형: '계약서_PDF',
    대상ID: contractId,
    대상명: contractName,
    상태: success ? '성공' : '실패',
    메시지: success ? 'PDF 생성 및 업로드 완료' : error || 'PDF 백업 실패',
    드라이브URL: url,
    담당자: 담당자 || '시스템',
  }).catch(logError => {
    console.error('[백업] 계약서 로그 기록 실패:', logError);
  });
}

/**
 * 문서 백업 로깅 (신분증, 통장사본 등)
 */
export async function logDocumentBackup(
  documentType: '신분증' | '통장사본' | '서명이미지',
  profileId: number,
  profileName: string,
  success: boolean,
  url?: string,
  error?: string
): Promise<void> {
  const { logBackup } = await import('./backup-logger');

  await logBackup({
    백업유형: documentType,
    대상ID: profileId,
    대상명: profileName,
    상태: success ? '성공' : '실패',
    메시지: success ? `${documentType} 업로드 완료` : error || `${documentType} 업로드 실패`,
    드라이브URL: url,
    담당자: '시스템',
  }).catch(logError => {
    console.error('[백업] 문서 로그 기록 실패:', logError);
  });
}

/**
 * 고객 활동 데이터 아카이브 로깅
 */
export async function logActivityArchive(
  archiveType: '고객활동데이터' | '상품조회데이터' | '기능사용데이터',
  recordCount: number,
  archivePeriod: string, // 예: '2024-01'
  success: boolean,
  url?: string,
  error?: string
): Promise<void> {
  const { logBackup } = await import('./backup-logger');

  await logBackup({
    백업유형: archiveType,
    대상명: archivePeriod,
    상태: success ? '성공' : '실패',
    메시지: success
      ? `${recordCount.toLocaleString()}건 아카이브 완료`
      : error || '아카이브 실패',
    드라이브URL: url,
    담당자: '시스템',
  }).catch(logError => {
    console.error('[백업] 아카이브 로그 기록 실패:', logError);
  });
}
