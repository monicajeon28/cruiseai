import { google } from 'googleapis';
import { getGoogleAuth, findOrCreateFolder, getDriveClient, uploadFileToDrive } from '@/lib/google-drive';

// Configuration Constants
const APIS_MAIN_FOLDER_ID = '185t2eIIPDsEm-QW9KmhTbxkrywFJhGdk'; // "여행 APIs" folder
const APIS_TEMPLATE_ID = '1Le6IPNzyvMqpn-6ZnqgvH0JTQ8O5rKymWMU_pkfbQ5Q'; // APIS Template Sheet ID
const PURCHASED_LIST_SHEET_ID = '14YAucoDM9Rn6Df4Fy10SUyAmhxb9Of8DTrM3fjQkPaI'; // "결제및정산판매목록" Sheet ID
const CERTIFICATE_FOLDER_ID = '1RpcvgcjVSW7nlvy5x9tJZyaYyYbutXpz'; // "구매확인증서" 저장 폴더

interface PaymentData {
    customerName: string;
    customerPhone: string;
    productName: string;
    departureDate: string;
    amount: number;
    headcount: number;
    orderId: string;
    managerName?: string;
    channel?: string;
}

/**
 * Ensures a folder exists for the specific trip (Product Name - Departure Date)
 * inside the main APIS folder.
 */
export async function ensureTripFolder(productName: string, departureDate: string): Promise<string> {
    const folderName = `${productName} - ${departureDate}`;

    try {
        // 1. Check if folder exists in the main APIS folder
        const result = await findOrCreateFolder(folderName, APIS_MAIN_FOLDER_ID);

        if (!result.ok || !result.folderId) {
            throw new Error(result.error || 'Failed to find or create trip folder');
        }

        console.log(`[Google Automation] Trip folder ensured: ${folderName} (${result.folderId})`);
        return result.folderId;
    } catch (error) {
        console.error('[Google Automation] Error ensuring trip folder:', error);
        throw error;
    }
}

/**
 * Ensures the APIS sheet exists in the trip folder.
 * If not, copies it from the template.
 */
export async function ensureApisSheet(folderId: string, productName: string, departureDate: string): Promise<string> {
    const sheetName = `[APIS] ${productName} (${departureDate})`;

    try {
        const drive = getDriveClient();

        // 1. Check if sheet already exists in the folder
        const q = `'${folderId}' in parents and name = '${sheetName}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
        const listRes = await drive.files.list({
            q,
            fields: 'files(id, name)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
        });

        if (listRes.data.files && listRes.data.files.length > 0) {
            console.log(`[Google Automation] APIS sheet already exists: ${listRes.data.files[0].id}`);
            return listRes.data.files[0].id!;
        }

        // 2. Copy from template
        const copyRes = await drive.files.copy({
            fileId: APIS_TEMPLATE_ID,
            requestBody: {
                name: sheetName,
                parents: [folderId],
            },
            supportsAllDrives: true,
        });

        const newSheetId = copyRes.data.id;
        if (!newSheetId) {
            throw new Error('Failed to copy APIS template');
        }

        console.log(`[Google Automation] Created new APIS sheet: ${newSheetId}`);
        return newSheetId;
    } catch (error) {
        console.error('[Google Automation] Error ensuring APIS sheet:', error);
        throw error;
    }
}

/**
 * Records payment information to the "Purchased List" spreadsheet.
 * This replaces the Apps Script functionality for direct API control.
 */
export async function recordPaymentToPurchasedList(data: PaymentData): Promise<void> {
    try {
        const auth = getGoogleAuth();
        const sheets = google.sheets({ version: 'v4', auth });

        const now = new Date();
        const kstDate = now.toLocaleString('ko-KR');
        const isoDate = now.toISOString().split('T')[0];

        // Determine target sheet name based on year-month (e.g., "2025-12")
        // If departure date is available, use that. Otherwise use current date.
        const targetDate = data.departureDate ? new Date(data.departureDate) : now;
        const sheetName = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;

        // Check if sheet exists, if not create it (optional, or just log error)
        // For now, we assume the sheet exists or we write to a default if not found.
        // Actually, the user mentioned "2025-12 시트에 입력이 1번 되어야 하고"

        const rowData = [
            '', // A: No (Auto-filled usually)
            isoDate, // B: 예약일
            data.orderId, // C: 예약번호
            data.productName, // D: 상품명
            data.departureDate, // E: 출발일
            '', // F: 객실 종류 (Unknown at this stage usually)
            '', // G:
            '', // H:
            data.customerName, // I: 성명
            '', // J:
            '', // K:
            '', // L:
            '', // M:
            '', // N:
            '', // O:
            data.customerPhone, // P: 고객연락처
            '', // Q:
            isoDate, // R: 결제일
            '카드', // S: 결제방법
            data.amount, // T: 결제금액
            data.managerName || '', // U: 연결담당자
            'System', // V: 최종수정자
            kstDate, // W: 최종수정일시
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: PURCHASED_LIST_SHEET_ID,
            range: `'${sheetName}'!A:W`, // Try to append to the specific month sheet
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [rowData],
            },
        });

        console.log(`[Google Automation] Recorded payment to sheet '${sheetName}'`);

    } catch (error: any) {
        console.error('[Google Automation] Error recording to purchased list:', error);
        // If the specific month sheet doesn't exist, maybe fallback to a default or log specific error
        if (error.message?.includes('Unable to parse range')) {
            console.warn(`[Google Automation] Sheet '${data.departureDate?.substring(0, 7)}' might not exist.`);
        }
    }
}

/**
 * Records initial passenger info to the APIS sheet.
 * This adds rows to the APIS sheet for the number of people in the order.
 */
export async function initApisSheetRows(sheetId: string, data: PaymentData): Promise<void> {
    try {
        const auth = getGoogleAuth();
        const sheets = google.sheets({ version: 'v4', auth });

        // Get sheet properties to find the correct sheet name/ID
        const meta = await sheets.spreadsheets.get({
            spreadsheetId: sheetId,
        });

        const sheetTitle = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';

        // Prepare rows based on headcount
        const rows = [];
        for (let i = 0; i < data.headcount; i++) {
            rows.push([
                '', // A: No
                '', // B:
                '', // C:
                '', // D:
                '', // E:
                '미지정', // F: 카테고리
                '', // G:
                '', // H:
                i === 0 ? data.customerName : '동행인', // I: 성명 (First row is booker)
                '', // J:
                '', // K:
                '', // L:
                '', // M:
                '', // N:
                '', // O:
                i === 0 ? data.customerPhone : '', // P: 연락처
                '', // Q:
                '', // R:
                '', // S:
                i === 0 ? `주문번호: ${data.orderId}` : '', // T: 비고
            ]);
        }

        if (rows.length > 0) {
            await sheets.spreadsheets.values.append({
                spreadsheetId: sheetId,
                range: `'${sheetTitle}'!A:T`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: rows,
                },
            });
            console.log(`[Google Automation] Initialized ${rows.length} rows in APIS sheet`);
        }

    } catch (error) {
        console.error('[Google Automation] Error initializing APIS rows:', error);
        throw error;
    }
}

/**
 * Uploads the generated certificate PNG to Google Drive.
 */
export async function uploadCertificateToDrive(buffer: Buffer, filename: string): Promise<string> {
    try {
        const result = await uploadFileToDrive({
            folderId: CERTIFICATE_FOLDER_ID,
            fileName: filename,
            mimeType: 'image/png',
            buffer: buffer,
        });

        if (!result.ok || !result.fileId) {
            throw new Error(result.error || 'Failed to upload certificate');
        }

        console.log(`[Google Automation] Certificate uploaded: ${filename} (${result.fileId})`);
        return result.fileId;
    } catch (error) {
        console.error('[Google Automation] Error uploading certificate:', error);
        throw error;
    }
}
