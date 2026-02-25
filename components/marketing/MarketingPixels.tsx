'use client';

// components/marketing/MarketingPixels.tsx
// 마케팅 픽셀 스크립트 자동 주입 컴포넌트

import { useEffect } from 'react';
import Script from 'next/script';

interface MarketingPixelsProps {
  config: {
    googlePixelId?: string | null;
    googleTagManagerId?: string | null;
    googleAdsId?: string | null;
    googleTestMode?: boolean;
    facebookPixelId?: string | null;
    facebookAppId?: string | null;
    facebookTestMode?: boolean;
    naverPixelId?: string | null;
    kakaoPixelId?: string | null;
    isGoogleEnabled?: boolean;
    isFacebookEnabled?: boolean;
    isNaverEnabled?: boolean;
    isKakaoEnabled?: boolean;
  } | null;
}

export default function MarketingPixels({ config }: MarketingPixelsProps) {
  // Google Analytics 4 (GA4)
  const hasGoogleAnalytics = config?.isGoogleEnabled && config?.googlePixelId;

  // Google Tag Manager
  const hasGoogleTagManager = config?.isGoogleEnabled && config?.googleTagManagerId;

  // Facebook Pixel
  const hasFacebookPixel = config?.isFacebookEnabled && config?.facebookPixelId;

  // 네이버 픽셀
  const hasNaverPixel = config?.isNaverEnabled && config?.naverPixelId;

  // 카카오 픽셀
  const hasKakaoPixel = config?.isKakaoEnabled && config?.kakaoPixelId;

  // Facebook Pixel은 Script 컴포넌트로 처리 (더 안정적)

  // 네이버 픽셀 초기화
  useEffect(() => {
    if (hasNaverPixel && typeof window !== 'undefined') {
      if (!window.wcs) {
        (window as any).wcs = {};
      }
      if (!window.wcs_add) {
        (window as any).wcs_add = {};
      }
      (window as any).wcs_add['wa'] = config?.naverPixelId;
      (window as any).wcs_do = true;

      // 네이버 픽셀 스크립트 로드
      const script = document.createElement('script');
      script.src = 'https://wcs.naver.net/wcslog.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, [hasNaverPixel, config?.naverPixelId]);

  // 카카오 픽셀 초기화
  useEffect(() => {
    if (hasKakaoPixel && typeof window !== 'undefined') {
      if (!window.kakaoPixel) {
        (window as any).kakaoPixel = function () {
          (window as any).kakaoPixel.q = (window as any).kakaoPixel.q || [];
          (window as any).kakaoPixel.q.push(arguments);
        };
        (window as any).kakaoPixel.l = Date.now();
        (window as any).kakaoPixel('init', config?.kakaoPixelId!);
        (window as any).kakaoPixel('page');

        const script = document.createElement('script');
        script.src = 'https://t1.daumcdn.net/kas/static/pixel/pixel.js';
        script.async = true;
        document.head.appendChild(script);
      }
    }
  }, [hasKakaoPixel, config?.kakaoPixelId]);

  if (!config) return null;

  return (
    <>
      {/* Google Analytics 4 */}
      {hasGoogleAnalytics && (
        <>
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${config.googlePixelId}`}
          />
          <Script
            id="google-analytics"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${config.googlePixelId}', {
                  ${config.googleTestMode ? "'debug_mode': true," : ''}
                  'send_page_view': true
                });
              `,
            }}
          />
        </>
      )}

      {/* Google Tag Manager */}
      {hasGoogleTagManager && (
        <>
          <Script
            id="google-tag-manager"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${config.googleTagManagerId}');
              `,
            }}
          />
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${config.googleTagManagerId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        </>
      )}

      {/* Google Ads Conversion Tracking */}
      {config.isGoogleEnabled && config.googleAdsId && (
        <Script
          id="google-ads"
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${config.googleAdsId}`}
        />
      )}

      {/* Facebook Pixel */}
      {hasFacebookPixel && (
        <>
          <Script
            id="facebook-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${config.facebookPixelId}');
                fbq('track', 'PageView');
              `,
            }}
          />
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${config.facebookPixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}
    </>
  );
}

// TypeScript 전역 타입 선언
declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
    _fbq?: any;
    wcs?: any;
    wcs_add?: any;
    wcs_do?: boolean;
    kakaoPixel?: any;
  }
}

