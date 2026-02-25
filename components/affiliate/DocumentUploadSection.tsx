// components/affiliate/DocumentUploadSection.tsx
// 신분증 및 통장사본 업로드 섹션

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { FiUpload, FiCheckCircle, FiXCircle, FiFile, FiRefreshCw, FiEye, FiClock, FiSave, FiEdit2, FiArrowLeft } from 'react-icons/fi';
import { showError, showSuccess } from '@/components/ui/Toast';

type Document = {
  id: number;
  documentType: 'ID_CARD' | 'BANKBOOK';
  filePath: string;
  fileName: string | null;
  fileSize: number | null;
  status: string;
  uploadedAt: string;
  reviewedAt: string | null;
  isApproved: boolean;
};

type DocumentUploadSectionProps = {
  partnerId?: string;
};

export default function DocumentUploadSection({ partnerId }: DocumentUploadSectionProps = {}) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<'ID_CARD' | 'BANKBOOK' | null>(null);
  const [savingDocuments, setSavingDocuments] = useState(false);
  const idCardInputRef = useRef<HTMLInputElement>(null);
  const bankbookInputRef = useRef<HTMLInputElement>(null);

  // 문서 목록 로드
  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/affiliate/profile/upload-documents', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || '문서 목록을 불러오지 못했습니다');
      }
      console.log('[DocumentUpload] Documents loaded:', json.documents);
      setDocuments(json.documents || []);
    } catch (error: any) {
      console.error('[DocumentUpload] Load documents error:', error);
      showError(error.message || '문서 목록을 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  // 파일 업로드 처리
  const handleFileUpload = async (file: File, documentType: 'ID_CARD' | 'BANKBOOK') => {
    if (!file) return;

    // 파일 형식 확인
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showError('지원하는 파일 형식: JPG, PNG, WEBP');
      return;
    }

    // 파일 크기 확인 (10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      showError('파일 크기는 10MB를 초과할 수 없습니다');
      return;
    }

    setUploading(documentType);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);

      console.log('[DocumentUpload] Uploading file:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        documentType,
      });

      const res = await fetch('/api/affiliate/profile/upload-documents', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const json = await res.json();

      console.log('[DocumentUpload] Upload response:', {
        status: res.status,
        ok: res.ok,
        jsonOk: json.ok,
        error: json.error,
      });

      if (!res.ok || !json.ok) {
        throw new Error(json.error || '파일 업로드에 실패했습니다');
      }

      showSuccess(json.message || '완료되었습니다');
      await loadDocuments(); // 목록 새로고침
    } catch (error: any) {
      console.error('[DocumentUpload] Upload error:', error);
      showError(error.message || '파일 업로드 중 오류가 발생했습니다');
    } finally {
      setUploading(null);
      // 파일 input 초기화
      if (documentType === 'ID_CARD' && idCardInputRef.current) {
        idCardInputRef.current.value = '';
      }
      if (documentType === 'BANKBOOK' && bankbookInputRef.current) {
        bankbookInputRef.current.value = '';
      }
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, documentType: 'ID_CARD' | 'BANKBOOK') => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, documentType);
    }
  };

  // 문서 상태 표시
  const getStatusInfo = (status: string, isApproved: boolean) => {
    if (isApproved) {
      return {
        label: '승인됨',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        icon: <FiCheckCircle className="text-base" />,
      };
    }
    switch (status) {
      case 'UPLOADED':
        return {
          label: '검토 대기',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          icon: <FiClock className="text-base" />,
        };
      case 'REJECTED':
        return {
          label: '반려됨',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          icon: <FiXCircle className="text-base" />,
        };
      default:
        return {
          label: '알 수 없음',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          icon: <FiFile className="text-base" />,
        };
    }
  };

  // 문서 저장 함수 (업로드된 문서 정보 확인)
  const handleSaveDocuments = async () => {
    setSavingDocuments(true);
    try {
      // 문서 목록을 다시 로드하여 최신 상태 확인
      await loadDocuments();
      showSuccess('세금 신고용 서류가 저장되었습니다!');
    } catch (error: any) {
      console.error('[DocumentUpload] Save documents error:', error);
      showError(error.message || '문서 저장 중 오류가 발생했습니다');
    } finally {
      setSavingDocuments(false);
    }
  };

  const idCardDoc = documents.find(d => d.documentType === 'ID_CARD');
  const bankbookDoc = documents.find(d => d.documentType === 'BANKBOOK');

  // 디버깅: 승인 상태 확인
  if (idCardDoc) {
    console.log('[DocumentUpload] ID Card doc:', {
      isApproved: idCardDoc.isApproved,
      status: idCardDoc.status,
      filePath: idCardDoc.filePath
    });
  }
  if (bankbookDoc) {
    console.log('[DocumentUpload] Bankbook doc:', {
      isApproved: bankbookDoc.isApproved,
      status: bankbookDoc.status,
      filePath: bankbookDoc.filePath
    });
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-lg md:rounded-3xl md:p-6">
      {partnerId && (
        <div className="mb-4">
          <Link
            href={`/partner/${partnerId}/dashboard`}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-semibold mb-4"
          >
            <FiArrowLeft className="text-base" />
            대시보드로 돌아가기
          </Link>
        </div>
      )}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 md:text-xl flex items-center gap-2">
          <FiFile className="text-blue-600" />
          세금 신고용 서류 업로드
        </h2>
        <button
          onClick={loadDocuments}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        >
          <FiRefreshCw className={`text-base ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
        <p className="text-xs text-blue-800">
          <strong>💡 안내:</strong> 원천징수 3.3% 신고를 위해 신분증과 통장사본을 업로드해주세요.
          <br />
          관리자 검토 후 승인되면 정산이 진행됩니다.
        </p>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-gray-500">
          문서 목록을 불러오는 중입니다...
        </div>
      ) : (
        <div className="space-y-4">
          {/* 신분증 업로드 */}
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">신분증</h3>
              {idCardDoc && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${getStatusInfo(idCardDoc.status, idCardDoc.isApproved).color
                    } ${getStatusInfo(idCardDoc.status, idCardDoc.isApproved).bgColor}`}
                >
                  {getStatusInfo(idCardDoc.status, idCardDoc.isApproved).icon}
                  {getStatusInfo(idCardDoc.status, idCardDoc.isApproved).label}
                </span>
              )}
            </div>
            {idCardDoc ? (
              <div className="space-y-3">
                {/* 승인된 경우 이미지 미리보기 */}
                {idCardDoc.isApproved && idCardDoc.filePath && (
                  <div className="rounded-lg border-2 border-green-200 bg-green-50 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <FiCheckCircle className="text-green-600" />
                      <span className="text-sm font-semibold text-green-700">✅ 승인 완료 - 활성화됨</span>
                    </div>
                    <div className="rounded-lg overflow-hidden border border-green-200 bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={idCardDoc.filePath.startsWith('http') ? idCardDoc.filePath : (typeof window !== 'undefined' ? `${window.location.origin}${idCardDoc.filePath}` : idCardDoc.filePath)}
                        alt="신분증"
                        className="w-full h-auto max-h-48 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => {
                          const url = idCardDoc.filePath.startsWith('http') ? idCardDoc.filePath : (typeof window !== 'undefined' ? `${window.location.origin}${idCardDoc.filePath}` : idCardDoc.filePath);
                          if (typeof window !== 'undefined') {
                            window.open(url, '_blank');
                          }
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    {idCardDoc.fileName || '신분증 파일'}
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={idCardDoc.filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    >
                      <FiEye className="text-base" />
                      <span>보기</span>
                    </a>
                    {idCardDoc.fileSize && (
                      <span className="text-xs text-gray-500">
                        ({(idCardDoc.fileSize / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    )}
                  </div>
                </div>
                {idCardDoc.uploadedAt && (
                  <p className="text-xs text-gray-500">
                    업로드일: {new Date(idCardDoc.uploadedAt).toLocaleString('ko-KR')}
                  </p>
                )}
                <button
                  onClick={() => idCardInputRef.current?.click()}
                  disabled={uploading === 'ID_CARD'}
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {uploading === 'ID_CARD' ? '업로드 중...' : '다시 업로드'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => idCardInputRef.current?.click()}
                disabled={uploading === 'ID_CARD'}
                className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center transition-colors hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"
              >
                <FiUpload className="mx-auto mb-2 text-2xl text-gray-400" />
                <p className="text-sm font-semibold text-gray-700">
                  {uploading === 'ID_CARD' ? '업로드 중...' : '신분증 업로드'}
                </p>
                <p className="mt-1 text-xs text-gray-500">JPG, PNG, WEBP (최대 10MB)</p>
              </button>
            )}
            <input
              ref={idCardInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={(e) => handleFileSelect(e, 'ID_CARD')}
              className="hidden"
            />
          </div>

          {/* 통장사본 업로드 */}
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">통장사본</h3>
              {bankbookDoc && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${getStatusInfo(bankbookDoc.status, bankbookDoc.isApproved).color
                    } ${getStatusInfo(bankbookDoc.status, bankbookDoc.isApproved).bgColor}`}
                >
                  {getStatusInfo(bankbookDoc.status, bankbookDoc.isApproved).icon}
                  {getStatusInfo(bankbookDoc.status, bankbookDoc.isApproved).label}
                </span>
              )}
            </div>
            {bankbookDoc ? (
              <div className="space-y-3">
                {/* 승인된 경우 이미지 미리보기 */}
                {bankbookDoc.isApproved && bankbookDoc.filePath && (
                  <div className="rounded-lg border-2 border-green-200 bg-green-50 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <FiCheckCircle className="text-green-600" />
                      <span className="text-sm font-semibold text-green-700">✅ 승인 완료 - 활성화됨</span>
                    </div>
                    <div className="rounded-lg overflow-hidden border border-green-200 bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={bankbookDoc.filePath.startsWith('http') ? bankbookDoc.filePath : (typeof window !== 'undefined' ? `${window.location.origin}${bankbookDoc.filePath}` : bankbookDoc.filePath)}
                        alt="통장사본"
                        className="w-full h-auto max-h-48 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => {
                          const url = bankbookDoc.filePath.startsWith('http') ? bankbookDoc.filePath : (typeof window !== 'undefined' ? `${window.location.origin}${bankbookDoc.filePath}` : bankbookDoc.filePath);
                          if (typeof window !== 'undefined') {
                            window.open(url, '_blank');
                          }
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    {bankbookDoc.fileName || '통장사본 파일'}
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={bankbookDoc.filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    >
                      <FiEye className="text-base" />
                      <span>보기</span>
                    </a>
                    {bankbookDoc.fileSize && (
                      <span className="text-xs text-gray-500">
                        ({(bankbookDoc.fileSize / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    )}
                  </div>
                </div>
                {bankbookDoc.uploadedAt && (
                  <p className="text-xs text-gray-500">
                    업로드일: {new Date(bankbookDoc.uploadedAt).toLocaleString('ko-KR')}
                  </p>
                )}
                <button
                  onClick={() => bankbookInputRef.current?.click()}
                  disabled={uploading === 'BANKBOOK'}
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {uploading === 'BANKBOOK' ? '업로드 중...' : '다시 업로드'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => bankbookInputRef.current?.click()}
                disabled={uploading === 'BANKBOOK'}
                className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center transition-colors hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"
              >
                <FiUpload className="mx-auto mb-2 text-2xl text-gray-400" />
                <p className="text-sm font-semibold text-gray-700">
                  {uploading === 'BANKBOOK' ? '업로드 중...' : '통장사본 업로드'}
                </p>
                <p className="mt-1 text-xs text-gray-500">JPG, PNG, WEBP (최대 10MB)</p>
              </button>
            )}
            <input
              ref={bankbookInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={(e) => handleFileSelect(e, 'BANKBOOK')}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* 저장/수정 버튼 */}
      <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
        <button
          onClick={handleSaveDocuments}
          disabled={savingDocuments || loading || documents.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {savingDocuments ? (
            <>
              <span className="animate-spin">⏳</span>
              저장 중...
            </>
          ) : (
            <>
              <FiSave />
              저장하기
            </>
          )}
        </button>
        {(idCardDoc || bankbookDoc) && (
          <button
            onClick={loadDocuments}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <FiEdit2 />
            수정하기
          </button>
        )}
      </div>
    </section>
  );
}






