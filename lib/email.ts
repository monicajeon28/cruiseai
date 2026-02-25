// lib/email.ts
// 이메일 전송 유틸리티

import nodemailer from 'nodemailer';
import { logger } from './logger';

/**
 * HTML 이스케이프 함수 - XSS 방지
 * 사용자 입력 값을 HTML 템플릿에 삽입할 때 사용
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 이메일 전송 설정
const getEmailTransporter = () => {
  const smtpHost = process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.EMAIL_SMTP_PORT || '587', 10);
  const smtpUser = process.env.EMAIL_SMTP_USER;
  const smtpPassword = process.env.EMAIL_SMTP_PASSWORD;
  const smtpFrom = process.env.EMAIL_SMTP_FROM || smtpUser;

  if (!smtpUser || !smtpPassword) {
    logger.warn('[Email] SMTP 설정이 없습니다. 이메일 전송 기능을 사용할 수 없습니다.');
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // 465 포트는 TLS 사용
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });
};

/**
 * 비밀번호 찾기 이메일 전송
 */
export async function sendPasswordResetEmail(
  to: string,
  userName: string,
  password: string
): Promise<boolean> {
  try {
    const transporter = getEmailTransporter();
    if (!transporter) {
      logger.error('[Email] SMTP 설정이 없어 이메일을 전송할 수 없습니다.');
      return false;
    }

    const smtpFrom = process.env.EMAIL_SMTP_FROM || process.env.EMAIL_SMTP_USER || 'noreply@cruisedot.kr';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cruisedot.kr';

    const mailOptions = {
      from: `크루즈닷 <${smtpFrom}>`,
      to: to,
      subject: '[크루즈닷] 비밀번호 찾기 결과',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #ffffff;
              border: 1px solid #e0e0e0;
              border-radius: 8px;
              padding: 30px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 10px;
            }
            .title {
              font-size: 20px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 20px;
            }
            .content {
              background-color: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 20px;
              margin: 20px 0;
            }
            .password-box {
              background-color: #ffffff;
              border: 2px solid #2563eb;
              border-radius: 6px;
              padding: 15px;
              text-align: center;
              margin: 20px 0;
            }
            .password {
              font-size: 24px;
              font-weight: bold;
              color: #2563eb;
              letter-spacing: 2px;
            }
            .warning {
              background-color: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
            .button {
              display: inline-block;
              background-color: #2563eb;
              color: #ffffff;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">크루즈닷</div>
              <div class="title">비밀번호 찾기 결과</div>
            </div>
            
            <p>안녕하세요, <strong>${escapeHtml(userName)}</strong>님.</p>

            <p>크루즈닷 비밀번호 찾기 요청이 접수되었습니다.</p>

            <div class="content">
              <p>회원님의 비밀번호는 아래와 같습니다:</p>

              <div class="password-box">
                <div class="password">${escapeHtml(password)}</div>
              </div>
            </div>
            
            <div class="warning">
              <strong>⚠️ 보안 안내</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>이 이메일은 비밀번호 찾기 요청에 대한 응답입니다.</li>
                <li>비밀번호를 안전하게 보관하시기 바랍니다.</li>
                <li>로그인 후 비밀번호를 변경하시는 것을 권장합니다.</li>
                <li>본인이 요청하지 않은 경우, 즉시 고객센터로 연락해주세요.</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/mall/login" class="button">로그인하기</a>
            </div>
            
            <div class="footer">
              <p>이 이메일은 자동으로 발송된 메일입니다.</p>
              <p>문의사항이 있으시면 고객센터로 연락해주세요.</p>
              <p>&copy; ${new Date().getFullYear()} 크루즈닷. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
크루즈닷 비밀번호 찾기 결과

안녕하세요, ${userName}님.

크루즈닷 비밀번호 찾기 요청이 접수되었습니다.

회원님의 비밀번호는 아래와 같습니다:

${password}

⚠️ 보안 안내
- 이 이메일은 비밀번호 찾기 요청에 대한 응답입니다.
- 비밀번호를 안전하게 보관하시기 바랍니다.
- 로그인 후 비밀번호를 변경하시는 것을 권장합니다.
- 본인이 요청하지 않은 경우, 즉시 고객센터로 연락해주세요.

로그인: ${baseUrl}/mall/login

이 이메일은 자동으로 발송된 메일입니다.
문의사항이 있으시면 고객센터로 연락해주세요.

© ${new Date().getFullYear()} 크루즈닷. All rights reserved.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.log('[Email] 비밀번호 찾기 이메일 전송 성공:', {
      to,
      messageId: info.messageId,
    });
    return true;
  } catch (error: any) {
    logger.error('[Email] 비밀번호 찾기 이메일 전송 실패:', {
      to,
      error: error.message,
    });
    return false;
  }
}

/**
 * 관리자에게 문의 알림 이메일 전송
 */
export async function sendInquiryNotificationEmail(
  inquiryData: {
    inquiryId: number;
    productCode: string;
    productName: string;
    customerName: string;
    customerPhone: string;
    passportNumber?: string | null;
    message?: string | null;
    isPhoneConsultation?: boolean;
    inquiryUrl?: string;
  }
): Promise<boolean> {
  try {
    const transporter = getEmailTransporter();
    if (!transporter) {
      logger.error('[Email] SMTP 설정이 없어 이메일을 전송할 수 없습니다.');
      return false;
    }

    // 관리자 이메일 주소 가져오기 (SystemConfig 우선, 없으면 환경 변수)
    let adminEmail: string | null = null;
    try {
      const prisma = (await import('@/lib/prisma')).default;
      const adminEmailConfig = await prisma.systemConfig.findUnique({
        where: { configKey: 'admin_email' },
      });
      adminEmail = adminEmailConfig?.configValue || null;
    } catch (error) {
      logger.warn('[Email] SystemConfig에서 admin_email 조회 실패, 환경 변수 사용:', error);
    }
    
    // SystemConfig에 없으면 환경 변수 사용
    if (!adminEmail) {
      adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_SMTP_USER || null;
    }
    
    if (!adminEmail) {
      logger.warn('[Email] ADMIN_EMAIL이 설정되지 않아 문의 알림을 전송할 수 없습니다.');
      return false;
    }

    const smtpFrom = process.env.EMAIL_SMTP_FROM || process.env.EMAIL_SMTP_USER || 'noreply@cruisedot.kr';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.cruisedot.co.kr';
    const inquiryUrl = inquiryData.inquiryUrl || `${baseUrl}/admin/inquiries/${inquiryData.inquiryId}`;

    const inquiryType = inquiryData.isPhoneConsultation ? '전화상담 신청' : '구매 문의';
    const inquiryTypeBadge = inquiryData.isPhoneConsultation 
      ? '<span style="background-color: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">전화상담</span>'
      : '<span style="background-color: #10b981; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">구매문의</span>';

    const mailOptions = {
      from: `크루즈닷 알림 <${smtpFrom}>`,
      to: adminEmail,
      subject: `[크루즈닷] 새로운 ${inquiryType} 접수 - ${inquiryData.customerName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background-color: #ffffff;
              border: 1px solid #e0e0e0;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #2563eb;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 10px;
            }
            .title {
              font-size: 20px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 10px;
            }
            .badge {
              display: inline-block;
              margin-top: 10px;
            }
            .content {
              background-color: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 20px;
              margin: 20px 0;
            }
            .info-row {
              display: flex;
              padding: 10px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .info-label {
              font-weight: bold;
              color: #6b7280;
              width: 120px;
              flex-shrink: 0;
            }
            .info-value {
              color: #1f2937;
              flex: 1;
            }
            .message-box {
              background-color: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 15px;
              margin: 15px 0;
              white-space: pre-wrap;
            }
            .button {
              display: inline-block;
              background-color: #2563eb;
              color: #ffffff;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
              text-align: center;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
            .urgent {
              background-color: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🚢 크루즈닷</div>
              <div class="title">새로운 ${inquiryType} 접수</div>
              <div class="badge">${inquiryTypeBadge}</div>
            </div>
            
            <div class="urgent">
              <strong>⚠️ 즉시 확인 필요</strong>
              <p style="margin: 5px 0 0 0;">새로운 ${inquiryType}가 접수되었습니다. 빠른 응대를 부탁드립니다.</p>
            </div>
            
            <div class="content">
              <div class="info-row">
                <div class="info-label">문의 ID:</div>
                <div class="info-value">#${inquiryData.inquiryId}</div>
              </div>
              <div class="info-row">
                <div class="info-label">고객명:</div>
                <div class="info-value"><strong>${escapeHtml(inquiryData.customerName)}</strong></div>
              </div>
              <div class="info-row">
                <div class="info-label">연락처:</div>
                <div class="info-value">${escapeHtml(inquiryData.customerPhone)}</div>
              </div>
              ${inquiryData.passportNumber ? `
              <div class="info-row">
                <div class="info-label">여권번호:</div>
                <div class="info-value">${escapeHtml(inquiryData.passportNumber)}</div>
              </div>
              ` : ''}
              <div class="info-row">
                <div class="info-label">상품코드:</div>
                <div class="info-value">${escapeHtml(inquiryData.productCode)}</div>
              </div>
              <div class="info-row">
                <div class="info-label">상품명:</div>
                <div class="info-value">${escapeHtml(inquiryData.productName)}</div>
              </div>
              ${inquiryData.message ? `
              <div class="info-row">
                <div class="info-label">문의내용:</div>
                <div class="info-value">
                  <div class="message-box">${escapeHtml(inquiryData.message)}</div>
                </div>
              </div>
              ` : ''}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inquiryUrl}" class="button">문의 상세보기</a>
            </div>
            
            <div class="footer">
              <p>이 이메일은 자동으로 발송된 메일입니다.</p>
              <p>문의 ID: ${inquiryData.inquiryId} | 접수 시간: ${new Date().toLocaleString('ko-KR')}</p>
              <p>&copy; ${new Date().getFullYear()} 크루즈닷. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
크루즈닷 새로운 ${inquiryType} 접수

⚠️ 즉시 확인 필요
새로운 ${inquiryType}가 접수되었습니다. 빠른 응대를 부탁드립니다.

문의 정보:
- 문의 ID: #${inquiryData.inquiryId}
- 고객명: ${inquiryData.customerName}
- 연락처: ${inquiryData.customerPhone}
${inquiryData.passportNumber ? `- 여권번호: ${inquiryData.passportNumber}\n` : ''}
- 상품코드: ${inquiryData.productCode}
- 상품명: ${inquiryData.productName}
${inquiryData.message ? `- 문의내용:\n${inquiryData.message}\n` : ''}

문의 상세보기: ${inquiryUrl}

문의 ID: ${inquiryData.inquiryId}
접수 시간: ${new Date().toLocaleString('ko-KR')}

© ${new Date().getFullYear()} 크루즈닷. All rights reserved.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.log('[Email] 문의 알림 이메일 전송 성공:', {
      to: adminEmail,
      inquiryId: inquiryData.inquiryId,
      messageId: info.messageId,
    });
    return true;
  } catch (error: any) {
    logger.error('[Email] 문의 알림 이메일 전송 실패:', {
      inquiryId: inquiryData.inquiryId,
      error: error.message,
    });
    return false;
  }
}

/**
 * 환불 알림 이메일 전송 (본사에 알림)
 */
export async function sendRefundNotificationEmail(
  refundData: {
    leadId: number;
    customerName: string;
    customerPhone?: string | null;
    refundedBy: string; // 환불 처리한 사람 이름
    refundedAt: string; // 환불 처리 시간
    managerName?: string | null;
    agentName?: string | null;
    notes?: string | null;
    leadUrl?: string;
  }
): Promise<boolean> {
  try {
    const transporter = getEmailTransporter();
    if (!transporter) {
      logger.error('[Email] SMTP 설정이 없어 이메일을 전송할 수 없습니다.');
      return false;
    }

    // 관리자 이메일 주소 가져오기 (SystemConfig 우선, 없으면 환경 변수)
    let adminEmail: string | null = null;
    try {
      const prisma = (await import('@/lib/prisma')).default;
      const adminEmailConfig = await prisma.systemConfig.findUnique({
        where: { configKey: 'admin_email' },
      });
      adminEmail = adminEmailConfig?.configValue || null;
    } catch (error) {
      logger.warn('[Email] SystemConfig에서 admin_email 조회 실패, 환경 변수 사용:', error);
    }
    
    // SystemConfig에 없으면 환경 변수 사용
    if (!adminEmail) {
      adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_SMTP_USER || null;
    }
    
    if (!adminEmail) {
      logger.warn('[Email] ADMIN_EMAIL이 설정되지 않아 환불 알림을 전송할 수 없습니다.');
      return false;
    }

    const smtpFrom = process.env.EMAIL_SMTP_FROM || process.env.EMAIL_SMTP_USER || 'noreply@cruisedot.kr';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.cruisedot.co.kr';
    const leadUrl = refundData.leadUrl || `${baseUrl}/admin/affiliate/leads/${refundData.leadId}`;

    const mailOptions = {
      from: `크루즈닷 알림 <${smtpFrom}>`,
      to: adminEmail,
      subject: `[크루즈닷] 환불 처리 알림 - ${refundData.customerName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background-color: #ffffff;
              border: 1px solid #e0e0e0;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #dc2626;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #dc2626;
              margin-bottom: 10px;
            }
            .title {
              font-size: 20px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 10px;
            }
            .badge {
              display: inline-block;
              background-color: #dc2626;
              color: white;
              padding: 4px 12px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: bold;
              margin-top: 10px;
            }
            .content {
              background-color: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 20px;
              margin: 20px 0;
            }
            .info-row {
              display: flex;
              padding: 10px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .info-label {
              font-weight: bold;
              color: #6b7280;
              width: 120px;
              flex-shrink: 0;
            }
            .info-value {
              color: #1f2937;
              flex: 1;
            }
            .notes-box {
              background-color: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 15px;
              margin: 15px 0;
              white-space: pre-wrap;
            }
            .button {
              display: inline-block;
              background-color: #dc2626;
              color: #ffffff;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
              text-align: center;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
            .urgent {
              background-color: #fee2e2;
              border-left: 4px solid #dc2626;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🚢 크루즈닷</div>
              <div class="title">환불 처리 알림</div>
              <div class="badge">환불</div>
            </div>
            
            <div class="urgent">
              <strong>⚠️ 환불 처리 완료</strong>
              <p style="margin: 5px 0 0 0;">고객의 환불이 처리되었습니다. 본사에서 확인이 필요합니다.</p>
            </div>
            
            <div class="content">
              <div class="info-row">
                <div class="info-label">Lead ID:</div>
                <div class="info-value">#${refundData.leadId}</div>
              </div>
              <div class="info-row">
                <div class="info-label">고객명:</div>
                <div class="info-value">${escapeHtml(refundData.customerName)}</div>
              </div>
              ${refundData.customerPhone ? `
              <div class="info-row">
                <div class="info-label">연락처:</div>
                <div class="info-value">${escapeHtml(refundData.customerPhone)}</div>
              </div>
              ` : ''}
              ${refundData.managerName ? `
              <div class="info-row">
                <div class="info-label">대리점장:</div>
                <div class="info-value">${escapeHtml(refundData.managerName)}</div>
              </div>
              ` : ''}
              ${refundData.agentName ? `
              <div class="info-row">
                <div class="info-label">판매원:</div>
                <div class="info-value">${escapeHtml(refundData.agentName)}</div>
              </div>
              ` : ''}
              <div class="info-row">
                <div class="info-label">처리자:</div>
                <div class="info-value">${escapeHtml(refundData.refundedBy)}</div>
              </div>
              <div class="info-row">
                <div class="info-label">처리 시간:</div>
                <div class="info-value">${new Date(refundData.refundedAt).toLocaleString('ko-KR')}</div>
              </div>
              ${refundData.notes ? `
              <div class="info-row">
                <div class="info-label">비고:</div>
                <div class="info-value">
                  <div class="notes-box">${escapeHtml(refundData.notes)}</div>
                </div>
              </div>
              ` : ''}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${leadUrl}" class="button">Lead 상세 보기</a>
            </div>
            
            <div class="footer">
              <p>이 이메일은 자동으로 발송되었습니다.</p>
              <p>© ${new Date().getFullYear()} 크루즈닷. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.log('[Email] 환불 알림 이메일 전송 성공:', {
      to: adminEmail,
      leadId: refundData.leadId,
      messageId: info.messageId,
    });
    return true;
  } catch (error: any) {
    logger.error('[Email] 환불 알림 이메일 전송 실패:', {
      leadId: refundData.leadId,
      error: error.message,
    });
    return false;
  }
}

