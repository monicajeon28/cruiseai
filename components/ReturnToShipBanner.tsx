'use client';

import { useEffect, useState } from 'react';
import { FiMapPin, FiAlertTriangle, FiClock } from 'react-icons/fi';
import { logger } from '@/lib/logger';

interface ReturnToShipBannerProps {
  tripId?: number;
}

/**
 * "배로 돌아가기" 카운트다운 배너
 * 기항 중(PortVisit)일 때만 표시됨
 */
export function ReturnToShipBanner({ tripId }: ReturnToShipBannerProps) {
  const [isActive, setIsActive] = useState(false);
  const [departureTime, setDepartureTime] = useState<string | null>(null);
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [locationName, setLocationName] = useState<string>('기항지');
  const [isLoading, setIsLoading] = useState(true);
  const [distance, setDistance] = useState<number | null>(null); // km
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null); // 예상 시간
  const [terminalCoords, setTerminalCoords] = useState<{ lat: number; lng: number } | null>(null);

  // GPS 위치 기반 거리/시간 계산
  useEffect(() => {
    if (!terminalCoords || !isActive) return;

    const updateDistanceAndTime = () => {
      if (!navigator.geolocation) {
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Haversine 공식으로 거리 계산 (km)
          const R = 6371; // 지구 반지름 (km)
          const dLat = (terminalCoords.lat - latitude) * Math.PI / 180;
          const dLon = (terminalCoords.lng - longitude) * Math.PI / 180;
          const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(latitude * Math.PI / 180) * Math.cos(terminalCoords.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const calculatedDistance = R * c;
          
          setDistance(calculatedDistance);
          
          // 예상 시간 계산 (도보: 5km/h, 택시: 30km/h 평균)
          // 도시 환경을 고려하여 평균 20km/h로 계산
          const avgSpeed = 20; // km/h
          const hours = calculatedDistance / avgSpeed;
          const minutes = Math.round(hours * 60);
          
          if (minutes < 60) {
            setEstimatedTime(`${minutes}분`);
          } else {
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            setEstimatedTime(`${h}시간 ${m}분`);
          }
        },
        (error) => {
          // GPS 오류는 조용히 처리 (거리 표시 안 함)
          console.warn('[ReturnToShip] GPS 위치 획득 실패:', error);
        },
        { timeout: 5000, maximumAge: 60000 } // 1분 캐시
      );
    };

    updateDistanceAndTime();
    const interval = setInterval(updateDistanceAndTime, 30000); // 30초마다 업데이트

    return () => clearInterval(interval);
  }, [terminalCoords, isActive]);

  // 카운트다운 타이머 업데이트
  useEffect(() => {
    if (!departureTime) return;

    const updateCountdown = () => {
      const now = new Date();
      const [hours, minutes] = departureTime.split(':').map(Number);
      
      const departure = new Date();
      departure.setHours(hours, minutes, 0, 0);

      // 출발 시간이 이미 지났다면 비활성화
      if (departure < now) {
        setIsActive(false);
        return;
      }

      const diff = departure.getTime() - now.getTime();
      const totalSeconds = Math.floor(diff / 1000);
      const remainingHours = Math.floor(totalSeconds / 3600);
      const remainingMinutes = Math.floor((totalSeconds % 3600) / 60);
      const remainingSeconds = totalSeconds % 60;

      // 시간 표시
      if (remainingHours > 0) {
        setRemainingTime(`${remainingHours}시간 ${remainingMinutes}분`);
      } else {
        setRemainingTime(`${remainingMinutes}분 ${remainingSeconds}초`);
      }

      // 1시간 미만이면 긴급 상태
      setIsUrgent(remainingHours < 1);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [departureTime]);

  // 현재 여행 상태 및 일정 조회
  useEffect(() => {
    const checkCurrentStatus = async () => {
      try {
        // 현재 진행 중인 여행 조회
        const activeTrip = await fetch('/api/trips/active').then(r => r.json());
        
        if (!activeTrip?.data?.id) {
          setIsActive(false);
          setIsLoading(false);
          return;
        }

        // 오늘 일정 조회
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const itinerariesRes = await fetch(
          `/api/trips/${activeTrip.data.id}/itineraries?date=${today.toISOString()}`
        ).then(r => r.json());

        const portVisit = itinerariesRes?.data?.find(
          (it: any) => it.type === 'PortVisit' && it.departure
        );

        if (portVisit) {
          setIsActive(true);
          setDepartureTime(portVisit.departure);
          setLocationName(portVisit.location || '기항지');
          
          // 터미널 좌표 조회
          try {
            const terminalRes = await fetch(
              `/api/terminals/search?location=${encodeURIComponent(portVisit.location || '기항지')}`
            ).then(r => r.json());
            
            const terminal = terminalRes?.data?.[0];
            if (terminal && terminal.latitude && terminal.longitude) {
              setTerminalCoords({
                lat: terminal.latitude,
                lng: terminal.longitude,
              });
            }
          } catch (error) {
            logger.error('[ReturnToShip] 터미널 좌표 조회 오류:', error);
          }
        } else {
          setIsActive(false);
        }
      } catch (error) {
        logger.error('[ReturnToShip] 상태 조회 오류:', error);
        setIsActive(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkCurrentStatus();
    const interval = setInterval(checkCurrentStatus, 60000); // 1분마다 확인

    return () => clearInterval(interval);
  }, []);

  const handleReturnToShip = async () => {
    try {
      // GPS 위치 획득
      if (!navigator.geolocation) {
        alert('이 기기에서는 위치 정보를 사용할 수 없습니다.\n\n직접 지도 앱을 사용하여 크루즈 터미널로 이동해 주세요.');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;

          // 터미널 위치 조회 (데이터에서 가져오기)
          try {
            const terminalRes = await fetch(
              `/api/terminals/search?location=${encodeURIComponent(locationName)}`
            ).then(r => r.json());

            const terminal = terminalRes?.data?.[0];
            if (terminal) {
              // Google Maps 네비게이션 URL
              const mapsUrl = `https://www.google.com/maps/dir/${latitude},${longitude}/${terminal.latitude},${terminal.longitude}`;
              window.open(mapsUrl, '_blank');
            } else {
              alert(`${locationName}의 크루즈 터미널 정보를 찾을 수 없습니다.\n\n직접 지도 앱에서 "${locationName} 크루즈 터미널"을 검색해 주세요.`);
            }
          } catch (error) {
            logger.error('[ReturnToShip] 터미널 검색 오류:', error);
            alert('길찾기 준비 중 문제가 발생했습니다.\n\n인터넷 연결을 확인하고 다시 시도해 주세요.');
          }
        },
        (error) => {
          logger.error('[ReturnToShip] GPS 오류:', error);
          let errorMessage = '위치 정보를 사용할 수 없습니다.\n\n';
          if (error.code === error.PERMISSION_DENIED) {
            errorMessage += '위치 권한이 거부되었습니다.\n브라우저 설정에서 위치 권한을 허용해 주세요.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errorMessage += '위치 정보를 가져올 수 없습니다.\nGPS가 켜져 있는지 확인해 주세요.';
          } else {
            errorMessage += '위치 정보 확인 중 문제가 발생했습니다.\n직접 지도 앱을 사용하여 크루즈 터미널로 이동해 주세요.';
          }
          alert(errorMessage);
        }
      );
    } catch (error) {
      logger.error('[ReturnToShip] 오류:', error);
      alert('길찾기 실행 중 문제가 발생했습니다.\n\n직접 지도 앱을 사용하여 크루즈 터미널로 이동해 주세요.');
    }
  };

  if (!isActive || isLoading) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isUrgent
          ? 'bg-gradient-to-r from-red-600 to-red-700'
          : 'bg-gradient-to-r from-orange-500 to-orange-600'
      } text-white px-4 py-4 sm:px-6`}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            {isUrgent ? (
              <FiAlertTriangle className="flex-shrink-0 animate-pulse" size={28} />
            ) : (
              <FiClock className="flex-shrink-0" size={28} />
            )}
            
            <div className="flex-1">
              <h3 className={`font-bold ${isUrgent ? 'text-lg' : 'text-base'} mb-1`}>
                {isUrgent
                  ? '⚠️ 출항 1시간 전! 지금 바로 배로 돌아오세요!'
                  : `🚢 ${locationName} 출항까지`}
              </h3>
              <div className="flex items-center gap-2 text-sm sm:text-base flex-wrap">
                <FiClock size={16} />
                <span className={`font-mono font-bold ${isUrgent ? 'text-lg' : ''}`}>
                  {remainingTime}
                </span>
                <span className="opacity-90">남음</span>
                {distance !== null && (
                  <>
                    <span className="opacity-70">•</span>
                    <span className="opacity-90">
                      약 {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`} 거리
                    </span>
                    {estimatedTime && (
                      <>
                        <span className="opacity-70">•</span>
                        <span className="opacity-90">예상 {estimatedTime}</span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleReturnToShip}
            className={`flex-shrink-0 px-6 py-3 rounded-lg font-bold transition-all duration-200 flex items-center gap-2 ${
              isUrgent
                ? 'bg-white text-red-600 hover:bg-red-50 shadow-lg'
                : 'bg-white text-orange-600 hover:bg-orange-50'
            }`}
          >
            <FiMapPin size={18} />
            <span className="hidden sm:inline">배로 돌아가기</span>
            <span className="sm:hidden">길찾기</span>
          </button>
        </div>

        {isUrgent && (
          <p className="text-xs mt-3 text-red-100 ml-10">
            💡 혹시 배를 놓칠까봐 걱정되신다면, 지금 바로 길찾기를 시작하세요!
          </p>
        )}
      </div>
    </div>
  );
}
