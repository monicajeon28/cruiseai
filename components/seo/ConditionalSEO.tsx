'use client';

import { usePathname } from 'next/navigation';
import GoogleAnalytics from './GoogleAnalytics';
import GoogleSearchConsoleVerification from './GoogleSearchConsoleVerification';

export default function ConditionalSEO() {
  const pathname = usePathname();
  
  // 파트너 모드나 어드민 모드에서는 SEO 컴포넌트를 렌더링하지 않음
  if (pathname?.startsWith('/partner') || pathname?.startsWith('/admin')) {
    return null;
  }
  
  return (
    <>
      <GoogleSearchConsoleVerification />
      <GoogleAnalytics />
    </>
  );
}






