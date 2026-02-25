import prisma from '@/lib/prisma';
import dayjs from 'dayjs';
import { generatePayslipPDF } from '@/lib/affiliate/payslip-pdf';
import { uploadFileToDrive, findOrCreateFolder } from '@/lib/google-drive';

/**
 * 지급명세서 자동 발송 스케줄러
 * 매월 1일에 승인된 지급명세서를 자동으로 발송합니다.
 */

/**
 * 승인된 지급명세서 발송
 */
export async function sendApprovedPayslips() {
  console.log('[Payslip Sender] Starting to send approved payslips...');

  try {
    // 전월 기간 계산
    const lastMonth = dayjs().subtract(1, 'month').format('YYYY-MM');

    // 승인되었지만 아직 발송되지 않은 지급명세서 조회
    const payslips = await prisma.affiliatePayslip.findMany({
      where: {
        period: lastMonth,
        status: 'APPROVED',
        sentAt: null,
      },
      include: {
        AffiliateProfile: {
          select: {
            userId: true,
            displayName: true,
            type: true,
            bankName: true,
            bankAccount: true,
            bankAccountHolder: true,
          },
        },
      },
    });

    if (payslips.length === 0) {
      console.log('[Payslip Sender] No payslips to send');
      return {
        ok: true,
        message: 'No payslips to send',
        sent: 0,
        failed: 0,
      };
    }

    console.log(`[Payslip Sender] Found ${payslips.length} payslips to send`);

    // 구글 드라이브 폴더 생성 (지급명세서 저장용)
    const folderResult = await findOrCreateFolder(`Payslips_${lastMonth}`);
    if (!folderResult.ok || !folderResult.folderId) {
      throw new Error('Failed to create/find Google Drive folder');
    }

    const folderId = folderResult.folderId;

    let sentCount = 0;
    let failedCount = 0;

    for (const payslip of payslips) {
      try {
        // PDF 생성
        const pdfBuffer = await generatePayslipPDF(payslip as any);

        // 파일명 생성
        const fileName = `Payslip_${payslip.AffiliateProfile.displayName}_${payslip.period}.pdf`;

        // 구글 드라이브에 업로드
        const uploadResult = await uploadFileToDrive({
          folderId,
          fileName,
          mimeType: 'application/pdf',
          buffer: pdfBuffer,
          makePublic: false,
        });

        if (!uploadResult.ok) {
          throw new Error(uploadResult.error || 'Failed to upload PDF');
        }

        // 지급명세서 업데이트 (발송 완료 처리)
        await prisma.affiliatePayslip.update({
          where: { id: payslip.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            pdfUrl: uploadResult.url,
          },
        });

        console.log(
          `[Payslip Sender] Sent payslip ${payslip.id} to ${payslip.AffiliateProfile.displayName}`
        );

        sentCount++;
      } catch (error) {
        console.error(
          `[Payslip Sender] Failed to send payslip ${payslip.id}:`,
          error
        );
        failedCount++;
      }
    }

    // 발송 로그 저장
    try {
      await prisma.adminActionLog.create({
        data: {
          adminId: 1, // 시스템 관리자
          action: 'PAYSLIP_AUTO_SEND',
          details: {
            period: lastMonth,
            total: payslips.length,
            sent: sentCount,
            failed: failedCount,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (logError) {
      console.error('[Payslip Sender] Failed to log send action:', logError);
    }

    console.log(
      `[Payslip Sender] Completed: ${sentCount} sent, ${failedCount} failed`
    );

    return {
      ok: true,
      message: `${sentCount}/${payslips.length} payslips sent successfully`,
      sent: sentCount,
      failed: failedCount,
    };
  } catch (error: any) {
    console.error('[Payslip Sender] Error:', error);
    return {
      ok: false,
      error: error.message || 'Failed to send payslips',
      sent: 0,
      failed: 0,
    };
  }
}

/**
 * 지급명세서 발송 스케줄러 시작
 * 매월 1일 오전 9시에 실행
 */
export function startPayslipSenderScheduler() {
  const cron = require('node-cron');

  // 매월 1일 오전 9시 (KST)
  cron.schedule(
    '0 9 1 * *',
    async () => {
      console.log('[Payslip Sender Scheduler] Running scheduled payslip send...');
      try {
        const result = await sendApprovedPayslips();
        console.log('[Payslip Sender Scheduler] Result:', result);
      } catch (error) {
        console.error('[Payslip Sender Scheduler] Error:', error);
      }
    },
    {
      timezone: 'Asia/Seoul', // 한국 시간 기준
    }
  );

  console.log(
    '💼 [Payslip Sender Scheduler] Started - Will run on 1st day of each month at 9:00 AM KST'
  );
}

/**
 * 수동 실행용 함수
 */
export async function manualSendPayslips() {
  console.log('[Payslip Sender] Manual send triggered');
  return await sendApprovedPayslips();
}



















