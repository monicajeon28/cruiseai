'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

interface GenieLinkSectionProps {
  userRole: string;
  userName: string | null;
  userPhone: string | null;
}

export default function GenieLinkSection({ userRole, userName, userPhone }: GenieLinkSectionProps) {
  const [isLinking, setIsLinking] = useState(false);
  const [linkStatus, setLinkStatus] = useState<'none' | 'success' | 'error'>('none');
  const [linkMessage, setLinkMessage] = useState('');
  const [linkedGenieInfo, setLinkedGenieInfo] = useState<{
    id: number;
    name: string;
    phone: string;
    genieStatus: string | null;
    genieLinkedAt: string | null;
  } | null>(null);



  useEffect(() => {
    // 연동 정보 확인
    if (userRole === 'community') {
      checkLinkStatus();
    }
  }, [userRole]);

  const checkLinkStatus = async () => {
    try {
      const response = await fetch('/api/community/profile', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.ok && data.linkedGenieUser) {
          setLinkedGenieInfo(data.linkedGenieUser);
          setLinkStatus('success');
          setLinkMessage('크루즈닷AI와 연동 완료');
        }
      }
    } catch (error) {
      logger.error('Failed to check link status:', error);
    }
  };

  const handleLinkGenie = async () => {
    if (!userName || !userPhone) {
      alert('이름과 연락처를 입력해주세요.');
      return;
    }

    setIsLinking(true);
    setLinkStatus('none');
    setLinkMessage('');

    try {
      const response = await fetch('/api/community/link-genie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: userName,
          phone: userPhone,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        setLinkStatus('success');
        setLinkMessage('연동 완료');
        // 연동 정보 다시 확인
        await checkLinkStatus();
      } else {
        setLinkStatus('error');
        setLinkMessage(data.error || '연동에 실패했습니다.');
      }
    } catch (error) {
      logger.error('Failed to link genie:', error);
      setLinkStatus('error');
      setLinkMessage('연동 중 오류가 발생했습니다.');
    } finally {
      setIsLinking(false);
    }
  };

  // 크루즈몰 사용자(role: 'community')인 경우에만 표시
  if (userRole !== 'community') {
    return null;
  }

  return (
    <section className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border-2 border-green-200 mb-6">
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-5 flex items-center gap-3 leading-tight">
        <span className="text-4xl md:text-5xl">🔗</span>
        크루즈닷AI 연동
      </h2>

      {linkStatus === 'success' && linkedGenieInfo ? (
        <div className="space-y-4">
          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">✅</span>
              <span className="font-bold text-green-700 text-lg">연동 완료</span>
            </div>
            <p className="text-gray-700 text-base">
              크루즈닷AI와 성공적으로 연동되었습니다.
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-semibold text-gray-700">연동된 크루즈닷 사용자 ID:</span>{' '}
              <span className="text-gray-900">{linkedGenieInfo.id}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700">이름:</span>{' '}
              <span className="text-gray-900">{linkedGenieInfo.name || '정보 없음'}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700">연락처:</span>{' '}
              <span className="text-gray-900">{linkedGenieInfo.phone || '정보 없음'}</span>
            </div>
            {linkedGenieInfo.genieStatus && (
              <div>
                <span className="font-semibold text-gray-700">크루즈닷 상태:</span>{' '}
                <span className="text-gray-900">
                  {linkedGenieInfo.genieStatus === 'active' ? '사용 중' : '사용 종료'}
                </span>
              </div>
            )}
            {linkedGenieInfo.genieLinkedAt && (
              <div>
                <span className="font-semibold text-gray-700">연동 일시:</span>{' '}
                <span className="text-gray-900">
                  {new Date(linkedGenieInfo.genieLinkedAt).toLocaleString('ko-KR')}
                </span>
              </div>
            )}
          </div>
        </div>
      ) : linkStatus === 'error' ? (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">❌</span>
            <span className="font-bold text-red-700 text-lg">연동 실패</span>
          </div>
          <p className="text-gray-700 text-base">{linkMessage}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-700 text-base md:text-lg leading-relaxed">
            크루즈닷AI와 연동하면 여행 정보를 공유하고 더 편리하게 이용할 수 있습니다.
          </p>
          <button
            onClick={handleLinkGenie}
            disabled={isLinking || !userName || !userPhone}
            className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg hover:from-green-600 hover:to-emerald-700 transition-all transform hover:scale-105 text-lg md:text-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isLinking ? '연동 중...' : '크루즈닷AI 연동하기'}
          </button>
          {(!userName || !userPhone) && (
            <p className="text-sm text-red-600">
              이름과 연락처를 먼저 입력해주세요.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

