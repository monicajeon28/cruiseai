'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface KakaoChannelButtonProps {
  className?: string;
  variant?: 'banner' | 'button';
}

export default function KakaoChannelButton({ className = '', variant = 'banner' }: KakaoChannelButtonProps) {
  const [isAdded, setIsAdded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showManualConfirm, setShowManualConfirm] = useState(false); // 수동 확인 버튼 표시 여부

  // 카카오 SDK 로드 및 채널 추가 여부 확인
  useEffect(() => {
    // 카카오 채널 추가 여부 확인
    checkChannelStatus();

    // 카카오 SDK 로드
    if (typeof window !== 'undefined') {
      const kakaoJsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      
      if (!kakaoJsKey) {
        console.warn('[Kakao Channel] NEXT_PUBLIC_KAKAO_JS_KEY가 설정되지 않았습니다.');
        return;
      }

      if (!window.Kakao) {
        const script = document.createElement('script');
        script.src = 'https://developers.kakao.com/sdk/js/kakao.js';
        script.async = true;
        script.onload = () => {
          if (window.Kakao && kakaoJsKey) {
            try {
              if (!window.Kakao.isInitialized()) {
                window.Kakao.init(kakaoJsKey);
                console.log('[Kakao Channel] SDK 초기화 완료');
              } else {
                console.log('[Kakao Channel] SDK가 이미 초기화되어 있습니다.');
              }
            } catch (error) {
              console.error('[Kakao Channel] SDK 초기화 실패:', error);
            }
          }
        };
        script.onerror = (error) => {
          console.error('[Kakao Channel] SDK 스크립트 로드 실패:', error);
        };
        document.head.appendChild(script);
      } else if (!window.Kakao.isInitialized()) {
        try {
          window.Kakao.init(kakaoJsKey);
          console.log('[Kakao Channel] SDK 재초기화 완료');
        } catch (error) {
          console.error('[Kakao Channel] SDK 재초기화 실패:', error);
        }
      } else {
        console.log('[Kakao Channel] SDK가 이미 초기화되어 있습니다.');
      }
    }

    // 페이지 포커스 시 자동으로 채널 추가 여부 확인 (카카오톡에서 돌아왔을 때)
    const handleFocus = () => {
      // 1초 후 확인 (카카오톡에서 돌아온 직후 상태가 업데이트될 시간을 줌)
      setTimeout(async () => {
        const wasAdded = await checkChannelStatus();
        if (wasAdded && showManualConfirm) {
          setShowManualConfirm(false);
        }
      }, 1000);
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [showManualConfirm]);

  const checkChannelStatus = async () => {
    try {
      const response = await fetch('/api/kakao/add-channel', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.ok) {
        const wasAdded = data.kakaoChannelAdded || false;
        setIsAdded(wasAdded);
        // 채널이 추가되었으면 수동 확인 버튼 숨기기
        if (wasAdded) {
          setShowManualConfirm(false);
        }
        return wasAdded;
      }
      return false;
    } catch (error) {
      console.error('Failed to check channel status:', error);
      return false;
    } finally {
      setChecking(false);
    }
  };

  const handleAddChannel = async () => {
    if (loading || isAdded) return;

    try {
      setLoading(true);

      // 환경 변수 확인
      const kakaoJsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (!kakaoJsKey) {
        console.error('[Kakao Channel] NEXT_PUBLIC_KAKAO_JS_KEY가 설정되지 않았습니다.');
        alert('카카오톡 SDK 설정이 완료되지 않았습니다. 관리자에게 문의하세요.\n\n오류: NEXT_PUBLIC_KAKAO_JS_KEY가 없습니다.');
        setLoading(false);
        return;
      }

      // 카카오 채널 공개 ID 가져오기 (API를 통해)
      let channelId = '';
      let missingVars: string[] = [];
      
      try {
        // 공개 API에서 채널 정보 가져오기
        const channelInfoResponse = await fetch('/api/kakao/channel-info');
        const channelInfoData = await channelInfoResponse.json();
        
        if (channelInfoData.ok && channelInfoData.channelId) {
          channelId = channelInfoData.channelId;
          console.log('[Kakao Channel] 채널 ID 조회 성공:', channelId);
        } else {
          // 누락된 환경 변수 정보 저장
          if (channelInfoData.missingVars) {
            missingVars = channelInfoData.missingVars;
          }
          console.warn('[Kakao Channel] 공개 API에서 채널 ID를 가져오지 못했습니다. 관리자 API 시도...');
          // 공개 API가 실패하면 관리자 API 시도 (로그인한 경우)
          const configResponse = await fetch('/api/admin/settings/info', {
            credentials: 'include',
          });
          const configData = await configResponse.json();
          if (configData.ok && configData.info?.kakaoChannelId) {
            channelId = configData.info.kakaoChannelId;
            console.log('[Kakao Channel] 관리자 API에서 채널 ID 조회 성공:', channelId);
          }
        }
      } catch (error) {
        console.error('[Kakao Channel] 채널 ID 조회 실패:', error);
      }
      
      if (!channelId) {
        console.error('[Kakao Channel] 채널 ID가 설정되지 않았습니다.');
        
        // 상세한 오류 메시지 생성
        let errorMessage = '카카오 채널 ID가 설정되지 않았습니다.\n\n';
        
        if (missingVars.length > 0) {
          errorMessage += `누락된 환경 변수:\n${missingVars.map(v => `- ${v}`).join('\n')}\n\n`;
        } else {
          errorMessage += `누락된 환경 변수: NEXT_PUBLIC_KAKAO_CHANNEL_ID\n\n`;
        }
        
        errorMessage += '해결 방법:\n';
        errorMessage += '1. Vercel 대시보드에서 환경 변수를 확인하세요\n';
        errorMessage += '2. Settings > Environment Variables에서 다음 변수를 설정하세요:\n';
        errorMessage += '   - NEXT_PUBLIC_KAKAO_CHANNEL_ID\n';
        errorMessage += '   - NEXT_PUBLIC_KAKAO_JS_KEY\n';
        errorMessage += '3. 환경 변수 설정 후 재배포가 필요합니다\n\n';
        errorMessage += '자세한 내용은 관리자에게 문의하세요.';
        
        alert(errorMessage);
        setLoading(false);
        return;
      }
      
      // 카카오 SDK 상태 확인
      const hasKakaoSDK = typeof window !== 'undefined' && window.Kakao;
      const isKakaoInitialized = hasKakaoSDK && window.Kakao.isInitialized();
      const hasChannelAPI = hasKakaoSDK && window.Kakao.Channel;
      
      console.log('[Kakao Channel] SDK 상태 확인:', {
        hasKakaoSDK,
        isKakaoInitialized,
        hasChannelAPI,
        channelId,
        kakaoJsKey: kakaoJsKey ? '설정됨' : '없음',
      });
      
      // SDK가 로드되지 않았거나 초기화되지 않은 경우 재시도
      if (!hasKakaoSDK || !isKakaoInitialized) {
        console.warn('[Kakao Channel] SDK가 로드되지 않았습니다. 재시도 중...');
        
        // SDK 재로드 시도
        if (!hasKakaoSDK) {
          const script = document.createElement('script');
          script.src = 'https://developers.kakao.com/sdk/js/kakao.js';
          script.async = true;
          script.onload = () => {
            if (window.Kakao && kakaoJsKey) {
              window.Kakao.init(kakaoJsKey);
              console.log('[Kakao Channel] SDK 재로드 및 초기화 완료');
              // 재로드 후 다시 시도
              setTimeout(() => handleAddChannel(), 500);
            }
          };
          script.onerror = () => {
            console.error('[Kakao Channel] SDK 스크립트 로드 실패');
            // SDK 로드 실패 시 URL로 직접 이동
            fallbackToDirectUrl(channelId);
          };
          document.head.appendChild(script);
          return;
        } else if (!isKakaoInitialized && kakaoJsKey) {
          window.Kakao.init(kakaoJsKey);
          console.log('[Kakao Channel] SDK 재초기화 완료');
          // 재초기화 후 다시 시도
          setTimeout(() => handleAddChannel(), 500);
          return;
        }
      }
      
      // 카카오 SDK의 Channel.addChannel은 최신 버전에서 success/fail 콜백을 지원하지 않음
      // 따라서 직접 채널 URL로 이동하는 방식 사용
      console.log('[Kakao Channel] 채널 페이지로 직접 이동합니다.');
      fallbackToDirectUrl(channelId);
    } catch (error) {
      console.error('[Kakao Channel] 예상치 못한 오류:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`카카오톡 채널 추가 중 오류가 발생했습니다.\n\n오류: ${errorMessage}\n\n브라우저 콘솔을 확인하세요.`);
    } finally {
      setLoading(false);
    }
  };

  // URL로 직접 이동하는 폴백 함수
  const fallbackToDirectUrl = (channelId: string) => {
    const channelUrl = `https://pf.kakao.com/_${channelId}`;
    console.log('[Kakao Channel] 채널 페이지로 직접 이동:', channelUrl);
    window.open(channelUrl, '_blank');
    
    // 자동 확인 시작 (카카오톡에서 돌아왔을 때 자동으로 확인)
    setShowManualConfirm(true);
    
    // 주기적으로 채널 추가 여부 확인 (최대 10회, 3초 간격)
    let checkCount = 0;
    const maxChecks = 10;
    const checkInterval = setInterval(async () => {
      checkCount++;
      const wasAdded = await checkChannelStatus();
      
      if (wasAdded || checkCount >= maxChecks) {
        clearInterval(checkInterval);
        if (wasAdded) {
          setIsAdded(true); // 명시적으로 상태 업데이트 (배너 숨김)
          setShowManualConfirm(false);
          alert('카카오톡 채널이 자동으로 확인되었습니다!');
        } else if (checkCount >= maxChecks) {
          console.log('[Kakao Channel] 자동 확인 시간 초과');
        }
      }
    }, 3000);
    
    alert('카카오톡 채널 페이지로 이동합니다. 채널을 추가하면 자동으로 확인됩니다.');
  };

  // 수동으로 채널 추가 완료 처리
  const handleManualConfirm = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/kakao/add-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await response.json();
      if (data.ok) {
        setIsAdded(true);
        setShowManualConfirm(false);
        alert('카카오톡 채널 추가가 완료되었습니다!');
      } else {
        alert('채널 추가 처리 중 오류가 발생했습니다: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to confirm channel:', error);
      alert('채널 추가 확인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return null; // 로딩 중에는 아무것도 표시하지 않음
  }

  if (isAdded && variant === 'banner') {
    return null; // 이미 추가된 경우 배너는 표시하지 않음
  }

  if (variant === 'banner') {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 ${className}`}>
        {!showManualConfirm ? (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <Image
                src="/images/kakao-logo.png"
                alt="카카오톡"
                width={40}
                height={40}
                className="rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23FEE500"%3E%3Cpath d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 01-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z"/%3E%3C/svg%3E';
                }}
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">
                카카오톡 채널 추가하고 특별한 혜택 받으세요!
              </p>
              <p className="text-xs text-gray-600 mt-1">
                최신 소식과 이벤트를 카카오톡으로 받아보세요
              </p>
            </div>
            <button
              onClick={handleAddChannel}
              disabled={loading}
              className="flex-shrink-0 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? '추가 중...' : '채널 추가하기'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <Image
                  src="/images/kakao-logo.png"
                  alt="카카오톡"
                  width={40}
                  height={40}
                  className="rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23FEE500"%3E%3Cpath d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 01-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z"/%3E%3C/svg%3E';
                  }}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">
                  카카오톡 채널 추가 확인 중...
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  채널을 추가하시면 자동으로 확인됩니다. (최대 30초)
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleManualConfirm}
                disabled={loading}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? '처리 중...' : '✓ 수동 확인'}
              </button>
              <button
                onClick={() => setShowManualConfirm(false)}
                disabled={loading}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 버튼 형태
  if (isAdded) {
    return null; // 이미 추가된 경우 버튼도 표시하지 않음
  }

  return (
    <button
      onClick={handleAddChannel}
      disabled={loading || isAdded}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
        isAdded
          ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
          : 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
      } ${className}`}
    >
      <Image
        src="/images/kakao-logo.png"
        alt="카카오톡"
        width={20}
        height={20}
        className="rounded-full"
        onError={(e) => {
          (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23FEE500"%3E%3Cpath d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 01-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z"/%3E%3C/svg%3E';
        }}
      />
      <span className="font-semibold">
        {loading ? '추가 중...' : isAdded ? '채널 추가됨' : '채널 추가하기'}
      </span>
    </button>
  );
}

// TypeScript 전역 타입 선언
declare global {
  interface Window {
    Kakao: any;
  }
}

