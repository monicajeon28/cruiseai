import { PartnerApiError } from '@/app/api/partner/_utils';

// Google Apps Script URL for Customer Groups
// Updated by user on 2025-12-03
const GROUP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz9vkrgmtYuTIyu-muC7XaYpXl5v0jzGRNqnGI2GuYEXw9dDCaNE5lT1rzYV0pPzLOXZw/exec';

// Google Apps Script URL for My Customer Management
// Updated by user on 2025-12-03
const MANAGEMENT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyZYKPmjQ_IWlAn0onXeUTnyj1DxLqtRJLuD2Lh70QEk_1IR4DkAZW0eM8aLyFJJGid/exec';

// Google Apps Script URL for Purchased Customers
// Updated by user on 2025-12-03
const PURCHASED_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbynS4vlBUNTSYGSksIJi9ca9gdDWH12y0JRK0O5iU6kmPVnDsoqIIrEUSuqK19N4Nll/exec';

interface GoogleSheetData {
  name: string;
  phone: string;
  source: string;
  productName?: string;
  channel: string;
  manager: string;
  notes?: string;
  target?: 'group' | 'management' | 'purchased'; // Default is 'group' if not specified

  // Additional fields for purchased customers (APIS format)
  reservationDate?: string; // B: 예약일
  reservationNo?: string;   // C: 예약번호
  departureDate?: string;   // E: 출발일
  cabinType?: string;       // F: 객실 종류
  paymentDate?: string;     // R: 결제일
  paymentMethod?: string;   // S: 결제방법
  amount?: number;          // T: 결제금액
  lastEditor?: string;      // V: 최종수정자
  lastEditTime?: string;    // W: 최종수정일시
}

/**
 * Sends customer data to Google Sheets via Google Apps Script.
 * @param data Customer data to send
 */
export async function sendToGoogleSheet(data: GoogleSheetData): Promise<void> {
  try {
    const timestamp = new Date().toLocaleString('ko-KR');
    let targetUrl = GROUP_SCRIPT_URL;

    if (data.target === 'management') {
      targetUrl = MANAGEMENT_SCRIPT_URL;
    } else if (data.target === 'purchased') {
      targetUrl = PURCHASED_SCRIPT_URL;
    }

    const formData = new URLSearchParams();
    formData.append('action', 'addRow');
    formData.append('timestamp', timestamp);
    formData.append('name', data.name);
    formData.append('phone', data.phone);
    formData.append('source', data.source);
    formData.append('productName', data.productName || '');
    formData.append('channel', data.channel);
    formData.append('manager', data.manager);
    formData.append('notes', data.notes || '');

    // Add extra fields for purchased customers (APIS format)
    if (data.reservationDate) formData.append('reservationDate', data.reservationDate);
    if (data.reservationNo) formData.append('reservationNo', data.reservationNo);
    if (data.departureDate) formData.append('departureDate', data.departureDate);
    if (data.cabinType) formData.append('cabinType', data.cabinType);
    if (data.paymentDate) formData.append('paymentDate', data.paymentDate);
    if (data.paymentMethod) formData.append('paymentMethod', data.paymentMethod);
    if (data.amount) formData.append('amount', data.amount.toString());
    if (data.lastEditor) formData.append('lastEditor', data.lastEditor);
    if (data.lastEditTime) formData.append('lastEditTime', data.lastEditTime);

    console.log(`[Google Sheets Backup] Sending data to ${data.target || 'group'} sheet:`, {
      name: data.name,
      phone: data.phone,
      channel: data.channel,
      manager: data.manager,
      target: data.target
    });

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const result = await response.text();
    console.log('[Google Sheets Backup] Response:', result);
  } catch (error) {
    console.error('[Google Sheets Backup] Failed to send data:', error);
    // We don't throw here to avoid failing the main operation (customer creation)
  }
}

// ============================================================================
// Stub functions for deprecated/removed APIS sync functionality
// These functions are no longer actively used but are kept for backward compatibility
// to prevent build errors in files that still import them.
// ============================================================================

interface SyncResult {
  ok: boolean;
  error?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  folderId?: string;
  rowCount?: number;
}

import { google } from 'googleapis';
import prisma from '@/lib/prisma';
import { getGoogleAuth } from '@/lib/google-drive';
import { getDriveFolderId } from '@/lib/config/drive-config';

// ... existing imports ...

// ... existing code ...

/**
 * Syncs APIS data to a Google Sheet for a specific trip.
 * Creates a new sheet from template if it doesn't exist.
 */
/**
 * APIS 스프레드시트 동기화 (누적 방식 - 그룹별 행 삽입)
 *
 * - 기존 데이터를 덮어쓰지 않고, 성명+연락처로 찾아서 업데이트하거나 새 행 추가
 * - 같은 카테고리(객실) 그룹 바로 아래에 새 행 삽입 (그룹 유지)
 *
 * 구매자APIS 시트 열 구조:
 *   F열: 카테고리 (발코니1, 발코니2 등 - 같은 방 쓰는 사람끼리 그룹)
 *   I열: 성명 (한글)
 *   P열: 고객 연락처
 *   + 영문성, 영문이름, 주민번호, 성별, 생년월일, 여권번호, 여권생성일, 여권만료일 등
 *
 * 예시:
 *   발코니1  홍길동  010-1234-5678
 *   발코니1  둘리    010-1234-5678
 *   발코니2  마이콜  010-9999-8888
 *
 * 홍길동 그룹에 "고길동" 추가 시 → 발코니1 그룹 바로 아래에 삽입
 */
export async function syncApisSpreadsheet(tripId: number): Promise<SyncResult> {
  try {
    // 1. Get Trip Info with Travelers, User, Payment, and Affiliate info
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        Reservation: {
          include: {
            Traveler: true,
            User: {
              select: { phone: true, name: true }
            },
            AffiliateSale: {
              include: {
                AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile: {
                  select: { displayName: true }
                },
                Payment: {
                  select: {
                    paidAt: true,
                    payMethod: true,
                    amount: true,
                  }
                }
              }
            }
          },
        },
      },
    });

    if (!trip) {
      return { ok: false, error: 'Trip not found' };
    }

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    let spreadsheetId = trip.spreadsheetId;

    // 2. Create Spreadsheet if not exists
    if (!spreadsheetId) {
      const templateId = await getDriveFolderId('APIS_TEMPLATE_ID');
      const apisMainFolderId = await getDriveFolderId('APIS_MAIN');

      const copyRes = await drive.files.copy({
        fileId: templateId,
        requestBody: {
          name: `[APIS] ${trip.shipName} (${new Date(trip.departureDate).toISOString().split('T')[0]})`,
          parents: apisMainFolderId ? [apisMainFolderId] : undefined,
        },
        fields: 'id, webViewLink',
        supportsAllDrives: true,
      });

      spreadsheetId = copyRes.data.id;
      if (!spreadsheetId) throw new Error('Failed to copy spreadsheet template');

      await prisma.trip.update({
        where: { id: tripId },
        data: { spreadsheetId },
      });
    }

    // Get spreadsheet metadata (sheet title and sheetId for insert)
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties',
    });

    const sheetProps = meta.data.sheets?.[0]?.properties;
    const sheetTitle = sheetProps?.title;
    const sheetId = sheetProps?.sheetId;

    if (!sheetTitle || sheetId === undefined) {
      throw new Error('Could not find any sheet in the spreadsheet');
    }

    // 3. 기존 데이터 읽기 (A3:Z1000) - 누적을 위해
    const existingDataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetTitle}'!A3:Z1000`,
    });
    const existingRows = existingDataResponse.data.values || [];

    // 기존 데이터 맵 생성
    // - personKey: I열(성명) + P열(고객연락처) → 개인 식별
    // - categoryKey: F열(카테고리) → 그룹 식별
    // F열 = index 5, I열 = index 8, P열 = index 15 (0-based)
    const existingPersonMap = new Map<string, { rowIndex: number; data: any[] }>();
    const categoryLastRowMap = new Map<string, number>(); // 카테고리별 마지막 행 번호

    existingRows.forEach((row, index) => {
      const actualRowNum = index + 3; // 실제 스프레드시트 행 번호 (데이터는 3행부터)
      const category = (row[5] || '').toString().trim(); // F열: 카테고리
      const name = (row[8] || '').toString().trim(); // I열: 성명
      const phone = (row[15] || '').toString().trim(); // P열: 고객연락처

      if (name || phone) {
        const personKey = `${name}|${phone}`;
        existingPersonMap.set(personKey, { rowIndex: actualRowNum, data: row });
      }

      if (category) {
        // 해당 카테고리의 마지막 행 업데이트
        categoryLastRowMap.set(category, actualRowNum);
      }
    });

    // 4. Prepare Data - 예약별로 처리
    // 카테고리 = cabinType + roomNumber (예: 발코니1, 발코니2, 오션뷰1)
    // roomNumber는 Traveler에 있으므로, 같은 방 번호를 가진 여행자들이 같은 그룹
    // 예약(Reservation)의 cabinType과 여행자(Traveler)의 roomNumber를 조합

    interface RowUpdate {
      type: 'update' | 'insert';
      rowIndex: number;  // update: 기존 행 번호, insert: 삽입할 위치 (해당 행 바로 아래)
      category: string;
      data: any[];
    }
    const operations: RowUpdate[] = [];
    let updatedCount = 0;
    let addedCount = 0;

    let rowNumber = 1; // 순번 카운터

    for (const reservation of trip.Reservation) {
      const userPhone = reservation.User?.phone || '';
      const cabinType = reservation.cabinType || '기타';

      // 결제 정보 가져오기
      const payment = reservation.AffiliateSale?.Payment;
      const paidAt = payment?.paidAt
        ? new Date(payment.paidAt).toLocaleString('ko-KR', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        })
        : '';
      const payMethod = payment?.payMethod || '';
      const payAmount = payment?.amount ? payment.amount.toLocaleString('ko-KR') : '';

      // 담당자 정보 (계약서 서명 이름)
      const agentName = reservation.AffiliateSale?.AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile?.displayName || '';

      for (const traveler of reservation.Traveler) {
        // 카테고리 = cabinType + roomNumber (예: 발코니1, 오션뷰2)
        // 같은 방(roomNumber)을 사용하는 여행자들은 같은 카테고리 그룹
        const roomNum = traveler.roomNumber || 1;
        const category = `${cabinType}${roomNum}`;
        const travelerName = traveler.korName || '';
        const personKey = `${travelerName}|${userPhone}`;

        // 행 데이터 생성 (구매자APIS 시트 열 구조에 맞게)
        // A~Y열 구조: No, 구매날짜, 상품코드, 상품명, 출발일, 카테고리, 영문성, 영문이름, 성명, 주민번호, 성별, 생년월일, 여권번호, 여권생성일, 여권만료일, 고객연락처, 항공, 결제일, 결제방법, 결제금액, 연결담당자, 최종수정자, 최종수정일시, 비고, 여권이미지링크
        const travelerPhone = (traveler as any).phone || userPhone;
        const now = new Date().toLocaleString('ko-KR');

        const rowData = [
          rowNumber.toString(), // A: No (순번 자동)
          reservation.createdAt ? new Date(reservation.createdAt).toLocaleDateString('ko-KR') : '', // B: 구매날짜
          trip.productCode || '', // C: 상품 코드번호
          trip.cruiseName || trip.shipName || '', // D: 상품명
          trip.departureDate ? new Date(trip.departureDate).toLocaleDateString('ko-KR') : '', // E: 출발일
          category, // F: 카테고리 (객실이름)
          traveler.engSurname || '', // G: 영문성
          traveler.engGivenName || '', // H: 영문이름
          traveler.korName || '', // I: 성명
          traveler.residentNum || '', // J: 주민번호
          traveler.gender || '', // K: 성별
          traveler.birthDate || '', // L: 생년월일
          traveler.passportNo || '', // M: 여권번호
          traveler.issueDate || '', // N: 여권생성일
          traveler.expiryDate || '', // O: 여권만료일
          travelerPhone, // P: 고객연락처
          '', // Q: 항공 (빈칸 - 수동 입력)
          paidAt, // R: 결제일 (YYYY-MM-DD HH:MM:SS)
          payMethod, // S: 결제방법 (카드/계좌이체/핸드폰)
          payAmount, // T: 결제금액
          agentName, // U: 연결담당자 (계약서 이름)
          agentName, // V: 최종수정자 (계약서 이름)
          now, // W: 최종수정일시
          traveler.notes || '', // X: 비고
          traveler.passportImage || '', // Y: 여권 이미지 링크 (구글 드라이브)
        ];

        rowNumber++; // 순번 증가

        const existingPerson = existingPersonMap.get(personKey);
        if (existingPerson) {
          // 기존 행 업데이트 - 데이터가 있는 열만 업데이트 (빈 값은 기존 유지)
          const mergedData = existingPerson.data.map((existingVal, colIndex) => {
            const newVal = rowData[colIndex];
            return newVal !== '' && newVal !== null && newVal !== undefined ? newVal : existingVal;
          });
          while (mergedData.length < rowData.length) {
            mergedData.push(rowData[mergedData.length]);
          }

          operations.push({
            type: 'update',
            rowIndex: existingPerson.rowIndex,
            category,
            data: mergedData,
          });
          updatedCount++;
        } else {
          // 새 행 추가 - 같은 카테고리 그룹 바로 아래에 삽입
          const lastRowOfCategory = categoryLastRowMap.get(category);
          const insertAfterRow = lastRowOfCategory || (existingRows.length + 2); // 없으면 맨 아래

          operations.push({
            type: 'insert',
            rowIndex: insertAfterRow,
            category,
            data: rowData,
          });

          // 카테고리 마지막 행 업데이트 (다음 삽입을 위해)
          categoryLastRowMap.set(category, insertAfterRow + 1);
          addedCount++;
        }
      }
    }

    // 5. 업데이트 실행
    // 먼저 삽입 작업을 행 번호 역순으로 정렬 (아래에서 위로 삽입해야 행 번호가 밀리지 않음)
    const insertOps = operations.filter(op => op.type === 'insert').sort((a, b) => b.rowIndex - a.rowIndex);
    const updateOps = operations.filter(op => op.type === 'update');

    // 행 삽입 및 데이터 쓰기
    for (const op of insertOps) {
      // 행 삽입 (해당 행 바로 아래에)
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            insertDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: op.rowIndex, // 0-based index
                endIndex: op.rowIndex + 1,
              },
              inheritFromBefore: true, // 위 행의 서식 상속 (색깔 등)
            },
          }],
        },
      });

      // 데이터 쓰기
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetTitle}'!A${op.rowIndex + 1}`, // 1-based row number
        valueInputOption: 'RAW',
        requestBody: { values: [op.data] },
      });
    }

    // 기존 행 업데이트
    for (const op of updateOps) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetTitle}'!A${op.rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: { values: [op.data] },
      });
    }

    console.log(`[Google Sheets] syncApisSpreadsheet: tripId=${tripId}, updated=${updatedCount}, added=${addedCount}`);

    return {
      ok: true,
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      rowCount: updatedCount + addedCount,
    };

  } catch (error: any) {
    console.error('[Google Sheets] syncApisSpreadsheet Error:', error);
    return { ok: false, error: error.message || 'Failed to sync APIS spreadsheet' };
  }
}

/**
 * @deprecated This function is no longer actively used.
 * Stub implementation to prevent build errors.
 */
export async function syncToMasterApisSheet(userId: number): Promise<SyncResult> {
  console.warn(`[Google Sheets] syncToMasterApisSheet is deprecated. Called with userId=${userId}`);
  return { ok: true, error: 'Function deprecated - no operation performed' };
}

interface PostData {
  id: number;
  title: string;
  content: string;
  category: string;
  authorName: string;
  createdAt: Date;
}

interface CommentData {
  id: number;
  postId: number;
  content: string;
  authorName: string;
  createdAt: Date;
}

/**
 * @deprecated This function is no longer actively used.
 * Stub implementation to prevent build errors.
 */
export async function savePostToSheets(data: PostData): Promise<SyncResult> {
  console.warn(`[Google Sheets] savePostToSheets is deprecated. Called with postId=${data.id}`);
  return { ok: true, error: 'Function deprecated - no operation performed' };
}

/**
 * @deprecated This function is no longer actively used.
 * Stub implementation to prevent build errors.
 */
export async function saveCommentToSheets(data: CommentData): Promise<SyncResult> {
  console.warn(`[Google Sheets] saveCommentToSheets is deprecated. Called with commentId=${data.id}`);
  return { ok: true, error: 'Function deprecated - no operation performed' };
}

/**
 * @deprecated This function is no longer actively used.
 * Stub implementation to prevent build errors.
 */
export async function updatePassportLinkInApis(reservationId: number, fileUrl: string): Promise<SyncResult> {
  console.warn(`[Google Sheets] updatePassportLinkInApis is deprecated. Called with reservationId=${reservationId}`);
  return { ok: true, error: 'Function deprecated - no operation performed' };
}

// ============================================================================
// APIS 동기화 with 재시도 로직
// ============================================================================

/**
 * APIS 스프레드시트 동기화 (재시도 로직 포함)
 * - 최대 3회 재시도
 * - 지수 백오프 (1초, 2초, 4초)
 * - 최종 실패 시 관리자 알림
 *
 * @param tripId - Trip ID
 * @param maxRetries - 최대 재시도 횟수 (기본값: 3)
 */
export async function syncApisWithRetry(
  tripId: number,
  maxRetries: number = 3
): Promise<SyncResult> {
  let lastError: string = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[APIS Sync] tripId=${tripId}, 시도 ${attempt}/${maxRetries}`);

      const result = await syncApisSpreadsheet(tripId);

      if (result.ok) {
        console.log(`[APIS Sync] tripId=${tripId}, 성공 (시도 ${attempt})`);

        // 백업 성공 로그 기록
        try {
          const { logApisSyncResult } = await import('@/lib/backup');
          await logApisSyncResult(
            tripId,
            `Trip #${tripId}`,
            true,
            result.rowCount,
            result.spreadsheetUrl
          );
        } catch (logError) {
          console.error('[APIS Sync] 로그 기록 실패:', logError);
        }

        return result;
      }

      lastError = result.error || 'Unknown error';
      console.warn(`[APIS Sync] tripId=${tripId}, 실패 (시도 ${attempt}): ${lastError}`);

    } catch (error: any) {
      lastError = error.message || 'Exception occurred';
      console.error(`[APIS Sync] tripId=${tripId}, 예외 (시도 ${attempt}):`, error);
    }

    // 마지막 시도가 아니면 대기 (지수 백오프)
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt - 1) * 1000; // 1초, 2초, 4초
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // 모든 재시도 실패 - 관리자 알림 + 백업 로그
  console.error(`[APIS Sync] tripId=${tripId}, 모든 재시도 실패`);

  try {
    const { notifyApisSyncFailed } = await import('@/lib/affiliate/admin-notifications');
    await notifyApisSyncFailed(tripId, lastError, maxRetries);
  } catch (notifyError) {
    console.error('[APIS Sync] 알림 전송 실패:', notifyError);
  }

  // 백업 실패 로그 기록
  try {
    const { logApisSyncResult } = await import('@/lib/backup');
    await logApisSyncResult(tripId, `Trip #${tripId}`, false, 0, undefined, lastError);
  } catch (logError) {
    console.error('[APIS Sync] 로그 기록 실패:', logError);
  }

  return {
    ok: false,
    error: `${maxRetries}회 재시도 후 실패: ${lastError}`,
  };
}

/**
 * APIS 동기화 (비동기, 에러 무시)
 * - 백그라운드에서 실행되며 실패해도 메인 작업에 영향 없음
 * - 재시도 로직 포함
 *
 * @param tripId - Trip ID
 */
export function syncApisInBackground(tripId: number): void {
  syncApisWithRetry(tripId).catch((err) => {
    console.error(`[APIS Sync Background] tripId=${tripId}, 최종 실패:`, err);
  });
}
