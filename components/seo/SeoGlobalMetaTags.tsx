// components/seo/SeoGlobalMetaTags.tsx
// SEO 전역 설정에서 메타 태그 및 스크립트 생성

'use server';

import Script from 'next/script';
import prisma from '@/lib/prisma';

export async function SeoGlobalMetaTags() {
  try {
    const seoConfig = await prisma.seoGlobalConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!seoConfig) {
      return null;
    }

    return (
      <>
        {/* Google Search Console Verification - head에 추가되도록 별도 처리 필요 */}
        {seoConfig.googleSearchConsoleVerification && (
          <meta
            name="google-site-verification"
            content={seoConfig.googleSearchConsoleVerification}
          />
        )}
      </>
    );
  } catch (error) {
    console.error('[SeoGlobalMetaTags] Error:', error);
    return null;
  }
}

export async function SeoGlobalScripts() {
  try {
    const seoConfig = await prisma.seoGlobalConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!seoConfig?.googleAnalyticsId) {
      return null;
    }

    return (
      <>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${seoConfig.googleAnalyticsId}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${seoConfig.googleAnalyticsId}');
          `}
        </Script>
      </>
    );
  } catch (error) {
    console.error('[SeoGlobalScripts] Error:', error);
    return null;
  }
}

