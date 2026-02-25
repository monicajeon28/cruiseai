// lib/seo/structured-data.ts
// 구조화된 데이터 생성 유틸리티 (추가 타입)

import { generateStructuredData } from './metadata';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cruisedot.co.kr';

/**
 * BreadcrumbList 구조화된 데이터 생성
 */
export function generateBreadcrumbList(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}`,
    })),
  };
}

/**
 * ItemList 구조화된 데이터 생성 (상품 목록용)
 */
export function generateItemList(items: Array<{
  name: string;
  description?: string;
  url: string;
  image?: string;
  price?: number;
}>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: item.name,
        description: item.description,
        image: item.image || `${baseUrl}/images/ai-cruise-logo.png`,
        url: item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}`,
        ...(item.price && {
          offers: {
            '@type': 'Offer',
            price: item.price,
            priceCurrency: 'KRW',
            availability: 'https://schema.org/InStock',
          },
        }),
      },
    })),
  };
}

/**
 * Service 구조화된 데이터 생성 (크루즈 여행 서비스용)
 */
export function generateService(data: {
  name: string;
  description: string;
  serviceType: string;
  areaServed?: string;
  provider?: {
    name: string;
    url: string;
  };
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: data.name,
    description: data.description,
    serviceType: data.serviceType,
    provider: data.provider ? {
      '@type': 'Organization',
      name: data.provider.name,
      url: data.provider.url,
    } : {
      '@type': 'Organization',
      name: '크루즈닷',
      url: baseUrl,
    },
    areaServed: data.areaServed || 'KR',
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: baseUrl,
      serviceType: 'Online',
    },
  };
}

/**
 * Review 구조화된 데이터 생성
 */
export function generateReview(data: {
  itemReviewed: {
    name: string;
    type: 'Product' | 'Service';
  };
  reviewRating: {
    ratingValue: number;
    bestRating?: number;
  };
  author: {
    name: string;
  };
  reviewBody: string;
  datePublished: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': data.itemReviewed.type,
      name: data.itemReviewed.name,
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: data.reviewRating.ratingValue,
      bestRating: data.reviewRating.bestRating || 5,
    },
    author: {
      '@type': 'Person',
      name: data.author.name,
    },
    reviewBody: data.reviewBody,
    datePublished: data.datePublished,
  };
}

/**
 * AggregateRating 구조화된 데이터 생성
 */
export function generateAggregateRating(data: {
  itemReviewed: {
    name: string;
    type: 'Product' | 'Service';
  };
  ratingValue: number;
  reviewCount: number;
  bestRating?: number;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AggregateRating',
    itemReviewed: {
      '@type': data.itemReviewed.type,
      name: data.itemReviewed.name,
    },
    ratingValue: data.ratingValue,
    reviewCount: data.reviewCount,
    bestRating: data.bestRating || 5,
  };
}

/**
 * LocalBusiness 구조화된 데이터 생성 (지역별 서비스용)
 */
export function generateLocalBusiness(data: {
  name: string;
  description: string;
  address?: {
    streetAddress?: string;
    addressLocality: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry: string;
  };
  telephone?: string;
  openingHours?: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: data.name,
    description: data.description,
    ...(data.address && {
      address: {
        '@type': 'PostalAddress',
        streetAddress: data.address.streetAddress,
        addressLocality: data.address.addressLocality,
        addressRegion: data.address.addressRegion,
        postalCode: data.address.postalCode,
        addressCountry: data.address.addressCountry,
      },
    }),
    ...(data.telephone && { telephone: data.telephone }),
    ...(data.openingHours && { openingHours: data.openingHours }),
    url: baseUrl,
  };
}






