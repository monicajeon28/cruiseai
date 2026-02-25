// app/my-trips/layout.tsx
// 내 여행 목록 페이지 SEO 메타데이터

import type { Metadata } from 'next';
import { generateMetadata as generateSeoMetadata } from '@/lib/seo/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const pagePath = '/my-trips';
  return generateSeoMetadata(pagePath, {
    title: '내 여행 목록 - 크루즈 가이드 | 예약한 크루즈 여행 확인',
    description: '예약한 크루즈 여행 목록을 확인하세요. 여행 일정, 선박 정보, 목적지 등 모든 여행 정보를 한 곳에서 관리하세요.',
    image: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://cruisedot.co.kr'}/images/ai-cruise-logo.png`,
    url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://cruisedot.co.kr'}/my-trips`,
  });
}

export default function MyTripsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}






