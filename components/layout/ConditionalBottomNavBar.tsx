'use client';

import { usePathname } from 'next/navigation';
import BottomNavBar from './BottomNavBar';

// 하단 네비게이션 바를 표시할 경로 (화이트리스트 방식)
// 메인 기능 페이지 전체에서 표시 (일반 + 3일체험 포함)
const SHOW_NAV_PATHS = [
  '/chat',          // 지니가이드
  '/chat-test',     // 지니가이드 3일체험
  '/tools',         // 도구함
  '/tools-test',    // 도구함 3일체험
  '/translator',    // 번역기
  '/translator-test', // 번역기 3일체험
  '/profile',       // 내 정보
  '/profile-test',  // 내 정보 3일체험
  '/checklist',     // 체크리스트
  '/checklist-test', // 체크리스트 3일체험
  '/wallet',        // 가계부
  '/wallet-test',   // 가계부 3일체험
  '/map',           // 세계 지도
  '/map-test',      // 세계 지도 3일체험
];

/**
 * 경로가 정확히 일치하거나 하위 경로인지 확인
 * 예: /chat 또는 /chat/xxx 는 true, /chat-bot 또는 /chats 는 false
 */
function isPathMatch(pathname: string, allowedPath: string): boolean {
  if (!pathname) return false;
  
  // 정확히 일치하는 경우
  if (pathname === allowedPath) return true;
  
  // 하위 경로인 경우 (예: /chat/something)
  if (pathname.startsWith(allowedPath + '/')) return true;
  
  return false;
}

export default function ConditionalBottomNavBar() {
  const pathname = usePathname();

  // 오직 /chat 또는 /chat-test 경로(및 하위 경로)에서만 하단 네비게이션 바 표시
  // 나머지 모든 경로(새로운 랜딩페이지 포함)에서는 표시하지 않음
  if (!pathname || !SHOW_NAV_PATHS.some((path) => isPathMatch(pathname, path))) {
    return null;
  }

  return <BottomNavBar />;
}
