// components/seo/GoogleSearchConsoleVerification.tsx
// Google Search Console Verification 메타 태그 자동 추가

'use client';

import { useEffect } from 'react';

export default function GoogleSearchConsoleVerification() {
  useEffect(() => {
    // 파트너 모드나 어드민 모드가 아닐 때만 호출
    if (typeof window === 'undefined') return;
    
    const pathname = window.location.pathname;
    const isPartnerMode = pathname.startsWith('/partner');
    const isAdminMode = pathname.startsWith('/admin');
    
    if (isPartnerMode || isAdminMode) {
      return; // 파트너/어드민 모드에서는 호출하지 않음
    }
    
    // SEO 전역 설정에서 Google Search Console verification 코드 가져오기
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
        if (data?.ok && data.config?.googleSearchConsoleVerification) {
          const verificationCode = data.config.googleSearchConsoleVerification;
          
          // 이미 존재하는지 확인
          const existingMeta = document.querySelector('meta[name="google-site-verification"]');
          
          if (!existingMeta) {
            // 메타 태그 생성 및 추가
            const meta = document.createElement('meta');
            meta.name = 'google-site-verification';
            meta.content = verificationCode;
            document.head.appendChild(meta);
          } else {
            // 기존 메타 태그 업데이트
            existingMeta.setAttribute('content', verificationCode);
          }
        }
      })
      .catch(() => {
        // 모든 에러는 조용히 무시 (파트너 모드 등에서 발생할 수 있음)
      });
  }, []);

  return null; // 이 컴포넌트는 아무것도 렌더링하지 않음
}

