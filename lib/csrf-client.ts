// lib/csrf-client.ts
'use client';

const CSRF_TOKEN_KEY = 'csrf-token';

/**
 * CSRF 토큰을 로컬 스토리지에 저장
 */
export function setCsrfToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(CSRF_TOKEN_KEY, token);
  }
}

/**
 * 로컬 스토리지에서 CSRF 토큰 가져오기
 */
export function getCsrfToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(CSRF_TOKEN_KEY);
  }
  return null;
}

/**
 * CSRF 토큰 제거
 */
export function clearCsrfToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CSRF_TOKEN_KEY);
  }
}

/**
 * 사용자 관련 모든 localStorage 데이터 정리
 * 로그아웃 시 호출하여 다른 사용자의 데이터가 남지 않도록 함
 */
export function clearAllLocalStorage() {
  if (typeof window === 'undefined') return;

  // 모든 localStorage 키 가져오기
  const keys = Object.keys(localStorage);
  
  // 제거할 키 패턴들
  const patternsToRemove = [
    'csrf-token',
    'dailySchedules-',
    'cruise-guide-checklist',
    'cruise-guide-wallet-storage',
    'cruise-guide-wallet-migrated',
    'cruise-guide-checklist-migrated',
    'cruise-guide-wallet-budget',
    'myTrips',
    'countryColors',
    'dday_popup_',
    'chat_dday_seen_',
    'genie-dday-popup:',
    'push-prompt-dismissed',
    'push-enabled',
    'adminToken', // 관리자 토큰도 제거
  ];

  // 패턴에 맞는 키 제거
  const removedKeys: string[] = [];
  keys.forEach((key) => {
    const shouldRemove = patternsToRemove.some((pattern) => 
      key.startsWith(pattern) || key === pattern
    );
    
    if (shouldRemove) {
      localStorage.removeItem(key);
      removedKeys.push(key);
    }
  });

  console.log('[clearAllLocalStorage] 사용자 데이터 정리 완료:', removedKeys.length, '개 키 제거됨');
  if (removedKeys.length > 0) {
    console.log('[clearAllLocalStorage] 제거된 키:', removedKeys);
  }
}

/**
 * CSRF 보호가 적용된 fetch 래퍼 함수
 * POST, PUT, DELETE, PATCH 요청 시 자동으로 CSRF 토큰을 헤더에 추가
 */
export async function csrfFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = options.method?.toUpperCase() || 'GET';
  const csrfMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

  // CSRF 토큰이 필요한 메서드인 경우
  if (csrfMethods.includes(method)) {
    const token = getCsrfToken();
    
    if (token) {
      options.headers = {
        ...options.headers,
        'X-CSRF-Token': token,
      };
    }
  }

  // credentials: 'include'를 기본으로 설정 (쿠키 전송)
  options.credentials = options.credentials || 'include';

  return fetch(url, options);
}

