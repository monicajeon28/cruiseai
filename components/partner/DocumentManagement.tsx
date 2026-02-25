'use client';

import React, { useState, useEffect } from 'react';
import { 
  FiFileText, 
  FiDownload, 
  FiUpload, 
  FiEye, 
  FiTrash2,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiSearch,
  FiFilter
} from 'react-icons/fi';

type DocumentManagementProps = {
  userId: number;
  userRole: 'agent' | 'manager';
  profileId: number;
};

type Document = {
  id: number;
  type: 'contract' | 'settlement' | 'invoice' | 'receipt' | 'other';
  name: string;
  fileName: string;
  uploadDate: string;
  status: 'pending' | 'approved' | 'rejected';
  fileUrl?: string;
};

/**
 * 파트너 문서 관리 컴포넌트
 * 계약서, 정산서 등 파트너 관련 문서를 관리합니다.
 */
export default function DocumentManagement({ 
  userId, 
  userRole, 
  profileId 
}: DocumentManagementProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([]);

  useEffect(() => {
    // 문서 목록 로드
    loadDocuments();
  }, [userId, profileId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      // TODO: API 연동 필요
      // const response = await fetch(`/api/partner/documents?profileId=${profileId}`);
      // const data = await response.json();
      // setDocuments(data);

      // 임시 더미 데이터
      setDocuments([
        {
          id: 1,
          type: 'contract',
          name: '계약서',
          fileName: 'contract_2024.pdf',
          uploadDate: new Date().toISOString(),
          status: 'approved',
        },
        {
          id: 2,
          type: 'settlement',
          name: '정산서',
          fileName: 'settlement_2024.pdf',
          uploadDate: new Date().toISOString(),
          status: 'pending',
        },
      ]);
    } catch (error) {
      console.error('문서 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    try {
      // TODO: 파일 업로드 API 연동
      // const formData = new FormData();
      // formData.append('file', file);
      // formData.append('type', 'contract');
      // const response = await fetch(`/api/partner/documents/upload`, {
      //   method: 'POST',
      //   body: formData,
      // });
      
      alert('파일 업로드 기능은 준비 중입니다.');
    } catch (error) {
      console.error('파일 업로드 실패:', error);
    }
  };

  const handleDownload = (document: Document) => {
    if (document.fileUrl) {
      window.open(document.fileUrl, '_blank');
    } else {
      alert('다운로드할 파일이 없습니다.');
    }
  };

  const handleDelete = async (documentId: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      // TODO: 삭제 API 연동
      // await fetch(`/api/partner/documents/${documentId}`, {
      //   method: 'DELETE',
      // });
      
      setDocuments(documents.filter(doc => doc.id !== documentId));
      alert('문서가 삭제되었습니다.');
    } catch (error) {
      console.error('문서 삭제 실패:', error);
      alert('문서 삭제에 실패했습니다.');
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      contract: '계약서',
      settlement: '정산서',
      invoice: '청구서',
      receipt: '영수증',
      other: '기타',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { icon: any; color: string; text: string }> = {
      pending: { icon: FiClock, color: 'text-yellow-600 bg-yellow-50', text: '대기중' },
      approved: { icon: FiCheckCircle, color: 'text-green-600 bg-green-50', text: '승인됨' },
      rejected: { icon: FiXCircle, color: 'text-red-600 bg-red-50', text: '거절됨' },
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.text}
      </span>
    );
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || doc.type === filterType;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg">
      {/* 헤더 */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">문서 관리</h2>
        <p className="text-gray-600 text-sm">계약서, 정산서 등 파트너 문서를 관리합니다.</p>
      </div>

      {/* 검색 및 필터 */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="문서명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">전체</option>
            <option value="contract">계약서</option>
            <option value="settlement">정산서</option>
            <option value="invoice">청구서</option>
            <option value="receipt">영수증</option>
            <option value="other">기타</option>
          </select>
        </div>
        <button
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/pdf,image/*';
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) handleUpload(file);
            };
            input.click();
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <FiUpload className="w-4 h-4" />
          업로드
        </button>
      </div>

      {/* 문서 목록 */}
      <div className="space-y-3">
        {filteredDocuments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FiFileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>문서가 없습니다.</p>
          </div>
        ) : (
          filteredDocuments.map((document) => (
            <div
              key={document.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <FiFileText className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">{document.name}</h3>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {getTypeLabel(document.type)}
                    </span>
                    {getStatusBadge(document.status)}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{document.fileName}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(document.uploadDate).toLocaleDateString('ko-KR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(document)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="다운로드"
                >
                  <FiDownload className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(document.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="삭제"
                >
                  <FiTrash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
