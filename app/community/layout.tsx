// app/community/layout.tsx
// 커뮤니티 페이지 SEO 메타데이터

import type { Metadata } from 'next';
import { generateMetadata as generateSeoMetadata } from '@/lib/seo/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const pagePath = '/community';
  return generateSeoMetadata(pagePath, {
    title: '리뷰/커뮤니티 - 크루즈 가이드',
    description: '크루즈 여행자들과 정보를 공유하고 소통하는 공간입니다. 크루즈 후기, 여행 팁, 질문 답변을 만나보세요.',
    image: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://cruisedot.co.kr'}/images/ai-cruise-logo.png`,
    url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://cruisedot.co.kr'}/community`,
  });
}

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}






