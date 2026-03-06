'use client';

import { logger } from '@/lib/logger';
import { showError, showWarning } from '@/components/ui/Toast';
import { useState, useEffect, useRef } from 'react';
import { FiChevronDown, FiChevronUp, FiMapPin, FiClock, FiSun, FiCalendar, FiPlus, FiX, FiBell, FiEdit2 } from 'react-icons/fi';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BriefingSkeleton } from '@/components/ui/Skeleton';
import { scheduleAlarm, removeAlarm, requestNotificationPermission } from '@/lib/notifications/scheduleAlarm';
import { formatDateK } from '@/lib/utils';
import type { WeatherResponse } from '@/lib/weather';

type BriefingData = {
  date: string;
  dayNumber: number;
  cruiseName: string | null;
  nights: number;
  days: number;
  startDate: string | null;
  endDate: string | null;
  tripNumber?: number | null; // 몇번째 여행
  tripId?: number | null; // 여행 ID (추가 버튼용)
  today: {
    location: string | null;
    country: string | null;
    type: string;
    arrival: string | null;
    departure: string | null;
    language: string | null;
    currency: string | null;
    notes: string | null;
  } | null;
  tomorrow: {
    location: string | null;
    country: string | null;
    type: string;
    arrival: string | null;
  } | null;
  dday: number;
  ddayType: 'departure' | 'return';
  weather: {
    temp: number | null;
    condition: string | null;
    icon: string | null;
    isDummyWeather?: boolean;
  } | null;
  weathers?: Array<{
    country: string;
    countryCode?: string;
    location: string | null;
    temp: number | null;
    condition: string | null;
    icon: string | null;
    time?: string;
    isDummyWeather?: boolean;
  }>;
};

type ScheduleItem = {
  id?: number; // 서버에서 받은 ID
  time: string;
  title: string;
  alarm: boolean;
  alarmTime?: string | null; // 알람 시간 (HH:MM 형식)
  date: string; // 날짜 (YYYY-MM-DD 형식)
};

export default function DailyBriefingCard() {
  const pathname = usePathname();
  const isTestMode = pathname?.includes('/chat-test') || 
                     pathname?.includes('/tools-test') || 
                     pathname?.includes('/translator-test') || 
                     pathname?.includes('/profile-test') ||
                     pathname?.includes('/checklist-test') ||
                     pathname?.includes('/wallet-test');
  
  const getProfileHref = () => {
    return isTestMode ? '/profile-test' : '/profile';
  };
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isAddingSchedule, setIsAddingSchedule] = useState(false); // 일정 추가 중 플래그
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null); // 수정 중인 일정
  const [editTime, setEditTime] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editAlarm, setEditAlarm] = useState(true);
  const [editAlarmTime, setEditAlarmTime] = useState('');
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [selectedWeatherData, setSelectedWeatherData] = useState<WeatherResponse | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [selectedWeatherCountry, setSelectedWeatherCountry] = useState<{
    country: string;
    countryCode?: string;
    location: string | null;
  } | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [tomorrowSchedules, setTomorrowSchedules] = useState<ScheduleItem[]>([]);
  const [scheduleViewMode, setScheduleViewMode] = useState<'today' | 'tomorrow'>('today'); // 오늘 또는 내일 보기 모드
  const [newScheduleTime, setNewScheduleTime] = useState('');
  const [newScheduleTitle, setNewScheduleTitle] = useState('');
  const [newScheduleAlarm, setNewScheduleAlarm] = useState(true);
  const [newScheduleAlarmTime, setNewScheduleAlarmTime] = useState(''); // 알람 시간 (HH:MM)
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<'today' | 'tomorrow'>('today'); // 오늘 또는 내일 선택
  const [ddayPopup, setDdayPopup] = useState<{ title: string; message: string } | null>(null); // D-day 팝업 상태
  const [user, setUser] = useState<{ name: string | null } | null>(null); // 사용자 정보
  const briefingDateRef = useRef<string | null>(null); // briefing.date 변경 추적용 (무한 리렌더링 방지)
  const schedulesRef = useRef<ScheduleItem[]>([]); // setInterval stale closure 방지용
  const [kstTime, setKstTime] = useState<string>(''); // 한국 시간 (KST)

  // 한국 시간 기준 날짜 생성 함수 (공통 함수로 분리)
  const getKSTDateString = (offsetDays = 0): string => {
    const now = new Date();
    // UTC 기준 시각에 +9시간 더한 후 UTC 날짜 필드로 읽기 (디바이스 시간대 무관)
    const kstMs = now.getTime() + 9 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000;
    const kstDate = new Date(kstMs);
    const year = kstDate.getUTCFullYear();
    const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(kstDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 브리핑 날짜 기준으로 내일 날짜 계산
  const getTomorrowDate = (dateStr: string): string => {
    try {
      let date: Date;
      
      // ISO 형식 (2025-11-04T15:00:00.000Z) 또는 YYYY-MM-DD 형식 모두 처리
      if (dateStr.includes('T')) {
        // ISO 형식인 경우
        date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid ISO date format: ${dateStr}`);
        }
      } else {
        // YYYY-MM-DD 형식인 경우
        const [year, month, day] = dateStr.split('-').map(Number);
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
          throw new Error(`Invalid date format: ${dateStr}`);
        }
        date = new Date(year, month - 1, day);
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date: ${dateStr}`);
        }
      }
      
      // 날짜를 YYYY-MM-DD 형식으로 변환 (시간 제거)
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + 1);
      const newYear = date.getFullYear();
      const newMonth = String(date.getMonth() + 1).padStart(2, '0');
      const newDay = String(date.getDate()).padStart(2, '0');
      return `${newYear}-${newMonth}-${newDay}`;
    } catch (error) {
      logger.error('[DailyBriefingCard] getTomorrowDate 오류:', error, { dateStr });
      throw error;
    }
  };

  // 알림 권한 요청 (컴포넌트 마운트 시)
  useEffect(() => {
    // 알림 권한 미리 요청
    if ('Notification' in window && Notification.permission === 'default') {
      requestNotificationPermission().then(hasPermission => {
        if (hasPermission) {
          logger.log('[DailyBriefingCard] 알림 권한이 허용되었습니다.');
        }
      });
    }
  }, []);

  // schedulesRef 동기화: setInterval stale closure 방지
  useEffect(() => { schedulesRef.current = schedules; }, [schedules]);

  // 한국 시간(KST) 초기화
  useEffect(() => {
    const updateKstTime = () => {
      const time = new Date().toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Seoul',
      });
      setKstTime(time);
    };
    updateKstTime();
    const timer = setInterval(updateKstTime, 60000); // 1분마다 갱신
    return () => clearInterval(timer);
  }, []);

  // 서버에서 일정 불러오기 함수 (공통 함수로 분리)
  const loadSchedules = async (date: string, type: 'today' | 'tomorrow') => {
    // type 인자로 오늘/내일 판단 (UTC 재계산 제거 → KST race condition 방지)
    const now = new Date();

    logger.log(`[DailyBriefingCard] loadSchedules 호출: date=${date}, type=${type}`);
    
    try {
      const response = await fetch(`/api/schedules?date=${date}`, {
        credentials: 'include',
      });
      
      logger.log(`[DailyBriefingCard] loadSchedules API 응답: status=${response.status}, date=${date}`);
      
      if (response.ok) {
        const data = await response.json();
        logger.log(`[DailyBriefingCard] loadSchedules API 데이터:`, data);
        
        if (data.ok && Array.isArray(data.schedules)) {
          const scheduleItems = data.schedules.map((s: any) => ({
            id: s.id,
            time: s.time,
            title: s.title,
            alarm: s.alarm,
            alarmTime: s.alarmTime || null,
            date: s.date,
          }));
          
          logger.log(`[DailyBriefingCard] loadSchedules 파싱된 일정:`, scheduleItems);
          
          // 현재 시간 기준으로 과거 일정 필터링 (핸드폰 시간 기준)
          const currentTime = now.getHours() * 60 + now.getMinutes(); // 분 단위로 변환

          const filterPastSchedules = (items: ScheduleItem[]) => {
            // type 인자로 오늘/내일 판단 (UTC 재계산 제거 → KST race condition 방지)
            if (type === 'today') {
              // 오늘 날짜면 현재 시간 이후 일정만 표시
              return items.filter((item) => {
                const [hours, minutes] = item.time.split(':').map(Number);
                const scheduleTime = hours * 60 + minutes;
                return scheduleTime >= currentTime;
              });
            } else if (type === 'tomorrow') {
              // 내일 날짜면 모든 일정 표시 (내일 일정은 시간이 지나도 표시)
              return items;
            }
            // 다른 경우 모든 일정 표시
            return items;
          };

          // type 인자로 오늘/내일 판단 (UTC 재계산 제거 → KST race condition 방지)
          if (type === 'today') {
            const filteredSchedules = filterPastSchedules(scheduleItems);
            logger.log(`[DailyBriefingCard] 오늘 일정 설정 (스마트폰 시간 기준):`, filteredSchedules.length, '개 (전체:', scheduleItems.length, '개)');

            // 과거 일정이 있으면 서버에서 삭제하고 알람도 제거
            const pastSchedules = scheduleItems.filter((item) => {
              const [hours, minutes] = item.time.split(':').map(Number);
              const scheduleTime = hours * 60 + minutes;
              return scheduleTime < currentTime;
            });

            // 과거 일정 삭제 및 알람 제거 (Promise.allSettled: 일부 실패해도 나머지 처리)
            await Promise.allSettled(
              pastSchedules.map(async (schedule) => {
                if (!schedule.id) return;
                try {
                  if (schedule.alarm) {
                    const alarmDateTime = schedule.alarmTime || schedule.time;
                    removeAlarm(date, alarmDateTime);
                    logger.log(`[DailyBriefingCard] 과거 일정 알람 제거:`, alarmDateTime, schedule.title);
                  }
                  await fetch(`/api/schedules?id=${schedule.id}`, {
                    method: 'DELETE',
                    credentials: 'include',
                  });
                  logger.log(`[DailyBriefingCard] 과거 일정 삭제:`, schedule.id, schedule.time);
                } catch (error) {
                  logger.error(`[DailyBriefingCard] 과거 일정 삭제 실패:`, error);
                }
              })
            );

            setSchedules(filteredSchedules);
            // 저장된 일정의 알람 재설정 (오늘 일정, 미래 일정만)
            await Promise.allSettled(
              filteredSchedules.map(async (schedule: ScheduleItem) => {
                if (!schedule.alarm || !schedule.alarmTime) return;
                try {
                  const alarmDateTime = schedule.alarmTime || schedule.time;
                  await scheduleAlarm(date, alarmDateTime, schedule.title);
                } catch (alarmError) {
                  logger.error('[DailyBriefingCard] 알람 재설정 실패:', alarmError, { date, alarmTime: schedule.alarmTime });
                }
              })
            );
          } else if (type === 'tomorrow') {
            // 내일 일정은 모든 일정 표시 (시간이 지나도 표시)
            logger.log(`[DailyBriefingCard] 내일 일정 설정 (스마트폰 시간 기준):`, scheduleItems.length, '개');

            setTomorrowSchedules(scheduleItems);
            // 저장된 일정의 알람 재설정 (내일 일정)
            await Promise.allSettled(
              scheduleItems.map(async (schedule: ScheduleItem) => {
                if (!schedule.alarm || !schedule.alarmTime) return;
                try {
                  const alarmDateTime = schedule.alarmTime || schedule.time;
                  await scheduleAlarm(date, alarmDateTime, schedule.title);
                } catch (alarmError) {
                  logger.error('[DailyBriefingCard] 알람 재설정 실패:', alarmError, { date, alarmTime: schedule.alarmTime });
                }
              })
            );
          }
          return scheduleItems;
        } else {
          logger.warn(`[DailyBriefingCard] loadSchedules 응답 형식 오류:`, data);
        }
      } else {
        logger.error(`[DailyBriefingCard] loadSchedules API 실패: status=${response.status}`);
      }
    } catch (error) {
      logger.error(`[DailyBriefingCard] Error loading schedules for ${date}:`, error);
      // 서버 실패 시 localStorage 백업 시도 (마이그레이션용)
      const savedSchedules = localStorage.getItem(`dailySchedules-${date}`);
      if (savedSchedules) {
        try {
          const parsed = JSON.parse(savedSchedules);
          const scheduleItems = Array.isArray(parsed)
            ? parsed.filter((s: ScheduleItem) => !s.date || s.date === date)
            : [];
          if (type === 'today') {
            setSchedules(scheduleItems);
          } else if (type === 'tomorrow') {
            setTomorrowSchedules(scheduleItems);
          }
          return scheduleItems;
        } catch (e) {
          logger.error('Error parsing localStorage backup:', e);
        }
      }
    }
    return [];
  };

  // 사용자 정보 불러오기
  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch('/api/user/profile', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setUser({ name: data.user?.name || data.data?.name || null });
        }
      } catch (error) {
        logger.error('[DailyBriefingCard] 사용자 정보 로드 실패:', error);
      }
    };
    loadUser();
  }, []);

  // D-day 팝업 표시 로직
  useEffect(() => {
    if (!briefing || !user) {
      logger.log('[DailyBriefingCard] D-day 팝업 체크: briefing 또는 user 없음', { briefing: !!briefing, user: !!user });
      return;
    }

    // D-day 키 생성 (페이지 진입 시마다 한 번씩 표시)
    let ddayKey: string | null = null;

    logger.log('[DailyBriefingCard] D-day 팝업 체크:', { dday: briefing.dday, ddayType: briefing.ddayType });

    // 출발일 기준 D-day 팝업
    if (briefing.ddayType === 'departure' && briefing.dday >= 0) {
      const validDdays = [0, 1, 2, 3, 7, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      if (validDdays.includes(briefing.dday)) {
        ddayKey = String(briefing.dday);
        logger.log('[DailyBriefingCard] D-day 팝업: 출발일 기준', { ddayKey });
      } else {
        logger.log('[DailyBriefingCard] D-day 팝업: 유효하지 않은 D-day', { dday: briefing.dday, validDdays });
        return;
      }
    } 
    // 종료일 기준 D-day 팝업 (종료일 하루 전 D-1, 종료일 D-0)
    else if (briefing.ddayType === 'return' && (briefing.dday === 0 || briefing.dday === 1)) {
      if (briefing.dday === 1) {
        ddayKey = 'end_1'; // 종료일 하루 전
        logger.log('[DailyBriefingCard] D-day 팝업: 종료일 하루 전', { ddayKey });
      } else if (briefing.dday === 0) {
        ddayKey = 'end_0'; // 종료일
        logger.log('[DailyBriefingCard] D-day 팝업: 종료일', { ddayKey });
      }
    } else {
      logger.log('[DailyBriefingCard] D-day 팝업: 표시할 D-day 없음', { dday: briefing.dday, ddayType: briefing.ddayType });
      return;
    }

    if (!ddayKey) {
      logger.log('[DailyBriefingCard] D-day 팝업: ddayKey 없음');
      return;
    }
    
    // 페이지 경로 기반 localStorage 키 생성 (페이지 진입 시마다 한 번씩 표시)
    const pageKey = pathname || '/chat';
    const localStorageKey = `dday_popup_${pageKey}_${ddayKey}`;
    
    // 이전에 표시한 페이지 경로 확인
    const lastShownPage = localStorage.getItem(`dday_popup_last_page_${ddayKey}`);
    
    // 이미 이 페이지에서 표시했는지 확인
    const alreadyShown = localStorage.getItem(localStorageKey);
    
    // 다른 페이지에서 왔거나, 이 페이지에서 아직 표시하지 않았으면 표시
    if (alreadyShown && lastShownPage === pageKey) {
      logger.log('[DailyBriefingCard] D-day 팝업: 이미 이 페이지에서 표시됨', { localStorageKey, lastShownPage, pageKey });
      return;
    }
    
    // 이전 페이지 키가 다르면 이 페이지의 키 초기화 (다른 페이지에서 돌아왔으므로 다시 표시)
    if (lastShownPage && lastShownPage !== pageKey) {
      localStorage.removeItem(`dday_popup_${lastShownPage}_${ddayKey}`);
      logger.log('[DailyBriefingCard] D-day 팝업: 다른 페이지에서 돌아옴, 이전 페이지 키 초기화', { lastShownPage, pageKey });
    }
    
    logger.log('[DailyBriefingCard] D-day 팝업: 메시지 로드 시작 (페이지 진입 시마다 한 번씩 표시)', { ddayKey, localStorageKey });

    // D-day 메시지 불러오기
    (async () => {
      try {
        logger.log('[DailyBriefingCard] D-day 메시지 파일 요청:', '/data/dday_messages.json');
        const response = await fetch('/data/dday_messages.json', { cache: 'no-store' });
        if (!response.ok) {
          logger.error('[DailyBriefingCard] D-day 메시지 파일 로드 실패:', response.status, response.statusText);
          return;
        }
        
        const data = await response.json();
        logger.log('[DailyBriefingCard] D-day 메시지 데이터:', { ddayKey, availableKeys: Object.keys(data.messages || {}) });
        const ddayMessage = data.messages?.[ddayKey];
        
        if (!ddayMessage) {
          logger.warn('[DailyBriefingCard] D-day 메시지 없음:', { ddayKey, availableKeys: Object.keys(data.messages || {}) });
          return;
        }

        logger.log('[DailyBriefingCard] D-day 메시지 찾음:', ddayMessage);

        // 메시지 변수 치환 (XSS 방지: 사용자 데이터 HTML 이스케이프)
        const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const fillMessage = (text: string) => {
          return (text || '')
            .replaceAll('[고객명]', escHtml(user.name || '고객'))
            .replaceAll('[크루즈명]', escHtml(briefing.cruiseName || '크루즈'))
            .replaceAll('[목적지]', escHtml(briefing.today?.country || briefing.tomorrow?.country || '목적지'));
        };

        const title = fillMessage(ddayMessage.title);
        const message = fillMessage(ddayMessage.message);

        logger.log('[DailyBriefingCard] D-day 팝업 표시 (페이지 진입 시마다 한 번씩):', { title, message: message.substring(0, 50) + '...' });
        setDdayPopup({ title, message });
        
        // 이 페이지에서 표시했음을 localStorage에 저장
        localStorage.setItem(localStorageKey, '1');
        localStorage.setItem(`dday_popup_last_page_${ddayKey}`, pageKey);

        // D-day 알람 설정: 매일 오전 8시에 알람 설정 (출발일 기준 및 종료일 기준 모두)
        const setupDdayAlarm = async () => {
          const hasPermission = await requestNotificationPermission();
          if (!hasPermission) {
            logger.log('[DailyBriefingCard] 알람 권한이 없어 D-day 알람을 설정할 수 없습니다.');
            return;
          }

          // 오늘 날짜 가져오기 (KST 기준)
          const todayStr = getKSTDateString(0);
          const tomorrowStr = getKSTDateString(1);
          
          // D-day 알람 키 (중복 방지)
          const todayAlarmKey = `dday-alarm-${ddayKey}-${todayStr}`;
          const tomorrowAlarmKey = `dday-alarm-${ddayKey}-${tomorrowStr}`;
          
          // 오늘 알람이 이미 설정되었는지 확인
          const todayAlarmSet = localStorage.getItem(todayAlarmKey);
          const tomorrowAlarmSet = localStorage.getItem(tomorrowAlarmKey);
          
          const alarmTime = '08:00';
          // 알람 제목 설정 (종료일 메시지는 별도 제목 사용)
          const alarmTitle = briefing.ddayType === 'return' 
            ? title // 종료일 메시지는 원본 제목 사용
            : `D-${ddayKey} ${title}`; // 출발일 메시지는 D-{숫자} 형식
          
          // scheduleAlarm 함수 import
          const { scheduleAlarm } = await import('@/lib/notifications/scheduleAlarm');
          
          // 오늘 알람 설정 (아직 설정하지 않았으면)
          if (!todayAlarmSet) {
            try {
              const success = await scheduleAlarm(todayStr, alarmTime, alarmTitle);
              if (success) {
                localStorage.setItem(todayAlarmKey, '1');
                logger.log('[DailyBriefingCard] 오늘 D-day 알람 설정 완료:', { ddayKey, ddayType: briefing.ddayType, date: todayStr, alarmTime });
              }
            } catch (error) {
              logger.error('[DailyBriefingCard] 오늘 D-day 알람 설정 실패:', error);
            }
          }
          
          // 내일 알람 설정 (아직 설정하지 않았으면)
          if (!tomorrowAlarmSet) {
            try {
              const success = await scheduleAlarm(tomorrowStr, alarmTime, alarmTitle);
              if (success) {
                localStorage.setItem(tomorrowAlarmKey, '1');
                logger.log('[DailyBriefingCard] 내일 D-day 알람 설정 완료:', { ddayKey, ddayType: briefing.ddayType, date: tomorrowStr, alarmTime });
              }
            } catch (error) {
              logger.error('[DailyBriefingCard] 내일 D-day 알람 설정 실패:', error);
            }
          }
        };

        // D-day 알람 설정 실행 (출발일 기준 및 종료일 기준 모두)
        await setupDdayAlarm();
      } catch (error) {
        logger.error('[DailyBriefingCard] D-day 메시지 로드 실패:', error);
      }
    })();
  }, [briefing, user, pathname]);

  // 브리핑 및 일정 불러오기 함수
  const loadAllData = async () => {
    // 브리핑 불러오기
    const loadBriefing = async () => {
      try {
        const response = await fetch('/api/briefing/today', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.hasTrip && data.briefing) {
            setBriefing(data.briefing);
          } else {
            logger.warn('[DailyBriefingCard] 브리핑을 표시할 수 없음:', {
              ok: data.ok,
              hasTrip: data.hasTrip,
              message: data.message,
            });
          }
        } else {
          logger.error('[DailyBriefingCard] 브리핑 API 오류:', response.status, response.statusText);
        }
      } catch (error) {
        logger.error('Error loading briefing:', error);
      } finally {
        setIsLoading(false);
      }
    };

    await loadBriefing();

    // 브리핑이 로드된 후에 일정 불러오기 (브리핑 날짜 기준)
    // loadBriefing 내부에서 setBriefing을 하므로, 여기서는 briefing 상태를 직접 사용할 수 없음
    // 대신 useEffect에서 briefing이 변경될 때 일정을 불러오도록 함
  };

  // 날짜를 YYYY-MM-DD 형식으로 정규화하는 함수
  const normalizeDate = (dateStr: string): string => {
    if (!dateStr) return '';
    
    // ISO 형식 (2025-11-04T15:00:00.000Z)인 경우
    if (dateStr.includes('T')) {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        logger.error('[DailyBriefingCard] normalizeDate: Invalid ISO date:', dateStr);
        return dateStr; // 원본 반환
      }
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // 이미 YYYY-MM-DD 형식인 경우
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // 형식이 맞지 않는 경우 원본 반환
    logger.warn('[DailyBriefingCard] normalizeDate: Unknown date format:', dateStr);
    return dateStr;
  };

  // 시간에서 30분 빼기 함수 (HH:MM 형식)
  const subtract30Minutes = (timeStr: string): string | null => {
    if (!timeStr || !timeStr.includes(':')) return null;
    try {
      const [hours, minutes] = timeStr.split(':').map(Number);
      let totalMinutes = hours * 60 + minutes - 30;
      if (totalMinutes < 0) {
        // 전날로 넘어가는 경우 처리
        totalMinutes += 24 * 60; // 24시간 추가
      }
      const newHours = Math.floor(totalMinutes / 60) % 24;
      const newMinutes = totalMinutes % 60;
      return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
    } catch (error) {
      logger.error('[DailyBriefingCard] 시간 계산 오류:', error);
      return null;
    }
  };

  // 일정 추가 모달이 열릴 때 현재 보기 모드에 따라 날짜 자동 설정
  useEffect(() => {
    if (showScheduleModal) {
      // 모달이 열릴 때 현재 보기 모드에 따라 날짜 자동 설정
      setSelectedScheduleDate(scheduleViewMode);
      logger.log('[DailyBriefingCard] 일정 추가 모달 열림, 날짜 자동 설정:', scheduleViewMode);
    }
  }, [showScheduleModal, scheduleViewMode]);

  // 브리핑이 변경될 때 일정 불러오기 및 내일 예정 알람 설정 (스마트폰 현재 시간 기준)
  // briefing.date만 의존성으로 사용하여 무한 리렌더링 방지
  useEffect(() => {
    if (!briefing || !briefing.date) return;

    // briefing.date가 실제로 변경되었는지 확인
    const currentDate = briefing.date;
    if (briefingDateRef.current === currentDate) {
      // 날짜가 변경되지 않았으면 실행하지 않음 (무한 리렌더링 방지)
      return;
    }
    
    // 날짜가 변경되었으면 ref 업데이트
    briefingDateRef.current = currentDate;

    // KST 기준으로 오늘/내일 날짜 계산
    const todayStr = getKSTDateString(0);
    const tomorrowStr = getKSTDateString(1);

    logger.log('[DailyBriefingCard] 스마트폰 시간 기준 일정 불러오기:', { todayStr, tomorrowStr });

    // 스마트폰 현재 시간 기준으로 일정 불러오기
    loadSchedules(todayStr, 'today').then(() => {
      logger.log('[DailyBriefingCard] 오늘 일정 불러오기 완료');
    });
    loadSchedules(tomorrowStr, 'tomorrow').then(() => {
      logger.log('[DailyBriefingCard] 내일 일정 불러오기 완료');
    });

    // 내일 예정 정보가 있으면 알람 자동 설정
    const setupTomorrowAlarms = async () => {
      if (!briefing.tomorrow || !briefing.tomorrow.arrival) {
        logger.log('[DailyBriefingCard] 내일 예정 정보가 없어 알람을 설정하지 않습니다.');
        return;
      }

      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        logger.log('[DailyBriefingCard] 알림 권한이 없어 내일 예정 알람을 설정할 수 없습니다.');
        return;
      }

      const tomorrowLocation = briefing.tomorrow.location || '항구';
      const tomorrowCountry = briefing.tomorrow.country || '';
      const arrivalTime = briefing.tomorrow.arrival;

      // 1. 입항 30분 전 알람 설정
      const alarm30MinBefore = subtract30Minutes(arrivalTime);
      if (alarm30MinBefore) {
        const alarmKey30Min = `tomorrow-arrival-30min-${tomorrowStr}`;
        const existingAlarm30Min = localStorage.getItem(alarmKey30Min);
        
        if (!existingAlarm30Min || existingAlarm30Min !== tomorrowStr) {
          try {
            const alarmTitle30Min = `🚢 ${tomorrowLocation}${tomorrowCountry ? ` (${tomorrowCountry})` : ''} 입항 30분 전!`;
            const success = await scheduleAlarm(tomorrowStr, alarm30MinBefore, alarmTitle30Min);
            if (success) {
              localStorage.setItem(alarmKey30Min, tomorrowStr);
              logger.log('[DailyBriefingCard] 입항 30분 전 알람 설정 완료:', { 
                date: tomorrowStr, 
                time: alarm30MinBefore,
                arrivalTime,
                location: tomorrowLocation 
              });
            }
          } catch (error) {
            logger.error('[DailyBriefingCard] 입항 30분 전 알람 설정 실패:', error);
          }
        }
      }

      // 2. 1일 전 알람 설정 (오늘 저녁 8시 또는 적절한 시간에)
      const alarmKey1Day = `tomorrow-arrival-1day-${tomorrowStr}`;
      const existingAlarm1Day = localStorage.getItem(alarmKey1Day);
      
      if (!existingAlarm1Day || existingAlarm1Day !== tomorrowStr) {
        try {
          // 오늘 날짜, 저녁 8시에 알람 설정
          const alarmTime1Day = '20:00';
          const alarmTitle1Day = `📅 내일 예정: ${tomorrowLocation}${tomorrowCountry ? ` (${tomorrowCountry})` : ''} 입항 ${arrivalTime}`;
          const success = await scheduleAlarm(todayStr, alarmTime1Day, alarmTitle1Day);
          if (success) {
            localStorage.setItem(alarmKey1Day, tomorrowStr);
            logger.log('[DailyBriefingCard] 1일 전 알람 설정 완료:', { 
              date: todayStr, 
              time: alarmTime1Day,
              tomorrowLocation,
              arrivalTime 
            });
          }
        } catch (error) {
          logger.error('[DailyBriefingCard] 1일 전 알람 설정 실패:', error);
        }
      }
    };

    // 내일 예정 알람 설정 (unhandled rejection 방지)
    setupTomorrowAlarms().catch(error => {
      logger.error('[DailyBriefingCard] 내일 예정 알람 설정 실패:', error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefing?.date, briefing?.tomorrow]); // briefing.date와 briefing.tomorrow를 의존성으로 사용

  useEffect(() => {
    loadAllData();

    // localStorage에서 서버로 마이그레이션 (한 번만 실행)
    const migrateFromLocalStorage = async () => {
      const allKeys = Object.keys(localStorage);
      const scheduleKeys = allKeys.filter(key => key.startsWith('dailySchedules-'));
      
      if (scheduleKeys.length === 0) return;
      
      logger.log('[DailyBriefingCard] localStorage에서 서버로 마이그레이션 시작...');
      
      for (const key of scheduleKeys) {
        try {
          const saved = localStorage.getItem(key);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              // 각 일정을 서버에 저장
              for (const schedule of parsed) {
                try {
                  await fetch('/api/schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      time: schedule.time,
                      title: schedule.title,
                      alarm: schedule.alarm ?? false,
                      date: schedule.date || key.replace('dailySchedules-', ''),
                    }),
                  });
                } catch (error) {
                  logger.error('Error migrating schedule:', error);
                }
              }
            }
          }
          // 마이그레이션 후 localStorage 키 삭제
          localStorage.removeItem(key);
        } catch (error) {
          logger.error(`Error migrating key ${key}:`, error);
        }
      }
      
      logger.log('[DailyBriefingCard] 마이그레이션 완료');
    };
    
    // 마이그레이션 실행 (한 번만)
    const migrationKey = 'schedules-migrated-to-server';
    if (!localStorage.getItem(migrationKey)) {
      migrateFromLocalStorage().then(() => {
        localStorage.setItem(migrationKey, 'true');
      });
    }

    // 알림 권한은 상단 useEffect에서 처리

    // 페이지가 다시 보일 때 일정 다시 불러오기 및 필터링 (탭 전환, 창 이동 등)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && briefingDateRef.current) {
        logger.log('[DailyBriefingCard] 페이지가 다시 보임, 일정 다시 불러오기 및 필터링');
        // KST 기준으로 일정 불러오기
        const todayStr = getKSTDateString(0);
        const tomorrowStr = getKSTDateString(1);
        loadSchedules(todayStr, 'today');
        loadSchedules(tomorrowStr, 'tomorrow');
      }
    };

    // 포커스 이벤트 (페이지 전환 후 돌아올 때)
    const handleFocus = () => {
      if (briefingDateRef.current) {
        logger.log('[DailyBriefingCard] 페이지 포커스, 일정 다시 불러오기 및 필터링');
        // KST 기준으로 일정 불러오기
        const todayStr = getKSTDateString(0);
        const tomorrowStr = getKSTDateString(1);
        loadSchedules(todayStr, 'today');
        loadSchedules(tomorrowStr, 'tomorrow');
      }
    };

    // 주기적으로 일정 필터링 및 자정 경과 체크 (1분마다)
    // briefingDateRef.current 사용: stale closure 방지 (useEffect []에서 briefing state 참조 금지)
    const filterInterval = setInterval(() => {
      const currentBriefingDate = briefingDateRef.current; // ref로 최신 값 참조
      if (currentBriefingDate) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const todayStr = getKSTDateString(0);
        const tomorrowStr = getKSTDateString(1);

        // 오늘 일정 필터링 (schedulesRef: stale closure 방지)
        const currentSchedules = schedulesRef.current;
        const filtered = currentSchedules.filter((schedule) => {
          const [hours, minutes] = schedule.time.split(':').map(Number);
          const scheduleTime = hours * 60 + minutes;
          return scheduleTime >= currentTime;
        });

        // 필터링된 일정과 현재 일정이 다르면 업데이트
        if (filtered.length !== currentSchedules.length) {
          logger.log('[DailyBriefingCard] 오늘 일정 자동 필터링:', filtered.length, '개 (전체:', currentSchedules.length, '개)');
          setSchedules(filtered);

          // 과거 일정 삭제 및 알람 제거 (Promise.allSettled: 병렬 + 일부 실패 허용)
          Promise.allSettled(
            currentSchedules.map(async (schedule) => {
              const [hours, minutes] = schedule.time.split(':').map(Number);
              const scheduleTime = hours * 60 + minutes;
              if (scheduleTime >= currentTime || !schedule.id) return;
              try {
                if (schedule.alarm) {
                  const alarmDateTime = schedule.alarmTime || schedule.time;
                  removeAlarm(todayStr, alarmDateTime);
                  logger.log(`[DailyBriefingCard] 과거 일정 알람 자동 제거:`, alarmDateTime, schedule.title);
                }
                await fetch(`/api/schedules?id=${schedule.id}`, {
                  method: 'DELETE',
                  credentials: 'include',
                });
                logger.log(`[DailyBriefingCard] 과거 일정 자동 삭제:`, schedule.id, schedule.time);
              } catch (error) {
                logger.error(`[DailyBriefingCard] 과거 일정 삭제 실패:`, error);
              }
            })
          );
        }
        
        // 자정 경과 체크: 날짜가 변경되었는지 확인
        // 이전 날짜를 저장해두고 비교하여 자정 경과 감지
        const lastCheckedDate = localStorage.getItem('lastCheckedDate');
        if (lastCheckedDate && lastCheckedDate !== todayStr) {
          logger.log('[DailyBriefingCard] 자정 경과 감지! 일정 다시 불러오기:', { lastCheckedDate, todayStr });
          // 자정이 지나면 일정 다시 불러오기 (내일 일정이 오늘 일정이 됨)
          // 오늘 날짜로 일정 불러오기 (이전 내일 일정이 오늘 일정으로 표시됨)
          loadSchedules(todayStr, 'today').then(() => {
            logger.log('[DailyBriefingCard] 자정 경과 후 오늘 일정 불러오기 완료');
          });
          // 새로운 내일 날짜로 일정 불러오기
          loadSchedules(tomorrowStr, 'tomorrow').then(() => {
            logger.log('[DailyBriefingCard] 자정 경과 후 내일 일정 불러오기 완료');
          });
          // 보기 모드를 오늘로 자동 전환 (내일 일정이 오늘로 이동했으므로)
          setScheduleViewMode('today');
          logger.log('[DailyBriefingCard] 자정 경과로 인해 보기 모드를 오늘로 자동 전환');
        }
        localStorage.setItem('lastCheckedDate', todayStr);
      }
    }, 60000); // 1분마다 체크

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(filterInterval);
    };
  }, []);

  const handleAddSchedule = async (): Promise<boolean> => {
    // 중복 클릭 방지
    if (isAddingSchedule) {
      logger.warn('[DailyBriefingCard] 일정 추가 중복 클릭 방지');
      return false;
    }

    setIsAddingSchedule(true);

    try {
      // 세션 확인 (API 호출 전에 미리 확인)
      try {
        const sessionCheck = await fetch('/api/user/profile', { credentials: 'include' });
        if (!sessionCheck.ok) {
          throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
        }
      } catch (sessionError) {
        logger.error('[DailyBriefingCard] 세션 확인 실패:', sessionError);
        showError('로그인 상태를 확인할 수 없습니다. 다시 로그인해주세요.');
        setIsAddingSchedule(false);
        return false;
      }

      if (!newScheduleTime || !newScheduleTitle) {
        showError('시간과 일정을 모두 입력해주세요.');
        setIsAddingSchedule(false);
        return false;
      }

      // 알람이 켜져 있으면 알람 시간도 필수
      if (newScheduleAlarm && !newScheduleAlarmTime) {
        showError('알람 시간을 입력해주세요.');
        setIsAddingSchedule(false);
        return false;
      }

      // 브리핑이 없으면 에러
      if (!briefing || !briefing.date) {
        showWarning('브리핑 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
        setIsAddingSchedule(false);
        return false;
      }

      // KST 기준으로 날짜 결정
      let targetDate: string;
      try {
        const todayStr = getKSTDateString(0);

        // 날짜 형식 검증 (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(todayStr)) {
          throw new Error(`날짜 형식이 올바르지 않습니다: ${todayStr}`);
        }

        if (selectedScheduleDate === 'today') {
          targetDate = todayStr;
        } else {
          targetDate = getKSTDateString(1);
        }
      } catch (error) {
        logger.error('[DailyBriefingCard] 날짜 계산 오류:', error);
        const errorMessage = error instanceof Error ? error.message : '날짜 계산 중 오류가 발생했습니다';
        showError(`일정 추가에 실패했습니다: ${errorMessage}`);
        setIsAddingSchedule(false);
        return false;
      }

      logger.log('[DailyBriefingCard] 일정 추가 시도:', {
        time: newScheduleTime,
        title: newScheduleTitle,
        alarm: newScheduleAlarm,
        alarmTime: newScheduleAlarmTime,
        date: targetDate,
        selectedScheduleDate,
      });

      // 서버에 일정 저장 (타임아웃 10초)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃
      
      let response;
      try {
        response = await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({
            time: newScheduleTime,
            title: newScheduleTitle,
            alarm: newScheduleAlarm,
            alarmTime: newScheduleAlarm ? newScheduleAlarmTime : null,
            date: targetDate,
          }),
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('요청 시간이 초과되었습니다. 네트워크 연결을 확인하고 다시 시도해주세요.');
        }
        throw new Error(`네트워크 오류: ${fetchError.message || '알 수 없는 오류'}`);
      }

      logger.log('[DailyBriefingCard] API 응답 상태:', response.status, response.statusText);

      // 응답 본문 읽기 (에러든 성공이든)
      let data;
      try {
        const text = await response.text();
        logger.log('[DailyBriefingCard] API 응답 본문 (raw):', text);
        data = JSON.parse(text);
      } catch (parseError) {
        logger.error('[DailyBriefingCard] 응답 파싱 실패:', parseError);
        throw new Error(`서버 응답을 읽을 수 없습니다 (HTTP ${response.status})`);
      }

      logger.log('[DailyBriefingCard] API 응답 데이터:', data);

      if (!response.ok) {
        logger.error('[DailyBriefingCard] API 에러:', {
          status: response.status,
          statusText: response.statusText,
          data,
        });
        const errorMessage = data?.error || data?.details || `HTTP ${response.status}: 일정 저장 실패`;
        throw new Error(errorMessage);
      }

      if (data.ok && data.schedule) {
        logger.log('[DailyBriefingCard] 일정 추가 성공, 서버에서 다시 불러오기');
        
        // KST 기준으로 일정 다시 불러오기
        if (!briefing || !briefing.date) {
          logger.error('[DailyBriefingCard] 브리핑 정보 없음, 일정 불러오기 건너뜀');
        } else {
          const todayStr = getKSTDateString(0);

          try {
            // 선택된 날짜에 따라 해당 날짜의 일정만 다시 불러오기
            if (selectedScheduleDate === 'today') {
              logger.log('[DailyBriefingCard] 오늘 일정 다시 불러오기 (KST 기준):', todayStr);
              await loadSchedules(todayStr, 'today');
              // 알람 설정 (웹 알림) - 오늘 일정
              if (newScheduleAlarm && newScheduleAlarmTime) {
                try {
                  await scheduleAlarm(todayStr, newScheduleAlarmTime, newScheduleTitle);
                } catch (alarmError) {
                  logger.error('[DailyBriefingCard] 알람 설정 실패:', alarmError);
                  // 알람 설정 실패해도 일정은 저장되었으므로 계속 진행
                }
              }
            } else {
              try {
                const tomorrowStr = getKSTDateString(1);
                logger.log('[DailyBriefingCard] 내일 일정 다시 불러오기 (KST 기준):', tomorrowStr);
                await loadSchedules(tomorrowStr, 'tomorrow');
                // 알람 설정 (웹 알림) - 내일 일정
                if (newScheduleAlarm && newScheduleAlarmTime) {
                  try {
                    await scheduleAlarm(tomorrowStr, newScheduleAlarmTime, newScheduleTitle);
                  } catch (alarmError) {
                    logger.error('[DailyBriefingCard] 알람 설정 실패:', alarmError);
                    // 알람 설정 실패해도 일정은 저장되었으므로 계속 진행
                  }
                }
              } catch (tomorrowError) {
                logger.error('[DailyBriefingCard] 내일 날짜 계산 실패:', tomorrowError);
                // 내일 날짜 계산 실패해도 계속 진행
              }
            }
          } catch (loadError) {
            logger.error('[DailyBriefingCard] 일정 불러오기 실패 (일정은 저장됨):', loadError);
            // 일정은 저장되었으므로 에러를 무시하고 계속 진행
          }
        }

        // 입력 필드 초기화
        setNewScheduleTime('');
        setNewScheduleTitle('');
        setNewScheduleAlarm(true);
        setNewScheduleAlarmTime('');
        // 현재 보기 모드에 맞게 날짜 유지 (오늘 탭이면 오늘, 내일 탭이면 내일)
        setSelectedScheduleDate(scheduleViewMode);
        
        // 모달 닫기
        setShowScheduleModal(false);
        
        logger.log('[DailyBriefingCard] 일정 추가 완료');
        setIsAddingSchedule(false);
        return true; // 성공
      } else {
        logger.error('[DailyBriefingCard] 응답 데이터 형식 오류:', data);
        showWarning('일정이 추가되었지만 응답 형식이 올바르지 않습니다.');
        setIsAddingSchedule(false);
        return false;
      }
    } catch (error) {
      logger.error('[DailyBriefingCard] Error adding schedule:', error);
      logger.error('[DailyBriefingCard] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      showError(`일정 추가에 실패했습니다. 다시 시도해주세요.`);
      setIsAddingSchedule(false);
      return false;
    } finally {
      setIsAddingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (schedule: ScheduleItem, isToday: boolean) => {
    if (!schedule.id) {
      logger.error('Schedule ID not found');
      return;
    }

    try {
      const response = await fetch(`/api/schedules?id=${schedule.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json().catch(() => ({}));
      
      // 404는 이미 삭제된 것으로 간주하고 성공 처리
      if (!response.ok && response.status !== 404) {
        throw new Error(data.error || '일정 삭제 실패');
      }
      
      // 성공 또는 이미 삭제된 경우 (404도 성공으로 처리)
      if (response.ok || response.status === 404) {
        logger.log('[DailyBriefingCard] 일정 삭제 성공:', schedule.id);
      }

      // 서버에서 최신 일정 다시 불러오기 (KST 기준)
      const todayStr = getKSTDateString(0);
      const tomorrowStr = getKSTDateString(1);

      // 알림도 제거
      if (schedule.alarm) {
        const targetDate = isToday ? todayStr : tomorrowStr;
        // alarmTime이 있으면 그 시간으로 제거, 없으면 일정 시간으로 제거
        const alarmDateTime = schedule.alarmTime || schedule.time;
        removeAlarm(targetDate, alarmDateTime);
      }
      
      if (isToday) {
        await loadSchedules(todayStr, 'today');
      } else {
        await loadSchedules(tomorrowStr, 'tomorrow');
      }
    } catch (error) {
      logger.error('Error deleting schedule:', error);
      showError('일정 삭제에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleEditSchedule = async () => {
    if (!editingSchedule?.id) return;
    if (!editTime || !editTitle.trim()) {
      showWarning('시간과 제목을 모두 입력해주세요.');
      return;
    }

    setIsEditingSchedule(true);
    try {
      const response = await fetch('/api/schedules', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingSchedule.id,
          time: editTime,
          title: editTitle.trim(),
          alarm: editAlarm,
          alarmTime: editAlarm && editAlarmTime ? editAlarmTime : null,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '일정 수정 실패');

      const isToday = editingSchedule.date === getKSTDateString(0);
      const targetDate = isToday ? getKSTDateString(0) : getKSTDateString(1);
      await loadSchedules(targetDate, isToday ? 'today' : 'tomorrow');
      setEditingSchedule(null);
    } catch (error) {
      logger.error('Error editing schedule:', error);
      showError('일정 수정에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsEditingSchedule(false);
    }
  };

  // 날씨 모달 열기 시 실제 API 데이터 가져오기
  const handleOpenWeatherModal = async (country: string, location: string | null) => {
    setShowWeatherModal(true);
    setWeatherLoading(true);
    
    // 도시명 결정 (location이 있으면 location 사용, 없으면 country 사용)
    const cityName = location || country;
    
    try {
      // API Route를 통해 서버에서 날씨 정보 가져오기
      const response = await fetch(`/api/weather/forecast?city=${encodeURIComponent(cityName)}&days=14`);
      const result = await response.json();
      
      if (result.ok && result.data) {
        setSelectedWeatherData(result.data);
      } else {
        logger.error('[DailyBriefingCard] 날씨 데이터 가져오기 실패:', result.error);
        setSelectedWeatherData(null);
      }
    } catch (error) {
      logger.error('[DailyBriefingCard] 날씨 데이터 가져오기 실패:', error);
      setSelectedWeatherData(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  if (isLoading) {
    return <BriefingSkeleton />;
  }

  if (!briefing) {
    // 브리핑 데이터가 없을 때 빈 상태 표시
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm mb-2 overflow-hidden border border-blue-100">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-xl">📰</div>
            <h2 className="text-base font-bold text-gray-900">오늘의 브리핑</h2>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <p className="text-gray-500 text-sm">여행 정보가 없습니다. 크루즈 여행을 등록해주세요.</p>
          </div>
        </div>
      </div>
    );
  }

  const today = briefing.today;
  const isCruising = today?.type === 'Cruising';
  const isEmbarkation = today?.type === 'Embarkation';
  const isDisembarkation = today?.type === 'Disembarkation';

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm mb-1.5 overflow-hidden border border-blue-100">
      {/* 헤더 - 컴팩트하게 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-blue-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="text-2xl">📰</div>
          <div className="text-left">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">오늘의 브리핑</h2>
            <p className="text-base md:text-lg text-gray-600 font-semibold leading-relaxed">
              Day {briefing.dayNumber} · {new Date(briefing.date).toLocaleDateString('ko-KR', {
                month: 'long',
                day: 'numeric',
                weekday: 'short'
              })}
            </p>
          </div>
        </div>
        <div className="text-gray-600">
          {isExpanded ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
        </div>
      </button>

      {/* 본문 (Accordion) - 컴팩트하게 */}
      {isExpanded && (
        <div className="px-3 pb-2 space-y-1.5">
          {/* 크루즈 정보 - 클릭하면 내 정보로 이동 */}
          {briefing.cruiseName && (
            <Link href={getProfileHref()} className="block">
              <div className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-blue-200 hover:border-blue-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-700 font-semibold flex-1">
                    <span className="text-2xl">🚢</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl md:text-2xl font-bold leading-tight break-words">{briefing.cruiseName}</span>
                        {briefing.tripNumber && briefing.tripNumber > 0 && (
                          <span className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-full text-sm md:text-base font-bold">
                            {briefing.tripNumber}번째 여행
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-lg md:text-xl font-semibold leading-relaxed">
                        {briefing.nights}박 {briefing.days}일
                      </p>
                      {briefing.startDate && briefing.endDate && (
                        <p className="text-gray-500 text-base md:text-lg font-medium mt-1 leading-relaxed">
                          {formatDateK(briefing.startDate)} ~ {formatDateK(briefing.endDate)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {briefing.dday > 0 && (
                      <div className="text-center bg-purple-100 px-4 py-3 rounded-lg">
                        <p className="text-base md:text-lg text-gray-600 font-semibold leading-tight">
                          출발
                        </p>
                        <p className="text-2xl md:text-3xl font-bold text-purple-700 leading-tight">
                          D-{briefing.dday}
                        </p>
                      </div>
                    )}
                    {briefing.tripId && (
                      <Link
                        href={getProfileHref()}
                        className="shrink-0 rounded-lg bg-blue-600 text-white px-5 py-3 text-base md:text-lg font-semibold hover:bg-blue-700 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        style={{ minHeight: '56px' }}
                      >
                        추가
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* 오늘/내일 일정 - 컴팩트하게 */}
          <div className="bg-white rounded-lg p-2 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="flex items-center gap-1.5 text-gray-900 font-bold text-xl md:text-2xl leading-tight">
                  <FiCalendar className="text-blue-600" size={24} />
                  일정
                </h3>
                {/* 오늘/내일 탭 버튼 */}
                <div className="flex gap-1 bg-gray-100 rounded-md p-1">
                  <button
                    onClick={() => setScheduleViewMode('today')}
                    className={`px-4 py-2.5 text-base md:text-lg font-semibold rounded transition-colors ${
                      scheduleViewMode === 'today'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                    style={{ minHeight: '48px' }}
                  >
                    오늘
                  </button>
                  <button
                    onClick={() => setScheduleViewMode('tomorrow')}
                    className={`px-4 py-2.5 text-base md:text-lg font-semibold rounded transition-colors ${
                      scheduleViewMode === 'tomorrow'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                    style={{ minHeight: '48px' }}
                  >
                    내일
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  // 현재 보기 모드에 따라 선택된 날짜 설정 (내일 탭이면 내일로 설정)
                  setSelectedScheduleDate(scheduleViewMode);
                  setShowScheduleModal(true);
                }}
                className="px-5 py-3 bg-blue-500 text-white text-base md:text-lg font-semibold rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                style={{ minHeight: '56px' }}
              >
                <FiPlus size={20} />
                추가
              </button>
            </div>

            {/* 현재 보기 모드에 따라 일정 표시 */}
            {scheduleViewMode === 'today' ? (
              <>
                {/* 오늘 일정 정보는 표시하지 않음 (사용자가 추가한 일정만 표시) */}

                {/* 추가된 일정 목록 - 메모지 스타일, 5열 그리드 */}
                {(() => {
                  // 렌더링 시에도 현재 시간 기준으로 필터링 (KST 기준)
                  const now = new Date();
                  const currentTime = now.getHours() * 60 + now.getMinutes();
                  const todayStr = getKSTDateString(0);
                  
                  // 오늘 일정만 시간 기준으로 필터링
                  const filteredSchedules = schedules.filter((schedule) => {
                    const scheduleDate = schedule.date || todayStr;
                    // 오늘 날짜인 경우만 시간 필터링
                    if (scheduleDate === todayStr) {
                      const [hours, minutes] = schedule.time.split(':').map(Number);
                      const scheduleTime = hours * 60 + minutes;
                      return scheduleTime >= currentTime;
                    }
                    // 다른 날짜는 모두 표시
                    return true;
                  });
                  
                  return filteredSchedules.length > 0 ? (
                    <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                      {filteredSchedules.map((schedule, index) => (
                      <div
                        key={schedule.id || index}
                        className="aspect-square bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 shadow-sm hover:shadow-md transition-shadow relative p-2 flex flex-col items-center justify-center gap-1 cursor-pointer"
                        style={{
                          transform: `rotate(${(index % 3 - 1) * 1.5}deg)`,
                        }}
                        onClick={() => {
                          setEditingSchedule(schedule);
                          setEditTime(schedule.time);
                          setEditTitle(schedule.title);
                          setEditAlarm(schedule.alarm);
                          setEditAlarmTime(schedule.alarmTime || '');
                        }}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(schedule, true); }}
                          className="absolute top-0.5 right-0.5 text-red-500 hover:text-red-700 p-0.5 z-10"
                          title="삭제"
                        >
                          <FiX size={12} />
                        </button>
                        <FiEdit2 size={10} className="absolute top-0.5 left-0.5 text-gray-400" />
                        <FiClock size={20} className="text-blue-600 mb-1" />
                        <span className="text-lg md:text-xl font-bold text-gray-900 text-center leading-tight">{schedule.time}</span>
                        <span className="text-base md:text-lg text-gray-700 text-center line-clamp-2 px-1 leading-relaxed font-semibold break-words">{schedule.title}</span>
                        {schedule.alarm && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <FiBell size={18} className="text-orange-500" />
                            {schedule.alarmTime && (
                              <span className="text-xs md:text-sm text-orange-600 font-semibold">{schedule.alarmTime}</span>
                            )}
                          </div>
                        )}
                      </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-center py-5 text-gray-500 text-base md:text-lg leading-relaxed">
                      오늘 등록된 일정이 없습니다. 일정 추가 버튼을 눌러 추가해보세요.
                    </div>
                  );
                })()}
              </>
            ) : (
              <>
                {/* 내일 일정 정보는 간단하게만 표시 */}
                {briefing.tomorrow && (
                  <div className="space-y-0.5 mb-2">
                    {briefing.tomorrow.location && (
                      <p className="text-xl md:text-2xl text-gray-800 font-bold leading-tight break-words">{briefing.tomorrow.location}</p>
                    )}
                    {briefing.tomorrow.arrival && (
                      <p className="text-lg md:text-xl text-gray-600 font-semibold leading-relaxed">입항: {briefing.tomorrow.arrival}</p>
                    )}
                  </div>
                )}
                
                {/* 내일 추가된 일정 목록 */}
                {(() => {
                  // 내일 일정은 모든 일정 표시 (시간이 지나도 표시)
                  const filteredSchedules = tomorrowSchedules;
                  
                  return filteredSchedules.length > 0 ? (
                    <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                      {filteredSchedules.map((schedule, index) => (
                      <div
                        key={schedule.id || index}
                        className="aspect-square bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border-2 border-purple-200 shadow-sm hover:shadow-md transition-shadow relative p-2 flex flex-col items-center justify-center gap-1 cursor-pointer"
                        style={{
                          transform: `rotate(${(index % 3 - 1) * 1.5}deg)`,
                        }}
                        onClick={() => {
                          setEditingSchedule(schedule);
                          setEditTime(schedule.time);
                          setEditTitle(schedule.title);
                          setEditAlarm(schedule.alarm);
                          setEditAlarmTime(schedule.alarmTime || '');
                        }}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(schedule, false); }}
                          className="absolute top-0.5 right-0.5 text-red-500 hover:text-red-700 p-0.5 z-10"
                          title="삭제"
                        >
                          <FiX size={12} />
                        </button>
                        <FiEdit2 size={10} className="absolute top-0.5 left-0.5 text-gray-400" />
                        <FiClock size={20} className="text-purple-600 mb-1" />
                        <span className="text-lg md:text-xl font-bold text-gray-900 text-center leading-tight">{schedule.time}</span>
                        <span className="text-base md:text-lg text-gray-700 text-center line-clamp-2 px-1 leading-relaxed font-semibold break-words">{schedule.title}</span>
                        {schedule.alarm && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <FiBell size={18} className="text-orange-500" />
                            {schedule.alarmTime && (
                              <span className="text-xs md:text-sm text-orange-600 font-semibold">{schedule.alarmTime}</span>
                            )}
                          </div>
                        )}
                      </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-5">
                      <p className="text-gray-500 text-xl md:text-2xl font-semibold leading-relaxed">내일 일정이 없습니다</p>
                      <p className="text-gray-400 text-lg md:text-xl mt-2 leading-relaxed">일정 추가 버튼을 눌러 내일 일정을 추가하세요</p>
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          {/* 날씨 - 여러 국가 표시 (온보딩 정보에 맞게 항상 표시) */}
          {briefing.weathers && briefing.weathers.length > 0 ? (
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <h3 className="flex items-center gap-3 text-gray-900 font-bold text-xl md:text-2xl mb-3 leading-tight">
                <FiSun className="text-orange-500" size={28} />
                오늘 날씨
                {kstTime && (
                  <span className="ml-auto text-sm font-normal text-gray-500">
                    한국 {kstTime}
                  </span>
                )}
              </h3>
              <div className="grid grid-cols-3 gap-1.5">
                {briefing.weathers.map((w, idx) => {
                  logger.log('[DailyBriefingCard] Rendering weather item:', { idx, w });
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedWeatherCountry({
                          country: w.country,
                          countryCode: w.countryCode,
                          location: w.location,
                        });
                        handleOpenWeatherModal(w.country, w.location);
                      }}
                      className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-2 border border-blue-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex flex-col gap-2 items-center">
                        {w.temp === null ? (
                          /* 실유저 날씨 로드 실패 */
                          <>
                            <span className="text-5xl md:text-6xl">🌡️</span>
                            <p className="text-sm text-gray-500 text-center">날씨 불러오는 중</p>
                            <p className="text-lg md:text-xl font-bold text-blue-700 bg-blue-200 px-4 py-2 rounded-full border-2 border-blue-300 leading-tight break-words">
                              {w.country}
                            </p>
                          </>
                        ) : (
                          <>
                            {/* 아이콘 */}
                            <span className="text-5xl md:text-6xl">{w.icon}</span>

                            {/* 온도와 나라 */}
                            <div className="flex items-center gap-2 flex-wrap justify-center">
                              <p className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">{w.temp}°C</p>
                              <p className="text-lg md:text-xl font-bold text-blue-700 bg-blue-200 px-4 py-2 rounded-full border-2 border-blue-300 leading-tight break-words">
                                {w.country}
                              </p>
                            </div>

                            {/* 시간 */}
                            {w.time && (
                              <p className="text-xl md:text-2xl font-bold text-gray-700 bg-white px-4 py-2 rounded-full border-2 border-gray-300 leading-tight">
                                🕐 {w.time}
                              </p>
                            )}

                            {/* 날씨 상태 */}
                            <p className="text-gray-700 text-lg md:text-xl font-bold text-center leading-relaxed break-words">{w.condition}</p>

                            {/* 지역명 */}
                            {w.location && (
                              <p className="text-gray-500 text-base text-center">📍 {w.location}</p>
                            )}
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : briefing.weather ? (
            // 하위 호환성: weathers가 없을 때 기존 방식 유지
            <div className="bg-white rounded-xl p-2 shadow-sm">
              <h3 className="flex items-center gap-2 text-gray-900 font-bold text-sm mb-2">
                <FiSun className="text-orange-500" size={16} />
                오늘 날씨
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{briefing.weather.icon}</span>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{briefing.weather.temp}°C</p>
                  <p className="text-gray-600 text-sm">{briefing.weather.condition}</p>
                </div>
              </div>
            </div>
          ) : null}

          {/* 내일 일정 미리보기 - 크루즈 일정의 내일 항구 정보 (여행 중일 때만 표시) */}
          {briefing.tomorrow && briefing.tomorrow.location && (
            <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-purple-400">
              <h3 className="text-gray-900 font-bold text-xl mb-2 flex items-center gap-2">
                <FiMapPin className="text-purple-600" size={20} />
                내일 예정
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-800 rounded-full text-base md:text-lg font-bold border-2 border-purple-300">
                  <FiMapPin size={16} className="text-purple-600" />
                  {briefing.tomorrow.location}
                </span>
                {briefing.tomorrow.country && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-sm font-semibold">
                    {briefing.tomorrow.country}
                  </span>
                )}
                {briefing.tomorrow.arrival && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-sm font-semibold">
                    입항 {briefing.tomorrow.arrival}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 푸터 */}
          <div className="text-center text-base text-gray-500 pt-1">
            💡 브리핑은 매일 아침 7시에 자동으로 업데이트됩니다
          </div>
        </div>
      )}

      {/* 날씨 상세 모달 - 30일치(1개월) */}
      {showWeatherModal && selectedWeatherCountry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10 shadow-sm">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <FiSun className="text-orange-500" />
                  {selectedWeatherCountry.country} 14일 날씨 예보
                </h3>
                {selectedWeatherCountry.location && (
                  <p className="text-sm text-gray-600 mt-1">📍 {selectedWeatherCountry.location}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowWeatherModal(false);
                  setSelectedWeatherCountry(null);
                  setSelectedWeatherData(null);
                }}
                className="text-gray-500 hover:text-gray-700 p-2"
              >
                <FiX size={24} />
              </button>
            </div>

            <div className="p-6">
              {weatherLoading ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">날씨 정보를 불러오는 중...</p>
                </div>
              ) : selectedWeatherData ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                  {selectedWeatherData.forecast.forecastday.map((day, idx) => {
                    const date = new Date(day.date);
                    const isToday = idx === 0;
                    const isTomorrow = idx === 1;
                    
                    return (
                      <div
                        key={idx}
                        className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="text-center">
                          <p className="text-xs font-semibold text-gray-700 mb-0.5">
                            {isToday ? '오늘' : isTomorrow ? '내일' : date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-xs text-gray-500 mb-2">
                            {date.toLocaleDateString('ko-KR', { weekday: 'short' })}
                          </p>
                          <div className="mb-1 flex justify-center">
                            {day.day.condition.icon ? (
                              <img 
                                src={day.day.condition.icon.startsWith('//') 
                                  ? `https:${day.day.condition.icon}` 
                                  : day.day.condition.icon
                                }
                                alt={day.day.condition.text}
                                className="w-12 h-12"
                              />
                            ) : (
                              <span className="text-2xl">🌤️</span>
                            )}
                          </div>
                          <p className="text-lg font-bold text-gray-900 mb-1">{Math.round(day.day.maxtemp_c)}°C</p>
                          <div className="flex items-center justify-center gap-1 text-xs text-gray-600 mb-1">
                            <span className="text-blue-600 font-semibold">↓{Math.round(day.day.mintemp_c)}°</span>
                            <span className="text-red-600 font-semibold">↑{Math.round(day.day.maxtemp_c)}°</span>
                          </div>
                          <p className="text-xs font-medium text-gray-700 mb-1.5">{day.day.condition.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">날씨 정보를 불러올 수 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 일정 추가 모달 */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">일정 추가</h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* 날짜 선택 (오늘/내일) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  날짜 선택
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedScheduleDate('today')}
                    className={`flex-1 px-4 py-3 text-base font-semibold rounded-lg transition-colors ${
                      selectedScheduleDate === 'today'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    오늘
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedScheduleDate('tomorrow')}
                    className={`flex-1 px-4 py-3 text-base font-semibold rounded-lg transition-colors ${
                      selectedScheduleDate === 'tomorrow'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    내일
                  </button>
                </div>
              </div>

              {/* 시간 입력 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  시간
                </label>
                <input
                  type="time"
                  value={newScheduleTime}
                  onChange={(e) => setNewScheduleTime(e.target.value)}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* 일정 제목 입력 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  일정
                </label>
                <input
                  type="text"
                  value={newScheduleTitle}
                  onChange={(e) => setNewScheduleTitle(e.target.value)}
                  placeholder="예: 조식 뷔페, 요가 클래스"
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* 알람 설정 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="alarm-check"
                    checked={newScheduleAlarm}
                    onChange={(e) => {
                      setNewScheduleAlarm(e.target.checked);
                      if (!e.target.checked) {
                        setNewScheduleAlarmTime(''); // 알람 해제 시 알람 시간도 초기화
                      }
                    }}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="alarm-check" className="text-base text-gray-700 flex items-center gap-2">
                    <FiBell className="text-orange-500" />
                    알람 설정
                  </label>
                </div>
                
                {/* 알람 시간 입력 (알람이 켜져 있을 때만 표시) */}
                {newScheduleAlarm && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      알람 시간 (미리 알림 받을 시간)
                    </label>
                    <input
                      type="time"
                      value={newScheduleAlarmTime}
                      onChange={(e) => setNewScheduleAlarmTime(e.target.value)}
                      className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="예: 08:00"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      💡 일정 시간보다 먼저 알림을 받을 시간을 설정하세요
                    </p>
                  </div>
                )}
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 px-4 py-3 text-base font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  onClick={async () => {
                    if (isAddingSchedule) {
                      return; // 이미 추가 중이면 무시
                    }
                    const success = await handleAddSchedule();
                    if (success) {
                      setShowScheduleModal(false);
                      // 입력 필드 초기화
                      setNewScheduleTime('');
                      setNewScheduleTitle('');
                      setNewScheduleAlarm(false);
                      setNewScheduleAlarmTime('');
                    }
                  }}
                  disabled={isAddingSchedule}
                  className={`flex-1 px-4 py-3 text-base font-semibold text-white rounded-lg transition-colors ${
                    isAddingSchedule 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isAddingSchedule ? '추가 중...' : '추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 일정 수정 모달 */}
      {editingSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">일정 수정</h3>
              <button
                onClick={() => setEditingSchedule(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* 시간 입력 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">시간</label>
                <input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* 일정 제목 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">일정</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="예: 조식 뷔페, 요가 클래스"
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* 알람 설정 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="edit-alarm-check"
                    checked={editAlarm}
                    onChange={(e) => {
                      setEditAlarm(e.target.checked);
                      if (!e.target.checked) setEditAlarmTime('');
                    }}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="edit-alarm-check" className="text-base text-gray-700 flex items-center gap-2">
                    <FiBell className="text-orange-500" />
                    알람 설정
                  </label>
                </div>
                {editAlarm && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">알람 시간</label>
                    <input
                      type="time"
                      value={editAlarmTime}
                      onChange={(e) => setEditAlarmTime(e.target.value)}
                      className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingSchedule(null)}
                  className="flex-1 px-4 py-3 text-base font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  onClick={handleEditSchedule}
                  disabled={isEditingSchedule}
                  className={`flex-1 px-4 py-3 text-base font-semibold text-white rounded-lg transition-colors ${
                    isEditingSchedule ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isEditingSchedule ? '수정 중...' : '수정'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* D-day 팝업 */}
      {ddayPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDdayPopup(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-[92%] max-w-xl p-5 md:p-6">
            <div className="text-[20px] md:text-[22px] font-extrabold mb-2">📣 {ddayPopup.title}</div>
            <div 
              className="text-[17px] md:text-[18px] leading-7 whitespace-pre-line"
              dangerouslySetInnerHTML={{ __html: ddayPopup.message.replace(/\n/g, '<br>') }}
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button 
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition-colors" 
                onClick={() => setDdayPopup(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
