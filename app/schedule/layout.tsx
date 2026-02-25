// app/schedule/layout.tsx
// 일정 페이지 SEO 메타데이터

import type { Metadata } from 'next';
import { generateMetadata as generateSeoMetadata } from '@/lib/seo/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const pagePath = '/schedule';
  return generateSeoMetadata(pagePath, {
    title: '오늘의 브리핑 - 크루즈 가이드 | 크루즈 일정, 여행 정보',
    description: '크루즈 여행 일정과 오늘의 브리핑을 확인하세요. 크루즈 선박 일정, 항구 정보, 여행 준비까지 모든 것을 한 눈에 확인하세요.',
    image: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://cruisedot.co.kr'}/images/ai-cruise-logo.png`,
    url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://cruisedot.co.kr'}/schedule`,
  });
}

export default function ScheduleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}






