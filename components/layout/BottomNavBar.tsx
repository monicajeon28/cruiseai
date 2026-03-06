'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  FiMessageCircle, 
  FiTool, 
  FiGlobe, 
  FiUser 
} from 'react-icons/fi';

interface NavItem {
  label: string;
  href: string;
  icon?: React.ElementType; // 이모지 사용 시 선택적
  emoji?: string; // 이모지 옵션 추가
  isExternal?: boolean; // 외부 링크 여부
}

const navItems: NavItem[] = [
  {
    label: '홈',
    href: '/chat',
    icon: FiMessageCircle,
  },
  {
    label: '다음크루즈',
    href: 'https://www.cruisedot.co.kr',
    emoji: '🛳️',
    isExternal: true,
  },
  {
    label: '도구함',
    href: '/tools',
    icon: FiTool,
  },
  {
    label: '번역기',
    href: '/translator',
    icon: FiGlobe,
  },
  {
    label: '내 정보',
    href: '/profile',
    icon: FiUser,
  },
];

export default function BottomNavBar() {
  const pathname = usePathname();
  const TEST_MODE_PATHS = ['/chat-test', '/tools-test', '/translator-test', '/profile-test', '/checklist-test', '/wallet-test', '/map-test'];
  const isTestMode = TEST_MODE_PATHS.some(p => pathname?.startsWith(p));
  
  // 루트(/), /login, /admin으로 시작하는 모든 경로에서는 하단 메뉴 숨김
  if (
    pathname === '/' || 
    pathname === '/login' || 
    pathname === '/login-test' ||
    pathname === null ||
    (pathname && pathname.startsWith('/admin'))
  ) {
    return null;
  }

  // 테스트 모드일 때 홈 링크를 /chat-test로 변경
  const getHomeHref = () => {
    return isTestMode ? '/chat-test' : '/chat';
  };

  // 테스트 모드일 때 다른 링크들도 테스트 버전으로 변경
  const getItemHref = (item: NavItem) => {
    if (item.label === '홈') {
      return getHomeHref();
    }
    if (isTestMode) {
      if (item.label === '도구함') return '/tools-test';
      if (item.label === '번역기') return '/translator-test';
      if (item.label === '내 정보') return '/profile-test';
    }
    return item.href;
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg pb-[env(safe-area-inset-bottom)]"
    >
      <div className="max-w-screen-xl mx-auto">
        <div className="grid grid-cols-5 gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            // 테스트 모드일 때 링크를 테스트 버전으로 변경
            const itemHref = getItemHref(item);
            const isActive = !item.isExternal && (pathname === itemHref || pathname?.startsWith(itemHref + '/'));

            const linkContent = (
              <>
                {item.emoji ? (
                  <span className="text-2xl mb-0.5">{item.emoji}</span>
                ) : Icon ? (
                  <Icon
                    size={22}
                    className="mb-0.5"
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                ) : null}
                <span className="text-xs font-semibold whitespace-nowrap leading-tight">
                  {item.label}
                </span>
              </>
            );

            const className = `
              flex flex-col items-center justify-center
              py-2 px-1
              transition-colors duration-200
              ${isActive
                ? 'text-brand-red font-bold'
                : 'text-gray-600 hover:text-gray-900'
              }
            `;

            // 외부 링크 또는 다음크루즈는 새 창으로 열기
            if (item.isExternal || item.label === '다음크루즈') {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                >
                  {linkContent}
                </a>
              );
            }
            
            return (
              <Link
                key={item.href}
                href={itemHref}
                prefetch={true}
                className={className}
              >
                {linkContent}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

