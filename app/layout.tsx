import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { validateEnv } from "@/lib/env";
import { initializeApp } from "@/lib/init";
import Providers from "./providers";
import ConditionalBottomNavBar from "@/components/layout/ConditionalBottomNavBar";
import ConditionalBottomPadding from "@/components/layout/ConditionalBottomPadding";
import ConditionalPushNotification from "@/components/ConditionalPushNotification";
import PWASetup from "@/components/PWASetup";

if (typeof window === "undefined") {
  validateEnv();
  initializeApp().catch((err) => console.error("[Layout] 초기화 오류:", err));
}

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://guide.cruisedot.co.kr'),
  title: "크루즈 가이드 - AI 여행 도우미",
  description: "AI 가이드 크루즈닷과 함께하는 특별한 크루즈 여행. 실시간 AI 안내, 통번역, 기항지 지도, 체크리스트까지.",
  manifest: "/manifest.json",
  openGraph: {
    title: "크루즈 가이드 - AI 여행 도우미",
    description: "AI 가이드 크루즈닷과 함께하는 특별한 크루즈 여행",
    url: process.env.NEXT_PUBLIC_BASE_URL || "https://guide.cruisedot.co.kr",
    siteName: "크루즈 가이드",
    locale: "ko_KR",
    type: "website",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#E50914" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        {/* 가이드 앱은 크롤링 불필요 */}
        <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
        <meta name="googlebot" content="noindex, nofollow" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/images/ai-cruise-logo.png" type="image/png" sizes="512x512" />
      </head>
      <body className={inter.className}>
        <PWASetup />
        <Providers>
          <ConditionalBottomPadding>
            {children}
          </ConditionalBottomPadding>
          <ConditionalBottomNavBar />
          <ConditionalPushNotification />
        </Providers>
      </body>
    </html>
  );
}
