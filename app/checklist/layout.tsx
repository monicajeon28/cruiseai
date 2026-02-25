// app/checklist/layout.tsx
// 체크리스트 페이지 SEO 메타데이터

import type { Metadata } from 'next';
import { generateMetadata as generateSeoMetadata } from '@/lib/seo/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const pagePath = '/checklist';
  return generateSeoMetadata(pagePath, {
    title: '크루즈 여행 체크리스트 - 크루즈 가이드 | 여행 준비물, 필수 체크리스트',
    description: '크루즈 여행을 위한 완벽한 체크리스트. 여행 준비물, 필수 아이템, 금지 품목까지 모든 것을 확인하세요. 크루즈 여행 준비를 한 번에 완료하세요.',
    image: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://cruisedot.co.kr'}/images/ai-cruise-logo.png`,
    url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://cruisedot.co.kr'}/checklist`,
  });
}

export default function ChecklistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}






