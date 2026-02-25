// lib/affiliate/contract-email.ts
// 계약서 PDF 이메일 전송 유틸리티

import nodemailer from 'nodemailer';
import { generateContractPDFFromId, saveContractPDF } from './contract-pdf';
import prisma from '@/lib/prisma';

/**
 * 이메일 발송기 생성
 */
function createEmailTransporter() {
  const smtpHost = process.env.EMAIL_SMTP_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.EMAIL_SMTP_PORT || process.env.SMTP_PORT || '587');
  const smtpUser = process.env.EMAIL_SMTP_USER || process.env.SMTP_USER;
  const smtpPassword = process.env.EMAIL_SMTP_PASSWORD || process.env.SMTP_PASS;
  const fromName = process.env.EMAIL_FROM_NAME || '크루즈 가이드';
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || smtpUser;

  if (!smtpUser || !smtpPassword) {
    throw new Error('이메일 설정이 완료되지 않았습니다.');
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });
}

/**
 * 계약서 PDF를 이메일로 전송
 */
export async function sendContractPDFByEmail(
  contractId: number,
  recipientEmail: string,
  recipientName: string,
  subject?: string,
  message?: string,
  cc?: string | string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[Contract PDF] Starting email send for contract ${contractId} to ${recipientEmail}`);
    
    // PDF 생성
    console.log(`[Contract PDF] Generating PDF for contract ${contractId}...`);
    const pdfBuffer = await generateContractPDFFromId(contractId);
    console.log(`[Contract PDF] PDF generated, size: ${pdfBuffer.length} bytes`);
    
    // PDF 파일로 저장 (선택사항)
    const pdfUrl = await saveContractPDF(contractId, pdfBuffer);
    console.log(`[Contract PDF] PDF saved to: ${pdfUrl}`);

    // 이메일 발송기 생성
    console.log(`[Contract PDF] Creating email transporter...`);
    const transporter = createEmailTransporter();
    console.log(`[Contract PDF] Email transporter created`);
    const fromName = process.env.EMAIL_FROM_NAME || '크루즈 가이드';
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_SMTP_USER || process.env.SMTP_USER || '';

    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      select: {
        name: true,
        metadata: true,
      },
    });

    if (!contract) {
      throw new Error('계약서를 찾을 수 없습니다.');
    }

    const metadata = contract.metadata as any;
    const contractTypeLabel = {
      SALES_AGENT: '판매원',
      BRANCH_MANAGER: '대리점장',
      CRUISE_STAFF: '크루즈 스태프',
      PRIMARKETER: '프리마케터',
    }[metadata?.contractType || 'SALES_AGENT'] || '어필리에이트';

    const emailSubject = subject || `[계약서 완료] 어필리에이트 ${contractTypeLabel} 계약서`;
    const emailMessage = message || `
      <div style="font-family: 'Malgun Gothic', sans-serif; padding: 20px;">
        <h2>계약서가 완료되었습니다</h2>
        <p>안녕하세요, ${recipientName}님,</p>
        <p>어필리에이트 ${contractTypeLabel} 계약서가 완료되어 첨부파일로 전송드립니다.</p>
        <p>계약서 내용을 확인하시기 바랍니다.</p>
        <p style="margin-top: 30px; color: #666; font-size: 12px;">
          본 계약서는 전자적으로 생성되었으며, 서명이 포함되어 있습니다.
        </p>
      </div>
    `;

    // 이메일 발송
    console.log(`[Contract PDF] Sending email to ${recipientEmail}...`);
    const mailOptions: any = {
      from: `"${fromName}" <${fromAddress}>`,
      to: recipientEmail,
      subject: emailSubject,
      html: emailMessage,
      attachments: [
        {
          filename: `계약서_${contract.name}_${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    };
    
    // CC 추가 (있는 경우)
    if (cc) {
      // CC는 문자열 또는 문자열 배열로 변환
      mailOptions.cc = Array.isArray(cc) ? cc : [cc];
      console.log(`[Contract PDF] CC: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
    }
    
    const emailResult = await transporter.sendMail(mailOptions);

    console.log(`[Contract PDF] 이메일 전송 성공: ${recipientEmail} (계약서 ID: ${contractId})`);
    console.log(`[Contract PDF] Email result:`, { messageId: emailResult.messageId, response: emailResult.response });
    console.log(`[Contract PDF] PDF 파일 경로: ${pdfUrl}`);
    console.log(`[Contract PDF] 첨부파일명: 계약서_${contract.name}_${new Date().toISOString().split('T')[0]}.pdf`);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(`[Contract PDF] 이메일 전송 실패 (계약서 ID: ${contractId}):`, error);
    console.error(`[Contract PDF] Error details:`, { message: errorMessage, stack: errorStack });
    return { success: false, error: errorMessage };
  }
}

/**
 * 계약서 서명 완료 시 본사에 PDF 전송
 */
export async function sendContractPDFToHeadOffice(contractId: number): Promise<void> {
  try {
    // 본사 이메일 주소 (환경 변수 또는 기본값)
    const headOfficeEmail = process.env.HEAD_OFFICE_EMAIL || process.env.ADMIN_EMAIL || 'hyeseon28@gmail.com';
    
    if (!headOfficeEmail) {
      console.warn('[Contract PDF] 본사 이메일 주소가 설정되지 않았습니다.');
      return;
    }

    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      select: {
        name: true,
        metadata: true,
      },
    });

    if (!contract) {
      throw new Error('계약서를 찾을 수 없습니다.');
    }

    await sendContractPDFByEmail(
      contractId,
      headOfficeEmail,
      '본사',
      `[계약서 서명 완료] ${contract.name}님의 어필리에이트 계약서`,
      `
        <div style="font-family: 'Malgun Gothic', sans-serif; padding: 20px;">
          <h2>계약서 서명이 완료되었습니다</h2>
          <p>${contract.name}님의 어필리에이트 계약서 서명이 완료되어 PDF로 전송드립니다.</p>
          <p>계약서 내용과 서명을 확인하시기 바랍니다.</p>
        </div>
      `
    );
  } catch (error) {
    console.error('[Contract PDF] 본사 전송 실패:', error);
    // 에러가 발생해도 계약서 처리는 계속 진행
  }
}

/**
 * 계약서 승인 시 계약자에게 PDF 전송
 */
export async function sendContractPDFToContractor(contractId: number): Promise<void> {
  try {
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      include: {
        User: {
          select: {
            email: true,
            name: true,
          },
        },
        AffiliateProfile: {
          select: {
            displayName: true,
            contactEmail: true,
          },
        },
      },
    });

    if (!contract) {
      throw new Error('계약서를 찾을 수 없습니다.');
    }

    const metadata = contract.metadata as any;
    const contractTypeLabel = {
      SALES_AGENT: '판매원',
      BRANCH_MANAGER: '대리점장',
      CRUISE_STAFF: '크루즈 스태프',
      PRIMARKETER: '프리마케터',
    }[metadata?.contractType || 'SALES_AGENT'] || '어필리에이트';

    // 계약자에게 PDF 전송
    const recipientEmail = contract.email || contract.User?.email;
    const recipientName = contract.name || contract.User?.name || '계약자';

    if (recipientEmail) {
      await sendContractPDFByEmail(
        contractId,
        recipientEmail,
        recipientName,
        `[계약서 승인 완료] 어필리에이트 ${contractTypeLabel} 계약서`,
        `
          <div style="font-family: 'Malgun Gothic', sans-serif; padding: 20px;">
            <h2>계약서가 승인되었습니다</h2>
            <p>안녕하세요, ${recipientName}님,</p>
            <p>귀하의 어필리에이트 ${contractTypeLabel} 계약서가 승인되어 완료된 계약서 PDF를 전송드립니다.</p>
            <p>계약서 내용과 서명을 확인하시기 바랍니다.</p>
            <p style="margin-top: 30px; color: #666; font-size: 12px;">
              본 계약서는 전자적으로 생성되었으며, 서명이 포함되어 있습니다.
            </p>
          </div>
        `
      );
    }

    // 대리점장이 초대한 경우, 대리점장에게도 PDF 전송
    if (contract.AffiliateProfile) {
      const branchManager = contract.AffiliateProfile;
      const branchManagerEmail = branchManager.contactEmail;
      const branchManagerName = branchManager.displayName || '대리점장';

      if (branchManagerEmail) {
        await sendContractPDFByEmail(
          contractId,
          branchManagerEmail,
          branchManagerName,
          `[계약서 승인 완료] ${recipientName}님의 어필리에이트 계약서`,
          `
            <div style="font-family: 'Malgun Gothic', sans-serif; padding: 20px;">
              <h2>계약서가 승인되었습니다</h2>
              <p>안녕하세요, ${branchManagerName}님,</p>
              <p>${recipientName}님의 어필리에이트 ${contractTypeLabel} 계약서가 승인되어 완료된 계약서 PDF를 전송드립니다.</p>
              <p>계약서 내용과 서명을 확인하시기 바랍니다.</p>
              <p style="margin-top: 30px; color: #666; font-size: 12px;">
                본 계약서는 전자적으로 생성되었으며, 서명이 포함되어 있습니다.
              </p>
            </div>
          `
        );
      }
    }
  } catch (error) {
    console.error('[Contract PDF] 계약자 전송 실패:', error);
    // 에러가 발생해도 계약서 처리는 계속 진행
  }
}

