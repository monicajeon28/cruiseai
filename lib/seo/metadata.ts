// lib/seo/metadata.ts
// SEO 메타데이터 생성 유틸리티

import prisma from '@/lib/prisma';
import type { Metadata } from 'next';

interface SeoConfigData {
  title?: string | null;
  description?: string | null;
  keywords?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  ogType?: string | null;
  ogUrl?: string | null;
  twitterCard?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImage?: string | null;
  canonicalUrl?: string | null;
  robots?: string | null;
  structuredData?: any;
}

/**
 * 페이지 경로에 대한 SEO 설정 조회
 */
export async function getSeoConfig(pagePath: string): Promise<SeoConfigData | null> {
  try {
    const config = await prisma.seoConfig.findUnique({
      where: { pagePath },
    });

    if (!config) {
      return null;
    }

    return {
      title: config.title,
      description: config.description,
      keywords: config.keywords,
      ogTitle: config.ogTitle,
      ogDescription: config.ogDescription,
      ogImage: config.ogImage,
      ogType: config.ogType,
      ogUrl: config.ogUrl,
      twitterCard: config.twitterCard,
      twitterTitle: config.twitterTitle,
      twitterDescription: config.twitterDescription,
      twitterImage: config.twitterImage,
      canonicalUrl: config.canonicalUrl,
      robots: config.robots,
      structuredData: config.structuredData,
    };
  } catch (error) {
    console.error('[getSeoConfig] Error:', error);
    return null;
  }
}

/**
 * Next.js Metadata 객체 생성
 */
export async function generateMetadata(
  pagePath: string,
  defaults?: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
  }
): Promise<Metadata> {
  const seoConfig = await getSeoConfig(pagePath);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cruisedot.co.kr';

  // SEO 설정이 있으면 우선 사용, 없으면 기본값 사용
  const title = seoConfig?.title || defaults?.title || '크루즈 가이드 - AI 여행 도우미';
  const description = seoConfig?.description || defaults?.description || '크루즈닷AI와 함께하는 특별한 크루즈 여행';
  const ogTitle = seoConfig?.ogTitle || seoConfig?.title || defaults?.title || title;
  const ogDescription = seoConfig?.ogDescription || seoConfig?.description || defaults?.description || description;
  const ogImage = seoConfig?.ogImage || defaults?.image || `${baseUrl}/images/ai-cruise-logo.png`;
  const ogUrl = seoConfig?.ogUrl || defaults?.url || `${baseUrl}${pagePath}`;
  const ogType = seoConfig?.ogType || 'website';
  const canonicalUrl = seoConfig?.canonicalUrl || `${baseUrl}${pagePath}`;
  const robots = seoConfig?.robots || 'index, follow';

  const metadata: Metadata = {
    title,
    description,
    keywords: seoConfig?.keywords ? seoConfig.keywords.split(',').map(k => k.trim()) : undefined,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: robots.includes('index'),
      follow: robots.includes('follow'),
      googleBot: {
        index: robots.includes('index'),
        follow: robots.includes('follow'),
      },
    },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: ogUrl,
      siteName: '크루즈 가이드',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: ogTitle,
        },
      ],
      locale: 'ko_KR',
      type: (ogType === 'product' ? 'website' : ogType) as 'website' | 'article',
    },
    twitter: {
      card: (seoConfig?.twitterCard as 'summary' | 'summary_large_image') || 'summary_large_image',
      title: seoConfig?.twitterTitle || ogTitle,
      description: seoConfig?.twitterDescription || ogDescription,
      images: seoConfig?.twitterImage ? [seoConfig.twitterImage] : [ogImage],
    },
  };

  return metadata;
}

/**
 * 구조화된 데이터 (JSON-LD) 생성
 */
export async function generateStructuredData(
  pagePath: string,
  type: 'product' | 'article' | 'organization' | 'website' | 'faq',
  data?: any
): Promise<object | null> {
  const seoConfig = await getSeoConfig(pagePath);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cruisedot.co.kr';

  // SEO 설정에 구조화된 데이터가 있으면 우선 사용
  if (seoConfig?.structuredData) {
    return seoConfig.structuredData;
  }

  // 타입별 기본 구조화된 데이터 생성
  switch (type) {
    case 'website':
      return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: '크루즈 가이드',
        alternateName: 'Cruise Guide',
        url: baseUrl,
        description: '크루즈닷AI와 함께하는 특별한 크루즈 여행',
        publisher: {
          '@type': 'Organization',
          name: '크루즈닷',
          logo: {
            '@type': 'ImageObject',
            url: `${baseUrl}/images/ai-cruise-logo.png`
          }
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${baseUrl}/products?search={search_term_string}`
          },
          'query-input': 'required name=search_term_string'
        }
      };

    case 'organization':
      return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: '크루즈닷',
        alternateName: 'CruiseDot',
        url: baseUrl,
        logo: `${baseUrl}/images/ai-cruise-logo.png`,
        description: '크루즈닷AI와 함께하는 특별한 크루즈 여행',
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: '010-3289-3800',
          contactType: 'customer service',
          areaServed: 'KR',
          availableLanguage: 'Korean'
        },
        sameAs: [
          'https://www.youtube.com/@cruisedoAI'
        ],
      };

    case 'product':
      if (!data) return null;
      return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: data.name || data.packageName,
        description: data.description,
        image: data.image || `${baseUrl}/images/ai-cruise-logo.png`,
        offers: {
          '@type': 'Offer',
          price: data.price || 0,
          priceCurrency: 'KRW',
          availability: 'https://schema.org/InStock',
        },
      };

    case 'article':
      if (!data) return null;
      return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: data.title,
        description: data.description,
        image: data.image || `${baseUrl}/images/ai-cruise-logo.png`,
        datePublished: data.publishedAt,
        dateModified: data.updatedAt,
        author: {
          '@type': 'Person',
          name: data.author || '크루즈 가이드',
        },
      };

    case 'faq':
      if (!data || !Array.isArray(data.questions)) return null;
      return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: data.questions.map((q: any) => ({
          '@type': 'Question',
          name: q.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: q.answer,
          },
        })),
      };

    default:
      return null;
  }
}

