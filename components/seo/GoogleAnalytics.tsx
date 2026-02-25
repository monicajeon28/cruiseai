// components/seo/GoogleAnalytics.tsx
// Google Analytics 스크립트 (SEO 전역 설정에서 가져옴)

'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

export default function GoogleAnalytics() {
  const [analyticsId, setAnalyticsId] = useState<string | null>(null);

  useEffect(() => {
    // 파트너 모드나 어드민 모드가 아닐 때만 호출
    if (typeof window === 'undefined') return;
    
    const pathname = window.location.pathname;
    const isPartnerMode = pathname.startsWith('/partner');
    const isAdminMode = pathname.startsWith('/admin');
    
    if (isPartnerMode || isAdminMode) {
      return; // 파트너/어드민 모드에서는 호출하지 않음
    }
    
    // SEO 전역 설정에서 Google Analytics ID 가져오기
    fetch('/api/admin/settings/seo-global', { credentials: 'include' })
      .then(res => {
        // 401, 403 등의 에러는 조용히 무시
        if (res.status === 401 || res.status === 403) {
          return null;
        }
        if (!res.ok) {
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data?.ok && data.config?.googleAnalyticsId) {
          setAnalyticsId(data.config.googleAnalyticsId);
        }
      })
      .catch(() => {
        // 모든 에러는 조용히 무시 (파트너 모드 등에서 발생할 수 있음)
      });
  }, []);

  if (!analyticsId) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${analyticsId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${analyticsId}');
        `}
      </Script>
    </>
  );
}

