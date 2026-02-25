/**
 * 메시지 발송 백업 라이브러리
 * - 이미지: Google Drive (UPLOADS_IMAGES 폴더)로 백업
 * - 발송 기록: Google Spreadsheet로 백업
 */

import { google } from 'googleapis';
import { getGoogleAuth, uploadFileToDrive, getDriveFileUrl } from '@/lib/google-drive';
import { getDriveFolderId } from '@/lib/config/drive-config';

// 메시지 백업용 스프레드시트 ID
const MESSAGE_BACKUP_SPREADSHEET_ID = '1epqXXFb6dF1KzAQ_4yVB3vOjT76L-5zUqR2UdlRZTKo';

// 이미지 백업용 Google Drive 폴더 ID
const MESSAGE_IMAGES_FOLDER_ID = '1fWbPelIoftl1DqXLayZNle7z-DSYzvl8';

interface MessageLogData {
  sentAt: Date;
  senderName: string;
  senderType: 'ADMIN' | 'BRANCH_MANAGER' | 'SALES_AGENT';
  messageType: 'SMS' | 'EMAIL';
  subject?: string;
  content: string;
  recipients: Array<{
    name: string;
    phone?: string;
    email?: string;
  }>;
  recipientCount: number;
  status: 'SENT' | 'FAILED' | 'PARTIAL' | 'SCHEDULED';
  successCount: number;
  failCount: number;
  imageUrls?: string[];
  groupName?: string;
}

interface ImageUploadResult {
  ok: boolean;
  url?: string;
  driveUrl?: string;
  fileId?: string;
  error?: string;
}

/**
 * 이미지를 Google Drive에 백업
 */
export async function backupImageToDrive(
  imageBuffer: Buffer,
  fileName: string,
  mimeType: string = 'image/jpeg'
): Promise<ImageUploadResult> {
  try {
    // UPLOADS_IMAGES 폴더에 업로드
    const folderId = await getDriveFolderId('UPLOADS_IMAGES');

    const result = await uploadFileToDrive({
      folderId,
      fileName: `MSG_${Date.now()}_${fileName}`,
      mimeType,
      buffer: imageBuffer,
      makePublic: true,
    });

    if (!result.ok || !result.fileId) {
      return { ok: false, error: result.error || '이미지 업로드 실패' };
    }

    const driveUrl = `https://drive.google.com/file/d/${result.fileId}/view`;

    return {
      ok: true,
      url: result.url,
      driveUrl,
      fileId: result.fileId,
    };
  } catch (error: any) {
    console.error('[MessageBackup] backupImageToDrive error:', error);
    return { ok: false, error: error.message || '이미지 백업 실패' };
  }
}

/**
 * URL에서 이미지를 다운로드하여 Google Drive에 백업
 */
export async function backupImageFromUrl(imageUrl: string): Promise<ImageUploadResult> {
  try {
    // 이미 Google Drive URL인 경우 그대로 반환
    if (imageUrl.includes('drive.google.com') || imageUrl.includes('lh3.googleusercontent.com')) {
      // 파일 ID 추출
      const fileIdMatch = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (fileIdMatch) {
        return {
          ok: true,
          url: imageUrl,
          driveUrl: `https://drive.google.com/file/d/${fileIdMatch[1]}/view`,
          fileId: fileIdMatch[1],
        };
      }
    }

    // 외부 URL에서 이미지 다운로드
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return { ok: false, error: `이미지 다운로드 실패: ${response.status}` };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const fileName = imageUrl.split('/').pop()?.split('?')[0] || 'image.jpg';

    return await backupImageToDrive(buffer, fileName, contentType);
  } catch (error: any) {
    console.error('[MessageBackup] backupImageFromUrl error:', error);
    return { ok: false, error: error.message || '이미지 URL 백업 실패' };
  }
}

/**
 * 메시지 발송 기록을 Google Spreadsheet에 백업
 *
 * 열 구조:
 * A: 발송일시
 * B: 발송담당자
 * C: 담당자유형
 * D: 형식 (SMS/이메일)
 * E: 제목
 * F: 내용
 * G: 받는이들
 * H: 발송건수
 * I: 성공건수
 * J: 실패건수
 * K: 상태
 * L: 그룹명
 * M: 이미지링크
 */
export async function logMessageToSpreadsheet(data: MessageLogData): Promise<{ ok: boolean; error?: string }> {
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 받는이들 문자열 생성 (최대 5명까지 표시)
    const recipientsList = data.recipients
      .slice(0, 5)
      .map(r => {
        const contact = r.phone || r.email || '';
        return `${r.name}(${contact})`;
      })
      .join(', ');
    const recipientsStr = data.recipients.length > 5
      ? `${recipientsList} 외 ${data.recipients.length - 5}명`
      : recipientsList;

    // 이미지 링크들 합치기
    const imageLinksStr = data.imageUrls?.join('\n') || '';

    // 발송일시 포맷
    const sentAtStr = data.sentAt.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    // 담당자 유형 한글화
    const senderTypeKr = {
      'ADMIN': '관리자',
      'BRANCH_MANAGER': '대리점장',
      'SALES_AGENT': '판매원',
    }[data.senderType] || data.senderType;

    // 상태 한글화
    const statusKr = {
      'SENT': '발송완료',
      'FAILED': '실패',
      'PARTIAL': '일부실패',
      'SCHEDULED': '예약됨',
    }[data.status] || data.status;

    // 내용 요약 (200자 제한)
    const contentSummary = data.content.length > 200
      ? data.content.substring(0, 200) + '...'
      : data.content;

    // 행 데이터
    const rowData = [
      sentAtStr,                    // A: 발송일시
      data.senderName,              // B: 발송담당자
      senderTypeKr,                 // C: 담당자유형
      data.messageType,             // D: 형식
      data.subject || '',           // E: 제목
      contentSummary,               // F: 내용
      recipientsStr,                // G: 받는이들
      data.recipientCount.toString(), // H: 발송건수
      data.successCount.toString(), // I: 성공건수
      data.failCount.toString(),    // J: 실패건수
      statusKr,                     // K: 상태
      data.groupName || '',         // L: 그룹명
      imageLinksStr,                // M: 이미지링크
    ];

    // 스프레드시트에 행 추가
    await sheets.spreadsheets.values.append({
      spreadsheetId: MESSAGE_BACKUP_SPREADSHEET_ID,
      range: 'Sheet1!A:M',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowData],
      },
    });

    console.log('[MessageBackup] 스프레드시트 백업 성공:', {
      sender: data.senderName,
      type: data.messageType,
      count: data.recipientCount,
    });

    return { ok: true };
  } catch (error: any) {
    console.error('[MessageBackup] logMessageToSpreadsheet error:', error);
    return { ok: false, error: error.message || '스프레드시트 백업 실패' };
  }
}

/**
 * 이메일 발송 시 이미지 백업 및 로그 기록
 */
export async function backupEmailWithImages(
  data: MessageLogData,
  images?: Array<{ url: string; alt?: string }>
): Promise<{ ok: boolean; imageUrls?: string[]; imageBackupStats?: { success: number; failed: number }; error?: string }> {
  try {
    const backedUpImageUrls: string[] = [];
    let imageSuccessCount = 0;
    let imageFailCount = 0;

    // 이미지가 있으면 Google Drive에 백업 (부분 실패 허용)
    if (images && images.length > 0) {
      const imageResults = await Promise.allSettled(
        images.map(img => backupImageFromUrl(img.url))
      );

      for (const result of imageResults) {
        if (result.status === 'fulfilled' && result.value.ok && result.value.driveUrl) {
          backedUpImageUrls.push(result.value.driveUrl);
          imageSuccessCount++;
        } else {
          imageFailCount++;
          const errorMsg = result.status === 'rejected'
            ? result.reason?.message
            : result.value?.error;
          console.warn('[MessageBackup] 이미지 백업 실패:', errorMsg);
        }
      }
    }

    // 스프레드시트에 로그 기록 (이미지 백업 일부 실패해도 로그는 기록)
    data.imageUrls = backedUpImageUrls;
    const logResult = await logMessageToSpreadsheet(data);

    if (!logResult.ok) {
      console.error('[MessageBackup] 스프레드시트 로그 실패:', logResult.error);
    }

    return {
      ok: true,
      imageUrls: backedUpImageUrls,
      imageBackupStats: { success: imageSuccessCount, failed: imageFailCount }
    };
  } catch (error: any) {
    console.error('[MessageBackup] backupEmailWithImages error:', error);
    return { ok: false, error: error.message || '이메일 백업 실패' };
  }
}

/**
 * SMS 발송 시 로그 기록
 */
export async function backupSmsLog(data: MessageLogData): Promise<{ ok: boolean; error?: string }> {
  try {
    return await logMessageToSpreadsheet(data);
  } catch (error: any) {
    console.error('[MessageBackup] backupSmsLog error:', error);
    return { ok: false, error: error.message || 'SMS 백업 실패' };
  }
}

/**
 * 스프레드시트 헤더 초기화 (최초 1회 실행)
 */
export async function initializeSpreadsheetHeaders(): Promise<{ ok: boolean; error?: string }> {
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const headers = [
      '발송일시',
      '발송담당자',
      '담당자유형',
      '형식',
      '제목',
      '내용',
      '받는이들',
      '발송건수',
      '성공건수',
      '실패건수',
      '상태',
      '그룹명',
      '이미지링크',
    ];

    // 첫 번째 행에 헤더 설정
    await sheets.spreadsheets.values.update({
      spreadsheetId: MESSAGE_BACKUP_SPREADSHEET_ID,
      range: 'Sheet1!A1:M1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });

    console.log('[MessageBackup] 스프레드시트 헤더 초기화 완료');
    return { ok: true };
  } catch (error: any) {
    console.error('[MessageBackup] initializeSpreadsheetHeaders error:', error);
    return { ok: false, error: error.message || '헤더 초기화 실패' };
  }
}
