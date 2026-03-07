/**
 * 브리핑 일정 알림 스케줄링 유틸리티
 * 아이폰, 안드로이드 모두 지원
 */

export interface AlarmSchedule {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  title: string;
  scheduledAt: number; // timestamp
}

const STORAGE_KEY = 'cruise-briefing-alarms';

/**
 * 알림 권한 요청
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('[Alarm] 알림을 지원하지 않는 브라우저입니다.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    console.warn('[Alarm] 알림 권한이 거부되었습니다.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('[Alarm] 알림 권한 요청 실패:', error);
    return false;
  }
}

/**
 * 내일 날짜 계산 (YYYY-MM-DD 형식)
 */
function getTomorrowDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, '0');
  const newDay = String(date.getDate()).padStart(2, '0');
  return `${newYear}-${newMonth}-${newDay}`;
}

/**
 * 날짜와 시간을 합쳐서 타임스탬프 계산 (현지 시간 기준)
 */
function calculateAlarmTimestamp(date: string, time: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  
  // 현지 시간으로 Date 객체 생성
  const alarmDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  
  return alarmDate.getTime();
}

/**
 * 저장된 알림 목록 가져오기
 */
export function getScheduledAlarms(): AlarmSchedule[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const alarms: AlarmSchedule[] = JSON.parse(stored);
    // 만료된 알림 제거
    const now = Date.now();
    const validAlarms = alarms.filter(alarm => alarm.scheduledAt > now);
    
    // 유효한 알림만 다시 저장
    if (validAlarms.length !== alarms.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validAlarms));
    }
    
    return validAlarms;
  } catch (error) {
    console.error('[Alarm] 알림 목록 불러오기 실패:', error);
    return [];
  }
}

/**
 * 알림 스케줄 저장
 */
function saveScheduledAlarms(alarms: AlarmSchedule[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
  } catch (error) {
    console.error('[Alarm] 알림 저장 실패:', error);
  }
}

/**
 * 일정에 알림 설정
 * 날짜가 지나면 자동으로 내일로 변경
 */
export async function scheduleAlarm(
  date: string,
  time: string,
  title: string
): Promise<boolean> {
  // 알림 권한 확인
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    console.warn('[Alarm] 알림 권한이 없어 알림을 설정할 수 없습니다.');
    return false;
  }

  // 스마트폰 기준 시계로 현재 시간 확인 (현지 시간)
  const now = Date.now();
  let targetDate = date;
  let scheduledAt = calculateAlarmTimestamp(date, time);
  
  // 과거 시간이면 내일로 자동 변경
  if (scheduledAt <= now) {
    console.log('[Alarm] 날짜가 지났습니다. 내일로 자동 변경합니다.', { date, time });
    targetDate = getTomorrowDate(date);
    scheduledAt = calculateAlarmTimestamp(targetDate, time);
    
    // 내일도 과거면 에러 (이상한 경우)
    if (scheduledAt <= now) {
      console.error('[Alarm] 내일 날짜도 과거입니다. 알림을 설정할 수 없습니다.', { targetDate, time });
      return false;
    }
    
    console.log('[Alarm] 내일 날짜로 변경됨:', { originalDate: date, newDate: targetDate, time });
  }

  const alarmId = `${targetDate}-${time}-${Date.now()}`;
  const alarm: AlarmSchedule = {
    id: alarmId,
    date: targetDate, // 변경된 날짜 사용
    time,
    title,
    scheduledAt,
  };

  // 기존 알림 목록 가져오기
  const alarms = getScheduledAlarms();
  
  // 같은 날짜/시간의 알림이 있으면 제거 (중복 방지)
  const filteredAlarms = alarms.filter(
    a => !(a.date === targetDate && a.time === time)
  );
  
  // 새 알림 추가
  filteredAlarms.push(alarm);
  
  // 저장
  saveScheduledAlarms(filteredAlarms);
  
  // 알림 체크 시작
  startAlarmChecker();
  
  console.log('[Alarm] 알림이 설정되었습니다:', { date: targetDate, time, title, scheduledAt });
  return true;
}

/**
 * 알림 제거
 */
export function removeAlarm(date: string, time: string): void {
  const alarms = getScheduledAlarms();
  const filteredAlarms = alarms.filter(
    a => !(a.date === date && a.time === time)
  );
  saveScheduledAlarms(filteredAlarms);
  console.log('[Alarm] 알림이 제거되었습니다:', { date, time });
}

/**
 * 모든 알림 제거
 */
export function clearAllAlarms(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  console.log('[Alarm] 모든 알림이 제거되었습니다.');
}

/**
 * 알림 체크 및 실행
 */
let alarmCheckInterval: NodeJS.Timeout | null = null;

function startAlarmChecker(): void {
  // 이미 실행 중이면 중복 실행 방지
  if (alarmCheckInterval) {
    return;
  }

  // 1분마다 알림 체크
  alarmCheckInterval = setInterval(() => {
    checkAndTriggerAlarms();
  }, 60000); // 1분

  // 즉시 한 번 체크
  checkAndTriggerAlarms();
}

function checkAndTriggerAlarms(): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const alarms = getScheduledAlarms();
  const now = Date.now();
  
  // 1분 이내에 울릴 알림 찾기
  const upcomingAlarms = alarms.filter(
    alarm => {
      const timeUntilAlarm = alarm.scheduledAt - now;
      return timeUntilAlarm > 0 && timeUntilAlarm <= 60000; // 1분 이내
    }
  );

  // 알림 실행
  upcomingAlarms.forEach(alarm => {
    triggerAlarm(alarm);
    // 실행된 알림 제거
    removeAlarm(alarm.date, alarm.time);
  });
}

function triggerAlarm(alarm: AlarmSchedule): void {
  try {
    const notification = new Notification('🚢 크루즈닷AI', {
      body: `${alarm.time} - ${alarm.title}`,
      icon: '/images/ai-cruise-logo.png',
      badge: '/images/ai-cruise-logo.png',
      tag: `briefing-${alarm.id}`, // 중복 알림 방지
      requireInteraction: false, // 자동으로 사라지게
      silent: false, // 소리 재생
    });

    // 알림 클릭 시 앱으로 이동
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // 5초 후 자동 닫기
    setTimeout(() => {
      notification.close();
    }, 5000);

    console.log('[Alarm] 알림이 실행되었습니다:', alarm);
  } catch (error) {
    console.error('[Alarm] 알림 실행 실패:', error);
  }
}

/**
 * 페이지 로드 시 알림 체커 시작
 */
if (typeof window !== 'undefined' && typeof Notification !== 'undefined') {
  // 페이지 로드 시 기존 알림 체크 시작
  if (Notification.permission === 'granted') {
    startAlarmChecker();
  }

  // 페이지가 보일 때마다 알림 체크 (백그라운드에서 돌아올 때)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Notification.permission === 'granted') {
      checkAndTriggerAlarms();
    }
  });

  // 포커스 시 알림 체크
  window.addEventListener('focus', () => {
    if (Notification.permission === 'granted') {
      checkAndTriggerAlarms();
    }
  });
}






