'use client';

import { useState, useRef } from 'react';
import {
  FiX,
  FiUpload,
  FiCheckCircle,
  FiClock,
  FiXCircle,
  FiExternalLink,
  FiRefreshCw,
} from 'react-icons/fi';
import { showError, showSuccess } from '@/components/ui/Toast';

type Sale = {
  id: number;
  productCode: string | null;
  saleAmount: number;
  status: string;
  audioFileGoogleDriveUrl: string | null;
  saleDate: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
};

type SalesConfirmationModalProps = {
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function SalesConfirmationModal({
  sale,
  isOpen,
  onClose,
  onSuccess,
}: SalesConfirmationModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioFileType, setAudioFileType] = useState<'FIRST_CALL' | 'PASSPORT_GUIDE' | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !sale) return null;

  // PENDING 또는 REJECTED 상태일 때 확정 요청 가능 (파일과 타입 모두 필요)
  const canSubmit = (sale.status === 'PENDING' || sale.status === 'REJECTED') && selectedFile && audioFileType !== '';
  const canCancel = sale.status === 'PENDING_APPROVAL';
  const isApproved = sale.status === 'APPROVED';
  const isRejected = sale.status === 'REJECTED';
  const canRequestAgain = sale.status === 'PENDING' || sale.status === 'REJECTED';

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 확인 (50MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showError('파일 크기는 50MB를 초과할 수 없습니다');
      return;
    }

    // 파일 형식 확인
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/x-m4a'];
    if (!allowedTypes.includes(file.type)) {
      showError('지원하는 파일 형식: MP3, WAV, M4A');
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile || !sale || !audioFileType) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('audioFile', selectedFile);
      formData.append('audioFileType', audioFileType);

      const res = await fetch(`/api/affiliate/sales/${sale.id}/submit-confirmation`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || '판매 확정 요청에 실패했습니다');
      }

      showSuccess('판매 확정 요청이 제출되었습니다. 관리자 승인을 기다려주세요.');
      setSelectedFile(null);
      setAudioFileType('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[SalesConfirmation] Submit error:', error);
      showError(error.message || '판매 확정 요청 중 오류가 발생했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!sale || !confirm('판매 확정 요청을 취소하시겠습니까?')) return;

    setIsCanceling(true);
    try {
      const res = await fetch(`/api/affiliate/sales/${sale.id}/cancel-confirmation`, {
        method: 'POST',
        credentials: 'include',
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || '요청 취소에 실패했습니다');
      }

      showSuccess('판매 확정 요청이 취소되었습니다');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[SalesConfirmation] Cancel error:', error);
      showError(error.message || '요청 취소 중 오류가 발생했습니다');
    } finally {
      setIsCanceling(false);
    }
  };

  const getStatusInfo = () => {
    switch (sale.status) {
      case 'PENDING':
        return {
          label: '대기 중',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          icon: <FiClock className="text-base" />,
        };
      case 'PENDING_APPROVAL':
        return {
          label: '승인 대기',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          icon: <FiClock className="text-base" />,
        };
      case 'APPROVED':
        return {
          label: '승인됨',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          icon: <FiCheckCircle className="text-base" />,
        };
      case 'REJECTED':
        return {
          label: '거부됨',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          icon: <FiXCircle className="text-base" />,
        };
      default:
        return {
          label: '알 수 없음',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          icon: <FiClock className="text-base" />,
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900">판매 확정 요청</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6 space-y-6">
          {/* 판매 정보 */}
          <div className="rounded-xl bg-gray-50 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">상품 코드</p>
                <p className="text-base font-semibold text-gray-900">
                  {sale.productCode || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">판매 금액</p>
                <p className="text-base font-semibold text-gray-900">
                  {sale.saleAmount.toLocaleString()}원
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">판매일</p>
                <p className="text-base font-semibold text-gray-900">
                  {sale.saleDate
                    ? new Date(sale.saleDate).toLocaleDateString('ko-KR')
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">상태</p>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${statusInfo.color} ${statusInfo.bgColor}`}
                >
                  {statusInfo.icon}
                  {statusInfo.label}
                </span>
              </div>
            </div>
          </div>

          {/* 상태별 UI */}
          {canRequestAgain && (
            <div className="space-y-4">
              {isRejected && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                  <p className="text-sm text-red-800 font-semibold mb-1">
                    이전 요청이 거부되었습니다
                  </p>
                  <p className="text-xs text-red-700">
                    새로운 녹음 파일을 업로드하여 다시 요청해주세요.
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  고객과의 통화 녹음 파일
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  MP3, WAV, M4A 형식만 지원됩니다 (최대 50MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/x-m4a"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {selectedFile && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                    <FiUpload className="text-base" />
                    <span>{selectedFile.name}</span>
                    <span className="text-gray-400">
                      ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                )}
              </div>

              {/* 녹음 파일 타입 선택 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  녹음 파일 타입 <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  정산 완료를 위해 첫 콜 또는 여권 안내 콜 녹음이 필요합니다
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="audioFileType"
                      value="FIRST_CALL"
                      checked={audioFileType === 'FIRST_CALL'}
                      onChange={(e) => setAudioFileType(e.target.value as 'FIRST_CALL')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-gray-900">첫 콜 녹음</span>
                      <p className="text-xs text-gray-500 mt-0.5">고객과의 첫 통화 녹음</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="audioFileType"
                      value="PASSPORT_GUIDE"
                      checked={audioFileType === 'PASSPORT_GUIDE'}
                      onChange={(e) => setAudioFileType(e.target.value as 'PASSPORT_GUIDE')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-gray-900">여권 안내 콜 녹음</span>
                      <p className="text-xs text-gray-500 mt-0.5">여권 안내 관련 통화 녹음</p>
                    </div>
                  </label>
                </div>
              </div>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
                className="w-full rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? '제출 중...' : isRejected ? '다시 요청 제출' : '요청 제출'}
              </button>
            </div>
          )}

          {sale.status === 'PENDING_APPROVAL' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4">
                <p className="text-sm text-yellow-800">
                  관리자 승인을 기다리고 있습니다. 승인되면 수당이 자동으로 계산됩니다.
                </p>
              </div>
              {sale.audioFileGoogleDriveUrl && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">업로드된 녹음 파일</p>
                  <a
                    href={sale.audioFileGoogleDriveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                  >
                    <FiExternalLink className="text-base" />
                    <span>녹음 파일 확인하기</span>
                  </a>
                </div>
              )}
              {sale.submittedAt && (
                <p className="text-xs text-gray-500">
                  제출일: {new Date(sale.submittedAt).toLocaleString('ko-KR')}
                </p>
              )}
              <button
                onClick={handleCancel}
                disabled={isCanceling}
                className="w-full rounded-xl bg-gray-200 px-6 py-3 text-base font-semibold text-gray-700 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
              >
                {isCanceling ? '취소 중...' : '요청 취소'}
              </button>
            </div>
          )}

          {isApproved && (
            <div className="space-y-4">
              <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                <p className="text-sm text-green-800">
                  판매가 승인되었고 수당이 자동으로 계산되었습니다.
                </p>
              </div>
              {sale.audioFileGoogleDriveUrl && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">녹음 파일</p>
                  <a
                    href={sale.audioFileGoogleDriveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                  >
                    <FiExternalLink className="text-base" />
                    <span>녹음 파일 확인하기</span>
                  </a>
                </div>
              )}
              {sale.approvedAt && (
                <p className="text-xs text-gray-500">
                  승인일: {new Date(sale.approvedAt).toLocaleString('ko-KR')}
                </p>
              )}
            </div>
          )}

          {/* REJECTED 상태는 위의 canRequestAgain 섹션에서 처리됨 */}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 p-6">
          <button
            onClick={onClose}
            className="rounded-xl bg-gray-100 px-6 py-2 text-base font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
