'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import ProductCard from './ProductCard';

type ThemeSectionConfig = {
  id: string;
  enabled: boolean;
  title: string;
  subtitle?: string;
  displayType: 'carousel' | 'grid';
  themeType: 'classification' | 'cruiseLine' | 'category' | 'tag';
  themeValue: string;
  limit: number;
  linkText?: string;
  linkUrl?: string;
};

interface Product {
  id: number;
  productCode: string;
  cruiseLine: string | null;
  shipName: string | null;
  packageName: string | null;
  nights: number | null;
  days: number | null;
  basePrice: number | null;
  description?: string | null;
  source?: string | null;
  thumbnailUrl?: string | null;
  tags?: string[] | null;
  isPopular?: boolean;
  isRecommended?: boolean;
  isPremium?: boolean;
  isGeniePack?: boolean;
  isDomestic?: boolean;
  isJapan?: boolean;
  isBudget?: boolean;
}

interface ThemeProductSectionProps {
  section: ThemeSectionConfig;
}

const classificationLabelMap: Record<string, string> = {
  popular: '인기 크루즈',
  recommended: '추천 크루즈',
  premium: '프리미엄 크루즈',
  genie: '크루즈닷패키지 크루즈',
  domestic: '국내출발 크루즈',
  japan: '일본 크루즈',
  budget: '알뜰 크루즈',
};

export default function ThemeProductSection({ section }: ThemeProductSectionProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const sectionTitle = section.title || getDefaultTitle(section);

  useEffect(() => {
    if (!section.enabled) return;

    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set('themeType', section.themeType);
    params.set('themeValue', section.themeValue);
    params.set('themeLimit', String(section.limit || 8));

    setLoading(true);
    setError(null);

    fetch(`/api/public/products?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('상품을 불러오지 못했습니다.');
        }
        const data = await response.json();
        if (data.ok && Array.isArray(data.products)) {
          setProducts(data.products);
        } else {
          throw new Error(data.error || '상품을 불러오지 못했습니다.');
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('[ThemeProductSection] load error:', err);
        setError(err.message || '상품을 불러오지 못했습니다.');
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [section.enabled, section.themeType, section.themeValue, section.limit]);

  const descriptionText = useMemo(() => {
    if (section.subtitle) return section.subtitle;

    switch (section.themeType) {
      case 'classification':
        return `${classificationLabelMap[section.themeValue] || section.themeValue} 상품을 모아봤어요.`;
      case 'cruiseLine':
        return `${section.themeValue} 선사 상품을 한눈에 확인하세요.`;
      case 'category':
        return `${section.themeValue} 테마의 상품을 소개합니다.`;
      case 'tag':
        return `${section.themeValue.replace(/^#?/, '#')} 태그가 포함된 상품을 모았습니다.`;
      default:
        return '';
    }
  }, [section.subtitle, section.themeType, section.themeValue]);

  if (!section.enabled) {
    return null;
  }

  if (!loading && !error && products.length === 0) {
    return null;
  }

  const handleScroll = (direction: 'prev' | 'next') => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollAmount = container.clientWidth * 0.8;
    const nextPosition = direction === 'next' ? container.scrollLeft + scrollAmount : container.scrollLeft - scrollAmount;
    container.scrollTo({ left: nextPosition, behavior: 'smooth' });
  };

  return (
    <section className="container mx-auto px-4 py-12 md:py-16" id={`theme-${section.id}`}>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">{sectionTitle}</h2>
          {descriptionText && <p className="text-lg text-gray-600 max-w-3xl leading-relaxed whitespace-pre-wrap">{descriptionText}</p>}
        </div>
        {section.linkUrl && (
          <a
            href={section.linkUrl}
            className="inline-flex items-center gap-2 text-red-600 font-semibold text-base md:text-lg"
          >
            {section.linkText || '크루즈 상품 전체 보기'} →
          </a>
        )}
      </div>

      {loading && (
        <div className="w-full bg-gray-100 rounded-xl p-12 text-center text-gray-500">상품을 불러오는 중입니다...</div>
      )}

      {error && (
        <div className="w-full bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 text-center">{error}</div>
      )}

      {!loading && !error && products.length > 0 && (
        section.displayType === 'carousel' ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => handleScroll('prev')}
              className="hidden md:flex absolute -left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white shadow-lg border border-gray-200 items-center justify-center text-gray-600 hover:bg-gray-50"
              aria-label="이전 상품"
            >
              <FiChevronLeft size={24} />
            </button>
            <div
              ref={scrollContainerRef}
              className="flex gap-5 overflow-x-auto scroll-smooth pb-4 snap-x snap-mandatory"
            >
              {products.map((product) => (
                <div key={`${section.id}-${product.id}`} className="min-w-[280px] max-w-[320px] snap-start">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => handleScroll('next')}
              className="hidden md:flex absolute -right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white shadow-lg border border-gray-200 items-center justify-center text-gray-600 hover:bg-gray-50"
              aria-label="다음 상품"
            >
              <FiChevronRight size={24} />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {products.map((product) => (
              <ProductCard key={`${section.id}-${product.id}`} product={product} />
            ))}
          </div>
        )
      )}
    </section>
  );
}

function getDefaultTitle(section: ThemeSectionConfig) {
  if (section.title) return section.title;

  if (section.themeType === 'classification') {
    return classificationLabelMap[section.themeValue] || '추천 크루즈 모음';
  }

  if (section.themeType === 'cruiseLine') {
    return `${section.themeValue} 선사 추천`;
  }

  if (section.themeType === 'category') {
    return `${section.themeValue} 상품 모음`;
  }

  if (section.themeType === 'tag') {
    return `${section.themeValue.replace(/^#?/, '#')} 테마 추천`;
  }

  return '추천 크루즈 모음';
}







