// components/mall/ProductCard.tsx
'use client';

import { useState } from 'react';
import { FiStar } from 'react-icons/fi';
import Link from 'next/link';
import { PRODUCT_TAGS } from '@/components/admin/ProductTagsSelector';
import ProductReviewsModal from './ProductReviewsModal';

interface ProductCardProps {
  product: {
    id: number;
    productCode: string;
    cruiseLine: string;
    shipName: string;
    packageName: string;
    nights: number;
    days: number;
    basePrice: number | null;
    source?: string | null;
    destination?: string[] | string | null;
    thumbnail?: string | null;
    // 리뷰/평점 데이터 (추후 DB에서 가져올 수 있음)
    rating?: number;
    reviewCount?: number;
    isPopular?: boolean;
    isRecommended?: boolean;
    isPremium?: boolean;
    isGeniePack?: boolean;
    isDomestic?: boolean;
    isJapan?: boolean;
    isBudget?: boolean;
    tags?: string[] | null;
    category?: string | null;
    mallProductContent?: {
      layout?: any;
    } | null;
  };
  partnerId?: string;
}

export default function ProductCard({ product, partnerId }: ProductCardProps) {
  const [showReviewModal, setShowReviewModal] = useState(false);

  // 가격 포맷팅
  const formatPrice = (price: number | null) => {
    if (!price) return '가격 문의';
    return `${price.toLocaleString('ko-KR')}원`;
  };

  // 목적지 추출 (itineraryPattern에서 country 필드 추출) - "O개국 여행" 형식으로 표시
  const getDestinations = (): string => {
    // 1. product.destination이 있으면 사용
    if (product.destination) {
      if (Array.isArray(product.destination)) {
        const count = product.destination.length;
        return count > 0 ? `${count}개국 여행` : '목적지 미정';
      }
      if (typeof product.destination === 'string') {
        try {
          const parsed = JSON.parse(product.destination);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return `${parsed.length}개국 여행`;
          }
        } catch {
          // 파싱 실패 시 itineraryPattern으로 fallback
        }
      }
    }

    // 2. itineraryPattern에서 country 필드 추출
    const itineraryPattern = (product as any).itineraryPattern;
    if (itineraryPattern) {
      try {
        // 문자열인 경우 파싱
        const pattern = typeof itineraryPattern === 'string'
          ? JSON.parse(itineraryPattern)
          : itineraryPattern;

        if (Array.isArray(pattern)) {
          // 각 일정에서 country 필드 추출 (중복 제거)
          const countries = new Set<string>();
          const countryNames: Record<string, string> = {
            'JP': '일본', 'KR': '한국', 'TH': '태국', 'VN': '베트남', 'MY': '말레이시아',
            'SG': '싱가포르', 'ES': '스페인', 'FR': '프랑스', 'IT': '이탈리아', 'GR': '그리스',
            'TR': '터키', 'US': '미국', 'CN': '중국', 'TW': '대만', 'HK': '홍콩',
            'PH': '필리핀', 'ID': '인도네시아', 'NO': '노르웨이', 'HR': '크로아티아', 'CA': '캐나다'
          };

          pattern.forEach((day: any) => {
            if (day && typeof day === 'object' && day.country && day.country !== 'KR') {
              const countryCode = day.country.toString().toUpperCase();
              countries.add(countryCode);
            }
          });

          const countryCount = countries.size;
          return countryCount > 0 ? `${countryCount}개국 여행` : '목적지 미정';
        }
      } catch (e) {
        console.error('[ProductCard] itineraryPattern 파싱 실패:', e);
      }
    }

    return '목적지 미정';
  };

  // 별점 (layout에서 가져오기 또는 기본값)
  const layout = product.mallProductContent?.layout
    ? (typeof product.mallProductContent.layout === 'string'
      ? JSON.parse(product.mallProductContent.layout)
      : product.mallProductContent.layout)
    : null;
  const rating = layout?.rating || product.rating || 4.5;
  const reviewCount = layout?.reviewCount || product.reviewCount || 243;

  const classificationBadges = [
    product.isPopular ? { label: '인기', color: 'bg-rose-500' } : null,
    product.isRecommended ? { label: '추천', color: 'bg-blue-500' } : null,
    product.isPremium ? { label: '프리미엄', color: 'bg-violet-500' } : null,
    product.isGeniePack ? { label: '크루즈닷팩', color: 'bg-indigo-500' } : null,
    product.isDomestic ? { label: '국내출', color: 'bg-emerald-500' } : null,
    product.isJapan ? { label: '일본', color: 'bg-amber-500' } : null,
    product.isBudget ? { label: '알뜰', color: 'bg-teal-500' } : null,
  ].filter(Boolean) as Array<{ label: string; color: string }>;

  const targetHref = partnerId
    ? `/products/${product.productCode}?partner=${encodeURIComponent(partnerId)}`
    : `/products/${product.productCode}`;

  return (
    <>
    <Link
      href={targetHref}
      className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border-2 border-gray-100 hover:border-[#D4AF37] group h-full flex flex-col cursor-pointer hover:-translate-y-1 block no-underline"
    >
      {/* 썸네일 이미지 (유튜브 스타일 - 16:9 비율) */}
      <div className="relative w-full aspect-video bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 overflow-hidden">
        {product.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={(() => {
              const url = product.thumbnail;
              if (!url) return '';
              // admin proxy URL을 public proxy URL로 변환
              if (url.includes('/api/admin/mall/google-drive-image')) {
                return url.replace('/api/admin/mall/google-drive-image', '/api/public/image-proxy');
              }
              // Google Drive URL인 경우 public proxy 사용
              if (url.includes('drive.google.com')) {
                const match = url.match(/id=([^&]+)/) || url.match(/\/d\/([^/]+)/);
                if (match) return `/api/public/image-proxy?fileId=${match[1]}`;
              }
              return url;
            })()}
            alt={`${product.cruiseLine} ${product.shipName} - ${product.packageName} 크루즈 여행 상품 이미지`}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-4 py-2">
            <div className="text-center text-gray-700 w-full">
              <p className="text-2xl md:text-3xl lg:text-4xl font-bold line-clamp-2 break-words leading-tight px-2">
                {product.shipName}
              </p>
              <p className="text-sm md:text-base lg:text-lg mt-2 opacity-90 font-bold text-[#051C2C] line-clamp-1 break-words px-2">
                {product.cruiseLine}
              </p>
            </div>
          </div>
        )}
        {/* 딱지들 - 썸네일 왼쪽 위에 표시 (더 작고 세련되게) */}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 z-10">
          {classificationBadges.map((badge) => (
            <div
              key={badge.label}
              className={`${badge.color} text-white px-2.5 py-1 rounded-md text-xs font-bold shadow-md backdrop-blur-sm bg-opacity-95`}
            >
              {badge.label}
            </div>
          ))}
          {/* 추가 딱지들 (layout에서 가져오기) */}
          {layout?.badges && Array.isArray(layout.badges) && layout.badges.map((badge: string) => {
            const badgeConfig: Record<string, { label: string; color: string }> = {
              'event': { label: '이벤트', color: 'bg-purple-500' },
              'theme': { label: '테마', color: 'bg-pink-500' },
              'departure-soon': { label: '출발임박', color: 'bg-orange-500' },
              'package-confirmed': { label: '패키지확정', color: 'bg-emerald-500' },
              'closing-soon': { label: '마감임박', color: 'bg-rose-600' },
            };
            const config = badgeConfig[badge];
            if (!config) return null;
            return (
              <div key={badge} className={`${config.color} text-white px-2.5 py-1 rounded-md text-xs font-bold shadow-md backdrop-blur-sm bg-opacity-95`}>
                {config.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* 상품 정보 */}
      <div className="p-4 md:p-5 flex-1 flex flex-col">
        {/* 크루즈명 및 여행 기간 */}
        <div className="flex items-start gap-2.5 mb-3">
          {/* 출처 로고 */}
          {product.source === 'cruisedot' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/images/ai-cruise-logo.png"
              alt="크루즈닷"
              className="w-10 h-10 md:w-12 md:h-12 object-contain flex-shrink-0 mt-0.5"
            />
          )}
          {product.source === 'wcruise' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/images/wcruise-logo.png"
              alt="W크루즈"
              className="w-10 h-10 md:w-12 md:h-12 object-contain flex-shrink-0 mt-0.5"
            />
          )}
          {product.source === 'lottejtb' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/images/롯데제이티비.png"
              alt="롯데 제이티비"
              className="w-10 h-10 md:w-12 md:h-12 object-contain flex-shrink-0 mt-0.5"
            />
          )}
          <h3 className="text-base md:text-lg font-bold text-[#051C2C] line-clamp-2 group-hover:text-[#D4AF37] transition-colors flex-1 leading-snug">
            {product.packageName}
          </h3>
        </div>

        <div className="flex items-center text-sm md:text-base text-gray-600 mb-3 font-medium flex-wrap gap-1.5">
          <span className="whitespace-nowrap">{product.nights}박 {product.days}일</span>
          <span className="text-gray-300">·</span>
          <span className="line-clamp-1 break-words flex-1 min-w-0 text-[#00008B] font-extrabold">{getDestinations()}</span>
          {(product as any).category && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-[#1e40af] font-bold">{(product as any).category}</span>
            </>
          )}
        </div>

        {/* 별점 및 리뷰 */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1">
            <span className="text-[#D4AF37] fill-[#D4AF37]">★</span>
            <span className="text-black font-bold">{rating.toFixed(1)}</span>
            <span className="text-gray-400 text-sm">({reviewCount.toLocaleString('ko-KR')})</span>
          </div>
          {reviewCount > 0 ? (
            <button
              type="button"
              className="text-xs md:text-sm text-gray-500 font-medium hover:text-[#D4AF37] transition-colors text-left bg-transparent border-0 p-0 cursor-pointer"
              onClick={(e) => {
                // 리뷰 클릭 시 모달로 표시 (새 창 이동 대신)
                e.stopPropagation();
                e.preventDefault();
                setShowReviewModal(true);
              }}
            >
              크루즈 여행 리뷰 {reviewCount.toLocaleString('ko-KR')}개
            </button>
          ) : (
            <span className="text-xs md:text-sm text-gray-500 font-medium">
              크루즈 여행 리뷰 {reviewCount.toLocaleString('ko-KR')}개
            </span>
          )}
        </div>

        {/* 후킹 태그 표시 - 이용자 리뷰 밑에 */}
        {(product as any).tags && Array.isArray((product as any).tags) && (product as any).tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(product as any).tags.slice(0, 3).map((tagId: string) => {
              const tag = PRODUCT_TAGS.find(t => t.id === tagId);
              if (!tag) return null;
              return (
                <span
                  key={tagId}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold text-white ${tag.color} shadow-sm`}
                >
                  <span>{tag.emoji}</span>
                  <span>{tag.label}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* 이벤트 가격 */}
        <div className="pt-3 border-t border-gray-100 mt-auto">
          <div className="space-y-0.5">
            <div className="text-xs text-gray-500 font-medium">이벤트 가격</div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <div className="text-xl md:text-2xl font-bold text-[#051C2C] leading-tight break-keep">
                {formatPrice(product.basePrice)}
              </div>
              {product.basePrice && (
                <div className="flex items-center gap-1 text-sm md:text-base">
                  <span className="text-gray-400 font-medium">/</span>
                  <span className="text-[#FF0000] font-black text-xl md:text-2xl drop-shadow-sm">
                    월 {Math.ceil(product.basePrice / 12).toLocaleString('ko-KR')}원
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>

    {/* 리뷰 모달 */}
    <ProductReviewsModal
      isOpen={showReviewModal}
      onClose={() => setShowReviewModal(false)}
      productCode={product.productCode}
      productName={product.packageName}
      cruiseLine={product.cruiseLine}
      shipName={product.shipName}
      rating={rating}
      reviewCount={reviewCount}
    />
    </>
  );
}










