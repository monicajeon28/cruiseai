// lib/test-mode-client.ts
// 클라이언트 사이드에서 사용할 테스트 모드 유틸리티

export interface TestModeInfo {
  isTestMode: boolean;
  testModeStartedAt: Date | null;
  remainingHours: number | null;
  testModeEndAt: Date | null;
}

/**
 * 클라이언트 사이드에서 테스트 모드 확인 (API 호출)
 */
export async function checkTestModeClient(): Promise<TestModeInfo> {
  try {
    const response = await fetch('/api/user/test-mode', {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        isTestMode: false,
        testModeStartedAt: null,
        remainingHours: null,
        testModeEndAt: null,
      };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[TestMode] Client check error:', error);
    return {
      isTestMode: false,
      testModeStartedAt: null,
      remainingHours: null,
      testModeEndAt: null,
    };
  }
}

/**
 * 경로가 테스트 모드 경로인지 확인 (클라이언트용)
 */
export function isTestModePath(pathname: string): boolean {
  if (!pathname) return false;
  return pathname.includes('-test') || pathname.startsWith('/chat-test');
}

/**
 * 경로 보호: 사용자의 테스트 모드 상태와 경로가 일치하는지 확인 (클라이언트용)
 * @param pathname 현재 경로
 * @param testModeInfo 사용자의 테스트 모드 정보
 * @returns 올바른 경로 (일치하면 현재 경로, 불일치하면 올바른 경로 반환)
 */
export function getCorrectPath(pathname: string, testModeInfo: TestModeInfo): string {
  if (!pathname) return '/chat';
  
  const isTestPath = isTestModePath(pathname);
  const isTestUser = testModeInfo.isTestMode;
  
  // 경로와 사용자 모드가 일치하면 현재 경로 유지
  if (isTestPath === isTestUser) {
    return pathname;
  }
  
  // 불일치 시 올바른 경로로 변환
  if (isTestUser) {
    // 테스트 모드 사용자가 일반 경로에 접근한 경우
    if (pathname === '/chat') return '/chat-test';
    if (pathname === '/checklist') return '/checklist-test';
    if (pathname === '/translator') return '/translator-test';
    if (pathname === '/profile') return '/profile-test';
    if (pathname === '/wallet') return '/wallet-test';
    if (pathname === '/tools') return '/tools-test';
    if (pathname === '/map') return '/map-test';
    // 하위 경로도 처리
    if (pathname.startsWith('/chat/')) return pathname.replace('/chat/', '/chat-test/');
    if (pathname.startsWith('/checklist/')) return pathname.replace('/checklist/', '/checklist-test/');
    if (pathname.startsWith('/translator/')) return pathname.replace('/translator/', '/translator-test/');
    if (pathname.startsWith('/profile/')) return pathname.replace('/profile/', '/profile-test/');
    if (pathname.startsWith('/wallet/')) return pathname.replace('/wallet/', '/wallet-test/');
    if (pathname.startsWith('/tools/')) return pathname.replace('/tools/', '/tools-test/');
    if (pathname.startsWith('/map/')) return pathname.replace('/map/', '/map-test/');
  } else {
    // 일반 사용자가 테스트 경로에 접근한 경우
    if (pathname === '/chat-test') return '/chat';
    if (pathname === '/checklist-test') return '/checklist';
    if (pathname === '/translator-test') return '/translator';
    if (pathname === '/profile-test') return '/profile';
    if (pathname === '/wallet-test') return '/wallet';
    if (pathname === '/tools-test') return '/tools';
    if (pathname === '/map-test') return '/map';
    // 하위 경로도 처리
    if (pathname.startsWith('/chat-test/')) return pathname.replace('/chat-test/', '/chat/');
    if (pathname.startsWith('/checklist-test/')) return pathname.replace('/checklist-test/', '/checklist/');
    if (pathname.startsWith('/translator-test/')) return pathname.replace('/translator-test/', '/translator/');
    if (pathname.startsWith('/profile-test/')) return pathname.replace('/profile-test/', '/profile/');
    if (pathname.startsWith('/wallet-test/')) return pathname.replace('/wallet-test/', '/wallet/');
    if (pathname.startsWith('/tools-test/')) return pathname.replace('/tools-test/', '/tools/');
    if (pathname.startsWith('/map-test/')) return pathname.replace('/map-test/', '/map/');
  }
  
  // 기본값
  return isTestUser ? '/chat-test' : '/chat';
}

