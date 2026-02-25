import { jsPDF } from 'jspdf';
import dayjs from 'dayjs';

/**
 * 지급명세서 PDF 생성
 */

interface PayslipData {
  id: number;
  profileId: number;
  period: string; // YYYY-MM
  type: string; // 'BRANCH_MANAGER' | 'SALES_AGENT'
  totalSales: number;
  totalCommission: number;
  totalWithholding: number;
  netPayment: number;
  status: string;
  createdAt: Date;
  AffiliateProfile: {
    displayName: string | null;
    type: string;
    bankName?: string | null;
    bankAccount?: string | null;
    bankAccountHolder?: string | null;
  };
  details?: any;
}

/**
 * 숫자를 한국 원화 형식으로 포맷
 */
function formatCurrency(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

/**
 * 지급명세서 PDF 생성
 */
export async function generatePayslipPDF(payslip: PayslipData): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  // 제목
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('지급명세서', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // 발행일
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`발행일: ${dayjs().format('YYYY년 MM월 DD일')}`, pageWidth - margin, yPos, { align: 'right' });
  yPos += 10;

  // 구분선
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // 기본 정보
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('기본 정보', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const basicInfo = [
    ['정산 기간:', `${payslip.period} (${dayjs(payslip.period).format('YYYY년 MM월')})`],
    ['이름:', payslip.AffiliateProfile.displayName || '-'],
    ['직급:', payslip.type === 'BRANCH_MANAGER' ? '대리점장' : '판매원'],
    ['은행명:', payslip.AffiliateProfile.bankName || '-'],
    ['계좌번호:', payslip.AffiliateProfile.bankAccount || '-'],
    ['예금주:', payslip.AffiliateProfile.bankAccountHolder || '-'],
  ];

  basicInfo.forEach(([label, value]) => {
    doc.text(label, margin + 5, yPos);
    doc.text(value, margin + 40, yPos);
    yPos += 7;
  });

  yPos += 5;

  // 구분선
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // 정산 내역
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('정산 내역', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const settlementInfo = [
    ['총 매출액:', formatCurrency(payslip.totalSales)],
    ['총 수당:', formatCurrency(payslip.totalCommission)],
    ['원천징수 (3.3%):', formatCurrency(payslip.totalWithholding)],
  ];

  settlementInfo.forEach(([label, value]) => {
    doc.text(label, margin + 5, yPos);
    doc.text(value, margin + 40, yPos);
    yPos += 7;
  });

  yPos += 3;

  // 실수령액 강조
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 10, 'F');
  doc.text('실수령액:', margin + 5, yPos);
  doc.text(formatCurrency(payslip.netPayment), margin + 40, yPos);
  yPos += 15;

  // 상세 내역 (있을 경우)
  if (payslip.details && Array.isArray(payslip.details) && payslip.details.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('판매 상세 내역', margin, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    // 테이블 헤더
    const colWidths = [25, 60, 30, 35]; // 날짜, 상품명, 객실종류, 수당
    const headers = ['날짜', '상품명', '객실종류', '수당'];
    let xPos = margin + 5;

    doc.setFont('helvetica', 'bold');
    headers.forEach((header, i) => {
      doc.text(header, xPos, yPos);
      xPos += colWidths[i];
    });
    yPos += 6;

    // 테이블 내용
    doc.setFont('helvetica', 'normal');
    payslip.details.slice(0, 10).forEach((detail: any) => {
      xPos = margin + 5;
      const row = [
        detail.saleDate ? dayjs(detail.saleDate).format('MM/DD') : '-',
        (detail.productName || '-').substring(0, 20),
        detail.cabinType || '-',
        formatCurrency(detail.commission || 0),
      ];

      row.forEach((cell, i) => {
        doc.text(cell, xPos, yPos);
        xPos += colWidths[i];
      });
      yPos += 6;

      // 페이지 넘김 방지
      if (yPos > pageHeight - margin - 20) {
        return;
      }
    });

    if (payslip.details.length > 10) {
      yPos += 3;
      doc.setFontSize(8);
      doc.text(`... 외 ${payslip.details.length - 10}건`, margin + 5, yPos);
    }
  }

  // 하단 여백
  yPos = pageHeight - margin - 30;

  // 로고 영역 placeholder (나중에 실제 로고로 교체)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text('[Maviz School Logo]', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // 발행처 정보
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('마비즈스쿨', pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  doc.text('이 명세서는 전자 발급되었습니다.', pageWidth / 2, yPos, { align: 'center' });

  // PDF를 Buffer로 반환
  const pdfBlob = doc.output('arraybuffer');
  return Buffer.from(pdfBlob);
}

/**
 * 지급명세서 PDF 파일명 생성
 */
export function generatePayslipFileName(payslip: PayslipData): string {
  const name = payslip.AffiliateProfile.displayName || 'Unknown';
  const period = payslip.period.replace('-', '');
  const date = dayjs().format('YYYYMMDD');
  return `Payslip_${name}_${period}_${date}.pdf`;
}



















