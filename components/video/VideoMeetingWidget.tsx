'use client';

import { useState, useRef, useEffect } from 'react';
import { FiVideo, FiVideoOff, FiMic, FiMicOff, FiX, FiLink, FiCopy, FiLock, FiCalendar, FiArrowUp, FiUsers } from 'react-icons/fi';
import VideoConference from './VideoConference';
import { showError, showSuccess } from '@/components/ui/Toast';


interface VideoMeetingWidgetProps {
  userName: string;
  userRole?: 'admin' | 'partner' | 'user';
}

export default function VideoMeetingWidget({ userName, userRole = 'user' }: VideoMeetingWidgetProps) {
  const [loading, setLoading] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<{ 
    roomId: string; 
    userName: string;
    isHost?: boolean;
    googleDriveToken?: string;
    maxParticipants?: number;
  } | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [newMeetingDescription, setNewMeetingDescription] = useState('');
  const [newMeetingPassword, setNewMeetingPassword] = useState('');
  const [newMeetingMaxParticipants, setNewMeetingMaxParticipants] = useState(10);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [createdMeetingLink, setCreatedMeetingLink] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [googleCalendarEnabled, setGoogleCalendarEnabled] = useState(false);
  const [googleDriveConnected, setGoogleDriveConnected] = useState(false);
  const [googleDriveToken, setGoogleDriveToken] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewVideoEnabled, setPreviewVideoEnabled] = useState(true);
  const [previewAudioEnabled, setPreviewAudioEnabled] = useState(true);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [previewRoomId, setPreviewRoomId] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  
  // Google 관련 상태
  const [googleUserInfo, setGoogleUserInfo] = useState<{ email: string; name: string; picture?: string } | null>(null);
  const [googleDriveFolders, setGoogleDriveFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);


  // 미팅 방 생성
  const createMeeting = async () => {
    if (!newMeetingTitle.trim()) {
      showError('미팅 제목을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/video/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: newMeetingTitle,
          description: newMeetingDescription,
          password: newMeetingPassword || null,
          maxParticipants: newMeetingMaxParticipants,
          scheduledStart: isScheduled && scheduledStart ? scheduledStart : null,
          scheduledEnd: isScheduled && scheduledEnd ? scheduledEnd : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[VideoMeetingWidget] Create meeting failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        
        // 세션 만료 또는 인증 오류인 경우
        if (response.status === 401 || response.status === 403) {
          const errorMsg = errorData?.error || '세션이 만료되었습니다. 다시 로그인해주세요.';
          showError(errorMsg);
          // 관리자 페이지인 경우 로그인 페이지로 리다이렉트
          if (window.location.pathname.startsWith('/admin')) {
            setTimeout(() => {
              window.location.href = '/admin/login';
            }, 2000);
          }
          return;
        }
        
        const errorMsg = errorData?.error || '미팅 방 생성에 실패했습니다.';
        const details = errorData?.details ? `\n상세: ${errorData.details}` : '';
        showError(errorMsg + details);
        return;
      }

      const data = await response.json();
      if (data.ok) {
        showSuccess('미팅 방이 생성되었습니다.');
        
        // maxParticipants 정보 저장
        const maxParticipants = data.room.maxParticipants || newMeetingMaxParticipants;
        
        // 구글 캘린더에 추가 (예약된 미팅이고 연동이 활성화된 경우)
        if (isScheduled && scheduledStart && googleCalendarEnabled && googleDriveToken) {
          try {
            const calendarResponse = await fetch('/api/google/calendar/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                meetingId: data.room.roomId,
                title: newMeetingTitle,
                description: newMeetingDescription,
                startTime: scheduledStart,
                endTime: scheduledEnd || new Date(new Date(scheduledStart).getTime() + 60 * 60 * 1000).toISOString(),
                meetingLink: data.room.shareableLink,
                accessToken: googleDriveToken,
              }),
            });
            
            const calendarData = await calendarResponse.json();
            if (calendarData.ok) {
              showSuccess('구글 캘린더에 추가되었습니다.');
            }
          } catch (error) {
            console.error('[VideoMeetingWidget] Calendar error:', error);
            // 캘린더 추가 실패해도 미팅 생성은 성공
          }
        }
        
        // 미팅 링크 표시
        if (data.room.shareableLink) {
          setCreatedMeetingLink(data.room.shareableLink);
          setShowLinkModal(true);
        }
        
        // 미팅 시작 (자동으로 참가)
        setActiveMeeting({
          roomId: data.room.roomId,
          userName,
          isHost: true,
          googleDriveToken: googleDriveToken || undefined,
          maxParticipants: maxParticipants,
        });
        
        setShowCreateModal(false);
        setNewMeetingTitle('');
        setNewMeetingDescription('');
        setNewMeetingPassword('');
        setNewMeetingMaxParticipants(10);
        setIsScheduled(false);
        setScheduledStart('');
        setScheduledEnd('');
        setGoogleCalendarEnabled(false);
        
      } else {
        const errorMsg = data.error || '미팅 방 생성에 실패했습니다.';
        const details = data.details ? `\n상세: ${data.details}` : '';
        console.error('[VideoMeetingWidget] Create failed:', {
          error: data.error,
          details: data.details,
          fullResponse: data,
        });
        showError(errorMsg + details);
      }
    } catch (error) {
      console.error('[VideoMeetingWidget] Create meeting error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showError(`미팅 방 생성 중 오류가 발생했습니다: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };


  // 미리보기 초기화
  const initPreview = async () => {
    let stream: MediaStream | null = null;
    
    // 여러 단계로 시도 (가장 간단한 것부터)
    const attempts = [
      // 1단계: 가장 기본적인 제약 조건 (브라우저가 자동으로 디바이스 선택)
      { video: true, audio: true },
      // 2단계: 비디오만 기본, 오디오는 고급 설정
      { video: true, audio: { echoCancellation: true } },
      // 3단계: 모바일 전면 카메라 우선
      { video: { facingMode: 'user' }, audio: true },
      // 4단계: 해상도 지정 없이 기본
      { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: true },
    ];

    for (let i = 0; i < attempts.length; i++) {
      try {
        console.log(`[VideoMeetingWidget] Attempting to get media with constraints ${i + 1}:`, attempts[i]);
        stream = await navigator.mediaDevices.getUserMedia(attempts[i]);
        console.log(`[VideoMeetingWidget] Successfully got media stream on attempt ${i + 1}`);
        break; // 성공하면 루프 종료
      } catch (error: any) {
        console.warn(`[VideoMeetingWidget] Attempt ${i + 1} failed:`, error.name, error.message);
        
        // 마지막 시도가 아니면 계속
        if (i < attempts.length - 1) {
          continue;
        }
        
        // 모든 시도 실패
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          showError('카메라와 마이크 접근 권한이 필요합니다. 브라우저 주소창의 자물쇠 아이콘을 클릭하여 권한을 허용해주세요.');
          return;
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          showError('카메라 또는 마이크를 사용할 수 없습니다. 다른 애플리케이션(예: Zoom, Teams 등)에서 사용 중인지 확인하고 종료해주세요.');
          return;
        } else if (error.name === 'NotFoundError') {
          showError('카메라나 마이크를 찾을 수 없습니다. 디바이스가 연결되어 있는지 확인해주세요.');
          return;
        } else {
          showError(`비디오 스트림을 초기화할 수 없습니다: ${error.message || '알 수 없는 오류'}`);
          return;
        }
      }
    }

    if (!stream) {
      showError('카메라와 마이크를 초기화할 수 없습니다.');
      return;
    }

    try {
      setPreviewStream(stream);
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
      }

      // 선택된 디바이스 정보 저장
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        setSelectedVideoDevice(videoTrack.label || settings.deviceId || '카메라');
        console.log('[VideoMeetingWidget] Video device selected:', videoTrack.label || settings.deviceId);
      }
      if (audioTrack) {
        const settings = audioTrack.getSettings();
        setSelectedAudioDevice(audioTrack.label || settings.deviceId || '마이크');
        console.log('[VideoMeetingWidget] Audio device selected:', audioTrack.label || settings.deviceId);
      }
    } catch (error) {
      console.error('[VideoMeetingWidget] Error setting up preview:', error);
      showError('미리보기 설정 중 오류가 발생했습니다.');
    }
  };

  // 미리보기에서 회의 시작
  const startMeetingFromPreview = async (roomId?: string) => {
    if (!previewStream) {
      showError('비디오 스트림을 초기화할 수 없습니다.');
      return;
    }

    try {
      // roomId가 없으면 새 미팅 생성
      let finalRoomId = roomId;
      let maxParticipants = 50;
      
      if (!finalRoomId) {
        const response = await fetch('/api/video/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: `${userName}님의 회의`,
            description: '',
            maxParticipants: 10,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          showError(errorData?.error || '미팅 방 생성에 실패했습니다.');
          return;
        }

        const data = await response.json();
        if (data.ok && data.room) {
          finalRoomId = data.room.roomId;
          maxParticipants = data.room.maxParticipants || 10; // 생성 시 받은 값 사용
        } else {
          showError('미팅 방 생성에 실패했습니다.');
          return;
        }
      }

      // 비디오/오디오 상태 적용
      if (previewStream.getVideoTracks()[0]) {
        previewStream.getVideoTracks()[0].enabled = previewVideoEnabled;
      }
      if (previewStream.getAudioTracks()[0]) {
        previewStream.getAudioTracks()[0].enabled = previewAudioEnabled;
      }
      
      setActiveMeeting({ 
        roomId: finalRoomId, 
        userName,
        isHost: true, // 새로 만든 미팅은 호스트
        googleDriveToken: googleDriveToken || undefined,
        maxParticipants: maxParticipants,
      });
      setShowPreview(false);
    } catch (error) {
      console.error('[VideoMeetingWidget] Start meeting error:', error);
      showError('회의 시작 중 오류가 발생했습니다.');
    }
  };

  // 새 회의 시작 (미리보기 없이 바로)
  const startNewMeeting = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/video/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: `${userName}님의 회의`,
          description: '',
          maxParticipants: 10,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        showError(errorData?.error || '미팅 방 생성에 실패했습니다.');
        return;
      }

      const data = await response.json();
      if (data.ok && data.room) {
        // 미리보기 화면 표시
        setPreviewRoomId(data.room.roomId);
        setShowPreview(true);
        await initPreview();
      }
    } catch (error) {
      console.error('[VideoMeetingWidget] Create meeting error:', error);
      showError('미팅 방 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 미팅 종료
  const leaveMeeting = () => {
    setActiveMeeting(null);
    setIsMinimized(false);
  };


  // 구글 드라이브 연동 확인 및 사용자 정보 가져오기
  useEffect(() => {
    const checkGoogleDriveConnection = async () => {
      // URL 파라미터에서 Google 인증 성공 여부 확인
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('google_auth') === 'success') {
        const token = urlParams.get('google_token');
        const email = urlParams.get('google_email');
        const name = urlParams.get('google_name');
        const picture = urlParams.get('google_picture');

        if (token) {
          // 로컬 스토리지에 저장 (임시)
          localStorage.setItem('googleDriveToken', token);
          if (email && name) {
            localStorage.setItem('googleUserInfo', JSON.stringify({
              email,
              name,
              picture: picture || undefined,
            }));
          }

          setGoogleDriveConnected(true);
          setGoogleDriveToken(token);
          setGoogleUserInfo({
            email: email || '',
            name: name || '구글 사용자',
            picture: picture || undefined,
          });

          showSuccess('구글 계정 연동이 완료되었습니다!');
          
          // URL 파라미터 제거
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
      
      // 로컬 스토리지에서 토큰 확인 (임시)
      const token = localStorage.getItem('googleDriveToken');
      const userInfoStr = localStorage.getItem('googleUserInfo');
      if (token) {
        setGoogleDriveConnected(true);
        setGoogleDriveToken(token);
        if (userInfoStr) {
          try {
            setGoogleUserInfo(JSON.parse(userInfoStr));
          } catch (e) {
            console.error('[VideoMeetingWidget] Parse user info error:', e);
          }
        }
      }
    };

    checkGoogleDriveConnection();
  }, []);

  // 구글 드라이브 연동 시작
  const connectGoogleDrive = async () => {
    try {
      const response = await fetch('/api/google/auth');
      const data = await response.json();
      if (data.ok && data.authUrl) {
        // 현재 URL을 저장하여 콜백 후 돌아올 수 있도록
        const returnUrl = encodeURIComponent(window.location.href);
        const authUrl = new URL(data.authUrl);
        authUrl.searchParams.set('returnUrl', returnUrl);
        window.location.href = authUrl.toString();
      }
    } catch (error) {
      console.error('[VideoMeetingWidget] Google auth error:', error);
      showError('구글 드라이브 연동에 실패했습니다.');
    }
  };

  // 구글 드라이브 폴더 목록 가져오기
  const loadGoogleDriveFolders = async () => {
    if (!googleDriveToken) {
      showError('구글 드라이브 연동이 필요합니다.');
      return;
    }

    try {
      setLoadingFolders(true);
      const response = await fetch(`/api/google/drive/folders?accessToken=${encodeURIComponent(googleDriveToken)}`);
      const data = await response.json();
      if (data.ok && data.folders) {
        setGoogleDriveFolders(data.folders);
        setShowFolderSelector(true);
      } else {
        showError(data.error || '폴더 목록을 가져오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('[VideoMeetingWidget] Load folders error:', error);
      showError('폴더 목록을 가져오는데 실패했습니다.');
    } finally {
      setLoadingFolders(false);
    }
  };

  // 미리보기 정리 (hooks는 조건부 return 이전에 호출되어야 함)
  useEffect(() => {
    return () => {
      if (previewStream) {
        previewStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [previewStream]);

  // 조건부 return은 모든 hooks 호출 이후에
  if (activeMeeting) {
    return (
      <VideoConference
        roomId={activeMeeting.roomId}
        userName={activeMeeting.userName}
        onLeave={leaveMeeting}
        isMinimized={isMinimized}
        onToggleMinimize={() => setIsMinimized(!isMinimized)}
        isHost={activeMeeting.isHost}
        googleDriveToken={activeMeeting.googleDriveToken}
        maxParticipants={activeMeeting.maxParticipants || 50}
      />
    );
  }

  return (
    <>
      {/* Zoom 스타일 메인 화면 */}
      {!showPreview && (
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* 새 회의 */}
            <button
              onClick={startNewMeeting}
              disabled={loading}
              className="group relative h-48 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex flex-col items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiVideo className="text-5xl mb-3" />
              <span className="text-xl font-bold">새 회의</span>
              <FiArrowUp className="absolute top-3 right-3 opacity-50" />
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              )}
            </button>

            {/* 예약 */}
            <button
              onClick={() => {
                setShowCreateModal(true);
                setIsScheduled(true);
              }}
              className="group relative h-48 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex flex-col items-center justify-center"
            >
              <FiCalendar className="text-5xl mb-3" />
              <span className="text-xl font-bold">예약</span>
            </button>
          </div>
        </div>
      )}

      {/* 미리보기 화면 (Zoom 스타일) */}
      {showPreview && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 pointer-events-auto"
          onClick={() => {
            setShowPreview(false);
            setPreviewRoomId(null);
            if (previewStream) {
              previewStream.getTracks().forEach(track => track.stop());
              setPreviewStream(null);
            }
          }}
        >
          <div 
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between bg-gray-50 px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">{userName}님의 회의</h3>
              <button
                onClick={() => {
                  setShowPreview(false);
                  setPreviewRoomId(null);
                  if (previewStream) {
                    previewStream.getTracks().forEach(track => track.stop());
                    setPreviewStream(null);
                  }
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX size={24} />
              </button>
            </div>

            {/* 비디오 미리보기 */}
            <div className="relative bg-black aspect-video">
              <video
                ref={previewVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {!previewVideoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <FiVideoOff className="text-white text-6xl" />
                </div>
              )}
            </div>

            {/* 컨트롤 */}
            <div className="p-6 space-y-4">
              {/* 오디오 */}
              <div>
                <button
                  onClick={() => {
                    setPreviewAudioEnabled(!previewAudioEnabled);
                    if (previewStream) {
                      previewStream.getAudioTracks()[0].enabled = !previewAudioEnabled;
                    }
                  }}
                  className="flex items-center gap-3 w-full p-3 rounded-lg border-2 border-gray-200 hover:border-blue-500 transition-colors"
                >
                  {previewAudioEnabled ? <FiMic className="text-blue-600" size={20} /> : <FiMicOff className="text-red-600" size={20} />}
                  <span className="font-medium">오디오</span>
                  <FiArrowUp className="ml-auto text-gray-400" size={16} />
                </button>
              </div>

              {/* 비디오 */}
              <div>
                <button
                  onClick={() => {
                    setPreviewVideoEnabled(!previewVideoEnabled);
                    if (previewStream) {
                      previewStream.getVideoTracks()[0].enabled = !previewVideoEnabled;
                    }
                  }}
                  className="flex items-center gap-3 w-full p-3 rounded-lg border-2 border-gray-200 hover:border-blue-500 transition-colors"
                >
                  {previewVideoEnabled ? <FiVideo className="text-blue-600" size={20} /> : <FiVideoOff className="text-red-600" size={20} />}
                  <span className="font-medium">비디오</span>
                  <FiArrowUp className="ml-auto text-gray-400" size={16} />
                </button>
              </div>

              {/* 시작 버튼 */}
              <button
                onClick={() => startMeetingFromPreview(previewRoomId || undefined)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                시작
              </button>
            </div>
          </div>
        </div>
      )}


      {/* 미팅 생성 모달 */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 pointer-events-auto" 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
            }
          }}
        >
          <div 
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200 p-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">새 미팅 생성</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewMeetingTitle('');
                  setNewMeetingDescription('');
                  setNewMeetingPassword('');
                  setNewMeetingMaxParticipants(10);
                  setIsScheduled(false);
                  setScheduledStart('');
                  setScheduledEnd('');
                }}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <FiX size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  미팅 제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newMeetingTitle}
                  onChange={(e) => setNewMeetingTitle(e.target.value)}
                  placeholder="예: 팀 미팅, 고객 상담 등"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  설명 (선택)
                </label>
                <textarea
                  value={newMeetingDescription}
                  onChange={(e) => setNewMeetingDescription(e.target.value)}
                  placeholder="미팅에 대한 간단한 설명을 입력하세요"
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* 비밀번호 설정 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <FiLock className="inline mr-1" />
                  비밀번호 (선택)
                </label>
                <input
                  type="text"
                  value={newMeetingPassword}
                  onChange={(e) => setNewMeetingPassword(e.target.value)}
                  placeholder="비밀번호를 입력하면 보안이 강화됩니다"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <p className="text-xs text-gray-500 mt-1">비밀번호를 설정하면 참가 시 입력이 필요합니다</p>
              </div>

              {/* 최대 참가자 수 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <FiUsers className="inline mr-1" />
                  최대 참가자 수
                </label>
                <select
                  value={newMeetingMaxParticipants}
                  onChange={(e) => setNewMeetingMaxParticipants(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value={10}>10명 (최적 성능) ⭐</option>
                  <option value={15}>15명</option>
                  <option value={20}>20명 (권장 최대)</option>
                  <option value={30}>30명</option>
                  <option value={50}>50명 (최대)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">권장: 10-20명 (브라우저 성능 최적화)</p>
              </div>

              {/* 예약 기능 */}
              <div className="border-t border-gray-200 pt-4">
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={isScheduled}
                    onChange={(e) => setIsScheduled(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <FiCalendar className="text-gray-600" />
                  <span className="text-sm font-semibold text-gray-700">미팅 예약하기</span>
                </label>
                
                {isScheduled && (
                  <div className="space-y-3 pl-6 border-l-2 border-blue-200">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        시작 시간
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduledStart}
                        onChange={(e) => setScheduledStart(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        종료 시간 (선택)
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduledEnd}
                        onChange={(e) => setScheduledEnd(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={googleCalendarEnabled}
                        onChange={(e) => setGoogleCalendarEnabled(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                        disabled={!googleDriveConnected}
                      />
                      <label className="text-xs text-gray-600">
                        구글 캘린더에 자동 추가
                        {!googleDriveConnected && (
                          <span className="text-red-500 ml-1">(구글 드라이브 연동 필요)</span>
                        )}
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 border-t border-gray-200 p-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewMeetingTitle('');
                  setNewMeetingDescription('');
                  setNewMeetingPassword('');
                  setNewMeetingMaxParticipants(50);
                  setIsScheduled(false);
                  setScheduledStart('');
                  setScheduledEnd('');
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={createMeeting}
                disabled={loading || !newMeetingTitle.trim()}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '생성 중...' : '미팅 생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 미팅 링크 공유 모달 */}
      {showLinkModal && createdMeetingLink && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 pointer-events-auto" 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLinkModal(false);
              setCreatedMeetingLink(null);
            }
          }}
        >
          <div 
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FiLink className="text-blue-600" />
                미팅 링크 생성 완료
              </h3>
              <p className="text-sm text-gray-600 mt-2">아래 링크를 공유하여 참가자를 초대하세요</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  미팅 링크
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={createdMeetingLink}
                    readOnly
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 bg-gray-50 text-sm"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdMeetingLink);
                      showSuccess('링크가 복사되었습니다!');
                    }}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 flex items-center gap-2"
                  >
                    <FiCopy size={16} />
                    복사
                  </button>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-800">
                  <strong>💡 안내:</strong> 이 링크를 카카오톡, 이메일, 문자 등으로 공유하시면 누구나 미팅에 참가할 수 있습니다.
                  {newMeetingPassword && (
                    <span className="block mt-1">
                      <strong>비밀번호:</strong> {newMeetingPassword}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-3 border-t border-gray-200 p-6">
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  setCreatedMeetingLink(null);
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdMeetingLink);
                  showSuccess('링크가 복사되었습니다!');
                }}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <FiCopy size={16} />
                링크 복사
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 구글 드라이브 폴더 선택 모달 */}
      {showFolderSelector && (
        <div 
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 pointer-events-auto" 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowFolderSelector(false);
            }
          }}
        >
          <div 
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200 p-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">녹화 저장 폴더 선택</h3>
              <button
                onClick={() => setShowFolderSelector(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <FiX size={24} />
              </button>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto">
              {loadingFolders ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : googleDriveFolders.length === 0 ? (
                <p className="text-center text-gray-500 py-8">폴더가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {googleDriveFolders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => {
                        setSelectedFolderId(folder.id);
                        setShowFolderSelector(false);
                        showSuccess(`"${folder.name}" 폴더가 선택되었습니다.`);
                      }}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                        selectedFolderId === folder.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">{folder.name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3 border-t border-gray-200 p-6">
              <button
                onClick={() => setShowFolderSelector(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

