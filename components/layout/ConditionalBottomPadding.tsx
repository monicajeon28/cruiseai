'use client';

import { usePathname } from 'next/navigation';

// 하단 패딩을 표시할 경로 (하단 툴바가 있는 경로와 동일)
// 오직 지니가이드와 지니가이드 3일체험에서만 패딩 적용
const SHOW_BOTTOM_PADDING_PATHS = [
  '/chat',      // 지니가이드 (크루즈 가이드 지니 AI)
  '/chat-test', // 지니가이드 3일체험
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

/**
 * 하단 툴바가 있는 페이지에서만 하단 패딩을 적용하는 컴포넌트
 * 툴바가 없는 페이지에서는 패딩을 완전히 제거하여 불필요한 흰색 공간을 없앱니다.
 * 흰색 공간이 어떠한 페이지에도 보이지 않도록 보장합니다.
 */
export default function ConditionalBottomPadding({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // 오직 /chat 또는 /chat-test 경로(및 하위 경로)에서만 하단 패딩 적용
  // 나머지 모든 경로에서는 패딩 완전히 제거 (흰색 공간 없음)
  const shouldShowPadding = pathname && SHOW_BOTTOM_PADDING_PATHS.some((path) => isPathMatch(pathname, path));

  // 패딩이 없는 경우 div 래퍼 없이 children만 반환하여 완전히 제거
  if (!shouldShowPadding) {
    return <>{children}</>;
  }

  // 패딩이 필요한 경우에만 적용
  return (
    <div 
      className="pb-20" 
      style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
    >
      {children}
    </div>
  );
}

