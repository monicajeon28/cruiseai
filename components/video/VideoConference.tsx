'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FiVideo, FiVideoOff, FiMic, FiMicOff, FiMonitor, FiUsers, FiMessageSquare, FiX, FiMaximize2, FiMinimize2, FiGrid, FiUser, FiImage, FiShield, FiCopy, FiSettings, FiLock } from 'react-icons/fi';
import { v4 as uuidv4 } from 'uuid';
import { showError, showSuccess } from '@/components/ui/Toast';
import { VirtualBackgroundProcessor } from './VirtualBackground';

interface Participant {
  id: string;
  stream: MediaStream;
  name: string;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isScreenSharing: boolean;
  screenStream?: MediaStream; // 화면 공유 스트림
}

interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: Date;
}

interface VideoConferenceProps {
  roomId: string;
  userName: string;
  onLeave: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  isHost?: boolean; // 호스트 여부
  googleDriveToken?: string; // 구글 드라이브 토큰
  maxParticipants?: number; // 최대 참가자 수
}

export default function VideoConference({
  roomId,
  userName,
  onLeave,
  isMinimized = false,
  onToggleMinimize,
  isHost = false,
  googleDriveToken,
  maxParticipants = 50,
}: VideoConferenceProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteScreenSharing, setRemoteScreenSharing] = useState<{ userId: string; stream: MediaStream } | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [peers, setPeers] = useState<Map<string, RTCPeerConnection>>(new Map());
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // localStream과 peers 변경 시 ref 업데이트
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);
  const [localVideoRef, setLocalVideoRef] = useState<HTMLVideoElement | null>(null);
  const [localSmallVideoRef, setLocalSmallVideoRef] = useState<HTMLVideoElement | null>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const screenVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localId = useRef(uuidv4());

  // 뷰 모드 (그리드/스피커)
  const [viewMode, setViewMode] = useState<'grid' | 'speaker'>('grid');
  const [speakingParticipant, setSpeakingParticipant] = useState<string | null>(null);

  // 오디오 레벨 모니터링
  const audioLevelRefs = useRef<Map<string, number>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRefs = useRef<Map<string, AnalyserNode>>(new Map());

  // 참가자 목록 표시
  const [showParticipantsList, setShowParticipantsList] = useState(false);

  // 가상 배경
  const [virtualBackground, setVirtualBackground] = useState<{
    type: 'none' | 'blur' | 'image';
    blurIntensity?: number;
    backgroundImage?: string;
  }>({ type: 'none' });
  const virtualBackgroundCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const virtualBackgroundProcessorRef = useRef<any>(null);

  // 오디오/비디오 디바이스 관리
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const [showScreenShareMenu, setShowScreenShareMenu] = useState(false);
  const [showHostToolsMenu, setShowHostToolsMenu] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);

  // 오디오 설정
  const [audioSettings, setAudioSettings] = useState({
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  });
  const audioSettingsRef = useRef(audioSettings);

  // audioSettings 변경 시 ref 업데이트
  useEffect(() => {
    audioSettingsRef.current = audioSettings;
  }, [audioSettings]);

  // 네트워크 품질 모니터링
  const [networkQuality, setNetworkQuality] = useState<{
    bandwidth?: number;
    latency?: number;
    packetLoss?: number;
    quality: 'excellent' | 'good' | 'fair' | 'poor';
  }>({ quality: 'excellent' });
  const networkStatsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 녹화 관련
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // 대기실 관련
  const [isInWaitingRoom, setIsInWaitingRoom] = useState(false);
  const [waitingParticipants, setWaitingParticipants] = useState<string[]>([]);

  // 모바일 감지 및 터치 제스처 (Hook은 항상 최상단에!)
  const [isMobile, setIsMobile] = useState(false);

  // Socket.io 연결 (WebSocket 대신)
  useEffect(() => {
    // 동적 import로 Socket.io 클라이언트 로드
    import('socket.io-client').then(({ io }) => {
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
      const socketPath = '/api/video/ws';

      console.log('[VideoConference] Connecting to Socket.io:', socketUrl, socketPath);

      const socket = io(socketUrl, {
        path: socketPath,
        query: {
          roomId: roomId,
          userId: localId.current,
          userName: userName,
          isHost: isHost ? 'true' : 'false',
          maxParticipants: maxParticipants?.toString() || '50',
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10, // 재연결 시도 횟수 증가
        timeout: 20000,
        forceNew: false, // 기존 연결 재사용
        autoConnect: true, // 자동 연결
      });

      socket.on('connect', () => {
        console.log('[VideoConference] Socket.io connected');
      });

      socket.on('user-joined', async (data: any) => {
        await handleUserJoined(data.userId, data.userName);
      });

      socket.on('user-left', (data: any) => {
        handleUserLeft(data.userId);
      });

      socket.on('screen-share-started', (data: any) => {
        // 원격 사용자가 화면 공유 시작
        setRemoteScreenSharing({ userId: data.userId, stream: data.stream });
      });

      socket.on('screen-share-stopped', (data: any) => {
        // 원격 사용자가 화면 공유 중지
        if (remoteScreenSharing?.userId === data.userId) {
          setRemoteScreenSharing(null);
        }
      });

      socket.on('offer', async (data: any) => {
        await handleOffer(data.from, data.offer);
      });

      socket.on('answer', async (data: any) => {
        await handleAnswer(data.from, data.answer);
      });

      socket.on('ice-candidate', async (data: any) => {
        await handleIceCandidate(data.from, data.candidate);
      });

      socket.on('chat-message', (data: any) => {
        setMessages((prev) => [
          ...prev,
          {
            id: uuidv4(),
            sender: data.userName,
            text: data.message,
            timestamp: new Date(),
          },
        ]);
      });

      socket.on('approved', (data: any) => {
        setIsInWaitingRoom(false);
      });

      socket.on('disconnect', (reason) => {
        console.log('[VideoConference] Socket.io disconnected:', reason);
        if (reason === 'io server disconnect') {
          // 서버가 연결을 끊은 경우 (예: 인증 실패)
          showError('서버 연결이 끊어졌습니다. 페이지를 새로고침해주세요.');
        } else {
          // 클라이언트가 연결을 끊은 경우 또는 네트워크 오류
          showError('연결이 끊어졌습니다. 자동으로 재연결을 시도합니다...');
          // 자동 재연결 (Socket.io가 자동으로 시도하지만, 수동으로도 시도)
          setTimeout(() => {
            socket.connect();
          }, 2000);
        }
      });

      socket.on('reconnect', (attemptNumber) => {
        console.log('[VideoConference] Socket.io reconnected after', attemptNumber, 'attempts');
        showError('연결이 복구되었습니다.');
      });

      socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('[VideoConference] Reconnection attempt', attemptNumber);
      });

      socket.on('reconnect_error', (error) => {
        console.error('[VideoConference] Reconnection error:', error);
      });

      socket.on('reconnect_failed', () => {
        console.error('[VideoConference] Reconnection failed');
        showError('재연결에 실패했습니다. 페이지를 새로고침해주세요.');
      });

      socket.on('connect_error', (error) => {
        console.error('[VideoConference] Socket.io connection error:', error);
        // 타임아웃 에러인 경우 더 자세한 메시지 제공
        if (error.message && error.message.includes('timeout')) {
          showError('화상회의 서버 연결 시간이 초과되었습니다. 서버가 실행 중인지 확인해주세요.');
        } else {
          showError(`화상회의 서버에 연결할 수 없습니다: ${error.message || '알 수 없는 오류'}. 서버가 실행 중인지 확인해주세요.`);
        }
      });

      socket.on('room-full', (data: any) => {
        showError(data.message || '미팅 방이 가득 찼습니다.');
        setTimeout(() => {
          onLeave();
        }, 2000);
      });

      // WebSocket 대신 Socket.io 인스턴스 저장
      setWs(socket as any);

      return () => {
        socket.disconnect();
        // 모든 피어 연결 종료
        peers.forEach((peer) => peer.close());
        // 로컬 스트림 종료
        if (localStream) {
          localStream.getTracks().forEach((track) => track.stop());
        }
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach((track) => track.stop());
        }
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // 오디오/비디오 디바이스 목록 가져오기 (초기 로드 시 한 번만)
  useEffect(() => {
    let isMounted = true;

    const enumerateDevices = async () => {
      try {
        // 먼저 권한 요청 (디바이스 라벨을 얻기 위해)
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        const videoInputs = devices.filter(d => d.kind === 'videoinput');

        if (!isMounted) return;

        console.log('[VideoConference] Found audio devices:', audioInputs.length);
        console.log('[VideoConference] Found video devices:', videoInputs.length);

        setAudioDevices(audioInputs);
        setVideoDevices(videoInputs);

        // 기본 디바이스 선택 (아직 선택되지 않은 경우만)
        if (audioInputs.length > 0 && !selectedAudioDevice) {
          setSelectedAudioDevice(audioInputs[0].deviceId);
        }
        if (videoInputs.length > 0 && !selectedVideoDevice) {
          setSelectedVideoDevice(videoInputs[0].deviceId);
        }
      } catch (error) {
        console.error('[VideoConference] Failed to enumerate devices:', error);
      }
    };

    // 초기 로드 시 한 번만 실행
    enumerateDevices();

    // 디바이스 변경 이벤트 리스너 (새 디바이스 연결/해제 시)
    const handleDeviceChange = () => {
      if (isMounted) {
        enumerateDevices();
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      isMounted = false;
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 빈 의존성 배열 - 초기 로드 시 한 번만 실행

  // 디바이스 변경 시 스트림 재생성 및 WebRTC 피어 연결 업데이트
  useEffect(() => {
    if (!localStreamRef.current) return; // 초기 스트림이 없으면 실행하지 않음
    if (!selectedAudioDevice && !selectedVideoDevice) return; // 디바이스가 선택되지 않았으면 실행하지 않음

    let isUpdating = false;
    const updateStream = async () => {
      if (isUpdating) return; // 이미 업데이트 중이면 무시
      isUpdating = true;
      try {
        const constraints: MediaStreamConstraints = {
          audio: selectedAudioDevice ? {
            deviceId: { exact: selectedAudioDevice },
            echoCancellation: audioSettingsRef.current.echoCancellation,
            noiseSuppression: audioSettingsRef.current.noiseSuppression,
            autoGainControl: audioSettingsRef.current.autoGainControl,
          } : {
            echoCancellation: audioSettingsRef.current.echoCancellation,
            noiseSuppression: audioSettingsRef.current.noiseSuppression,
            autoGainControl: audioSettingsRef.current.autoGainControl,
          },
          video: selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : true,
        };

        const newStream = await navigator.mediaDevices.getUserMedia(constraints);

        // WebRTC 피어 연결에 새 트랙 적용
        const audioTrack = newStream.getAudioTracks()[0];
        const videoTrack = newStream.getVideoTracks()[0];

        if (audioTrack || videoTrack) {
          // 모든 피어 연결에 새 트랙 적용
          for (const [peerId, peerConnection] of peersRef.current.entries()) {
            try {
              if (audioTrack) {
                const audioSender = peerConnection.getSenders().find(sender =>
                  sender.track && sender.track.kind === 'audio'
                );
                if (audioSender) {
                  await audioSender.replaceTrack(audioTrack);
                  console.log(`[VideoConference] Replaced audio track for peer ${peerId}`);
                } else {
                  peerConnection.addTrack(audioTrack, newStream);
                }
              }

              if (videoTrack) {
                const videoSender = peerConnection.getSenders().find(sender =>
                  sender.track && sender.track.kind === 'video'
                );
                if (videoSender) {
                  await videoSender.replaceTrack(videoTrack);
                  console.log(`[VideoConference] Replaced video track for peer ${peerId}`);
                } else {
                  peerConnection.addTrack(videoTrack, newStream);
                }
              }
            } catch (error) {
              console.error(`[VideoConference] Failed to update tracks for peer ${peerId}:`, error);
            }
          }
        }

        // 기존 스트림의 트랙 중지 (새 스트림이 성공적으로 생성된 후)
        const oldStream = localStreamRef.current;
        const oldAudioTrack = oldStream?.getAudioTracks()[0];
        const oldVideoTrack = oldStream?.getVideoTracks()[0];

        if (oldAudioTrack) oldAudioTrack.stop();
        if (oldVideoTrack) oldVideoTrack.stop();

        // 새 스트림 설정
        setLocalStream(newStream);

        // 비디오 요소 업데이트
        if (localVideoRef) {
          localVideoRef.srcObject = newStream;
        }
        if (localSmallVideoRef) {
          localSmallVideoRef.srcObject = newStream;
        }

        console.log('[VideoConference] Device switched successfully');
        showSuccess('디바이스가 변경되었습니다.');
        isUpdating = false;
      } catch (error: any) {
        console.error('[VideoConference] Failed to switch device:', error);
        showError(`디바이스 전환에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
        isUpdating = false;
      }
    };

    // 약간의 지연을 두어 무한 루프 방지
    const timeoutId = setTimeout(() => {
      updateStream();
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      isUpdating = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAudioDevice, selectedVideoDevice]); // localStream, peers, audioSettings 제거하여 무한 루프 방지

  // 로컬 미디어 스트림 초기화
  useEffect(() => {
    const initLocalStream = async () => {
      let stream: MediaStream | null = null;

      // 여러 단계로 시도 (가장 간단한 것부터)
      const attempts = [
        // 1단계: 가장 기본적인 제약 조건 (브라우저가 자동으로 디바이스 선택)
        {
          video: true,
          audio: {
            echoCancellation: audioSettings.echoCancellation,
            noiseSuppression: audioSettings.noiseSuppression,
            autoGainControl: audioSettings.autoGainControl,
          }
        },
        // 2단계: 비디오만 기본, 오디오는 고급 설정
        {
          video: true,
          audio: {
            echoCancellation: audioSettings.echoCancellation,
            noiseSuppression: audioSettings.noiseSuppression,
            autoGainControl: audioSettings.autoGainControl,
          }
        },
        // 3단계: 모바일 전면 카메라 우선
        {
          video: { facingMode: 'user' },
          audio: {
            echoCancellation: audioSettings.echoCancellation,
            noiseSuppression: audioSettings.noiseSuppression,
            autoGainControl: audioSettings.autoGainControl,
          }
        },
        // 4단계: 해상도 지정 없이 기본
        {
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: {
            echoCancellation: audioSettings.echoCancellation,
            noiseSuppression: audioSettings.noiseSuppression,
            autoGainControl: audioSettings.autoGainControl,
          }
        },
      ];

      for (let i = 0; i < attempts.length; i++) {
        try {
          console.log(`[VideoConference] Attempting to get media with constraints ${i + 1}:`, attempts[i]);
          stream = await navigator.mediaDevices.getUserMedia(attempts[i]);
          console.log(`[VideoConference] Successfully got media stream on attempt ${i + 1}`);
          break; // 성공하면 루프 종료
        } catch (error: any) {
          console.warn(`[VideoConference] Attempt ${i + 1} failed:`, error.name, error.message);

          // 마지막 시도가 아니면 계속
          if (i < attempts.length - 1) {
            continue;
          }

          // 모든 시도 실패
          if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            alert('카메라와 마이크 접근 권한이 필요합니다. 브라우저 주소창의 자물쇠 아이콘을 클릭하여 권한을 허용해주세요.');
            return;
          } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            alert('카메라 또는 마이크를 사용할 수 없습니다. 다른 애플리케이션(예: Zoom, Teams 등)에서 사용 중인지 확인하고 종료해주세요.');
            return;
          } else if (error.name === 'NotFoundError') {
            alert('카메라나 마이크를 찾을 수 없습니다. 디바이스가 연결되어 있는지 확인해주세요.');
            return;
          } else {
            alert(`비디오 스트림을 초기화할 수 없습니다: ${error.message || '알 수 없는 오류'}`);
            return;
          }
        }
      }

      if (!stream) {
        console.error('[VideoConference] Failed to get media stream after all attempts');
        return;
      }

      try {
        setLocalStream(stream);
        if (localVideoRef) {
          localVideoRef.srcObject = stream;
        }
        if (localSmallVideoRef) {
          localSmallVideoRef.srcObject = stream;
        }
        console.log('[VideoConference] Local stream initialized successfully');
      } catch (error) {
        console.error('[VideoConference] Error setting up local stream:', error);
        alert('비디오 스트림 설정 중 오류가 발생했습니다.');
      }
    };

    if (!localStream) {
      initLocalStream();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 오디오 레벨 모니터링 초기화
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    // 로컬 스트림 오디오 레벨 모니터링
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        const source = audioContextRef.current.createMediaStreamSource(localStream);
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRefs.current.set('local', analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkAudioLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          audioLevelRefs.current.set('local', average);
          requestAnimationFrame(checkAudioLevel);
        };
        checkAudioLevel();
      }
    }

    // 원격 스트림 오디오 레벨 모니터링
    participants.forEach((participant) => {
      if (!analyserRefs.current.has(participant.id)) {
        const source = audioContextRef.current!.createMediaStreamSource(participant.stream);
        const analyser = audioContextRef.current!.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRefs.current.set(participant.id, analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkAudioLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          audioLevelRefs.current.set(participant.id, average);

          // 말하는 사람 감지 (임계값: 30)
          if (average > 30 && !speakingParticipant) {
            setSpeakingParticipant(participant.id);
            if (viewMode === 'speaker') {
              setViewMode('speaker');
            }
          }

          requestAnimationFrame(checkAudioLevel);
        };
        checkAudioLevel();
      }
    });

    // 말하는 사람이 없으면 스피커 뷰 초기화
    const checkSpeaking = setInterval(() => {
      const allLevels = Array.from(audioLevelRefs.current.values());
      const maxLevel = Math.max(...allLevels, 0);
      if (maxLevel < 20 && speakingParticipant) {
        setSpeakingParticipant(null);
      }
    }, 500);

    return () => {
      clearInterval(checkSpeaking);
    };
  }, [localStream, participants, speakingParticipant, viewMode]);

  // 네트워크 품질 모니터링
  useEffect(() => {
    const checkNetworkQuality = async () => {
      if (peers.size === 0) return;

      try {
        let totalBandwidth = 0;
        let totalLatency = 0;
        let totalPacketLoss = 0;
        let validStats = 0;

        for (const [userId, peerConnection] of peers.entries()) {
          try {
            const stats = await peerConnection.getStats();
            let bandwidth = 0;
            let latency = 0;
            let packetLoss = 0;

            stats.forEach((report: any) => {
              // 대역폭 계산
              if (report.type === 'candidate-pair' && report.availableOutgoingBitrate) {
                bandwidth += report.availableOutgoingBitrate;
              }

              // 지연시간 계산
              if (report.type === 'candidate-pair' && report.currentRoundTripTime) {
                latency += report.currentRoundTripTime * 1000; // ms로 변환
              }

              // 패킷 손실 계산
              if (report.type === 'inbound-rtp' && report.packetsLost !== undefined && report.packetsReceived !== undefined) {
                const totalPackets = report.packetsLost + report.packetsReceived;
                if (totalPackets > 0) {
                  packetLoss += (report.packetsLost / totalPackets) * 100;
                }
              }
            });

            if (bandwidth > 0 || latency > 0) {
              totalBandwidth += bandwidth;
              totalLatency += latency;
              totalPacketLoss += packetLoss;
              validStats++;
            }
          } catch (error) {
            console.warn(`[VideoConference] Failed to get stats for ${userId}:`, error);
          }
        }

        if (validStats > 0) {
          const avgBandwidth = totalBandwidth / validStats;
          const avgLatency = totalLatency / validStats;
          const avgPacketLoss = totalPacketLoss / validStats;

          // 품질 평가
          let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
          if (avgLatency > 300 || avgPacketLoss > 5 || avgBandwidth < 100000) {
            quality = 'poor';
          } else if (avgLatency > 200 || avgPacketLoss > 3 || avgBandwidth < 500000) {
            quality = 'fair';
          } else if (avgLatency > 100 || avgPacketLoss > 1 || avgBandwidth < 1000000) {
            quality = 'good';
          }

          setNetworkQuality({
            bandwidth: avgBandwidth,
            latency: avgLatency,
            packetLoss: avgPacketLoss,
            quality,
          });

          // 화질 자동 조절 (네트워크 품질이 나쁠 때)
          if (quality === 'poor' && localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
              const constraints = videoTrack.getConstraints();
              videoTrack.applyConstraints({
                width: { ideal: 320 },
                height: { ideal: 240 },
                frameRate: { ideal: 15 },
              });
            }
          } else if (quality === 'excellent' && localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
              videoTrack.applyConstraints({
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
              });
            }
          }
        }
      } catch (error) {
        console.error('[VideoConference] Network quality check error:', error);
      }
    };

    // 5초마다 네트워크 품질 체크
    networkStatsIntervalRef.current = setInterval(checkNetworkQuality, 5000);
    checkNetworkQuality(); // 즉시 한 번 실행

    return () => {
      if (networkStatsIntervalRef.current) {
        clearInterval(networkStatsIntervalRef.current);
      }
    };
  }, [peers, localStream]);

  // 가상 배경 처리
  useEffect(() => {
    if (virtualBackground.type === 'none' || !localStream || isScreenSharing) {
      if (virtualBackgroundProcessorRef.current) {
        try {
          virtualBackgroundProcessorRef.current.stop();
          virtualBackgroundProcessorRef.current.dispose();
        } catch (error) {
          console.error('[VideoConference] Error stopping virtual background:', error);
        }
        virtualBackgroundProcessorRef.current = null;
      }
      return;
    }

    try {
      if (!virtualBackgroundCanvasRef.current) {
        const canvas = document.createElement('canvas');
        canvas.style.display = 'none';
        document.body.appendChild(canvas);
        virtualBackgroundCanvasRef.current = canvas;
      }

      const processor = new VirtualBackgroundProcessor(virtualBackgroundCanvasRef.current);
      virtualBackgroundProcessorRef.current = processor;

      const setupProcessor = async () => {
        try {
          if (!localVideoRef) {
            console.warn('[VideoConference] Local video ref not available for virtual background');
            return;
          }

          // 비디오 엘리먼트가 준비될 때까지 대기
          let attempts = 0;
          const maxAttempts = 50; // 5초 (100ms * 50)

          const checkVideo = setInterval(async () => {
            attempts++;
            if (localVideoRef && localVideoRef.videoWidth > 0 && localVideoRef.videoHeight > 0) {
              clearInterval(checkVideo);
              try {
                await processor.setVideo(localVideoRef);
                processor.setOptions(virtualBackground);
                processor.start();

                // 처리된 스트림을 로컬 스트림으로 교체
                const processedStream = processor.getProcessedStream();
                if (processedStream) {
                  // 오디오 트랙 추가
                  const audioTracks = localStream.getAudioTracks();
                  audioTracks.forEach(track => {
                    if (!processedStream.getTracks().some(t => t.id === track.id)) {
                      processedStream.addTrack(track);
                    }
                  });

                  // 비디오 트랙만 교체
                  const videoTracks = localStream.getVideoTracks();
                  videoTracks.forEach(track => {
                    if (!processedStream.getTracks().some(t => t.id === track.id)) {
                      track.stop();
                    }
                  });

                  setLocalStream(processedStream);
                  showSuccess('가상 배경이 적용되었습니다.');
                }
              } catch (error: any) {
                console.error('[VideoConference] Virtual background setup error:', error);
                showError(`가상 배경 적용에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
              }
            } else if (attempts >= maxAttempts) {
              clearInterval(checkVideo);
              console.warn('[VideoConference] Virtual background setup timeout');
              showError('가상 배경 설정 시간이 초과되었습니다.');
            }
          }, 100);
        } catch (error: any) {
          console.error('[VideoConference] Virtual background setup error:', error);
          showError(`가상 배경 설정에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
        }
      };

      setupProcessor();

      return () => {
        if (virtualBackgroundProcessorRef.current) {
          try {
            virtualBackgroundProcessorRef.current.stop();
            virtualBackgroundProcessorRef.current.dispose();
          } catch (error) {
            console.error('[VideoConference] Error cleaning up virtual background:', error);
          }
          virtualBackgroundProcessorRef.current = null;
        }
      };
    } catch (error: any) {
      console.error('[VideoConference] Virtual background initialization error:', error);
      showError(`가상 배경 초기화에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
    }
  }, [virtualBackground, localStream, isScreenSharing, localVideoRef]);

  // 로컬 비디오 엘리먼트 참조 설정
  useEffect(() => {
    if (localVideoRef && localStream && !isScreenSharing) {
      localVideoRef.srcObject = localStream;
    }
    if (localSmallVideoRef && localStream) {
      localSmallVideoRef.srcObject = localStream;
    }
    if (localVideoRef && isScreenSharing && screenStreamRef.current) {
      localVideoRef.srcObject = screenStreamRef.current;
    }
  }, [localVideoRef, localSmallVideoRef, localStream, isScreenSharing]);

  // Signaling 메시지 처리
  const handleSignalingMessage = async (data: any) => {
    switch (data.type) {
      case 'user-joined':
        await handleUserJoined(data.userId, data.userName);
        break;
      case 'user-left':
        handleUserLeft(data.userId);
        break;
      case 'offer':
        await handleOffer(data.from, data.offer);
        break;
      case 'answer':
        await handleAnswer(data.from, data.answer);
        break;
      case 'ice-candidate':
        await handleIceCandidate(data.from, data.candidate);
        break;
      case 'chat-message':
        setMessages((prev) => [
          ...prev,
          {
            id: uuidv4(),
            sender: data.userName,
            text: data.message,
            timestamp: new Date(),
          },
        ]);
        break;
    }
  };

  // 사용자 참가 처리
  const handleUserJoined = async (userId: string, userName: string) => {
    if (userId === localId.current) return;

    const peerConnection = createPeerConnection(userId);
    setPeers((prev) => new Map(prev).set(userId, peerConnection));

    // Offer 생성 및 전송
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });
    }

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Socket.io로 전송
    if (ws && typeof (ws as any).emit === 'function') {
      (ws as any).emit('offer', {
        to: userId,
        offer: offer,
      });
    }
  };

  // Offer 수신 처리
  const handleOffer = async (from: string, offer: RTCSessionDescriptionInit) => {
    const peerConnection = createPeerConnection(from);
    setPeers((prev) => new Map(prev).set(from, peerConnection));

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Socket.io로 전송
    if (ws && typeof (ws as any).emit === 'function') {
      (ws as any).emit('answer', {
        to: from,
        answer: answer,
      });
    }
  };

  // Answer 수신 처리
  const handleAnswer = async (from: string, answer: RTCSessionDescriptionInit) => {
    const peerConnection = peers.get(from);
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  // ICE Candidate 처리
  const handleIceCandidate = async (from: string, candidate: RTCIceCandidateInit) => {
    const peerConnection = peers.get(from);
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  // 사용자 퇴장 처리
  const handleUserLeft = (userId: string) => {
    const peerConnection = peers.get(userId);
    if (peerConnection) {
      peerConnection.close();
    }
    setPeers((prev) => {
      const newPeers = new Map(prev);
      newPeers.delete(userId);
      return newPeers;
    });
    setParticipants((prev) => prev.filter((p) => p.id !== userId));
  };


  // PeerConnection 생성
  const createPeerConnection = (userId: string): RTCPeerConnection => {
    const configuration = {
      iceServers: [
        // STUN 서버 (NAT 통과)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        // TURN 서버 (방화벽/NAT 환경에서 필수) - 무료 공개 서버
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
      ],
      iceCandidatePoolSize: 10, // ICE 후보자 풀 크기 증가
    };

    const peerConnection = new RTCPeerConnection(configuration);

    // 원격 스트림 수신
    peerConnection.ontrack = (event) => {
      const stream = event.streams[0];
      const track = event.track;

      // 화면 공유 트랙인지 확인 (track.label 또는 stream.id로 판단)
      const isScreenTrack = track.kind === 'video' && (
        track.label.toLowerCase().includes('screen') ||
        track.label.toLowerCase().includes('display') ||
        stream.id.includes('screen')
      );

      if (isScreenTrack) {
        // 화면 공유 스트림
        setRemoteScreenSharing({ userId: userId, stream: stream });

        // 화면 공유 비디오 엘리먼트에 연결
        setTimeout(() => {
          const screenVideoElement = screenVideoRefs.current.get(userId);
          if (screenVideoElement) {
            screenVideoElement.srcObject = stream;
          }
        }, 100);
      } else {
        // 일반 비디오/오디오 스트림
        setParticipants((prev) => {
          const existing = prev.find((p) => p.id === userId);
          if (existing) {
            return prev.map((p) =>
              p.id === userId
                ? { ...p, stream: stream, isVideoEnabled: track.kind === 'video' ? track.enabled : p.isVideoEnabled }
                : p
            );
          }
          return [...prev, {
            id: userId,
            stream: stream,
            name: userName, // 실제로는 서버에서 받아와야 함
            isVideoEnabled: track.kind === 'video' ? track.enabled : true,
            isAudioEnabled: track.kind === 'audio' ? track.enabled : true,
            isScreenSharing: false,
          }];
        });

        // 비디오 엘리먼트에 스트림 연결
        setTimeout(() => {
          const videoElement = videoRefs.current.get(userId);
          if (videoElement) {
            videoElement.srcObject = stream;
          }
        }, 100);
      }
    };

    // ICE Candidate 전송
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Socket.io로 전송
        if (ws && typeof (ws as any).emit === 'function') {
          (ws as any).emit('ice-candidate', {
            to: userId,
            candidate: event.candidate,
          });
        }
      }
    };

    return peerConnection;
  };

  // 비디오 토글
  const toggleVideo = useCallback(() => {
    try {
      if (!localStream) {
        showError('비디오 스트림이 없습니다.');
        return;
      }

      const videoTrack = localStream.getVideoTracks()[0];
      if (!videoTrack) {
        showError('비디오 트랙을 찾을 수 없습니다.');
        return;
      }

      const newEnabled = !isVideoEnabled;
      videoTrack.enabled = newEnabled;
      setIsVideoEnabled(newEnabled);

      // WebRTC 피어 연결에도 반영
      peersRef.current.forEach((peerConnection) => {
        const videoSender = peerConnection.getSenders().find(sender =>
          sender.track && sender.track.kind === 'video'
        );
        if (videoSender && videoSender.track) {
          videoSender.track.enabled = newEnabled;
        }
      });

      if (newEnabled) {
        showSuccess('비디오가 켜졌습니다.');
      } else {
        showSuccess('비디오가 꺼졌습니다.');
      }
    } catch (error: any) {
      console.error('[VideoConference] Toggle video error:', error);
      showError(`비디오 전환에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
    }
  }, [localStream, isVideoEnabled]);

  // 오디오 토글
  const toggleAudio = useCallback(() => {
    try {
      if (!localStream) {
        showError('오디오 스트림이 없습니다.');
        return;
      }

      const audioTrack = localStream.getAudioTracks()[0];
      if (!audioTrack) {
        showError('오디오 트랙을 찾을 수 없습니다.');
        return;
      }

      const newEnabled = !isAudioEnabled;
      audioTrack.enabled = newEnabled;
      setIsAudioEnabled(newEnabled);

      // WebRTC 피어 연결에도 반영
      peersRef.current.forEach((peerConnection) => {
        const audioSender = peerConnection.getSenders().find(sender =>
          sender.track && sender.track.kind === 'audio'
        );
        if (audioSender && audioSender.track) {
          audioSender.track.enabled = newEnabled;
        }
      });

      if (newEnabled) {
        showSuccess('마이크가 켜졌습니다.');
      } else {
        showSuccess('마이크가 꺼졌습니다.');
      }
    } catch (error: any) {
      console.error('[VideoConference] Toggle audio error:', error);
      showError(`오디오 전환에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
    }
  }, [localStream, isAudioEnabled]);

  // 화면 공유
  const handleScreenShare = async () => {
    await toggleScreenShare();
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          showError('이 브라우저는 화면 공유를 지원하지 않습니다.');
          return;
        }

        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'monitor',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          } as any,
          audio: true,
        });

        if (!screenStream || screenStream.getVideoTracks().length === 0) {
          showError('화면 공유 스트림을 가져올 수 없습니다.');
          return;
        }

        screenStreamRef.current = screenStream;

        // 모든 피어에 화면 공유 트랙 전송 (별도 트랙으로)
        let trackAdded = false;
        peersRef.current.forEach((peerConnection, userId) => {
          try {
            const videoTrack = screenStream.getVideoTracks()[0];
            const audioTrack = screenStream.getAudioTracks()[0];

            // 기존 비디오 트랙은 유지하고, 화면 공유 트랙을 추가로 전송
            if (videoTrack) {
              peerConnection.addTrack(videoTrack, screenStream);
              trackAdded = true;
            }
            if (audioTrack) {
              peerConnection.addTrack(audioTrack, screenStream);
            }
          } catch (error) {
            console.error(`[VideoConference] Failed to add screen share track to peer ${userId}:`, error);
          }
        });

        // Socket.io로 화면 공유 시작 알림
        if (ws && typeof (ws as any).emit === 'function') {
          try {
            (ws as any).emit('screen-share-started', {
              roomId: roomId,
              userId: localId.current,
            });
          } catch (error) {
            console.error('[VideoConference] Failed to emit screen-share-started:', error);
          }
        }

        setIsScreenSharing(true);
        showSuccess('화면 공유가 시작되었습니다.');

        // 화면 공유 종료 감지
        const videoTrack = screenStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            stopScreenShare();
          };
        }
      } else {
        await stopScreenShare();
      }
    } catch (error: any) {
      console.error('[VideoConference] Screen share error:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        showError('화면 공유 권한이 거부되었습니다.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        showError('화면 공유할 디스플레이를 찾을 수 없습니다.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        showError('화면 공유를 시작할 수 없습니다. 다른 애플리케이션에서 사용 중일 수 있습니다.');
      } else {
        showError(`화면 공유에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
      }
    }
  };

  // 화면 공유 중지
  const stopScreenShare = async () => {
    try {
      if (screenStreamRef.current) {
        // 모든 피어에서 화면 공유 트랙 제거
        peersRef.current.forEach((peerConnection) => {
          try {
            const senders = peerConnection.getSenders();
            senders.forEach((sender) => {
              if (sender.track && screenStreamRef.current?.getTracks().includes(sender.track)) {
                peerConnection.removeTrack(sender);
              }
            });
          } catch (error) {
            console.error('[VideoConference] Failed to remove screen share track:', error);
          }
        });

        screenStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (error) {
            console.error('[VideoConference] Failed to stop screen track:', error);
          }
        });
        screenStreamRef.current = null;
      }

      // Socket.io로 화면 공유 중지 알림
      if (ws && typeof (ws as any).emit === 'function') {
        try {
          (ws as any).emit('screen-share-stopped', {
            roomId: roomId,
            userId: localId.current,
          });
        } catch (error) {
          console.error('[VideoConference] Failed to emit screen-share-stopped:', error);
        }
      }

      setIsScreenSharing(false);
      showSuccess('화면 공유가 중지되었습니다.');
    } catch (error: any) {
      console.error('[VideoConference] Stop screen share error:', error);
      showError(`화면 공유 중지에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
    }
  };

  // 채팅 메시지 전송
  const sendMessage = useCallback(() => {
    try {
      if (!chatInput.trim()) {
        showError('메시지를 입력해주세요.');
        return;
      }

      if (!ws) {
        showError('서버 연결이 없습니다. 페이지를 새로고침해주세요.');
        return;
      }

      // Socket.io로 전송
      if (typeof (ws as any).emit === 'function') {
        (ws as any).emit('chat-message', {
          message: chatInput.trim(),
        });
        setChatInput('');
      } else {
        showError('메시지 전송 기능을 사용할 수 없습니다.');
      }
    } catch (error: any) {
      console.error('[VideoConference] Send message error:', error);
      showError(`메시지 전송에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
    }
  }, [chatInput, ws]);

  // 녹화 시작
  const startRecording = useCallback(async () => {
    try {
      if (!isHost) {
        showError('호스트만 녹화를 시작할 수 있습니다.');
        return;
      }

      if (!googleDriveToken) {
        showError('Google Drive 토큰이 필요합니다. 설정에서 연결해주세요.');
        return;
      }

      if (!localStream) {
        showError('비디오 스트림이 없습니다.');
        return;
      }

      if (!MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        showError('이 브라우저는 녹화를 지원하지 않습니다.');
        return;
      }

      // 모든 비디오 스트림을 합성
      const streams: MediaStream[] = [];
      if (localStream) streams.push(localStream);
      participants.forEach((p) => {
        if (p.stream && p.stream.getTracks().length > 0) {
          streams.push(p.stream);
        }
      });

      if (streams.length === 0) {
        showError('녹화할 스트림이 없습니다.');
        return;
      }

      // MediaRecorder로 녹화
      const combinedStream = new MediaStream();
      streams.forEach((stream) => {
        stream.getTracks().forEach((track) => {
          combinedStream.addTrack(track);
        });
      });

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp8,opus',
      });

      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event: any) => {
        console.error('[VideoConference] MediaRecorder error:', event.error);
        showError(`녹화 중 오류가 발생했습니다: ${event.error?.message || '알 수 없는 오류'}`);
        setIsRecording(false);
      };

      mediaRecorder.onstop = async () => {
        try {
          if (recordedChunksRef.current.length === 0) {
            showError('녹화된 데이터가 없습니다.');
            return;
          }

          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });

          // 구글 드라이브에 업로드
          const formData = new FormData();
          formData.append('file', blob, `meeting-${roomId}-${Date.now()}.webm`);
          formData.append('fileName', `미팅녹화-${new Date().toLocaleString('ko-KR')}.webm`);
          formData.append('meetingId', roomId);
          formData.append('accessToken', googleDriveToken);

          const response = await fetch('/api/google/drive/upload', {
            method: 'POST',
            body: formData,
          });

          const data = await response.json();
          if (data.ok && data.file) {
            showSuccess(`녹화가 완료되었습니다. Google Drive에 저장되었습니다.`);
            console.log('[VideoConference] Recording uploaded to Google Drive:', data.file.link);
          } else {
            showError(data.error || '녹화 파일 업로드에 실패했습니다.');
          }
        } catch (error: any) {
          console.error('[VideoConference] Upload error:', error);
          showError(`녹화 파일 업로드에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
        }
      };

      mediaRecorder.start(1000); // 1초마다 데이터 수집
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      showSuccess('녹화가 시작되었습니다.');
    } catch (error: any) {
      console.error('[VideoConference] Recording error:', error);
      showError(`녹화 시작에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
    }
  }, [isHost, googleDriveToken, localStream, participants, roomId]);

  // 녹화 중지
  const stopRecording = useCallback(() => {
    try {
      if (!mediaRecorderRef.current) {
        showError('녹화가 진행 중이 아닙니다.');
        return;
      }

      if (!isRecording) {
        showError('녹화가 진행 중이 아닙니다.');
        return;
      }

      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        showSuccess('녹화가 중지되었습니다. 업로드 중...');
      } else {
        setIsRecording(false);
      }
    } catch (error: any) {
      console.error('[VideoConference] Stop recording error:', error);
      showError(`녹화 중지에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
      setIsRecording(false);
    }
  }, [isRecording]);

  // 호스트인 경우 자동 녹화 시작 (선택적 - 주석 처리)
  // useEffect(() => {
  //   if (isHost && googleDriveToken && !isRecording && localStream) {
  //     startRecording();
  //   }
  //   return () => {
  //     if (isRecording) {
  //       stopRecording();
  //     }
  //   };
  // }, [isHost, googleDriveToken, localStream, isRecording, startRecording, stopRecording]);

  // 대기실 참가자 승인
  const approveParticipant = useCallback((userId: string) => {
    try {
      if (!isHost) {
        showError('호스트만 참가자를 승인할 수 있습니다.');
        return;
      }

      if (!ws || typeof (ws as any).emit !== 'function') {
        showError('서버 연결이 없습니다.');
        return;
      }

      (ws as any).emit('approve-participant', {
        userId: userId,
      });
      setWaitingParticipants((prev) => prev.filter((id) => id !== userId));
      showSuccess('참가자가 승인되었습니다.');
    } catch (error: any) {
      console.error('[VideoConference] Approve participant error:', error);
      showError(`참가자 승인에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
    }
  }, [isHost, ws]);

  // 참가자 제거
  const removeParticipant = useCallback((userId: string) => {
    try {
      if (!isHost) {
        showError('호스트만 참가자를 제거할 수 있습니다.');
        return;
      }

      if (!ws || typeof (ws as any).emit !== 'function') {
        showError('서버 연결이 없습니다.');
        return;
      }

      (ws as any).emit('remove-participant', {
        userId: userId,
      });
      showSuccess('참가자가 제거되었습니다.');
    } catch (error: any) {
      console.error('[VideoConference] Remove participant error:', error);
      showError(`참가자 제거에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
    }
  }, [isHost, ws]);

  // 호스트 전환
  const transferHost = useCallback((userId: string) => {
    try {
      if (!isHost) {
        showError('호스트만 호스트 권한을 전환할 수 있습니다.');
        return;
      }

      if (!ws || typeof (ws as any).emit !== 'function') {
        showError('서버 연결이 없습니다.');
        return;
      }

      if (userId === localId.current) {
        showError('이미 호스트입니다.');
        return;
      }

      (ws as any).emit('transfer-host', {
        userId: userId,
      });
      showSuccess('호스트 권한이 전환되었습니다.');
    } catch (error: any) {
      console.error('[VideoConference] Transfer host error:', error);
      showError(`호스트 전환에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
    }
  }, [isHost, ws]);

  // 미팅 종료
  const handleLeave = useCallback(async () => {
    try {
      console.log('[VideoConference] Leaving meeting...');

      // 녹화 중지
      if (isRecording && mediaRecorderRef.current) {
        try {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          if (recordedChunksRef.current.length > 0) {
            recordedChunksRef.current = [];
          }
        } catch (error) {
          console.error('[VideoConference] Error stopping recording:', error);
        }
      }

      // Socket.io 연결 종료
      if (ws && typeof (ws as any).disconnect === 'function') {
        try {
          (ws as any).emit('leave-room', { roomId, userId: localId.current });
          (ws as any).disconnect();
        } catch (error) {
          console.error('[VideoConference] Error disconnecting socket:', error);
        }
      }

      // 모든 피어 연결 종료
      peers.forEach((peer) => {
        try {
          peer.close();
        } catch (error) {
          console.error('[VideoConference] Error closing peer:', error);
        }
      });
      setPeers(new Map());

      // 로컬 스트림 종료
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (error) {
            console.error('[VideoConference] Error stopping track:', error);
          }
        });
      }

      // 화면 공유 스트림 종료
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (error) {
            console.error('[VideoConference] Error stopping screen track:', error);
          }
        });
        screenStreamRef.current = null;
      }

      // 네트워크 모니터링 정리
      if (networkStatsIntervalRef.current) {
        clearInterval(networkStatsIntervalRef.current);
        networkStatsIntervalRef.current = null;
      }

      // 가상 배경 정리
      if (virtualBackgroundProcessorRef.current) {
        try {
          virtualBackgroundProcessorRef.current.stop();
          virtualBackgroundProcessorRef.current.dispose();
        } catch (error) {
          console.error('[VideoConference] Error cleaning up virtual background:', error);
        }
        virtualBackgroundProcessorRef.current = null;
      }

      // 참가자 목록 초기화
      setParticipants([]);
      setLocalStream(null);
      setRemoteScreenSharing(null);

      console.log('[VideoConference] Meeting left successfully');

      // 부모 컴포넌트에 종료 알림
      onLeave();
    } catch (error: any) {
      console.error('[VideoConference] Error leaving meeting:', error);
      // 에러가 발생해도 종료는 진행
      onLeave();
    }
  }, [ws, roomId, localId, peers, localStream, isRecording, onLeave]);

  // 모바일 감지 useEffect
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 모바일에서 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobile) {
        const target = event.target as HTMLElement;
        if (!target.closest('.relative')) {
          setShowAudioMenu(false);
          setShowVideoMenu(false);
          setShowScreenShareMenu(false);
          setShowHostToolsMenu(false);
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isMobile]);

  // 최소화된 경우
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white shadow-lg">
        <span className="text-sm font-semibold">화상 회의 진행 중</span>
        <button
          onClick={onToggleMinimize}
          className="rounded p-1 hover:bg-blue-700"
        >
          <FiMaximize2 />
        </button>
        <button
          onClick={handleLeave}
          className="rounded p-1 hover:bg-red-600"
        >
          <FiX />
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 flex flex-col bg-gray-900 ${isMobile ? 'mobile-optimized' : ''}`}>
      {/* 헤더 - 모바일 최적화 */}
      <div className={`flex items-center justify-between bg-gray-800 ${isMobile ? 'px-2 py-2' : 'px-4 py-3'}`}>
        <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-3'}`}>
          <h2 className={`${isMobile ? 'text-sm' : 'text-lg'} font-bold text-white`}>화상 회의</h2>
          <span className={`rounded-full bg-blue-600 ${isMobile ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'} text-white`}>
            {participants.length + 1}명
          </span>
          {/* 네트워크 품질 표시 */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${networkQuality.quality === 'excellent' ? 'bg-green-500' :
              networkQuality.quality === 'good' ? 'bg-yellow-500' :
                networkQuality.quality === 'fair' ? 'bg-orange-500' : 'bg-red-500'
              }`} title={`네트워크 품질: ${networkQuality.quality}`} />
            {networkQuality.latency && (
              <span className="text-xs text-gray-300">
                {Math.round(networkQuality.latency)}ms
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onToggleMinimize && (
            <button
              onClick={onToggleMinimize}
              className="rounded-lg bg-gray-700 p-2 text-white hover:bg-gray-600"
            >
              <FiMinimize2 />
            </button>
          )}
          <button
            onClick={handleLeave}
            className="rounded-lg bg-red-600 p-2 text-white hover:bg-red-700"
          >
            <FiX />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* 화면 공유 영역 (원격 사용자가 화면 공유 중일 때) */}
        {remoteScreenSharing && (
          <div className="absolute inset-0 z-10 bg-black">
            <video
              ref={(el) => {
                if (el) {
                  screenVideoRefs.current.set(remoteScreenSharing.userId, el);
                  el.srcObject = remoteScreenSharing.stream;
                }
              }}
              autoPlay
              playsInline
              className="h-full w-full object-contain"
            />
            {/* 내 카메라 작은 네모 (왼쪽 상단) */}
            {localStream && (
              <div className="absolute top-4 left-4 w-48 h-36 rounded-lg overflow-hidden bg-gray-800 border-2 border-white shadow-lg z-20">
                <video
                  ref={setLocalSmallVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
                {!isVideoEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <div className="text-center text-white">
                      <FiVideoOff className="mx-auto mb-1 text-2xl" />
                    </div>
                  </div>
                )}
                <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                  {userName}
                </div>
              </div>
            )}
            {/* 화면 공유 중지 버튼 (호스트만) */}
            {isHost && (
              <button
                onClick={() => {
                  // 원격 사용자의 화면 공유 중지 요청
                  if (ws && typeof (ws as any).emit === 'function') {
                    (ws as any).emit('stop-remote-screen-share', {
                      userId: remoteScreenSharing.userId,
                    });
                  }
                  setRemoteScreenSharing(null);
                }}
                className="absolute top-4 right-4 z-20 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <FiMonitor size={16} />
                화면 공유 중지
              </button>
            )}
          </div>
        )}

        {/* 일반 비디오 영역 (화면 공유 중이 아닐 때) - 모바일 최적화 */}
        {!remoteScreenSharing && (
          <div className={`flex flex-1 gap-4 ${isMobile ? 'p-2' : 'p-4'} ${viewMode === 'grid'
            ? 'flex-wrap'
            : 'flex-col items-center justify-center'
            }`}>
            {/* 스피커 뷰: 말하는 사람이 크게 표시 - 모바일 최적화 */}
            {viewMode === 'speaker' && speakingParticipant && (
              <div className={`relative w-full h-full ${isMobile ? 'max-w-full' : 'max-w-4xl'} rounded-lg bg-gray-800 overflow-hidden shadow-2xl`}>
                {participants
                  .filter(p => p.id === speakingParticipant)
                  .map((participant) => (
                    <div key={participant.id} className="relative w-full h-full">
                      <video
                        ref={(el) => {
                          if (el) {
                            videoRefs.current.set(participant.id, el);
                            el.srcObject = participant.stream;
                          }
                        }}
                        autoPlay
                        playsInline
                        className="h-full w-full rounded-lg object-cover"
                      />
                      <div className="absolute bottom-4 left-4 rounded bg-black/70 px-4 py-2 text-lg text-white font-semibold flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        {participant.name} (말하는 중)
                      </div>
                      {!participant.isVideoEnabled && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                          <div className="text-center text-white">
                            <FiVideoOff className="mx-auto mb-4 text-6xl" />
                            <p className="text-xl">{participant.name}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {/* 그리드 뷰 또는 스피커 뷰의 작은 타일들 */}
            <div className={`${viewMode === 'grid'
              ? 'flex flex-wrap gap-4 w-full'
              : 'absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2'
              }`}>
              {/* 로컬 비디오 - 모바일 최적화 */}
              <div className={`relative rounded-lg bg-gray-800 overflow-hidden shadow-lg ${viewMode === 'grid'
                ? `aspect-video w-full ${isMobile ? 'max-w-full' : 'max-w-md'}`
                : isMobile ? 'w-24 h-18' : 'w-32 h-24'
                } ${viewMode === 'speaker' && speakingParticipant === 'local' ? 'ring-4 ring-blue-500' : ''}`}>
                {isScreenSharing && screenStreamRef.current ? (
                  <>
                    {/* 화면 공유 전체화면 */}
                    <video
                      ref={setLocalVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="h-full w-full object-contain bg-black"
                    />
                    {/* 내 카메라 작은 네모 (왼쪽 상단) */}
                    {localStream && (
                      <div className="absolute top-2 left-2 w-32 h-24 rounded-lg overflow-hidden bg-gray-800 border-2 border-white shadow-lg z-10">
                        <video
                          ref={setLocalSmallVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className="h-full w-full object-cover"
                        />
                        {!isVideoEnabled && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                            <FiVideoOff className="text-white text-lg" />
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <video
                      ref={setLocalVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="h-full w-full rounded-lg object-cover"
                    />
                    {!isVideoEnabled && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                        <div className="text-center text-white">
                          <FiVideoOff className="mx-auto mb-2 text-4xl" />
                          <p className="text-sm">카메라 꺼짐</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-sm text-white flex items-center gap-2">
                  {audioLevelRefs.current.get('local') && audioLevelRefs.current.get('local')! > 30 && (
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  )}
                  {userName} (나)
                </div>
              </div>

              {/* 원격 참가자 비디오 */}
              {participants.map((participant) => {
                const audioLevel = audioLevelRefs.current.get(participant.id) || 0;
                const isSpeaking = audioLevel > 30;

                return (
                  <div
                    key={participant.id}
                    className={`relative rounded-lg bg-gray-800 overflow-hidden shadow-lg ${viewMode === 'grid'
                      ? `aspect-video w-full ${isMobile ? 'max-w-full' : 'max-w-md'}`
                      : isMobile ? 'w-24 h-18' : 'w-32 h-24'
                      } ${viewMode === 'speaker' && speakingParticipant === participant.id ? 'ring-4 ring-blue-500' : ''}`}
                  >
                    <video
                      ref={(el) => {
                        if (el) {
                          videoRefs.current.set(participant.id, el);
                          el.srcObject = participant.stream;
                        }
                      }}
                      autoPlay
                      playsInline
                      className="h-full w-full rounded-lg object-cover"
                    />
                    <div className={`absolute bottom-2 left-2 rounded px-2 py-1 text-sm text-white flex items-center gap-2 ${isSpeaking ? 'bg-green-600/90' : 'bg-black/70'
                      }`}>
                      {isSpeaking && (
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      )}
                      {participant.name}
                    </div>
                    {/* 오디오 레벨 표시 (작은 막대) */}
                    {isSpeaking && (
                      <div className="absolute top-2 right-2 flex items-end gap-0.5 h-6">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div
                            key={i}
                            className="w-1 bg-green-400 rounded-t"
                            style={{
                              height: `${Math.min((audioLevel / 100) * 24, 24)}px`,
                              opacity: i < Math.floor((audioLevel / 100) * 5) ? 1 : 0.3
                            }}
                          />
                        ))}
                      </div>
                    )}
                    {!participant.isVideoEnabled && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                        <div className="text-center text-white">
                          <FiVideoOff className={`mx-auto mb-2 ${viewMode === 'grid' ? 'text-4xl' : 'text-xl'}`} />
                          <p className={`${viewMode === 'grid' ? 'text-sm' : 'text-xs'}`}>카메라 꺼짐</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 채팅 사이드바 - 모바일 최적화 */}
        {showChat && (
          <div className={`${isMobile ? 'w-full' : 'w-80'} border-l border-gray-700 bg-gray-800 flex flex-col`}>
            <div className="border-b border-gray-700 p-4 flex items-center justify-between">
              <h3 className="font-semibold text-white">채팅</h3>
              <button
                onClick={() => {
                  // 채팅 미리보기 토글
                  const preview = document.getElementById('chat-preview');
                  if (preview) {
                    preview.classList.toggle('hidden');
                  }
                }}
                className="text-xs text-gray-400 hover:text-white"
                title="채팅 미리보기 표시"
              >
                미리보기
              </button>
            </div>
            {/* 채팅 미리보기 */}
            <div id="chat-preview" className="hidden border-b border-gray-700 p-2 bg-gray-750">
              <p className="text-xs text-gray-400 px-2">최근 메시지 미리보기</p>
              {messages.length > 0 && (
                <div className="px-2 py-1 text-xs text-gray-300">
                  {messages[messages.length - 1].sender}: {messages[messages.length - 1].text}
                </div>
              )}
            </div>
            <div className="flex h-[calc(100vh-200px)] flex-col">
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {messages.map((msg) => (
                  <div key={msg.id} className="rounded-lg bg-gray-700 p-2">
                    <p className="text-xs font-semibold text-blue-400">{msg.sender}</p>
                    <p className="text-sm text-white">{msg.text}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-700 p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="메시지 입력..."
                    className="flex-1 rounded-lg bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={sendMessage}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                  >
                    전송
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 대기실 모달 */}
      {isInWaitingRoom && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur pointer-events-auto">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">대기실</h3>
            <p className="text-gray-600 mb-6">호스트의 승인을 기다리는 중입니다...</p>
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      )}

      {/* 참가자 목록 사이드바 */}
      {showParticipantsList && (
        <div className="fixed top-20 right-4 z-[90] bg-white rounded-lg shadow-2xl p-4 w-80 max-h-[calc(100vh-120px)] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-gray-900">참가자 ({participants.length + 1}명)</h4>
            <button
              onClick={() => setShowParticipantsList(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <FiX />
            </button>
          </div>
          <div className="space-y-2">
            {/* 로컬 사용자 */}
            <div className="flex items-center justify-between bg-gray-50 rounded p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{userName} (나)</p>
                  <p className="text-xs text-gray-500">
                    {isHost ? '호스트' : '참가자'} • {isVideoEnabled ? '비디오 켜짐' : '비디오 꺼짐'} • {isAudioEnabled ? '오디오 켜짐' : '오디오 꺼짐'}
                  </p>
                </div>
              </div>
            </div>
            {/* 원격 참가자 */}
            {participants.map((participant) => {
              const audioLevel = audioLevelRefs.current.get(participant.id) || 0;
              const isSpeaking = audioLevel > 30;

              return (
                <div key={participant.id} className="flex items-center justify-between bg-gray-50 rounded p-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${isSpeaking ? 'bg-green-600 ring-2 ring-green-400' : 'bg-gray-600'
                      }`}>
                      {participant.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 flex items-center gap-2">
                        {participant.name}
                        {isSpeaking && (
                          <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded">말하는 중</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {participant.isVideoEnabled ? '비디오 켜짐' : '비디오 꺼짐'} • {participant.isAudioEnabled ? '오디오 켜짐' : '오디오 꺼짐'}
                      </p>
                    </div>
                  </div>
                  {isHost && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (confirm(`${participant.name}님을 미팅에서 제거하시겠습니까?`)) {
                            removeParticipant(participant.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-700 p-1"
                        title="제거"
                      >
                        <FiX />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`${participant.name}님에게 호스트 권한을 전환하시겠습니까?`)) {
                            transferHost(participant.id);
                          }
                        }}
                        className="text-blue-600 hover:text-blue-700 p-1 text-xs"
                        title="호스트 전환"
                      >
                        호스트 전환
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 호스트용 대기실 관리 */}
      {isHost && waitingParticipants.length > 0 && (
        <div className="fixed top-20 right-4 z-[90] bg-white rounded-lg shadow-2xl p-4 max-w-xs">
          <h4 className="font-bold text-gray-900 mb-3">대기 중인 참가자</h4>
          <div className="space-y-2">
            {waitingParticipants.map((userId) => (
              <div key={userId} className="flex items-center justify-between bg-gray-50 rounded p-2">
                <span className="text-sm text-gray-700">{userId}</span>
                <button
                  onClick={() => approveParticipant(userId)}
                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                >
                  승인
                </button>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* 컨트롤 바 (Zoom 스타일) - 모바일 최적화 */}
      <div className={`flex items-center justify-center gap-1 bg-gray-900 px-2 py-2 ${isMobile ? 'flex-wrap' : 'gap-2 px-6 py-3'}`} style={{ position: 'relative', zIndex: 10 }}>
        {/* 오디오 버튼 및 메뉴 */}
        <div className="relative">
          <button
            onClick={() => {
              setShowAudioMenu(!showAudioMenu);
              setShowVideoMenu(false);
            }}
            className={`flex flex-col items-center gap-1 ${isMobile ? 'px-2 py-1 text-xs' : 'px-4 py-2'} rounded-lg transition-colors ${isAudioEnabled ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            title="오디오"
          >
            {isAudioEnabled ? <FiMic size={20} /> : <FiMicOff size={20} />}
            <span className="text-xs">오디오</span>
            <span className="text-xs">↑</span>
          </button>
          {showAudioMenu && (
            <div className={`absolute ${isMobile ? 'bottom-full right-0 mb-2' : 'bottom-full left-1/2 transform -translate-x-1/2 mb-2'} bg-gray-800 rounded-lg shadow-xl p-4 ${isMobile ? 'w-72' : 'w-80'}`} style={{ zIndex: 9999 }}>
              <h4 className="text-white font-semibold mb-3">마이크 선택</h4>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedAudioDevice('');
                    setShowAudioMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm ${!selectedAudioDevice ? 'bg-blue-600 text-white' : 'text-gray-300'
                    }`}
                >
                  시스템과 동일
                </button>
                {audioDevices.map((device) => (
                  <button
                    key={device.deviceId}
                    onClick={() => {
                      setSelectedAudioDevice(device.deviceId);
                      setShowAudioMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm flex items-center gap-2 ${selectedAudioDevice === device.deviceId ? 'bg-blue-600 text-white' : 'text-gray-300'
                      }`}
                  >
                    {selectedAudioDevice === device.deviceId && <span>✓</span>}
                    <span>{device.label || `마이크 ${device.deviceId.slice(0, 8)}`}</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-gray-700 mt-3 pt-3 space-y-1">
                <button
                  onClick={toggleAudio}
                  className="w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm text-gray-300"
                >
                  {isAudioEnabled ? '마이크 끄기' : '마이크 켜기'}
                </button>
                <button
                  onClick={() => {
                    setShowAudioSettings(true);
                    setShowAudioMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm text-gray-300"
                >
                  오디오 설정...
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 비디오 버튼 및 메뉴 */}
        <div className="relative">
          <button
            onClick={() => {
              setShowVideoMenu(!showVideoMenu);
              setShowAudioMenu(false);
            }}
            className={`flex flex-col items-center gap-1 ${isMobile ? 'px-2 py-1 text-xs' : 'px-4 py-2'} rounded-lg transition-colors ${isVideoEnabled ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            title="비디오"
          >
            {isVideoEnabled ? <FiVideo size={20} /> : <FiVideoOff size={20} />}
            <span className="text-xs">비디오</span>
            <span className="text-xs">↑</span>
          </button>
          {showVideoMenu && (
            <div className={`absolute ${isMobile ? 'bottom-full right-0 mb-2' : 'bottom-full left-1/2 transform -translate-x-1/2 mb-2'} bg-gray-800 rounded-lg shadow-xl p-4 ${isMobile ? 'w-72' : 'w-80'}`} style={{ zIndex: 9999 }}>
              <h4 className="text-white font-semibold mb-3">카메라 선택</h4>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedVideoDevice('');
                    setShowVideoMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm ${!selectedVideoDevice ? 'bg-blue-600 text-white' : 'text-gray-300'
                    }`}
                >
                  시스템과 동일
                </button>
                {videoDevices.map((device) => (
                  <button
                    key={device.deviceId}
                    onClick={() => {
                      setSelectedVideoDevice(device.deviceId);
                      setShowVideoMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm flex items-center gap-2 ${selectedVideoDevice === device.deviceId ? 'bg-blue-600 text-white' : 'text-gray-300'
                      }`}
                  >
                    {selectedVideoDevice === device.deviceId && <span>✓</span>}
                    <span>{device.label || `카메라 ${device.deviceId.slice(0, 8)}`}</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-gray-700 mt-3 pt-3 space-y-1">
                <button
                  onClick={() => {
                    try {
                      setVirtualBackground({ type: 'blur', blurIntensity: 50 });
                      setShowVideoMenu(false);
                    } catch (error: any) {
                      console.error('[VideoConference] Set blur background error:', error);
                      showError(`배경 흐리게 설정에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
                    }
                  }}
                  className={`w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm flex items-center gap-2 ${virtualBackground.type === 'blur' ? 'bg-blue-600 text-white' : 'text-gray-300'
                    }`}
                >
                  {virtualBackground.type === 'blur' && <span>✓</span>}
                  <span>내 배경 흐리게</span>
                </button>
                <button
                  onClick={() => {
                    // 배경 설정 모달 열기
                    const menu = document.getElementById('virtual-background-menu');
                    if (menu) {
                      menu.classList.remove('hidden');
                    }
                    setShowVideoMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm text-gray-300"
                >
                  배경 및 효과 조정...
                </button>
                <button
                  onClick={toggleVideo}
                  className="w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm text-gray-300"
                >
                  {isVideoEnabled ? '비디오 끄기' : '비디오 켜기'}
                </button>
                <button
                  onClick={(e) => {
                    try {
                      e.stopPropagation(); // 이벤트 전파 방지
                      // 비디오 설정은 현재 카메라 선택과 동일하므로 메뉴를 유지
                      // 메뉴가 이미 열려있으므로 아무것도 하지 않음 (메뉴 유지)
                      // 사용자에게 메뉴 상단의 카메라 선택 옵션을 사용하도록 안내
                    } catch (error: any) {
                      console.error('[VideoConference] Video settings error:', error);
                      showError(`비디오 설정을 열 수 없습니다: ${error.message || '알 수 없는 오류'}`);
                    }
                  }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm text-gray-300"
                  title="위의 카메라 선택 메뉴를 사용하세요"
                >
                  비디오 설정...
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => setViewMode(viewMode === 'grid' ? 'speaker' : 'grid')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${viewMode === 'speaker' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
          title={viewMode === 'grid' ? '스피커 뷰' : '그리드 뷰'}
        >
          {viewMode === 'grid' ? <FiUser size={20} /> : <FiGrid size={20} />}
          <span className="text-xs">{viewMode === 'grid' ? '스피커' : '그리드'}</span>
        </button>
        {/* 참가자 버튼 및 메뉴 */}
        <div className="relative">
          <button
            onClick={() => {
              setShowParticipantsList(!showParticipantsList);
              setShowAudioMenu(false);
              setShowVideoMenu(false);
            }}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors relative ${showParticipantsList ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
            title="참가자"
          >
            <FiUsers size={20} />
            <span className="text-xs">참가자</span>
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {participants.length + 1}
            </span>
            <span className="text-xs">↑</span>
          </button>
          {!showParticipantsList && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-800 rounded-lg shadow-xl p-2" style={{ zIndex: 9999 }}>
              <button
                onClick={async () => {
                  const meetingLink = `${window.location.origin}/meeting/${roomId}`;
                  try {
                    await navigator.clipboard.writeText(meetingLink);
                    showSuccess('초대 링크가 복사되었습니다!');
                  } catch (error) {
                    showError('링크 복사에 실패했습니다.');
                  }
                }}
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm text-gray-300"
              >
                초대 링크 복사
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowChat(!showChat)}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${showChat ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
          title="채팅"
        >
          <FiMessageSquare size={20} />
          <span className="text-xs">채팅</span>
        </button>
        {/* 가상 배경 메뉴 */}
        <div className="relative">
          <button
            onClick={() => {
              const menu = document.getElementById('virtual-background-menu');
              if (menu) {
                menu.classList.toggle('hidden');
              }
            }}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${virtualBackground.type !== 'none' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
            title="가상 배경"
          >
            <FiImage size={20} />
            <span className="text-xs">배경</span>
          </button>
          {/* 가상 배경 메뉴 */}
          <div
            id="virtual-background-menu"
            className="hidden absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-white rounded-lg shadow-xl p-4 w-64"
            style={{ zIndex: 9999 }}
          >
            <div className="space-y-2">
              <button
                onClick={() => {
                  setVirtualBackground({ type: 'none' });
                  document.getElementById('virtual-background-menu')?.classList.add('hidden');
                }}
                className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 ${virtualBackground.type === 'none' ? 'bg-blue-50 text-blue-600' : ''
                  }`}
              >
                배경 없음
              </button>
              <button
                onClick={() => {
                  setVirtualBackground({ type: 'blur', blurIntensity: 50 });
                  document.getElementById('virtual-background-menu')?.classList.add('hidden');
                }}
                className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 ${virtualBackground.type === 'blur' ? 'bg-blue-50 text-blue-600' : ''
                  }`}
              >
                배경 블러
              </button>
              <div className="border-t pt-2">
                <label className="block text-xs text-gray-600 mb-1">블러 강도</label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={virtualBackground.blurIntensity || 50}
                  onChange={(e) => {
                    if (virtualBackground.type === 'blur') {
                      setVirtualBackground({
                        ...virtualBackground,
                        blurIntensity: parseInt(e.target.value),
                      });
                    }
                  }}
                  disabled={virtualBackground.type !== 'blur'}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
        {/* 화면 공유 버튼 및 메뉴 */}
        <div className="relative">
          <button
            onClick={() => {
              if (!isScreenSharing) {
                setShowScreenShareMenu(!showScreenShareMenu);
                setShowAudioMenu(false);
                setShowVideoMenu(false);
                setShowHostToolsMenu(false);
              } else {
                toggleScreenShare();
              }
            }}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${isScreenSharing ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
            title="화면 공유"
          >
            <FiMonitor size={20} />
            <span className="text-xs">공유</span>
            {!isScreenSharing && <span className="text-xs">↑</span>}
          </button>
          {showScreenShareMenu && !isScreenSharing && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-white rounded-lg shadow-xl p-4 w-96" style={{ zIndex: 9999 }}>
              <h3 className="text-lg font-bold text-gray-900 mb-4">공유하려는 창 또는 앱 선택</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">전체 화면</h4>
                  <button
                    onClick={async () => {
                      await toggleScreenShare();
                      setShowScreenShareMenu(false);
                    }}
                    className="w-full border-2 border-gray-300 rounded p-2 hover:border-blue-500 text-left"
                  >
                    <div className="bg-gray-200 rounded h-20 mb-1"></div>
                    <p className="text-xs text-gray-600">화면 1</p>
                  </button>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">애플리케이션 창</h4>
                  <button
                    onClick={async () => {
                      await toggleScreenShare();
                      setShowScreenShareMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm border border-gray-200"
                  >
                    현재 창 공유
                  </button>
                </div>
                <div className="border-t pt-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="rounded" />
                    <span>소리 공유</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="rounded" />
                    <span>비디오 공유에 최적화</span>
                  </label>
                </div>
                <button
                  onClick={async () => {
                    await toggleScreenShare();
                    setShowScreenShareMenu(false);
                  }}
                  className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                >
                  공유
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 호스트 도구 버튼 및 메뉴 */}
        {isHost && (
          <div className="relative">
            <button
              onClick={() => {
                setShowHostToolsMenu(!showHostToolsMenu);
                setShowAudioMenu(false);
                setShowVideoMenu(false);
                setShowScreenShareMenu(false);
              }}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors bg-gray-700 text-white hover:bg-gray-600"
              title="호스트 도구"
            >
              <FiShield size={20} />
              <span className="text-xs">호스트 도구</span>
              <span className="text-xs">↑</span>
            </button>
            {showHostToolsMenu && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-white rounded-lg shadow-xl p-4 w-80 max-h-96 overflow-y-auto" style={{ zIndex: 9999 }}>
                <h3 className="text-lg font-bold text-gray-900 mb-4">회의 잠금</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" defaultChecked />
                    <span className="text-sm">대기실 사용</span>
                  </label>
                  <div className="border-t pt-3">
                    <p className="text-sm font-semibold text-gray-700 mb-2">모든 참가자에게 다음을 허용:</p>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm">화면 공유</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded" defaultChecked />
                        <span className="text-sm">채팅</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded" defaultChecked />
                        <span className="text-sm">스스로 이름 바꾸기</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded" defaultChecked />
                        <span className="text-sm">스스로 음소거 해제</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded" defaultChecked />
                        <span className="text-sm">비디오 시작</span>
                      </label>
                    </div>
                  </div>
                  <div className="border-t pt-3 space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">컴퓨터에 녹화</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" defaultChecked />
                      <span className="text-sm">컴퓨터에 녹화 요청</span>
                    </label>
                  </div>
                  <button
                    onClick={() => {
                      alert('참가자 활동 일시 중단 기능은 준비 중입니다.');
                    }}
                    className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 text-sm mt-3"
                  >
                    참가자 활동 일시 중단
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 녹화 버튼 */}
        {isHost && (
          <button
            onClick={async () => {
              try {
                if (isRecording) {
                  await stopRecording();
                } else {
                  if (googleDriveToken) {
                    await startRecording();
                  } else {
                    showError('구글 드라이브 연동이 필요합니다. 설정에서 연결해주세요.');
                  }
                }
              } catch (error: any) {
                console.error('[VideoConference] Recording toggle error:', error);
                showError(`녹화 전환에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
              }
            }}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${isRecording ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
            title="녹화"
            disabled={isRecording && !mediaRecorderRef.current}
          >
            <div className={`w-4 h-4 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></div>
            <span className="text-xs">녹화</span>
            {!isRecording && <span className="text-xs">↑</span>}
          </button>
        )}

        <div className="w-px h-8 bg-gray-600 mx-2"></div>
        <button
          onClick={handleLeave}
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
          title="종료"
        >
          <FiX size={20} />
          <span className="text-xs">종료</span>
        </button>
      </div>

      {/* 오디오 설정 모달 */}
      {showAudioSettings && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50 pointer-events-auto"
          onClick={() => setShowAudioSettings(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-[90vw] pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">오디오 설정</h3>
              <button
                onClick={() => setShowAudioSettings(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">에코 캔슬레이션</span>
                <input
                  type="checkbox"
                  checked={audioSettings.echoCancellation}
                  onChange={(e) => {
                    setAudioSettings({ ...audioSettings, echoCancellation: e.target.checked });
                  }}
                  className="rounded"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">노이즈 억제</span>
                <input
                  type="checkbox"
                  checked={audioSettings.noiseSuppression}
                  onChange={(e) => {
                    setAudioSettings({ ...audioSettings, noiseSuppression: e.target.checked });
                  }}
                  className="rounded"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">자동 게인 제어</span>
                <input
                  type="checkbox"
                  checked={audioSettings.autoGainControl}
                  onChange={(e) => {
                    setAudioSettings({ ...audioSettings, autoGainControl: e.target.checked });
                  }}
                  className="rounded"
                />
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAudioSettings(false);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  // 오디오 설정 적용
                  if (localStream) {
                    try {
                      const constraints: MediaStreamConstraints = {
                        audio: selectedAudioDevice ? {
                          deviceId: { exact: selectedAudioDevice },
                          echoCancellation: audioSettings.echoCancellation,
                          noiseSuppression: audioSettings.noiseSuppression,
                          autoGainControl: audioSettings.autoGainControl,
                        } : {
                          echoCancellation: audioSettings.echoCancellation,
                          noiseSuppression: audioSettings.noiseSuppression,
                          autoGainControl: audioSettings.autoGainControl,
                        },
                        video: selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : true,
                      };

                      const newStream = await navigator.mediaDevices.getUserMedia(constraints);

                      // WebRTC 피어 연결에 새 트랙 적용
                      const audioTrack = newStream.getAudioTracks()[0];
                      if (audioTrack) {
                        for (const [peerId, peerConnection] of peers.entries()) {
                          try {
                            const audioSender = peerConnection.getSenders().find(sender =>
                              sender.track && sender.track.kind === 'audio'
                            );
                            if (audioSender) {
                              await audioSender.replaceTrack(audioTrack);
                            } else {
                              peerConnection.addTrack(audioTrack, newStream);
                            }
                          } catch (error) {
                            console.error(`[VideoConference] Failed to update audio track for peer ${peerId}:`, error);
                          }
                        }
                      }

                      // 기존 스트림의 오디오 트랙 중지
                      const oldAudioTrack = localStream.getAudioTracks()[0];
                      if (oldAudioTrack) oldAudioTrack.stop();

                      // 새 스트림 설정
                      const videoTrack = localStream.getVideoTracks()[0];
                      if (videoTrack) {
                        newStream.addTrack(videoTrack);
                      }

                      setLocalStream(newStream);

                      // 비디오 요소 업데이트
                      if (localVideoRef) {
                        localVideoRef.srcObject = newStream;
                      }
                      if (localSmallVideoRef) {
                        localSmallVideoRef.srcObject = newStream;
                      }

                      showSuccess('오디오 설정이 적용되었습니다.');
                      setShowAudioSettings(false);
                    } catch (error: any) {
                      console.error('[VideoConference] Failed to apply audio settings:', error);
                      showError(`오디오 설정 적용에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
                    }
                  } else {
                    showError('미디어 스트림이 없습니다.');
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

