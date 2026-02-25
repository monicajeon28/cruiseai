import { getGoogleAccessToken } from '@/lib/google-auth-jwt';

// 고정된 B2B 잠재고객 백업 스프레드시트 ID
// 모든 판매원, 대리점장에서 들어오는 B2B DB가 이 시트로 백업됨
const B2B_BACKUP_SPREADSHEET_ID = '11_cfi841QGIDaBmYdjdk3aHYp2UYpCnx1QVVrgV7QJY';

/**
 * Google Sheets REST API로 데이터 추가 (googleapis 대신 직접 호출)
 * Vercel 번들링 이슈 회피
 */
async function appendToSheet(sheetName: string, values: (string | number)[]): Promise<boolean> {
  try {
    const accessToken = await getGoogleAccessToken();
    const range = encodeURIComponent(`${sheetName}!A1`);

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${B2B_BACKUP_SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [values],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[B2B Backup] Sheet append failed:`, errorText);
      return false;
    }

    console.log(`[B2B Backup] Successfully appended to sheet: ${sheetName}`);
    return true;
  } catch (error) {
    console.error(`[B2B Backup] Failed to append to sheet ${sheetName}:`, error);
    return false;
  }
}

/**
 * Appends a new B2B lead to the fixed Google Sheet.
 * All B2B leads from all partners (branch managers and sales agents) go to this single sheet.
 */
export async function appendB2BLeadToSheet(leadData: {
    name: string;
    phone: string;
    partnerName: string;
    source: string;
    createdAt: string;
    notes?: string;
}) {
    return appendToSheet('B2B 잠재고객', [
        leadData.name,
        leadData.phone,
        leadData.partnerName,
        leadData.source,
        leadData.createdAt,
        leadData.notes || ''
    ]);
}

/**
 * 시스템 상담 신청을 스프레드시트에 백업
 */
export async function appendSystemConsultationToSheet(data: {
    name: string;
    phone: string;
    partnerName: string;
    status: string;
    createdAt: string;
    message?: string;
}) {
    return appendToSheet('시스템 상담', [
        data.name,
        data.phone,
        data.partnerName,
        data.status,
        data.createdAt,
        data.message || ''
    ]);
}

/**
 * B2B 잠재고객 상담기록을 스프레드시트 "B2B유입 상담기록" 시트에 백업
 * 컬럼: 상담ID, 고객ID, 고객이름, 연락처, 상담일시, 상담내용, 상담자, 상담자유형, 다음조치일, 다음조치메모, 상담후상태, 녹음파일링크, 등록일
 */
export async function appendConsultationNoteToSheet(data: {
    consultationId: number;
    customerId: number;
    customerName: string;
    customerPhone: string;
    consultedAt: string;
    content: string;
    consultantName: string;
    consultantType: string; // '본사' | '대리점장' | '판매원'
    nextActionDate?: string | null;
    nextActionNote?: string | null;
    statusAfter?: string | null;
    audioFileUrl?: string | null;
    createdAt: string;
}) {
    return appendToSheet('B2B유입 상담기록', [
        data.consultationId,
        data.customerId,
        data.customerName,
        data.customerPhone,
        data.consultedAt,
        data.content,
        data.consultantName,
        data.consultantType,
        data.nextActionDate || '',
        data.nextActionNote || '',
        data.statusAfter || '',
        data.audioFileUrl || '',
        data.createdAt,
    ]);
}

/**
 * 시스템 문의 상담기록을 스프레드시트 "시스템상담 상담기록" 시트에 백업
 * 컬럼: 노트ID, 문의ID, 고객이름, 연락처, 담당파트너, 상담일시, 상담내용, 상담자, 상담자유형, 다음조치일, 다음조치메모, 상담후상태, 녹음파일링크, 등록일
 */
export async function appendSystemConsultationNoteToSheet(data: {
    noteId: number;
    consultationId: number;
    customerName: string;
    customerPhone: string;
    partnerName: string;
    consultedAt: string;
    content: string;
    consultantName: string;
    consultantType: string; // '본사' | '대리점장' | '판매원'
    nextActionDate?: string | null;
    nextActionNote?: string | null;
    statusAfter?: string | null;
    audioFileUrl?: string | null;
    createdAt: string;
}) {
    return appendToSheet('시스템상담 상담기록', [
        data.noteId,
        data.consultationId,
        data.customerName,
        data.customerPhone,
        data.partnerName,
        data.consultedAt,
        data.content,
        data.consultantName,
        data.consultantType,
        data.nextActionDate || '',
        data.nextActionNote || '',
        data.statusAfter || '',
        data.audioFileUrl || '',
        data.createdAt,
    ]);
}
