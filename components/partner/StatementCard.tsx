'use client';

import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { FiDownload, FiUploadCloud, FiMail, FiX, FiCheck } from 'react-icons/fi';
import { showSuccess, showError } from '@/components/ui/Toast';
import html2canvas from 'html2canvas';

// html2canvas에서 사용할 이미지 미리 로드
const LOGO_URL = '/logo-watermark.png';
const STAMP_URL = '/images/cruisedot-stamp.png';

const preloadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

type StatementDetail = {
  entryId: number;
  saleId: number | null;
  productCode: string | null;
  saleAmount: number | null;
  saleDate: string | null;
  cabinType: string | null;
  headcount: number | null;
  customerName: string | null;
  entryType: string;
  amount: number;
  withholdingAmount: number;
  netAmount: number;
};

type Statement = {
  profileId: number;
  affiliateCode: string | null;
  displayName: string | null;
  type: string;
  periodStart: string;
  periodEnd: string;
  salesCount: number;
  totalSaleAmount: number;
  salesCommission: number;
  branchCommission: number;
  overrideCommission: number;
  grossAmount: number;
  withholdingAmount: number;
  withholdingRate: number;
  netAmount: number;
  entryCount: number;
  bankName: string | null;
  bankAccount: string | null;
  bankAccountHolder: string | null;
  details: StatementDetail[];
};

type Settlement = {
  id: number;
  periodStart: string;
  periodEnd: string;
  status: string;
  paymentDate: string | null;
};

type StatementCardProps = {
  statement: Statement;
  settlement: Settlement;
  onClose?: () => void;
};

export default function StatementCard({ statement, settlement, onClose }: StatementCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // 이미지 프리로딩 (html2canvas CORS 문제 해결)
  useEffect(() => {
    const loadImages = async () => {
      try {
        await Promise.all([
          preloadImage(LOGO_URL),
          preloadImage(STAMP_URL),
        ]);
        setImagesLoaded(true);
      } catch (error) {
        console.warn('이미지 프리로딩 실패:', error);
        // 실패해도 계속 진행 (이미지 없이 캡처)
        setImagesLoaded(true);
      }
    };
    loadImages();
  }, []);

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-';
    return `${amount.toLocaleString()}원`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.getFullYear()}년 ${startDate.getMonth() + 1}월`;
  };

  const getEntryTypeLabel = (type: string) => {
    switch (type) {
      case 'SALES_COMMISSION':
        return '판매 수당';
      case 'BRANCH_COMMISSION':
        return '대리점 수당';
      case 'OVERRIDE_COMMISSION':
        return '오버라이드 수당';
      default:
        return type;
    }
  };

  // PNG 다운로드
  const handleDownloadPNG = async () => {
    if (!cardRef.current) return;

    if (!imagesLoaded) {
      showError('이미지가 아직 로딩 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      setIsDownloading(true);
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 15000,
      });

      const link = document.createElement('a');
      link.download = `정산명세서_${statement.displayName}_${formatPeriod(statement.periodStart, statement.periodEnd)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      showSuccess('PNG 파일이 다운로드되었습니다.');
    } catch (error) {
      console.error('PNG 다운로드 오류:', error);
      showError('PNG 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  // 구글 드라이브 백업
  const handleBackupToGoogleDrive = async () => {
    if (!cardRef.current) return;

    if (!imagesLoaded) {
      showError('이미지가 아직 로딩 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      setIsUploading(true);
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 15000,
      });

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      });

      const formData = new FormData();
      formData.append('file', blob, `정산명세서_${statement.displayName}_${formatPeriod(statement.periodStart, statement.periodEnd)}.png`);
      formData.append('settlementId', settlement.id.toString());
      formData.append('profileId', statement.profileId.toString());
      formData.append('displayName', statement.displayName || '');
      formData.append('periodStart', statement.periodStart);
      formData.append('periodEnd', statement.periodEnd);
      // 스프레드시트 기록용 추가 필드
      formData.append('affiliateCode', statement.affiliateCode || '');
      formData.append('type', statement.type);
      formData.append('salesCount', statement.salesCount.toString());
      formData.append('totalSaleAmount', statement.totalSaleAmount.toString());
      formData.append('salesCommission', statement.salesCommission.toString());
      formData.append('branchCommission', statement.branchCommission.toString());
      formData.append('overrideCommission', statement.overrideCommission.toString());
      formData.append('grossAmount', statement.grossAmount.toString());
      formData.append('withholdingRate', statement.withholdingRate.toString());
      formData.append('withholdingAmount', statement.withholdingAmount.toString());
      formData.append('netAmount', statement.netAmount.toString());
      formData.append('bankName', statement.bankName || '');
      formData.append('bankAccount', statement.bankAccount || '');
      formData.append('bankAccountHolder', statement.bankAccountHolder || '');

      const res = await fetch('/api/partner/statements/backup', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.ok) {
        showSuccess('구글 드라이브에 백업되고 기록되었습니다.');
      } else {
        throw new Error(data.message || '백업 실패');
      }
    } catch (error: any) {
      console.error('구글 드라이브 백업 오류:', error);
      showError(error.message || '구글 드라이브 백업 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  // 이메일 발송
  const handleSendEmail = async () => {
    if (!cardRef.current || !emailAddress) return;

    if (!imagesLoaded) {
      showError('이미지가 아직 로딩 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      setIsSendingEmail(true);
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 15000,
      });

      const imageData = canvas.toDataURL('image/png');

      const res = await fetch('/api/partner/statements/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailAddress,
          subject: `[크루즈닷] ${formatPeriod(statement.periodStart, statement.periodEnd)} 정산 명세서`,
          imageData,
          // 명세서 정보 (스프레드시트 기록용)
          settlementId: settlement.id,
          profileId: statement.profileId,
          displayName: statement.displayName,
          periodStart: statement.periodStart,
          periodEnd: statement.periodEnd,
          affiliateCode: statement.affiliateCode,
          type: statement.type,
          salesCount: statement.salesCount,
          totalSaleAmount: statement.totalSaleAmount,
          salesCommission: statement.salesCommission,
          branchCommission: statement.branchCommission,
          overrideCommission: statement.overrideCommission,
          grossAmount: statement.grossAmount,
          withholdingRate: statement.withholdingRate,
          withholdingAmount: statement.withholdingAmount,
          netAmount: statement.netAmount,
          bankName: statement.bankName,
          bankAccount: statement.bankAccount,
          bankAccountHolder: statement.bankAccountHolder,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        showSuccess('이메일이 발송되고 기록되었습니다.');
        setShowEmailModal(false);
        setEmailAddress('');
      } else {
        throw new Error(data.message || '이메일 발송 실패');
      }
    } catch (error: any) {
      console.error('이메일 발송 오류:', error);
      showError(error.message || '이메일 발송 중 오류가 발생했습니다.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-y-auto">
        {/* 헤더 - 버튼들 */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-lg font-semibold text-slate-900">정산 명세서</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPNG}
              disabled={isDownloading}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
            >
              <FiDownload className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
              PNG 다운로드
            </button>
            <button
              onClick={handleBackupToGoogleDrive}
              disabled={isUploading}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm"
            >
              <FiUploadCloud className={`w-4 h-4 ${isUploading ? 'animate-spin' : ''}`} />
              드라이브 백업
            </button>
            <button
              onClick={() => setShowEmailModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm"
            >
              <FiMail className="w-4 h-4" />
              이메일 발송
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* 명세서 카드 (PNG로 캡처될 영역) */}
        <div ref={cardRef} className="bg-white p-8" style={{ minWidth: '600px' }}>
          {/* 상단 로고 */}
          <div className="flex justify-center mb-8">
            <Image
              src="/logo-watermark.png"
              alt="크루즈닷 로고"
              width={180}
              height={60}
              className="object-contain"
            />
          </div>

          {/* 제목 */}
          <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">
            정산 명세서
          </h1>
          <p className="text-center text-slate-600 mb-8">
            {formatPeriod(statement.periodStart, statement.periodEnd)}
          </p>

          {/* 수신자 정보 */}
          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">수신자</p>
                <p className="font-semibold text-slate-900">{statement.displayName} 님</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">어필리에이트 코드</p>
                <p className="font-semibold text-slate-900">{statement.affiliateCode || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">정산 기간</p>
                <p className="font-semibold text-slate-900">
                  {formatDate(statement.periodStart)} ~ {formatDate(statement.periodEnd)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">지급 예정일</p>
                <p className="font-semibold text-slate-900">
                  {settlement.paymentDate ? formatDate(settlement.paymentDate) : '미정'}
                </p>
              </div>
            </div>
          </div>

          {/* 정산 요약 */}
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
            <div className="bg-slate-900 text-white px-4 py-3">
              <h2 className="font-semibold">정산 요약</h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600">총 판매 건수</span>
                <span className="font-semibold text-slate-900">{statement.salesCount}건</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600">총 판매 금액</span>
                <span className="font-semibold text-slate-900">{formatCurrency(statement.totalSaleAmount)}</span>
              </div>
              {statement.salesCommission > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">판매 수당</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(statement.salesCommission)}</span>
                </div>
              )}
              {statement.branchCommission > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">대리점 수당</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(statement.branchCommission)}</span>
                </div>
              )}
              {statement.overrideCommission > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">오버라이드 수당</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(statement.overrideCommission)}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600">총 수당 (세전)</span>
                <span className="font-bold text-slate-900">{formatCurrency(statement.grossAmount)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600">원천징수 ({statement.withholdingRate}%)</span>
                <span className="font-semibold text-red-600">-{formatCurrency(statement.withholdingAmount)}</span>
              </div>
              <div className="flex justify-between items-center py-3 bg-emerald-50 -mx-4 px-4 rounded-b-lg">
                <span className="font-bold text-slate-900">실지급액</span>
                <span className="text-2xl font-bold text-emerald-600">{formatCurrency(statement.netAmount)}</span>
              </div>
            </div>
          </div>

          {/* 계좌 정보 */}
          {statement.bankName && (
            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-slate-900 mb-2">입금 계좌</h3>
              <p className="text-slate-700">
                {statement.bankName} {statement.bankAccount} ({statement.bankAccountHolder})
              </p>
            </div>
          )}

          {/* 상세 내역 */}
          {statement.details.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden mb-8">
              <div className="bg-slate-100 px-4 py-3">
                <h2 className="font-semibold text-slate-900">상세 내역</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-600">판매일</th>
                      <th className="px-3 py-2 text-left text-slate-600">상품</th>
                      <th className="px-3 py-2 text-left text-slate-600">고객</th>
                      <th className="px-3 py-2 text-left text-slate-600">유형</th>
                      <th className="px-3 py-2 text-right text-slate-600">판매액</th>
                      <th className="px-3 py-2 text-right text-slate-600">수당</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {statement.details.map((detail, idx) => (
                      <tr key={detail.entryId || idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-700">
                          {detail.saleDate ? new Date(detail.saleDate).toLocaleDateString('ko-KR') : '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{detail.productCode || '-'}</td>
                        <td className="px-3 py-2 text-slate-700">{detail.customerName || '-'}</td>
                        <td className="px-3 py-2 text-slate-700">{getEntryTypeLabel(detail.entryType)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(detail.saleAmount)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatCurrency(detail.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 하단 도장 */}
          <div className="flex justify-end mt-8">
            <div className="text-right">
              <p className="text-sm text-slate-500 mb-2">발행일: {new Date().toLocaleDateString('ko-KR')}</p>
              <Image
                src="/images/cruisedot-stamp.png"
                alt="크루즈닷 도장"
                width={100}
                height={100}
                className="object-contain ml-auto"
              />
            </div>
          </div>

          {/* 푸터 */}
          <div className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
            <p>본 명세서는 전자 발행되었으며, 별도의 서명 없이도 효력을 갖습니다.</p>
            <p className="mt-1">문의: support@cruisedot.com | www.cruisedot.com</p>
          </div>
        </div>
      </div>

      {/* 이메일 발송 모달 */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">이메일로 명세서 발송</h3>
            <input
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="수신자 이메일 주소"
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSendEmail}
                disabled={!emailAddress || isSendingEmail}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSendingEmail ? (
                  <>
                    <FiMail className="w-4 h-4 animate-spin" />
                    발송 중...
                  </>
                ) : (
                  <>
                    <FiMail className="w-4 h-4" />
                    발송
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
