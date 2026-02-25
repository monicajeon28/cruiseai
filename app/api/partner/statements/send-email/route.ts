export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import nodemailer from 'nodemailer';
import { appendStatementRecord, StatementRecord } from '@/lib/affiliate/statement-spreadsheet';

// 이메일 전송 설정
const getEmailTransporter = () => {
  const smtpHost = process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.EMAIL_SMTP_PORT || '587', 10);
  const smtpUser = process.env.EMAIL_SMTP_USER;
  const smtpPassword = process.env.EMAIL_SMTP_PASSWORD;

  if (!smtpUser || !smtpPassword) {
    console.warn('[Send Email] SMTP 설정이 없습니다.');
    return null;
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
};

// PNG base64 데이터 검증 (보안)
const validatePngBase64 = (data: string): { valid: boolean; error?: string } => {
  // base64 형식 검증
  const base64Pattern = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;
  const match = data.match(base64Pattern);

  if (!match) {
    // data: prefix 없이도 허용
    const rawBase64Pattern = /^[A-Za-z0-9+/=]+$/;
    if (!rawBase64Pattern.test(data.replace(/^data:image\/\w+;base64,/, ''))) {
      return { valid: false, error: '잘못된 base64 형식입니다.' };
    }
  }

  // PNG 매직 넘버 검증 (iVBORw0KGgo로 시작)
  const base64Data = data.replace(/^data:image\/\w+;base64,/, '');
  if (!base64Data.startsWith('iVBORw0KGgo')) {
    return { valid: false, error: '유효한 PNG 이미지가 아닙니다.' };
  }

  // 크기 제한 (10MB)
  const sizeInBytes = (base64Data.length * 3) / 4;
  if (sizeInBytes > 10 * 1024 * 1024) {
    return { valid: false, error: '이미지 크기가 10MB를 초과합니다.' };
  }

  return { valid: true };
};

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await req.json();
    const {
      to,
      subject,
      imageData, // base64 PNG 데이터
      // 명세서 정보 (스프레드시트 기록용)
      settlementId,
      profileId,
      displayName,
      periodStart,
      periodEnd,
      affiliateCode,
      type,
      salesCount,
      totalSaleAmount,
      salesCommission,
      branchCommission,
      overrideCommission,
      grossAmount,
      withholdingRate,
      withholdingAmount,
      netAmount,
      bankName,
      bankAccount,
      bankAccountHolder,
    } = body;

    if (!to || !imageData) {
      return NextResponse.json({ ok: false, message: '이메일 주소와 이미지 데이터가 필요합니다.' }, { status: 400 });
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json({ ok: false, message: '올바른 이메일 형식이 아닙니다.' }, { status: 400 });
    }

    // PNG 이미지 데이터 검증 (보안)
    const pngValidation = validatePngBase64(imageData);
    if (!pngValidation.valid) {
      return NextResponse.json({ ok: false, message: pngValidation.error || '이미지 검증 실패' }, { status: 400 });
    }

    // 권한 확인 (관리자 또는 본인)
    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });
    const isAdmin = dbUser?.role === 'admin';

    if (!isAdmin && profileId) {
      const partnerProfile = await prisma.affiliateProfile.findFirst({
        where: { userId: sessionUser.id },
        select: { id: true },
      });

      if (!partnerProfile || partnerProfile.id !== parseInt(profileId, 10)) {
        return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
      }
    }

    const transporter = getEmailTransporter();
    if (!transporter) {
      return NextResponse.json({ ok: false, message: 'SMTP 설정이 되어있지 않습니다.' }, { status: 500 });
    }

    // Base64 데이터 파싱
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // 파일명 생성
    const monthFolder = periodStart
      ? `${new Date(periodStart).getFullYear()}-${String(new Date(periodStart).getMonth() + 1).padStart(2, '0')}`
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const safeName = (displayName || `profile_${profileId || 'unknown'}`).replace(/[/\\?%*:|"<>]/g, '_');
    const fileName = `지급명세서_${monthFolder}_${safeName}.png`;

    const smtpFrom = process.env.EMAIL_SMTP_FROM || process.env.EMAIL_SMTP_USER || 'noreply@cruisedot.kr';

    // 이메일 발송
    const mailOptions = {
      from: `크루즈닷 <${smtpFrom}>`,
      to,
      subject: subject || `[크루즈닷] ${monthFolder} 지급명세서`,
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
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .info-label {
              color: #6b7280;
            }
            .info-value {
              font-weight: bold;
              color: #1f2937;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">크루즈닷</div>
              <div class="title">${monthFolder} 지급명세서</div>
            </div>

            <p>안녕하세요, <strong>${displayName || '파트너'}</strong>님.</p>
            <p>${monthFolder} 정산 기간의 지급명세서를 첨부파일로 보내드립니다.</p>

            <div class="content">
              <div class="info-row">
                <span class="info-label">정산 기간:</span>
                <span class="info-value">${periodStart || '-'} ~ ${periodEnd || '-'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">총 수당:</span>
                <span class="info-value">${grossAmount ? Number(grossAmount).toLocaleString() + '원' : '-'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">원천징수:</span>
                <span class="info-value">${withholdingAmount ? Number(withholdingAmount).toLocaleString() + '원' : '-'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">실지급액:</span>
                <span class="info-value" style="color: #2563eb; font-size: 1.1em;">${netAmount ? Number(netAmount).toLocaleString() + '원' : '-'}</span>
              </div>
            </div>

            <p style="color: #6b7280; font-size: 14px;">
              첨부된 이미지 파일을 확인해주세요. 문의사항이 있으시면 본사로 연락 부탁드립니다.
            </p>

            <div class="footer">
              <p>이 이메일은 자동으로 발송된 메일입니다.</p>
              <p>&copy; ${new Date().getFullYear()} 크루즈닷. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      attachments: [
        {
          filename: fileName,
          content: buffer,
          contentType: 'image/png',
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Send Email] Statement email sent to ${to}, messageId: ${info.messageId}`);

    // Google Sheets에 이메일 발송 기록 추가
    if (settlementId && profileId) {
      const record: StatementRecord = {
        recordDate: new Date().toISOString(),
        settlementId: parseInt(settlementId, 10),
        periodStart: periodStart || '',
        periodEnd: periodEnd || periodStart || '',
        profileId: parseInt(profileId, 10),
        affiliateCode: affiliateCode || null,
        displayName: displayName || null,
        type: type || 'SALES_AGENT',
        salesCount: salesCount ? parseInt(salesCount, 10) : 0,
        totalSaleAmount: totalSaleAmount ? parseInt(totalSaleAmount, 10) : 0,
        salesCommission: salesCommission ? parseInt(salesCommission, 10) : 0,
        branchCommission: branchCommission ? parseInt(branchCommission, 10) : 0,
        overrideCommission: overrideCommission ? parseInt(overrideCommission, 10) : 0,
        grossAmount: grossAmount ? parseInt(grossAmount, 10) : 0,
        withholdingRate: withholdingRate ? parseFloat(withholdingRate) : 3.3,
        withholdingAmount: withholdingAmount ? parseInt(withholdingAmount, 10) : 0,
        netAmount: netAmount ? parseInt(netAmount, 10) : 0,
        bankName: bankName || null,
        bankAccount: bankAccount || null,
        bankAccountHolder: bankAccountHolder || null,
        pngFileId: null, // 이메일로 발송한 경우 Drive 파일 ID 없음
        pngFileUrl: `mailto:${to}`, // 발송 이메일 주소 기록
        status: 'EMAIL_SENT',
      };

      const sheetResult = await appendStatementRecord(record);
      if (!sheetResult.ok) {
        console.warn(`[Send Email] Spreadsheet record failed: ${sheetResult.error}`);
      } else {
        console.log(`[Send Email] Spreadsheet record added for email: ${displayName} -> ${to}`);
      }
    }

    return NextResponse.json({
      ok: true,
      message: '지급명세서가 이메일로 발송되었습니다.',
      messageId: info.messageId,
    });
  } catch (error: any) {
    console.error('[Send Email] Error:', error);
    return NextResponse.json(
      { ok: false, message: '이메일 발송 실패', error: error?.message },
      { status: 500 }
    );
  }
}
