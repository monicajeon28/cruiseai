'use client';

import { useEffect } from 'react';

interface AffiliateTrackerProps {
  mallUserId: string;
  affiliateCode?: string | null;
}

export default function AffiliateTracker({ mallUserId, affiliateCode }: AffiliateTrackerProps) {
  useEffect(() => {
    if (!mallUserId) return;

    // 쿠키에 어필리에이트 정보 저장
    const setCookie = (name: string, value: string, days: number = 30) => {
      const expires = new Date();
      expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
      document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    };

    setCookie('affiliate_mall_user_id', String(mallUserId));
    if (affiliateCode) {
      setCookie('affiliate_code', String(affiliateCode));
    }
  }, [mallUserId, affiliateCode]);

  // 이 컴포넌트는 UI를 렌더링하지 않음
  return null;
}










