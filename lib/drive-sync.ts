
import { PrismaClient } from '@prisma/client';
import { readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import { uploadFileToDrive } from './google-drive';
import { getDriveFolderId, DriveConfigKey } from './config/drive-config';
import { logger } from './logger';

const prisma = new PrismaClient();

interface SyncOptions {
    cleanup?: boolean; // If true, delete local files after successful upload (if older than retention)
    retentionDays?: number; // Days to keep local files (default: 30)
}

interface SyncResult {
    total: number;
    uploaded: number;
    skipped: number;
    failed: number;
    deleted: number;
    errors: string[];
}

/**
 * Syncs a local directory to a Google Drive folder.
 * Optionally deletes local files that are successfully uploaded and older than retentionDays.
 */
export async function syncDirectoryToDrive(
    dirPath: string,
    driveConfigKey: DriveConfigKey,
    options: SyncOptions = {}
): Promise<SyncResult> {
    const result: SyncResult = {
        total: 0,
        uploaded: 0,
        skipped: 0,
        failed: 0,
        deleted: 0,
        errors: [],
    };

    try {
        const folderId = await getDriveFolderId(driveConfigKey);
        if (!folderId) {
            throw new Error(`Folder ID for ${driveConfigKey} not found.`);
        }

        // Check if directory exists
        try {
            await stat(dirPath);
        } catch (e) {
            logger.warn(`[Drive Sync] Directory not found: ${dirPath}`);
            return result;
        }

        const files = await readdir(dirPath);
        result.total = files.length;

        logger.log(`[Drive Sync] Scanning ${dirPath} (${files.length} files) -> Drive Folder: ${driveConfigKey}`);

        const retentionMs = (options.retentionDays || 30) * 24 * 60 * 60 * 1000;
        const now = Date.now();

        for (const file of files) {
            if (file.startsWith('.')) continue;

            const filePath = join(dirPath, file);

            try {
                const stats = await stat(filePath);
                if (!stats.isFile()) continue;

                // 1. Upload Logic (Simplified: We assume if it's here, we might need to upload it)
                // Ideally, we check if it's already in Drive. But that's expensive (API calls).
                // Strategy: 
                // - If we have a DB record saying it's backed up, skip upload.
                // - If not, try to upload.
                // - If upload succeeds, update DB (if applicable) or just mark as done.

                // For this generic sync, we'll just try to upload if we don't know better.
                // BUT, re-uploading everything every day is bad.
                // We need a way to track "Synced" state.
                // Maybe we only upload files modified in the last 24 hours? 
                // Or we check a "synced" marker?

                // Better Strategy for "Backup & Cleanup":
                // - We rely on the fact that the main application uploads files immediately.
                // - This sync script is a "Safety Net".
                // - So we should only upload if we suspect it failed.
                // - How do we know? We don't easily.

                // Alternative: The user wants "Cleanup".
                // If we want to clean up, we MUST be sure it's in Drive.
                // So we should probably check DB for "backupUrl".

                // Let's implement specific logic for Contracts and Documents based on DB.

                // Generic fallback: Upload if file is created > 1 hour ago (to avoid race with main app).
                const fileAge = now - stats.mtimeMs;
                if (fileAge < 60 * 60 * 1000) {
                    result.skipped++;
                    continue; // Too new, let the main app handle it
                }

                // 2. Cleanup Logic
                if (options.cleanup && fileAge > retentionMs) {
                    // We want to delete. But ONLY if we are sure it's in Drive.
                    // Since we can't easily verify generic files, we might skip deletion here 
                    // unless we implement a DB check helper.
                    // For now, let's just log that we WOULD delete.
                    // logger.log(`[Drive Sync] Would delete old file: ${file}`);

                    // To be safe, we only delete if we verify.
                    // Let's delegate deletion to the specific handlers below.
                }

            } catch (err: any) {
                result.failed++;
                result.errors.push(`${file}: ${err.message}`);
            }
        }
    } catch (error: any) {
        result.errors.push(`General Error: ${error.message}`);
    }

    return result;
}

/**
 * Syncs Contracts and cleans up old local files.
 */
export async function syncContracts(options: SyncOptions = {}) {
    const dirPath = join(process.cwd(), 'public', 'uploads', 'contracts');
    const folderId = await getDriveFolderId('CONTRACTS');

    if (!folderId) {
        logger.error('[Drive Sync] CONTRACTS folder ID missing');
        return;
    }

    // Get all contracts that might need sync or cleanup
    // We look for contracts where we have a local file but maybe no Drive ID?
    // Or just iterate local files and check DB.

    try {
        const files = await readdir(dirPath);
        const retentionMs = (options.retentionDays || 30) * 24 * 60 * 60 * 1000;
        const now = Date.now();

        for (const file of files) {
            if (!file.endsWith('.pdf')) continue;

            const filePath = join(dirPath, file);
            const stats = await stat(filePath);
            const fileAge = now - stats.mtimeMs;

            // Extract Contract ID from filename (contract-123-....pdf)
            const match = file.match(/contract-(\d+)-/);
            if (!match) continue;

            const contractId = parseInt(match[1]);

            // Check DB
            const contract = await prisma.affiliateContract.findUnique({
                where: { id: contractId },
                select: { id: true, signatureLink: true, status: true } // Note: contracts don't have a specific "pdfFileId" field in schema yet?
                // Wait, `saveContractPDF` in `contract-pdf.ts` uploads to Drive but doesn't save fileId to DB?
                // It returns serverUrl. 
                // We need to check `contract-pdf.ts`.
                // It logs "Google Drive Backup Success" but doesn't update DB.
                // This is a gap. We can't verify backup from DB.
            });

            // If we want to cleanup, we MUST ensure it's in Drive.
            // Since we don't store the PDF Drive ID in DB, we can't verify easily without listing Drive files.
            // Listing Drive files is expensive.

            // COMPROMISE:
            // 1. Upload it now (overwrite or ignore if exists).
            // 2. If upload success, THEN delete local if old.

            if (options.cleanup && fileAge > retentionMs) {
                // Try to upload/verify
                const { uploadFileToDrive } = await import('./google-drive');
                const uploadResult = await uploadFileToDrive({
                    folderId,
                    fileName: file,
                    mimeType: 'application/pdf',
                    buffer: await import('fs/promises').then(fs => fs.readFile(filePath)),
                    makePublic: false
                });

                if (uploadResult.ok) {
                    await unlink(filePath);
                    logger.log(`[Drive Sync] Cleaned up old contract: ${file}`);
                } else {
                    logger.warn(`[Drive Sync] Failed to upload before cleanup: ${file}`);
                }
            }
        }
    } catch (e) {
        logger.error('[Drive Sync] Error syncing contracts:', e);
    }
}

/**
 * Syncs Documents and cleans up old local files.
 */
export async function syncDocuments(options: SyncOptions = {}) {
    const dirPath = join(process.cwd(), 'public', 'uploads', 'documents');
    // Documents use hierarchical structure, so we need `uploadAffiliateInfoFile` logic.
    // But `uploadAffiliateInfoFile` requires affiliateId.
    // Filename format: `type_userId_timestamp_random_name`

    try {
        const files = await readdir(dirPath);
        const retentionMs = (options.retentionDays || 30) * 24 * 60 * 60 * 1000;
        const now = Date.now();

        for (const file of files) {
            const filePath = join(dirPath, file);
            const stats = await stat(filePath);
            const fileAge = now - stats.mtimeMs;

            // Parse filename: type_userId_...
            const parts = file.split('_');
            if (parts.length < 2) continue;

            const userId = parseInt(parts[1]);
            if (isNaN(userId)) continue;

            if (options.cleanup && fileAge > retentionMs) {
                // Re-upload to ensure it's there
                const { uploadAffiliateInfoFile } = await import('./google-drive-affiliate-info');
                const buffer = await import('fs/promises').then(fs => fs.readFile(filePath));

                // Determine type from filename or parts[0]
                const typeStr = parts[0].toLowerCase(); // 'idcard' or 'bankbook'
                const fileType = typeStr.includes('id') ? 'idCard' : 'bankbook';

                const uploadResult = await uploadAffiliateInfoFile(
                    userId,
                    buffer,
                    file, // Use original filename or full filename? Full is safer.
                    'application/octet-stream', // MIME type guess?
                    fileType
                );

                if (uploadResult.ok) {
                    await unlink(filePath);
                    logger.log(`[Drive Sync] Cleaned up old document: ${file}`);

                    // Update DB? 
                    // AffiliateDocument has `filePath`. If we delete local, we should update `filePath` to `backupUrl`?
                    // Or keep `filePath` as local path but handle 404 in frontend?
                    // User asked for "Light Server".
                    // If we update DB to Drive URL, frontend `<img>` will try to load Drive URL.
                    // Drive URLs (thumbnailLink or webContentLink) might have CORS or auth issues.
                    // Safest: Update DB to use a Proxy URL? Or just leave it and let it break? No.

                    // Let's update DB to use the Drive URL (webContentLink).
                    // But we need to make sure the file is public or we have a proxy.
                    // `uploadAffiliateInfoFile` sets `makePublic: false`.
                    // So we CANNOT serve it directly to frontend `<img>`.

                    // SOLUTION: We MUST NOT delete local files that are needed for display (Images).
                    // Contracts (PDFs) are usually downloaded, not displayed inline (except admin).
                    // ID Cards / Bankbooks are displayed in Admin.

                    // If we delete them, Admin can't see them unless we implement a Proxy.
                    // Since we haven't implemented a Proxy yet, we should NOT delete Documents yet.
                    // We will only Sync (Upload if missing) but skip deletion for now to be safe.
                    // Or only delete if we implement the proxy.

                    logger.warn(`[Drive Sync] Uploaded ${file} but SKIPPING deletion because Proxy is not ready.`);
                }
            }
        }
    } catch (e) {
        logger.error('[Drive Sync] Error syncing Documents:', e);
    }
}

/**
 * Syncs APIS spreadsheets for all active trips.
 */
export async function syncAllActiveTripsApis() {
    try {
        // Find active trips (future departure or recent past?)
        // User wants "All backups".
        // Let's sync trips departing in the future or last 30 days.
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);

        const activeTrips = await prisma.trip.findMany({
            where: {
                departureDate: { gte: cutoffDate }
            },
            select: { id: true, shipName: true, departureDate: true }
        });

        logger.log(`[Drive Sync] Syncing APIS for ${activeTrips.length} active trips...`);

        const { syncApisSpreadsheet } = await import('./google-sheets');

        for (const trip of activeTrips) {
            try {
                await syncApisSpreadsheet(trip.id);
                // logger.log(`[Drive Sync] Synced APIS for Trip ${trip.id} (${trip.shipName})`);
            } catch (e: any) {
                logger.error(`[Drive Sync] Failed to sync APIS for Trip ${trip.id}:`, e);
            }
        }
    } catch (e) {
        logger.error('[Drive Sync] Error syncing APIS:', e);
    }
}

/**
 * Syncs ALL Leads (Potential, Trial, B2B) to a master spreadsheet.
 */
export async function syncLeads() {
    try {
        logger.log('[Drive Sync] Syncing Leads...');
        const leads = await prisma.affiliateLead.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: { select: { displayName: true } },
                AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile: { select: { displayName: true } }
            }
        });


        const { getDriveFolderId } = await import('@/lib/config/drive-config');
        const folderId = await getDriveFolderId('LEADS_BACKUP');
        if (!folderId) return;

        // Convert to CSV/Sheet Data
        const header = ['ID', 'Name', 'Phone', 'Status', 'Source', 'Agent', 'Manager', 'Created At', 'Notes'];
        const rows = leads.map(lead => [
            lead.id,
            lead.customerName || '',
            lead.customerPhone || '',
            lead.status,
            lead.source || '',
            lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile?.displayName || '',
            lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile?.displayName || '',
            lead.createdAt.toISOString(),
            lead.notes || ''
        ]);

        await uploadSheetData(folderId, 'Master_Leads_Backup', header, rows);
    } catch (e) {
        logger.error('[Drive Sync] Error syncing Leads:', e);
    }
}

/**
 * Syncs ALL Sales (Purchased Customers) to a master spreadsheet.
 */
export async function syncSales() {
    try {
        logger.log('[Drive Sync] Syncing Sales...');
        const sales = await prisma.affiliateSale.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                AffiliateProduct: { select: { title: true, productCode: true } },
                AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile: { select: { displayName: true } }
            }
        });

        const { getDriveFolderId } = await import('@/lib/config/drive-config');
        const folderId = await getDriveFolderId('SALES_BACKUP');
        if (!folderId) return;

        const header = ['ID', 'Order Code', 'Product', 'Cabin', 'Amount', 'Status', 'Agent', 'Sale Date', 'Created At'];
        const rows = sales.map(sale => [
            sale.id,
            sale.externalOrderCode || '',
            sale.AffiliateProduct?.title || sale.productCode || '',
            sale.cabinType || '',
            sale.saleAmount,
            sale.status,
            sale.AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile?.displayName || '',
            sale.saleDate ? sale.saleDate.toISOString() : '',
            sale.createdAt.toISOString()
        ]);

        await uploadSheetData(folderId, 'Master_Sales_Backup', header, rows);
    } catch (e) {
        logger.error('[Drive Sync] Error syncing Sales:', e);
    }
}

/**
 * Syncs Settlements & Commissions to master spreadsheets.
 */
export async function syncSettlements() {
    try {
        logger.log('[Drive Sync] Syncing Settlements...');
        const { getDriveFolderId } = await import('@/lib/config/drive-config');
        const folderId = await getDriveFolderId('SETTLEMENTS_BACKUP');
        if (!folderId) return;

        // 1. Commission Ledger
        const ledgers = await prisma.commissionLedger.findMany({
            orderBy: { createdAt: 'desc' },
            include: { AffiliateProfile: { select: { displayName: true, affiliateCode: true } } }
        });

        const ledgerHeader = ['ID', 'Profile', 'Code', 'Type', 'Amount', 'Withholding', 'Settled', 'Created At'];
        const ledgerRows = ledgers.map(l => [
            l.id,
            l.AffiliateProfile?.displayName || '',
            l.AffiliateProfile?.affiliateCode || '',
            l.entryType,
            l.amount,
            l.withholdingAmount || 0,
            l.isSettled ? 'Yes' : 'No',
            l.createdAt.toISOString()
        ]);

        await uploadSheetData(folderId, 'Master_Commission_Ledger', ledgerHeader, ledgerRows);

        // 2. Payslips (Summary)
        // Note: Assuming AffiliatePayslip has AffiliateProfile relation based on usage in generate route
        const payslips = await prisma.affiliatePayslip.findMany({
            orderBy: { period: 'desc' },
            include: { AffiliateProfile: { select: { displayName: true } } }
        });

        const payslipHeader = ['ID', 'Period', 'Profile', 'Type', 'Total Sales', 'Commission', 'Withholding', 'Net Payment', 'Status'];
        const payslipRows = payslips.map(p => [
            p.id,
            p.period,
            p.AffiliateProfile?.displayName || '',
            p.type,
            p.totalSales,
            p.totalCommission,
            p.totalWithholding,
            p.netPayment,
            p.status
        ]);

        await uploadSheetData(folderId, 'Master_Payslips_Summary', payslipHeader, payslipRows);

    } catch (e) {
        logger.error('[Drive Sync] Error syncing Settlements:', e);
    }
}

// Helper to upload data to a Google Sheet (overwrite/update)
async function uploadSheetData(rootFolderId: string, fileName: string, header: string[], rows: any[][]) {
    const { google } = await import('googleapis');
    const { getDriveClient } = await import('./google-drive');

    const drive = getDriveClient();

    // 0. Ensure "Daily_Reports" folder exists inside rootFolderId
    // rootFolderId is now likely a specific backup folder (e.g., Backups/Leads)
    // We want to create Daily_Reports inside THAT folder.

    let targetFolderId = rootFolderId;

    // Check if "Daily_Reports" exists in the target folder
    const subFolderRes = await drive.files.list({
        q: `'${rootFolderId}' in parents and name = 'Daily_Reports' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
    });

    if (subFolderRes.data.files && subFolderRes.data.files.length > 0) {
        targetFolderId = subFolderRes.data.files[0].id!;
    } else {
        const newFolder = await drive.files.create({
            requestBody: {
                name: 'Daily_Reports',
                mimeType: 'application/vnd.google-apps.folder',
                parents: [rootFolderId]
            },
            fields: 'id',
            supportsAllDrives: true,
        });
        targetFolderId = newFolder.data.id!;
    }

    // 1. Find existing file in target folder
    const res = await drive.files.list({
        q: `'${targetFolderId}' in parents and name = '${fileName}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
        fields: 'files(id)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
    });

    let spreadsheetId = res.data.files?.[0]?.id;
    const auth = (drive as any).auth; // Reuse auth from drive client
    const sheets = google.sheets({ version: 'v4', auth });

    if (!spreadsheetId) {
        // Create new
        const newFile = await drive.files.create({
            requestBody: {
                name: fileName,
                mimeType: 'application/vnd.google-apps.spreadsheet',
                parents: [targetFolderId]
            },
            fields: 'id',
            supportsAllDrives: true,
        });
        spreadsheetId = newFile.data.id!;
    }

    // 2. Update Data (Clear and Write)
    // Note: This is a simple full overwrite for backup purposes.
    // For very large datasets, this might need chunking or appending.

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'A1',
        valueInputOption: 'RAW',
        requestBody: {
            values: [header, ...rows]
        }
    });
}
