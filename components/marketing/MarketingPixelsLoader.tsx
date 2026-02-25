// components/marketing/MarketingPixelsLoader.tsx
// 서버 컴포넌트: 마케팅 설정을 가져와서 클라이언트 컴포넌트에 전달

import prisma from '@/lib/prisma';
import MarketingPixels from './MarketingPixels';

export default async function MarketingPixelsLoader() {
  try {
    // 마케팅 설정 조회
    const config = await prisma.marketingConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      return null;
    }

    // 활성화된 설정만 전달
    return (
      <MarketingPixels
        config={{
          googlePixelId: config.googlePixelId,
          googleTagManagerId: config.googleTagManagerId,
          googleAdsId: config.googleAdsId,
          googleTestMode: config.googleTestMode,
          facebookPixelId: config.facebookPixelId,
          facebookAppId: config.facebookAppId,
          facebookTestMode: config.facebookTestMode,
          naverPixelId: config.naverPixelId,
          kakaoPixelId: config.kakaoPixelId,
          isGoogleEnabled: config.isGoogleEnabled,
          isFacebookEnabled: config.isFacebookEnabled,
          isNaverEnabled: config.isNaverEnabled,
          isKakaoEnabled: config.isKakaoEnabled,
        }}
      />
    );
  } catch (error) {
    console.error('[MarketingPixelsLoader] Error loading config:', error);
    return null;
  }
}






