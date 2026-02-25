// lib/purchase-certificate.ts
// 구매확인서 이메일 발송 + 구글 드라이브 백업
// 이미지 생성은 클라이언트(html2canvas)에서 하고 API로 전송받음

import prisma from '@/lib/prisma';
import { uploadFileToDrive, findOrCreateFolder } from '@/lib/google-drive';
import nodemailer from 'nodemailer';

interface PurchaseCertificateData {
  saleId?: number;
  reservationId?: number;
  // 고객 정보
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  birthDate?: string;
  // 상품 정보
  productName: string;
  productCode?: string;
  // 결제 정보
  paymentAmount: number;
  paymentDate: string;
  orderId: string;
  // 담당자 정보
  managerName?: string;
  managerRole?: '대리점장' | '판매원';
  // 상품 상세 (옵션)
  productDetails?: {
    nights?: number;
    days?: number;
    cruiseLine?: string;
    shipName?: string;
    destinations?: string[];
    flightIncluded?: boolean;
    // 추가 상세 정보
    hasEscort?: boolean;           // 인솔자
    hasLocalGuide?: boolean;       // 가이드
    hasCruisedotStaff?: boolean;   // 크루즈닷 전용스탭
    hasTravelInsurance?: boolean;  // 여행자보험
    included?: string[];           // 포함사항
    excluded?: string[];           // 불포함사항
    cabinType?: string;            // 결제한 객실
  };
}

interface SendResult {
  ok: boolean;
  certificateImageUrl?: string;
  driveFileId?: string;
  emailSent?: boolean;
  error?: string;
}

// 클라이언트에서 생성한 이미지 Buffer를 받아서 이메일 발송 + 드라이브 백업
interface SendWithImageData {
  customerName: string;
  customerEmail: string;
  productName: string;
  orderId: string;
  paymentAmount: number;
  saleId?: number;
  reservationId?: number;
}

// SMTP 이메일 전송자 생성
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// 이메일 HTML 템플릿 생성
function generateEmailHtml(data: PurchaseCertificateData): string {
  const formattedAmount = data.paymentAmount.toLocaleString('ko-KR');
  const formattedDate = new Date(data.paymentDate).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
      border-radius: 16px 16px 0 0;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 28px;
      letter-spacing: 0.1em;
    }
    .header p {
      margin: 0;
      opacity: 0.9;
      font-size: 16px;
    }
    .content {
      background: white;
      padding: 40px 30px;
      border-radius: 0 0 16px 16px;
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 20px;
    }
    .info-box {
      background: #f8fafc;
      padding: 24px;
      margin: 24px 0;
      border-radius: 12px;
      border-left: 4px solid #2563eb;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .label {
      font-weight: 600;
      color: #64748b;
      font-size: 14px;
    }
    .value {
      color: #1e293b;
      font-weight: 500;
      text-align: right;
    }
    .amount {
      font-size: 20px;
      font-weight: 700;
      color: #2563eb;
    }
    .certificate-notice {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
      text-align: center;
    }
    .certificate-notice p {
      margin: 0;
      color: #1e40af;
      font-size: 14px;
    }
    .manager-info {
      background: #f1f5f9;
      padding: 16px;
      border-radius: 8px;
      margin: 24px 0;
      text-align: center;
    }
    .manager-info span {
      color: #475569;
      font-size: 14px;
    }
    .manager-info strong {
      color: #1e293b;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      color: #94a3b8;
      font-size: 12px;
    }
    .footer p {
      margin: 5px 0;
    }
    .cruise-icon {
      font-size: 40px;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="cruise-icon">&#128674;</div>
      <h1>구매확인서</h1>
      <p>크루즈닷에서 발행되었습니다</p>
    </div>
    <div class="content">
      <p class="greeting">안녕하세요, <strong>${data.customerName}</strong>님!</p>
      <p>크루즈 여행 상품을 구매해 주셔서 감사합니다.<br>아래 내용을 확인해 주세요.</p>

      <div class="info-box">
        <div class="info-row">
          <span class="label">상품명</span>
          <span class="value">${data.productName}</span>
        </div>
        ${data.productDetails?.cruiseLine ? `
        <div class="info-row">
          <span class="label">크루즈사</span>
          <span class="value">${data.productDetails.cruiseLine}</span>
        </div>` : ''}
        ${data.productDetails?.shipName ? `
        <div class="info-row">
          <span class="label">선박명</span>
          <span class="value">${data.productDetails.shipName}</span>
        </div>` : ''}
        ${data.productDetails?.nights ? `
        <div class="info-row">
          <span class="label">여행기간</span>
          <span class="value">${data.productDetails.nights}박 ${data.productDetails.days || data.productDetails.nights + 1}일</span>
        </div>` : ''}
        ${data.productDetails?.cabinType ? `
        <div class="info-row">
          <span class="label">객실타입</span>
          <span class="value">${data.productDetails.cabinType}</span>
        </div>` : ''}
        <div class="info-row">
          <span class="label">결제금액</span>
          <span class="value amount">${formattedAmount}원</span>
        </div>
        <div class="info-row">
          <span class="label">결제일자</span>
          <span class="value">${formattedDate}</span>
        </div>
        <div class="info-row">
          <span class="label">주문번호</span>
          <span class="value">${data.orderId}</span>
        </div>
      </div>

      ${(data.productDetails?.hasEscort !== undefined || data.productDetails?.hasLocalGuide !== undefined ||
         data.productDetails?.hasCruisedotStaff !== undefined || data.productDetails?.hasTravelInsurance !== undefined) ? `
      <div class="info-box" style="margin-top: 16px;">
        <div style="font-weight: 600; color: #1e293b; margin-bottom: 12px; font-size: 15px;">서비스 안내</div>
        ${data.productDetails?.hasEscort ? `
        <div class="info-row">
          <span class="label">인솔자</span>
          <span class="value" style="color: #22c55e;">✓ 포함</span>
        </div>` : ''}
        ${data.productDetails?.hasLocalGuide ? `
        <div class="info-row">
          <span class="label">가이드</span>
          <span class="value" style="color: #22c55e;">✓ 포함</span>
        </div>` : ''}
        ${data.productDetails?.hasCruisedotStaff ? `
        <div class="info-row">
          <span class="label">크루즈닷 전용스탭</span>
          <span class="value" style="color: #22c55e;">✓ 포함</span>
        </div>` : ''}
        ${data.productDetails?.hasTravelInsurance ? `
        <div class="info-row">
          <span class="label">여행자보험</span>
          <span class="value" style="color: #22c55e;">✓ 포함</span>
        </div>` : ''}
      </div>` : ''}

      ${data.productDetails?.included && data.productDetails.included.length > 0 ? `
      <div class="info-box" style="margin-top: 16px; border-left-color: #22c55e;">
        <div style="font-weight: 600; color: #1e293b; margin-bottom: 12px; font-size: 15px;">✅ 포함사항</div>
        <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.8;">
          ${data.productDetails.included.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>` : ''}

      ${data.productDetails?.excluded && data.productDetails.excluded.length > 0 ? `
      <div class="info-box" style="margin-top: 16px; border-left-color: #ef4444;">
        <div style="font-weight: 600; color: #1e293b; margin-bottom: 12px; font-size: 15px;">❌ 불포함사항</div>
        <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.8;">
          ${data.productDetails.excluded.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>` : ''}

      <div class="certificate-notice">
        <p>&#128206; 첨부된 구매확인증서 이미지를 확인해 주세요.</p>
      </div>

      ${data.managerName ? `
      <div class="manager-info">
        <span>담당 ${data.managerRole || '담당자'}: <strong>${data.managerName}</strong></span>
      </div>` : ''}

      <p>추가 문의사항이 있으시면 언제든지 연락 주세요.<br>즐거운 크루즈 여행 되세요! &#127754;</p>

      <div class="footer">
        <p>본 메일은 자동으로 발송된 메일입니다.</p>
        <p>&copy; ${new Date().getFullYear()} 크루즈닷. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 클라이언트에서 생성한 이미지(Buffer)를 받아서 이메일 발송 + 구글 드라이브 백업
 * 서류관리 Certificate.tsx와 동일한 패턴 (html2canvas로 생성된 이미지)
 */
export async function sendPurchaseCertificateWithImage(
  imageBuffer: Buffer,
  data: SendWithImageData
): Promise<SendResult> {
  console.log('[Purchase Certificate] Starting with provided image...', {
    customerName: data.customerName,
    customerEmail: data.customerEmail,
    orderId: data.orderId,
    imageSize: imageBuffer.length,
  });

  try {
    // 1. 구글 드라이브에 백업
    let driveFileId: string | undefined;
    let certificateImageUrl: string | undefined;

    try {
      console.log('[Purchase Certificate] Uploading to Google Drive...');

      // 월별 폴더 생성
      const monthFolder = new Date().toISOString().slice(0, 7); // YYYY-MM
      const folderResult = await findOrCreateFolder(`구매확인서_${monthFolder}`);

      if (folderResult.ok && folderResult.folderId) {
        // 파일명 생성
        const dateStr = new Date().toISOString().split('T')[0];
        const safeCustomerName = data.customerName.replace(/[/\\?%*:|"<>]/g, '_');
        const fileName = `구매확인서_${safeCustomerName}_${data.orderId}_${dateStr}.png`;

        const uploadResult = await uploadFileToDrive({
          folderId: folderResult.folderId,
          fileName,
          mimeType: 'image/png',
          buffer: imageBuffer,
          makePublic: false,
        });

        if (uploadResult.ok && uploadResult.fileId) {
          driveFileId = uploadResult.fileId;
          certificateImageUrl = `https://drive.google.com/file/d/${uploadResult.fileId}/view`;
          console.log('[Purchase Certificate] Uploaded to Drive:', certificateImageUrl);
        }
      }
    } catch (driveError) {
      console.error('[Purchase Certificate] Drive upload error:', driveError);
      // 드라이브 업로드 실패해도 계속 진행
    }

    // 2. 이메일 발송
    let emailSent = false;

    if (data.customerEmail) {
      try {
        console.log('[Purchase Certificate] Sending email to:', data.customerEmail);

        const transporter = createTransporter();
        const emailHtml = generateEmailHtml({
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          productName: data.productName,
          paymentAmount: data.paymentAmount,
          paymentDate: new Date().toISOString(),
          orderId: data.orderId,
        });

        await transporter.sendMail({
          from: `"크루즈닷" <${process.env.SMTP_USER}>`,
          to: data.customerEmail,
          subject: `[구매확인서] ${data.productName} 구매가 완료되었습니다`,
          html: emailHtml,
          attachments: [
            {
              filename: `구매확인서_${data.customerName}_${data.orderId}.png`,
              content: imageBuffer,
              contentType: 'image/png',
            },
          ],
        });

        emailSent = true;
        console.log('[Purchase Certificate] Email sent successfully');
      } catch (emailError) {
        console.error('[Purchase Certificate] Email send error:', emailError);
      }
    } else {
      console.log('[Purchase Certificate] No customer email, skipping email send');
    }

    // 3. DB에 발송 로그 기록
    if (data.saleId || data.reservationId) {
      try {
        await prisma.adminActionLog.create({
          data: {
            adminId: 1, // 시스템
            action: 'PURCHASE_CERTIFICATE_SENT',
            details: {
              saleId: data.saleId,
              reservationId: data.reservationId,
              customerName: data.customerName,
              customerEmail: data.customerEmail,
              orderId: data.orderId,
              driveFileId,
              certificateImageUrl,
              emailSent,
              sentAt: new Date().toISOString(),
            },
          },
        });
      } catch (logError) {
        console.error('[Purchase Certificate] Log error:', logError);
      }
    }

    return {
      ok: true,
      certificateImageUrl,
      driveFileId,
      emailSent,
    };

  } catch (error: any) {
    console.error('[Purchase Certificate] Error:', error);
    return {
      ok: false,
      error: error.message || '구매확인서 발송에 실패했습니다.',
    };
  }
}

/**
 * 구매확인서 이메일 발송 + 구글 드라이브 백업 (이미지 없이 데이터만)
 * @deprecated 이미지 생성이 필요한 경우 sendPurchaseCertificateWithImage 사용
 */
export async function sendPurchaseCertificate(data: PurchaseCertificateData): Promise<SendResult> {
  console.log('[Purchase Certificate] Starting (no image)...', {
    customerName: data.customerName,
    customerEmail: data.customerEmail,
    orderId: data.orderId,
  });

  // 이메일만 발송 (이미지 첨부 없이)
  try {
    let emailSent = false;

    if (data.customerEmail) {
      try {
        console.log('[Purchase Certificate] Sending email to:', data.customerEmail);

        const transporter = createTransporter();
        const emailHtml = generateEmailHtml(data);

        await transporter.sendMail({
          from: `"크루즈닷" <${process.env.SMTP_USER}>`,
          to: data.customerEmail,
          subject: `[구매확인서] ${data.productName} 구매가 완료되었습니다`,
          html: emailHtml,
          // 이미지 첨부 없음 - 클라이언트에서 이미지 생성 후 별도 API 호출 필요
        });

        emailSent = true;
        console.log('[Purchase Certificate] Email sent successfully (no attachment)');
      } catch (emailError) {
        console.error('[Purchase Certificate] Email send error:', emailError);
      }
    }

    return {
      ok: true,
      emailSent,
    };

  } catch (error: any) {
    console.error('[Purchase Certificate] Error:', error);
    return {
      ok: false,
      error: error.message || '구매확인서 발송에 실패했습니다.',
    };
  }
}

/**
 * 결제 완료 시 자동으로 구매확인서 발송 (결제 웹훅에서 호출)
 */
export async function sendCertificateOnPaymentComplete(paymentId: number): Promise<SendResult> {
  try {
    // 결제 정보 조회
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            birthDate: true,
          },
        },
        Reservation: {
          include: {
            Trip: {
              include: {
                CruiseProduct: {
                  select: {
                    productCode: true,
                    cruiseLine: true,
                    shipName: true,
                    nights: true,
                    destinations: true,
                    flightIncluded: true,
                  },
                },
              },
            },
            AffiliateSale: {
              include: {
                AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile: {
                  select: { displayName: true, legalName: true, type: true },
                },
                AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile: {
                  select: { displayName: true, legalName: true, type: true },
                },
              },
            },
          },
        },
      },
    });

    // MallProductContent에서 상세 정보 조회
    const productCode = payment?.Reservation?.Trip?.CruiseProduct?.productCode || payment?.Reservation?.Trip?.productCode;
    let mallContent: { layout?: any } | null = null;
    if (productCode) {
      mallContent = await prisma.mallProductContent.findUnique({
        where: { productCode },
        select: { layout: true },
      });
    }

    if (!payment) {
      return { ok: false, error: '결제 정보를 찾을 수 없습니다.' };
    }

    const user = payment.User;
    const reservation = payment.Reservation;
    const trip = reservation?.Trip;
    const product = trip?.CruiseProduct;
    const sale = reservation?.AffiliateSale;

    // 담당자 정보
    const agent = sale?.AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile;
    const manager = sale?.AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile;
    const responsibleProfile = agent || manager;

    // MallProductContent의 layout에서 상세 정보 추출
    const layout = mallContent?.layout as {
      hasEscort?: boolean;
      hasLocalGuide?: boolean;
      hasCruisedotStaff?: boolean;
      hasTravelInsurance?: boolean;
      included?: string[];
      excluded?: string[];
    } | null;

    // 객실 타입 (Reservation 또는 AffiliateSale에서)
    const cabinType = reservation?.cabinType || sale?.cabinType || undefined;

    // 구매확인서 데이터 구성
    const certData: PurchaseCertificateData = {
      reservationId: reservation?.id,
      saleId: sale?.id,
      customerName: user?.name || '고객',
      customerEmail: user?.email || undefined,
      customerPhone: user?.phone || undefined,
      birthDate: user?.birthDate || undefined,
      productName: trip?.shipName || product?.shipName || '크루즈 상품',
      productCode: trip?.productCode || undefined,
      paymentAmount: payment.amount,
      paymentDate: payment.paidAt?.toISOString() || new Date().toISOString(),
      orderId: payment.orderId,
      managerName: responsibleProfile?.legalName || responsibleProfile?.displayName || undefined,
      managerRole: agent ? '판매원' : manager ? '대리점장' : undefined,
      productDetails: product ? {
        nights: product.nights || undefined,
        days: product.nights ? product.nights + 1 : undefined,
        cruiseLine: product.cruiseLine || undefined,
        shipName: product.shipName || undefined,
        destinations: product.destinations as string[] || undefined,
        flightIncluded: product.flightIncluded || undefined,
        // MallProductContent에서 가져온 상세 정보
        hasEscort: layout?.hasEscort,
        hasLocalGuide: layout?.hasLocalGuide,
        hasCruisedotStaff: layout?.hasCruisedotStaff,
        hasTravelInsurance: layout?.hasTravelInsurance,
        included: layout?.included,
        excluded: layout?.excluded,
        cabinType,
      } : undefined,
    };

    return await sendPurchaseCertificate(certData);

  } catch (error: any) {
    console.error('[Purchase Certificate] Payment complete error:', error);
    return {
      ok: false,
      error: error.message || '구매확인서 자동 발송에 실패했습니다.',
    };
  }
}

/**
 * 판매(AffiliateSale) 기준으로 구매확인서 발송
 */
export async function sendCertificateForSale(saleId: number): Promise<SendResult> {
  try {
    const sale = await prisma.affiliateSale.findUnique({
      where: { id: saleId },
      include: {
        AffiliateLead: {
          select: {
            customerName: true,
            customerPhone: true,
            metadata: true,
          },
        },
        AffiliateProduct: {
          select: {
            title: true,
            productCode: true,
          },
        },
        AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile: {
          select: { displayName: true, legalName: true, type: true },
        },
        AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile: {
          select: { displayName: true, legalName: true, type: true },
        },
        Payment: {
          select: { orderId: true, paidAt: true },
        },
        Reservation: {
          include: {
            User: { select: { email: true, birthDate: true } },
            Trip: {
              include: {
                CruiseProduct: {
                  select: {
                    cruiseLine: true,
                    shipName: true,
                    nights: true,
                    destinations: true,
                    flightIncluded: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!sale) {
      return { ok: false, error: '판매 정보를 찾을 수 없습니다.' };
    }

    const lead = sale.AffiliateLead;
    const product = sale.AffiliateProduct;
    const agent = sale.AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile;
    const manager = sale.AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile;
    const responsibleProfile = agent || manager;
    const reservation = sale.Reservation;
    const user = reservation?.User;
    const trip = reservation?.Trip;
    const cruiseProduct = trip?.CruiseProduct;

    // MallProductContent에서 상세 정보 조회
    const saleProductCode = sale.productCode || product?.productCode;
    let mallContent: { layout?: any } | null = null;
    if (saleProductCode) {
      mallContent = await prisma.mallProductContent.findUnique({
        where: { productCode: saleProductCode },
        select: { layout: true },
      });
    }

    // MallProductContent의 layout에서 상세 정보 추출
    const layout = mallContent?.layout as {
      hasEscort?: boolean;
      hasLocalGuide?: boolean;
      hasCruisedotStaff?: boolean;
      hasTravelInsurance?: boolean;
      included?: string[];
      excluded?: string[];
    } | null;

    // 객실 타입 (AffiliateSale 또는 Reservation에서)
    const cabinType = sale.cabinType || reservation?.cabinType || undefined;

    // 이메일 주소 찾기 (여러 소스에서)
    const customerEmail = user?.email ||
      (lead?.metadata as any)?.customerEmail ||
      undefined;

    const certData: PurchaseCertificateData = {
      saleId: sale.id,
      reservationId: reservation?.id,
      customerName: lead?.customerName || '고객',
      customerEmail,
      customerPhone: lead?.customerPhone || undefined,
      birthDate: user?.birthDate || undefined,
      productName: product?.title || cruiseProduct?.shipName || '크루즈 상품',
      productCode: sale.productCode || product?.productCode || undefined,
      paymentAmount: sale.saleAmount,
      paymentDate: sale.saleDate?.toISOString() || new Date().toISOString(),
      orderId: sale.externalOrderCode || sale.Payment?.orderId || `SALE-${sale.id}`,
      managerName: responsibleProfile?.legalName || responsibleProfile?.displayName || undefined,
      managerRole: agent ? '판매원' : manager ? '대리점장' : undefined,
      productDetails: cruiseProduct ? {
        nights: cruiseProduct.nights || undefined,
        days: cruiseProduct.nights ? cruiseProduct.nights + 1 : undefined,
        cruiseLine: cruiseProduct.cruiseLine || undefined,
        shipName: cruiseProduct.shipName || undefined,
        destinations: cruiseProduct.destinations as string[] || undefined,
        flightIncluded: cruiseProduct.flightIncluded || undefined,
        // MallProductContent에서 가져온 상세 정보
        hasEscort: layout?.hasEscort,
        hasLocalGuide: layout?.hasLocalGuide,
        hasCruisedotStaff: layout?.hasCruisedotStaff,
        hasTravelInsurance: layout?.hasTravelInsurance,
        included: layout?.included,
        excluded: layout?.excluded,
        cabinType,
      } : undefined,
    };

    return await sendPurchaseCertificate(certData);

  } catch (error: any) {
    console.error('[Purchase Certificate] Sale error:', error);
    return {
      ok: false,
      error: error.message || '구매확인서 발송에 실패했습니다.',
    };
  }
}
