// components/mall/ProductList.tsx
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';
import Image from 'next/image';
import ProductCard from './ProductCard';
import cruiseShipsData from '@/data/cruise_ships.json';
import { normalize } from '@/utils/normalize';
import { FiYoutube } from 'react-icons/fi'; // Added FiYoutube import

interface Product {
  id: number;
  productCode: string;
  cruiseLine: string;
  shipName: string;
  packageName: string;
  nights: number;
  days: number;
  basePrice: number | null;
  source: string | null;
  destination?: any;
  itineraryPattern?: any; // 일정 패턴 (JSON)
  rating?: number;
  reviewCount?: number;
  isPopular?: boolean;
  isRecommended?: boolean;
  isPremium?: boolean;
  isGeniePack?: boolean;
  isDomestic?: boolean;
  isJapan?: boolean;
  isBudget?: boolean;
}

interface MallSettings {
  'popular-banner'?: {
    title: string;
    buttons: Array<{ text: string; icon: string }>;
    rightBadge: { topText: string; bottomText: string };
  };
  'recommended-banner'?: {
    title: string;
    buttons: Array<{ text: string; icon: string }>;
    rightBadge: { topText: string; bottomText: string };
  };
  'product-display-settings'?: {
    popularRows: number;
    recommendedRows: number;
  };
  'menu-bar-settings'?: {
    filters: Array<{ value: string; label: string; enabled: boolean }>;
  };
  'recommended-below-settings'?: {
    type: 'none' | 'banner' | 'products';
    banner: { image: string; title: string; link: string };
    products: { count: number; category: string };
  };
}

// 기본 필터 옵션 (설정이 없을 때 사용)
const DEFAULT_REGION_FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'japan', label: '일본' },
  { value: 'southeast-asia', label: '동남아' },
  { value: 'singapore', label: '싱가포르' },
  { value: 'western-mediterranean', label: '서부지중해' },
  { value: 'eastern-mediterranean', label: '동부지중해' },
  { value: 'alaska', label: '알래스카' },
];

type PartnerContext = {
  mallUserId: string;
  profileTitle?: string | null;
  landingAnnouncement?: string | null;
  welcomeMessage?: string | null;
  profileImage?: string | null;
  coverImage?: string | null;
  featuredProductCodes?: string[]; // 개인 링크로 등록된 상품 코드 목록
};

type ProductListProps = {
  partnerContext?: PartnerContext | null;
  featuredProductCodes?: string[]; // 개인 링크로 등록된 상품 코드 목록 (직접 전달도 가능)
};

export default function ProductList({ partnerContext = null, featuredProductCodes: featuredProductCodesProp }: ProductListProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]); // 개인 링크 상품
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFeatured, setIsLoadingFeatured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<MallSettings>({});

  // featuredProductCodes는 prop 또는 partnerContext에서 가져옴
  const featuredProductCodes = featuredProductCodesProp || partnerContext?.featuredProductCodes || [];
  const [filters, setFilters] = useState({
    region: 'all', // 나라별 필터
    type: 'all', // 'all', 'popular', 'recommended'
    sort: 'newest', // 'newest', 'price_asc', 'price_desc', 'popular'
    cruiseLine: 'all', // 크루즈 라인 필터
    shipName: 'all', // 선박명 필터
  });

  // 크루즈 라인/선박명 검색 상태
  const [cruiseLineSearchTerm, setCruiseLineSearchTerm] = useState('');
  const [cruiseLineDropdownOpen, setCruiseLineDropdownOpen] = useState(false);
  const [shipNameSearchTerm, setShipNameSearchTerm] = useState('');
  const [shipNameDropdownOpen, setShipNameDropdownOpen] = useState(false);
  const cruiseLineDropdownRef = useRef<HTMLDivElement>(null);
  const shipNameDropdownRef = useRef<HTMLDivElement>(null);
  const popularScrollRef = useRef<HTMLDivElement>(null);
  const recommendedScrollRef = useRef<HTMLDivElement>(null);
  const featuredScrollRef = useRef<HTMLDivElement>(null); // 개인 링크 상품 스크롤용
  const allProductsScrollRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [belowProducts, setBelowProducts] = useState<Product[]>([]);
  const [shouldScrollToProducts, setShouldScrollToProducts] = useState(false);
  const [availableRegions, setAvailableRegions] = useState<Set<string>>(new Set(['all'])); // 판매 중인 상품이 있는 지역

  const isPartnerMall = Boolean(partnerContext && partnerContext.mallUserId);
  const partnerProfileTitle = partnerContext?.profileTitle
    ? String(partnerContext.profileTitle).trim()
    : partnerContext?.mallUserId
      ? `${partnerContext.mallUserId} 파트너몰`
      : '크루즈닷 파트너몰';
  const partnerAnnouncement = partnerContext?.landingAnnouncement
    ? String(partnerContext.landingAnnouncement).trim()
    : '';
  const partnerWelcome = partnerContext?.welcomeMessage
    ? String(partnerContext.welcomeMessage).trim()
    : '';
  const partnerId = partnerContext?.mallUserId || undefined;
  // 크루즈선사 목록 생성 (한국어 이름을 value로 사용)
  const cruiseLineOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    (cruiseShipsData as any[]).forEach((line) => {
      const cruiseLineShort = line.cruise_line.split('(')[0].trim(); // 한국어 이름
      options.push({
        value: cruiseLineShort, // 한국어 이름을 value로 사용
        label: cruiseLineShort
      });
    });
    return options;
  }, []);

  // 선택된 크루즈선사에 해당하는 크루즈선 목록 (한국어 이름을 value로 사용)
  const shipNameOptions = useMemo(() => {
    if (!filters.cruiseLine || filters.cruiseLine === 'all') return [];

    const selectedLine = (cruiseShipsData as any[]).find((line) => {
      const cruiseLineShort = line.cruise_line.split('(')[0].trim();
      return cruiseLineShort === filters.cruiseLine;
    });

    if (!selectedLine) return [];

    const options: Array<{ value: string; label: string }> = [];
    selectedLine.ships.forEach((ship: string) => {
      const shipNameShort = ship.split('(')[0].trim(); // 한국어 이름

      let displayLabel = shipNameShort;
      const cruiseLineKeywords = selectedLine.cruise_line.split('(')[0].trim().split(' ').filter((word: string) => word.length > 1);
      const hasCruiseLineInShipName = cruiseLineKeywords.some((keyword: string) =>
        shipNameShort.includes(keyword)
      );

      if (!hasCruiseLineInShipName) {
        const simpleCruiseLine = cruiseLineKeywords[0] || selectedLine.cruise_line.split('(')[0].trim();
        displayLabel = `${simpleCruiseLine} ${shipNameShort}`;
      }

      options.push({
        value: shipNameShort, // 한국어 이름을 value로 사용
        label: displayLabel
      });
    });
    return options;
  }, [filters.cruiseLine]);

  // 필터링된 크루즈선사 옵션 (한국어 검색)
  const filteredCruiseLineOptions = useMemo(() => {
    if (!cruiseLineSearchTerm.trim()) {
      return cruiseLineOptions.slice(0, 50);
    }
    const term = normalize(cruiseLineSearchTerm);
    return cruiseLineOptions.filter(option =>
      normalize(option.label).includes(term) || normalize(option.value).includes(term)
    ).slice(0, 50);
  }, [cruiseLineSearchTerm, cruiseLineOptions]);

  // 필터링된 크루즈선 이름 옵션 (한국어 검색)
  const filteredShipNameOptions = useMemo(() => {
    if (!shipNameSearchTerm.trim()) {
      return shipNameOptions.slice(0, 50);
    }
    const term = normalize(shipNameSearchTerm);
    return shipNameOptions.filter(option =>
      normalize(option.label).includes(term) || normalize(option.value).includes(term)
    ).slice(0, 50);
  }, [shipNameSearchTerm, shipNameOptions]);

  // 선택된 크루즈선사 라벨
  const selectedCruiseLineLabel = useMemo(() => {
    if (filters.cruiseLine === 'all') return '';
    const option = cruiseLineOptions.find(opt => opt.value === filters.cruiseLine);
    return option?.label || filters.cruiseLine || '';
  }, [filters.cruiseLine, cruiseLineOptions]);

  // 선택된 크루즈선 이름 라벨
  const selectedShipNameLabel = useMemo(() => {
    if (filters.shipName === 'all') return '';
    const option = shipNameOptions.find(opt => opt.value === filters.shipName);
    return option?.label || filters.shipName || '';
  }, [filters.shipName, shipNameOptions]);

  // 크루즈 라인 선택 핸들러
  const handleCruiseLineSelect = (value: string) => {
    setFilters({ ...filters, cruiseLine: value, shipName: 'all' }); // 크루즈선사 변경 시 크루즈선 이름 초기화
    setCruiseLineSearchTerm('');
    setCruiseLineDropdownOpen(false);
    setPage(1);
  };

  // 선박명 선택 핸들러
  const handleShipNameSelect = (value: string) => {
    setFilters({ ...filters, shipName: value });
    setShipNameSearchTerm('');
    setShipNameDropdownOpen(false);
    setPage(1);
  };

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cruiseLineDropdownRef.current && !cruiseLineDropdownRef.current.contains(event.target as Node)) {
        setCruiseLineDropdownOpen(false);
      }
      if (shipNameDropdownRef.current && !shipNameDropdownRef.current.contains(event.target as Node)) {
        setShipNameDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // 페이지를 먼저 표시하고 백그라운드에서 로드
    setIsLoading(false);
    // 설정 불러오기
    loadSettings();
    // 판매 중인 상품이 있는 지역 확인
    loadAvailableRegions();
    // 개인 링크 상품 로드
    if (featuredProductCodes.length > 0) {
      loadFeaturedProducts();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // featuredProductCodes가 변경되면 다시 로드

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (featuredProductCodes.length > 0) {
      loadFeaturedProducts();
    } else {
      setFeaturedProducts([]);
    }
  }, [featuredProductCodes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadProducts();
  }, [filters, page]);

  useEffect(() => {
    // 필터 변경 시 상품 목록으로 스크롤
    if (shouldScrollToProducts && filters.region !== 'all') {
      setTimeout(() => {
        const productSection = document.getElementById('products');
        if (productSection) {
          productSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setShouldScrollToProducts(false);
      }, 300);
    }
  }, [shouldScrollToProducts, filters.region]);

  useEffect(() => {
    // 설정이 로드되고 추천크루즈 밑 상품 설정이 있으면 추가 상품 로드
    if (settings['recommended-below-settings']?.type === 'products') {
      loadBelowProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const loadSettings = async () => {
    try {
      const apiUrl = '/api/public/mall-settings';
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${apiUrl}`);
      }

      const data = await response.json();
      if (data.ok && data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/public/mall-settings` : '/api/public/mall-settings';
      console.error('[ProductList] 설정 로드 실패:', fullUrl, error);
      // 설정 로드 실패 시 기본값 사용
    }
  };

  // 판매 중인 상품이 있는 지역 확인
  const loadAvailableRegions = async () => {
    try {
      // 모든 상품을 가져와서 지역별로 상품이 있는지 확인
      const apiUrl = '/api/public/products?limit=1000';
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${apiUrl}`);
      }

      const data = await response.json();

      if (data.ok && Array.isArray(data.products)) {
        const regions = new Set<string>(['all']); // '전체'는 항상 포함

        // 각 지역별로 상품이 있는지 확인
        const regionMap: Record<string, string[]> = {
          'japan': ['JP', 'Japan', '일본'],
          'southeast-asia': ['TH', 'Thailand', '태국', 'VN', 'Vietnam', '베트남', 'MY', 'Malaysia', '말레이시아'],
          'singapore': ['SG', 'Singapore', '싱가포르'],
          'western-mediterranean': ['ES', 'Spain', '스페인', 'FR', 'France', '프랑스', 'IT', 'Italy', '이탈리아'],
          'eastern-mediterranean': ['GR', 'Greece', '그리스', 'TR', 'Turkey', '터키'],
          'alaska': ['US', 'USA', '미국', 'Alaska', '알래스카'],
        };

        data.products.forEach((product: Product) => {
          if (!product.itineraryPattern || !Array.isArray(product.itineraryPattern)) {
            return;
          }

          // 각 지역별로 상품이 있는지 확인
          Object.entries(regionMap).forEach(([regionKey, keywords]) => {
            const hasRegion = product.itineraryPattern.some((item: any) => {
              if (typeof item === 'object' && item.country) {
                const country = item.country.toString().toUpperCase();
                return keywords.some(keyword => country.includes(keyword.toUpperCase()));
              }
              return false;
            });

            if (hasRegion) {
              regions.add(regionKey);
            }
          });
        });

        setAvailableRegions(regions);
      }
    } catch (error) {
      const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/public/products?limit=1000` : '/api/public/products?limit=1000';
      console.error('[ProductList] 지역 정보 로드 실패:', fullUrl, error);
      // 실패 시 기본값 사용 (전체만 표시)
      setAvailableRegions(new Set(['all']));
    }
  };

  const scrollLeft = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollBy({ left: -400, behavior: 'smooth' });
    }
  };

  const scrollRight = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollBy({ left: 400, behavior: 'smooth' });
    }
  };

  // 개인 링크 상품 로드
  const loadFeaturedProducts = async () => {
    const codesToLoad = featuredProductCodesProp || partnerContext?.featuredProductCodes || [];

    console.log('[ProductList] loadFeaturedProducts 호출:', {
      codesToLoad,
      codesToLoadLength: codesToLoad.length,
      featuredProductCodesProp,
      partnerContextFeaturedCodes: partnerContext?.featuredProductCodes,
    });

    if (codesToLoad.length === 0) {
      console.log('[ProductList] featuredProductCodes가 비어있어서 상품을 로드하지 않습니다.');
      setFeaturedProducts([]);
      return;
    }

    try {
      setIsLoadingFeatured(true);

      console.log('[ProductList] 상품 로드 시작:', codesToLoad);

      // 각 상품 코드에 대해 상품 정보 조회
      const productPromises = codesToLoad.map(async (productCode) => {
        try {
          const apiUrl = `/api/public/products/${productCode}`;
          const response = await fetch(apiUrl);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${apiUrl}`);
          }

          const data = await response.json();

          if (data.ok && data.product) {
            const p = data.product;
            const {
              MallProductContent,
              mallProductContent: existingMallContent,
              ...rest
            } = p;

            const mallContent = existingMallContent ?? MallProductContent ?? null;
            const layout = mallContent?.layout
              ? (typeof mallContent.layout === 'string'
                ? JSON.parse(mallContent.layout)
                : mallContent.layout)
              : null;
            const rating = layout?.rating || p.rating || 4.0 + Math.random() * 1.0;
            const reviewCount = layout?.reviewCount || p.reviewCount || Math.floor(Math.random() * 500) + 50;

            return {
              ...rest,
              mallProductContent: mallContent,
              rating,
              reviewCount,
              isPopular: Boolean(p.isPopular),
              isRecommended: Boolean(p.isRecommended),
              isPremium: Boolean(p.isPremium),
              isGeniePack: Boolean(p.isGeniePack),
              isDomestic: Boolean(p.isDomestic),
              isJapan: Boolean(p.isJapan),
              isBudget: Boolean(p.isBudget),
            } as Product;
          }
          return null;
        } catch (error) {
          const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/public/products/${productCode}` : `/api/public/products/${productCode}`;
          console.error(`[ProductList] 상품 로드 실패:`, fullUrl, error);
          return null;
        }
      });

      const loadedProducts = (await Promise.all(productPromises)).filter(
        (p): p is Product => p !== null
      );

      console.log('[ProductList] 상품 로드 완료:', {
        requestedCount: codesToLoad.length,
        loadedCount: loadedProducts.length,
        loadedProductCodes: loadedProducts.map(p => p.productCode),
      });

      setFeaturedProducts(loadedProducts);
    } catch (error) {
      console.error('Failed to load featured products:', error);
      setFeaturedProducts([]);
    } finally {
      setIsLoadingFeatured(false);
    }
  };

  // React Query를 사용한 데이터 페칭
  const { data: queryData, isLoading: isQueryLoading, error: queryError, refetch } = useQuery({
    queryKey: ['products', page, filters.sort, filters.region, filters.cruiseLine, filters.shipName],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
        sort: filters.sort,
      });

      if (filters.region !== 'all') params.append('region', filters.region);
      if (filters.cruiseLine !== 'all') params.append('cruiseLine', filters.cruiseLine);
      if (filters.shipName !== 'all') params.append('shipName', filters.shipName);

      const apiUrl = `/api/public/products?${params.toString()}`;
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || 'Failed to fetch products');
      return data;
    },
    staleTime: 60 * 1000, // 1분간 데이터 신선함 유지
    gcTime: 5 * 60 * 1000, // 5분간 캐시 유지
  });

  // 데이터 동기화
  useEffect(() => {
    if (queryData) {
      const productsWithFlags = queryData.products.map((p: any) => {
        const {
          MallProductContent,
          mallProductContent: existingMallContent,
          ...rest
        } = p;

        const mallContent = existingMallContent ?? MallProductContent ?? null;
        const layout = mallContent?.layout
          ? (typeof mallContent.layout === 'string'
            ? JSON.parse(mallContent.layout)
            : mallContent.layout)
          : null;

        return {
          ...rest,
          mallProductContent: mallContent,
          rating: layout?.rating || p.rating || 4.0 + Math.random() * 1.0,
          reviewCount: layout?.reviewCount || p.reviewCount || Math.floor(Math.random() * 500) + 50,
          isPopular: Boolean(p.isPopular),
          isRecommended: Boolean(p.isRecommended),
          isPremium: Boolean(p.isPremium),
          isGeniePack: Boolean(p.isGeniePack),
          isDomestic: Boolean(p.isDomestic),
          isJapan: Boolean(p.isJapan),
          isBudget: Boolean(p.isBudget),
        } as Product;
      });

      let filteredProducts = productsWithFlags;
      if (filters.type === 'popular') {
        filteredProducts = productsWithFlags.filter((p: any) => p.isPopular);
      } else if (filters.type === 'recommended') {
        filteredProducts = productsWithFlags.filter((p: any) => p.isRecommended);
      }

      setProducts(filteredProducts);
      setTotalPages(queryData.pagination?.totalPages || 1);
      updateAvailableRegions(filteredProducts);
      setIsLoading(false);
    }
  }, [queryData, filters.type]);

  useEffect(() => {
    if (isQueryLoading) setIsLoading(true);
  }, [isQueryLoading]);

  useEffect(() => {
    if (queryError) setError(queryError instanceof Error ? queryError.message : 'Error loading products');
  }, [queryError]);

  // 기존 loadProducts 함수는 더 이상 사용하지 않음 (빈 함수로 대체)
  const loadProducts = async () => {
    // React Query가 자동으로 처리하므로 수동 호출 불필요
  };

  // 상품 목록에서 판매 중인 지역 확인
  const updateAvailableRegions = (products: Product[]) => {
    const regions = new Set<string>(['all']); // '전체'는 항상 포함

    const regionMap: Record<string, string[]> = {
      'japan': ['JP', 'Japan', '일본'],
      'southeast-asia': ['TH', 'Thailand', '태국', 'VN', 'Vietnam', '베트남', 'MY', 'Malaysia', '말레이시아'],
      'singapore': ['SG', 'Singapore', '싱가포르'],
      'western-mediterranean': ['ES', 'Spain', '스페인', 'FR', 'France', '프랑스', 'IT', 'Italy', '이탈리아'],
      'eastern-mediterranean': ['GR', 'Greece', '그리스', 'TR', 'Turkey', '터키'],
      'alaska': ['US', 'USA', '미국', 'Alaska', '알래스카'],
    };

    products.forEach((product) => {
      if (!product.itineraryPattern || !Array.isArray(product.itineraryPattern)) {
        return;
      }

      // 각 지역별로 상품이 있는지 확인
      Object.entries(regionMap).forEach(([regionKey, keywords]) => {
        const hasRegion = product.itineraryPattern.some((item: any) => {
          if (typeof item === 'object' && item.country) {
            const country = item.country.toString().toUpperCase();
            return keywords.some(keyword => country.includes(keyword.toUpperCase()));
          }
          return false;
        });

        if (hasRegion) {
          regions.add(regionKey);
        }
      });
    });

    setAvailableRegions(regions);
  };

  const loadBelowProducts = async () => {
    const belowSettings = settings['recommended-below-settings'];
    if (!belowSettings || belowSettings.type !== 'products') {
      setBelowProducts([]);
      return;
    }

    const params = new URLSearchParams({
      limit: (belowSettings.products.count || 4).toString(),
      sort: 'popular',
    });

    if (belowSettings.products.category) {
      params.append('region', belowSettings.products.category);
    }

    const apiUrl = `/api/public/products?${params.toString()}`;

    try {
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${apiUrl}`);
      }

      const data = await response.json();

      if (data.ok && data.products) {
        setBelowProducts(data.products);
      }
    } catch (error) {
      const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${apiUrl}` : apiUrl;
      console.error('[ProductList] 하위 상품 로드 실패:', fullUrl, error);
      setBelowProducts([]);
    }
  };

  // 판매 중인 상품이 있는 지역만 필터로 표시 (Hooks는 early return 이전에 호출되어야 함)
  const menuFilters = useMemo(() => {
    const configuredFilters = settings['menu-bar-settings']?.filters?.filter(f => f.enabled) || DEFAULT_REGION_FILTERS;

    // 판매 중인 상품이 있는 지역만 필터링
    return configuredFilters.filter(filter => availableRegions.has(filter.value));
  }, [settings, availableRegions]);

  const recommendedBelow = settings['recommended-below-settings'] || { type: 'none' };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center py-20">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-6"></div>
        <p className="text-xl md:text-2xl text-gray-700 font-semibold">상품을 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-2 border-red-300 rounded-xl p-8 md:p-10 text-center shadow-lg">
        <p className="text-xl md:text-2xl text-red-800 font-bold mb-6">{error}</p>
        <button
          onClick={() => refetch()}
          className="px-8 py-4 bg-red-600 text-white text-lg md:text-xl font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg min-h-[56px]"
        >
          다시 시도
        </button>
      </div>
    );
  }

  // 인기/추천 크루즈 분리
  const popularProducts = products.filter(p => p.isPopular);
  const recommendedProducts = products.filter(p => p.isRecommended);
  const premiumProducts = products.filter(p => p.isPremium);
  const geniePackProducts = products.filter(p => p.isGeniePack);
  const domesticProducts = products.filter(p => p.isDomestic);
  const japanProducts = products.filter(p => p.isJapan);
  const budgetProducts = products.filter(p => p.isBudget);
  const allProducts = products;

  // 지역 필터가 적용되었을 때는 모든 상품을 표시
  const showFilteredProducts = filters.region !== 'all';

  // 설정값 가져오기 (기본값 포함)
  const popularBanner = settings['popular-banner'] || {
    title: '인기 크루즈',
    buttons: [
      { text: '프리미엄 서비스 보장', icon: '✓' },
      { text: '크루즈닷AI 가이드 서비스 지원', icon: '✓' },
      { text: '확실한 출발 100%', icon: '✓' },
    ],
    rightBadge: { topText: '신뢰할 수 있는', bottomText: '한국 여행사' },
  };

  const recommendedBanner = settings['recommended-banner'] || {
    title: '추천 크루즈',
    buttons: [
      { text: '10년 승무원 출신 인솔자', icon: '✓' },
      { text: '전문 매니저 상담', icon: '✓' },
      { text: '빠르고 신속한 스탭지원', icon: '✓' },
    ],
    rightBadge: { topText: '신뢰할 수 있는', bottomText: '한국 여행사' },
  };

  const renderPartnerHero = () => {
    // gest 계정 확인
    const isGestAccount = partnerId?.toLowerCase().startsWith('gest');

    // gest 계정이면 노란색 테마, 아니면 기존 파란색-보라색 테마
    const headerGradient = isGestAccount
      ? 'bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-500'
      : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600';
    const overlayGradient = isGestAccount
      ? 'bg-gradient-to-r from-yellow-500/80 via-yellow-400/80 to-yellow-600/80'
      : 'bg-gradient-to-r from-blue-700 via-purple-700 to-indigo-700 opacity-80';
    const textColor = isGestAccount ? 'text-gray-900' : 'text-white';
    const textMutedColor = isGestAccount ? 'text-gray-700' : 'text-white/70';

    return (
      <section className={`relative overflow-hidden rounded-3xl ${headerGradient} ${textColor} shadow-2xl`}>
        <div className="absolute inset-0">
          {partnerContext?.coverImage && String(partnerContext.coverImage).trim() ? (
            <Image
              src={String(partnerContext.coverImage)}
              alt="파트너 커버"
              fill
              sizes="100vw"
              className="object-cover opacity-60"
            />
          ) : (
            <div className={`absolute inset-0 ${overlayGradient}`} />
          )}
          {!isGestAccount && (
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/70 via-blue-900/60 to-purple-900/60" />
          )}
        </div>
        <div className="relative z-10 flex flex-col gap-6 p-8 md:p-10 lg:p-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${isGestAccount ? 'bg-white/95' : 'bg-white/95'} shadow-xl`}>
                <Image src="/images/ai-cruise-logo.png" alt="크루즈닷" width={56} height={56} sizes="56px" className="w-12 h-12 object-contain" />
              </div>
              <div>
                <p className={`text-xs uppercase tracking-[0.35em] ${isGestAccount ? 'text-gray-800 font-semibold' : textMutedColor}`}>Cruisedot Partner Mall</p>
                <h1 className={`mt-2 text-3xl md:text-4xl lg:text-5xl font-black leading-tight ${isGestAccount ? 'text-gray-900' : textColor}`}>
                  {partnerProfileTitle}
                </h1>
                {partnerAnnouncement && (
                  <p className={`mt-3 text-sm md:text-base font-medium ${isGestAccount ? 'text-gray-900' : 'text-white/80'} whitespace-pre-line`}>
                    {partnerAnnouncement}
                  </p>
                )}
              </div>
            </div>
          </div>
          {partnerWelcome && (
            <div className={`rounded-2xl ${isGestAccount ? 'bg-white/90 border-2 border-gray-400 shadow-lg' : 'bg-white/10 border border-white/15'} p-5 text-sm md:text-base ${isGestAccount ? 'text-gray-900 font-semibold' : 'text-white/90'} whitespace-pre-line`}>
              {partnerWelcome}
            </div>
          )}
        </div>
      </section>
    );
  };

  const productDisplay = settings['product-display-settings'] || {
    popularRows: 1,
    recommendedRows: 1,
  };

  // 개인 링크 상품 섹션 렌더링
  const renderFeaturedProducts = () => {
    // 디버깅: featuredProductCodes와 featuredProducts 상태 확인
    const codesToCheck = featuredProductCodesProp || partnerContext?.featuredProductCodes || [];
    console.log('[ProductList] renderFeaturedProducts:', {
      codesToCheck,
      codesToCheckLength: codesToCheck.length,
      featuredProductsLength: featuredProducts.length,
      isLoadingFeatured,
      isPartnerMall,
    });

    // 파트너몰이고 featuredProductCodes가 있으면 항상 섹션 표시 (로딩 중이거나 상품이 없어도)
    if (isPartnerMall && codesToCheck.length > 0) {
      if (isLoadingFeatured) {
        return (
          <section className="mb-12">
            <div className="mb-6">
              <h2 className="text-3xl md:text-4xl font-black text-[#051C2C] mb-2">
                나의 추천 상품
              </h2>
              <p className="text-gray-600 text-sm md:text-base">
                개인 링크로 등록된 특별 상품을 확인하세요
              </p>
            </div>
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
            </div>
          </section>
        );
      }

      if (featuredProducts.length === 0) {
        // 상품이 없으면 섹션 자체를 표시하지 않음
        return null;
      }
    }

    if (featuredProducts.length === 0) {
      return null;
    }

    return (
      <section className="mb-12">
        <div className="mb-6">
          <h2 className="text-3xl md:text-4xl font-black text-[#051C2C] mb-2">
            나의 추천 상품
          </h2>
          <p className="text-gray-600 text-sm md:text-base">
            개인 링크로 등록된 특별 상품을 확인하세요
          </p>
        </div>
        {isLoadingFeatured ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => scrollLeft(featuredScrollRef)}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white rounded-full p-3 shadow-lg border-2 border-gray-200 hover:border-[#D4AF37] transition-all transform hover:scale-110"
              aria-label="이전 상품"
            >
              <FiChevronLeft className="w-6 h-6 text-gray-700" />
            </button>
            <div
              ref={featuredScrollRef}
              className="flex gap-4 md:gap-5 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
            >
              {featuredProducts.map((product) => (
                <div key={product.id} className="flex-shrink-0 w-[280px] sm:w-[320px] md:w-[340px] h-full">
                  <ProductCard product={product} partnerId={partnerId} />
                </div>
              ))}
            </div>
            <button
              onClick={() => scrollRight(featuredScrollRef)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white rounded-full p-3 shadow-lg border-2 border-gray-200 hover:border-[#D4AF37] transition-all transform hover:scale-110"
              aria-label="다음 상품"
            >
              <FiChevronRight className="w-6 h-6 text-gray-700" />
            </button>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-8">
      {isPartnerMall ? (
        <>
          {renderPartnerHero()}
          {renderFeaturedProducts()}
        </>
      ) : (
        <>
          {/* 크루즈 쇼케이스 배경 이미지 (동영상 대신 사용 - 빠른 로딩) */}
          <div className="relative w-full h-64 md:h-80 lg:h-96 rounded-xl overflow-hidden shadow-2xl mb-8">
            <div
              className="absolute inset-0 w-full h-full bg-cover bg-center animate-subtle-zoom"
              style={{
                backgroundImage: `url('${encodeURI('/크루즈정보사진/크루즈배경이미지/고화질배경이미지 (2).png')}')`,
              }}
            />
            {/* 배경 위 어두운 오버레이 (선택적) */}
            <div className="absolute inset-0 bg-black/20"></div>
          </div>

          {/* 인기 크루즈 헤더 */}
          {filters.type === 'all' && filters.region === 'all' && popularProducts.length > 0 && (
            <div className="relative rounded-xl p-8 md:p-10 text-white overflow-hidden shadow-2xl mb-8">
              {/* 배경 이미지 */}
              <div
                className="absolute inset-0 bg-gradient-to-r from-[#1e3c72] to-[#2a5298]"
              >
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent)', backgroundSize: '20px 20px' }}></div>
                <div className="absolute inset-0 bg-black/10"></div>
              </div>

              {/* 컨텐츠 */}
              <div className="relative z-10">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-4xl md:text-5xl font-black mb-6 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                      {popularBanner.title}
                    </h2>
                    <div className="flex flex-wrap gap-4 text-base md:text-lg">
                      {popularBanner.buttons.slice(0, 3).map((button) => (
                        <span
                          key={button.text}
                          className="bg-white/95 text-gray-900 px-6 py-3 rounded-full font-black shadow-2xl border-3 border-white text-lg md:text-xl whitespace-nowrap"
                        >
                          <span className="text-green-600 mr-2">{button.icon}</span> {button.text}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* 신뢰 마크 */}
                  {popularBanner.rightBadge && (
                    <div className="flex gap-3">
                      <div className="bg-white/95 backdrop-blur-sm px-6 py-4 rounded-xl border-3 border-white shadow-2xl whitespace-nowrap">
                        <div className="text-sm md:text-base text-gray-600 mb-2 font-bold">
                          {popularBanner.rightBadge.topText}
                        </div>
                        <div className="text-lg md:text-xl font-black text-gray-900 leading-tight">
                          {popularBanner.rightBadge.bottomText}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 나라별 필터 */}
      {menuFilters.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-5 md:p-6 mb-8" id="product-filters">
          <div className="space-y-4">
            {/* 지역 필터 */}
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {menuFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => {
                    const previousRegion = filters.region;
                    setFilters({ ...filters, region: filter.value });
                    setPage(1);

                    if (previousRegion !== filter.value && filter.value !== 'all') {
                      setShouldScrollToProducts(true);
                    }
                  }}
                  className={`px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl text-sm sm:text-base md:text-lg font-bold transition-all min-h-[48px] sm:min-h-[52px] flex items-center justify-center ${filters.region === filter.value
                    ? 'bg-[#051C2C] text-white shadow-lg scale-105 border-2 border-[#051C2C]'
                    : 'bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 border-2 border-gray-200 hover:border-[#D4AF37]'
                    }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* 크루즈 라인 및 선박명 필터 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
              {/* 크루즈 라인 필터 */}
              <div className="relative" ref={cruiseLineDropdownRef}>
                <label className="block text-sm font-semibold text-gray-700 mb-2">크루즈 라인</label>
                <div className="relative">
                  <input
                    type="text"
                    value={cruiseLineDropdownOpen ? cruiseLineSearchTerm : selectedCruiseLineLabel || '전체'}
                    onChange={(e) => {
                      setCruiseLineSearchTerm(e.target.value);
                      setCruiseLineDropdownOpen(true);
                    }}
                    onFocus={() => {
                      setCruiseLineDropdownOpen(true);
                      setCruiseLineSearchTerm('');
                    }}
                    onBlur={() => {
                      setTimeout(() => setCruiseLineDropdownOpen(false), 200);
                    }}
                    placeholder="크루즈선사 검색 (예: MSC, 로얄캐리비안)"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] text-base pr-12"
                  />
                  {cruiseLineSearchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setCruiseLineSearchTerm('');
                        setCruiseLineDropdownOpen(false);
                        handleCruiseLineSelect('all');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    >
                      <FiX size={20} />
                    </button>
                  )}
                  {cruiseLineDropdownOpen && filteredCruiseLineOptions.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-300 rounded-lg shadow-xl max-h-72 overflow-y-auto">
                      <div
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleCruiseLineSelect('all');
                        }}
                        className={`px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors border-b border-gray-100 ${filters.cruiseLine === 'all' ? 'bg-blue-100 font-bold' : 'font-medium'
                          }`}
                      >
                        <div className="text-base text-gray-900">전체</div>
                      </div>
                      {filteredCruiseLineOptions.map((option) => (
                        <div
                          key={option.value}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleCruiseLineSelect(option.value);
                          }}
                          className={`px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0 ${filters.cruiseLine === option.value ? 'bg-blue-100 font-bold' : 'font-medium'
                            }`}
                        >
                          <div className="text-base text-gray-900">{option.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 선박명 필터 */}
              <div className="relative" ref={shipNameDropdownRef}>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  선박명 {filters.cruiseLine !== 'all' && <span className="text-gray-500 text-xs">({selectedCruiseLineLabel})</span>}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled={filters.cruiseLine === 'all'}
                    value={shipNameDropdownOpen ? shipNameSearchTerm : selectedShipNameLabel || '전체'}
                    onChange={(e) => {
                      setShipNameSearchTerm(e.target.value);
                      setShipNameDropdownOpen(true);
                    }}
                    onFocus={() => {
                      if (filters.cruiseLine !== 'all') {
                        setShipNameDropdownOpen(true);
                        setShipNameSearchTerm('');
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShipNameDropdownOpen(false), 200);
                    }}
                    placeholder={filters.cruiseLine !== 'all' ? "선박명 검색 (예: 벨리시마)" : "먼저 크루즈선사를 선택하세요"}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base pr-12 ${filters.cruiseLine === 'all' ? 'bg-gray-100 border-gray-200 cursor-not-allowed' : 'border-gray-300'
                      }`}
                  />
                  {shipNameSearchTerm && filters.cruiseLine !== 'all' && (
                    <button
                      type="button"
                      onClick={() => {
                        setShipNameSearchTerm('');
                        setShipNameDropdownOpen(false);
                        handleShipNameSelect('all');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    >
                      <FiX size={20} />
                    </button>
                  )}
                  {shipNameDropdownOpen && filters.cruiseLine !== 'all' && filteredShipNameOptions.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-300 rounded-lg shadow-xl max-h-72 overflow-y-auto">
                      <div
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleShipNameSelect('all');
                        }}
                        className={`px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors border-b border-gray-100 ${filters.shipName === 'all' ? 'bg-blue-100 font-bold' : 'font-medium'
                          }`}
                      >
                        <div className="text-base text-gray-900">전체</div>
                      </div>
                      {filteredShipNameOptions.map((option) => (
                        <div
                          key={option.value}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleShipNameSelect(option.value);
                          }}
                          className={`px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0 ${filters.shipName === option.value ? 'bg-blue-100 font-bold' : 'font-medium'
                            }`}
                        >
                          <div className="text-base text-gray-900">{option.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 인기 크루즈 섹션 */}
      {filters.type === 'all' && filters.region === 'all' && popularProducts.length > 0 && (
        <div id="popular-cruises" className="mb-12">
          <h3 className="text-3xl md:text-4xl font-black text-[#051C2C] mb-6">인기 크루즈</h3>
          <div
            className={`grid gap-4 md:gap-5 lg:gap-6 ${productDisplay.popularRows === 2 || productDisplay.popularRows === 3
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'relative'
              }`}
          >
            {productDisplay.popularRows === 1 ? (
              <>
                <button
                  onClick={() => scrollLeft(popularScrollRef)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white rounded-full p-3 shadow-lg border-2 border-gray-200 hover:border-[#D4AF37] transition-all transform hover:scale-110"
                  aria-label="이전 상품"
                >
                  <FiChevronLeft className="w-6 h-6 text-gray-700" />
                </button>
                <div
                  ref={popularScrollRef}
                  className="flex gap-4 md:gap-5 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
                >
                  {popularProducts.map((product) => (
                    <div key={product.id} className="flex-shrink-0 w-[280px] sm:w-[320px] md:w-[340px] h-full">
                      <ProductCard product={product} partnerId={partnerId} />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => scrollRight(popularScrollRef)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white rounded-full p-3 shadow-lg border-2 border-gray-200 hover:border-[#D4AF37] transition-all transform hover:scale-110"
                  aria-label="다음 상품"
                >
                  <FiChevronRight className="w-6 h-6 text-gray-700" />
                </button>
              </>
            ) : (
              popularProducts.map((product) => (
                <ProductCard key={product.id} product={product} partnerId={partnerId} />
              ))
            )}
          </div>
        </div>
      )}

      {/* 추천 크루즈 배너 */}
      {filters.type === 'all' && filters.region === 'all' && recommendedProducts.length > 0 && (
        <div className="relative rounded-xl p-8 md:p-10 text-white overflow-hidden shadow-2xl mb-8">
          {/* 배경 이미지 */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-[#2a5298] to-[#1e3c72]"
          >
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent)', backgroundSize: '20px 20px' }}></div>
            <div className="absolute inset-0 bg-white/5"></div>
          </div>

          {/* 컨텐츠 */}
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <h2 className="text-4xl md:text-5xl font-black mb-6 text-white drop-shadow-md">
                  {recommendedBanner.title}
                </h2>
                <div className="flex flex-wrap gap-4 text-base md:text-lg">
                  {recommendedBanner.buttons.slice(0, 3).map((button) => (
                    <span
                      key={button.text}
                      className="bg-white/95 text-gray-900 px-6 py-3 rounded-full font-black shadow-2xl border-3 border-white text-lg md:text-xl whitespace-nowrap"
                    >
                      <span className="text-green-600 mr-2">{button.icon}</span> {button.text}
                    </span>
                  ))}
                </div>
              </div>
              {/* 신뢰 마크 */}
              {recommendedBanner.rightBadge && (
                <div className="flex gap-3">
                  <div className="bg-white/95 backdrop-blur-sm px-6 py-4 rounded-xl border-3 border-white shadow-2xl whitespace-nowrap">
                    <div className="text-sm md:text-base text-gray-600 mb-2 font-bold">
                      {recommendedBanner.rightBadge.topText}
                    </div>
                    <div className="text-lg md:text-xl font-black text-gray-900 leading-tight">
                      {recommendedBanner.rightBadge.bottomText}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 추천 크루즈 섹션 */}
      {filters.type === 'all' && filters.region === 'all' && recommendedProducts.length > 0 && (
        <div>
          <h3 className="text-3xl md:text-4xl font-black text-[#051C2C] mb-6">추천 크루즈</h3>
          <div
            className={`grid gap-4 md:gap-5 lg:gap-6 ${productDisplay.recommendedRows === 2 || productDisplay.recommendedRows === 3
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'relative'
              }`}
          >
            {productDisplay.recommendedRows === 1 ? (
              <>
                <button
                  onClick={() => scrollLeft(recommendedScrollRef)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white rounded-full p-3 shadow-lg border-2 border-gray-200 hover:border-[#D4AF37] transition-all transform hover:scale-110"
                  aria-label="이전 상품"
                >
                  <FiChevronLeft className="w-6 h-6 text-gray-700" />
                </button>
                <div
                  ref={recommendedScrollRef}
                  className="flex gap-4 md:gap-5 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
                >
                  {recommendedProducts.map((product) => (
                    <div key={product.id} className="flex-shrink-0 w-[280px] sm:w-[320px] md:w-[340px] h-full">
                      <ProductCard product={product} partnerId={partnerId} />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => scrollRight(recommendedScrollRef)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white rounded-full p-3 shadow-lg border-2 border-gray-200 hover:border-[#D4AF37] transition-all transform hover:scale-110"
                  aria-label="다음 상품"
                >
                  <FiChevronRight className="w-6 h-6 text-gray-700" />
                </button>
              </>
            ) : (
              recommendedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))
            )}
          </div>

          {/* 추천크루즈 밑 배너/상품 */}
          {recommendedBelow.type === 'banner' && recommendedBelow.banner && (
            <div className="mt-8 mb-8">
              {recommendedBelow.banner.link ? (
                <a href={recommendedBelow.banner.link} target="_blank" rel="noopener noreferrer">
                  <div
                    className="relative rounded-xl overflow-hidden shadow-2xl cursor-pointer hover:shadow-3xl transition-shadow"
                    style={{
                      backgroundImage: recommendedBelow.banner.image
                        ? `url(${recommendedBelow.banner.image})`
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      minHeight: '200px',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    <div className="absolute inset-0 bg-black/30"></div>
                    <div className="relative z-10 p-8 md:p-12 text-white">
                      <h3 className="text-3xl md:text-4xl font-black mb-4">
                        {recommendedBelow.banner.title}
                      </h3>
                    </div>
                  </div>
                </a>
              ) : (
                <div
                  className="relative rounded-xl overflow-hidden shadow-2xl"
                  style={{
                    backgroundImage: recommendedBelow.banner.image
                      ? `url(${recommendedBelow.banner.image})`
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    minHeight: '200px',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  <div className="absolute inset-0 bg-black/30"></div>
                  <div className="relative z-10 p-8 md:p-12 text-white">
                    <h3 className="text-3xl md:text-4xl font-black mb-4">
                      {recommendedBelow.banner.title}
                    </h3>
                  </div>
                </div>
              )}
            </div>
          )}

          {recommendedBelow.type === 'products' && belowProducts.length > 0 && (
            <div className="mt-8 mb-8">
              <h3 className="text-2xl md:text-3xl font-black text-[#051C2C] mb-6">추가 추천 상품</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
                {belowProducts.map((product) => (
                  <ProductCard key={product.id} product={product} partnerId={partnerId} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 프리미엄 크루즈 섹션 */}
      {filters.type === 'all' && filters.region === 'all' && premiumProducts.length > 0 && (
        <div id="premium-cruises" className="mb-12">
          <h3 className="text-3xl md:text-4xl font-black text-[#051C2C] mb-6">프리미엄 크루즈</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
            {premiumProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}

      {/* 크루즈닷AI패키지 섹션 */}
      {filters.type === 'all' && filters.region === 'all' && geniePackProducts.length > 0 && (
        <div id="geniepack-cruises" className="mb-12">
          <h3 className="text-3xl md:text-4xl font-black text-[#051C2C] mb-6">크루즈닷패키지 크루즈</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
            {geniePackProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}

      {/* 국내 출발 크루즈 섹션 */}
      {filters.type === 'all' && filters.region === 'all' && domesticProducts.length > 0 && (
        <div id="domestic-cruises" className="mb-12">
          <h3 className="text-3xl md:text-4xl font-black text-[#051C2C] mb-6">국내출발 크루즈</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
            {domesticProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}

      {/* 일본 크루즈 섹션 */}
      {filters.type === 'all' && filters.region === 'all' && japanProducts.length > 0 && (
        <div id="japan-cruises" className="mb-12">
          <h3 className="text-3xl md:text-4xl font-black text-[#051C2C] mb-6">일본 크루즈</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
            {japanProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}

      {/* 알뜰 크루즈 섹션 */}
      {filters.type === 'all' && filters.region === 'all' && budgetProducts.length > 0 && (
        <div id="budget-cruises" className="mb-12">
          <h3 className="text-3xl md:text-4xl font-black text-[#051C2C] mb-6">알뜰 크루즈</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
            {budgetProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}

      {/* 필터링된 상품 또는 전체 상품 그리드 */}
      {allProducts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-lg border-2 border-gray-200">
          <p className="text-xl md:text-2xl text-gray-700 font-semibold">
            {showFilteredProducts
              ? `${menuFilters.find(f => f.value === filters.region)?.label || '선택한 지역'}에 해당하는 상품이 없습니다.`
              : '상품이 없습니다.'}
          </p>
        </div>
      ) : (
        <>
          {/* 필터가 적용되었거나, 필터가 '전체'일 때도 상품 목록 표시 (인기/추천 크루즈 아래) */}
          {(showFilteredProducts || (filters.type === 'all' && filters.region === 'all')) && (
            <div className="mb-8">
              {showFilteredProducts && (
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-3xl md:text-4xl font-black text-[#051C2C]">
                    {menuFilters.find(f => f.value === filters.region)?.label || '필터링된'} 크루즈
                  </h3>
                  <a
                    href="/product"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-gradient-to-r from-[#D4AF37] via-yellow-400 to-[#D4AF37] bg-[length:200%_auto] animate-gradient text-[#051C2C] font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all min-h-[48px] flex items-center justify-center text-base md:text-lg"
                  >
                    전체 보기 →
                  </a>
                </div>
              )}
              {!showFilteredProducts && filters.type === 'all' && filters.region === 'all' && (
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-3xl md:text-4xl font-black text-[#051C2C]">크루즈 상품 안내</h3>
                  <a
                    href="/product"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-gradient-to-r from-[#D4AF37] via-yellow-400 to-[#D4AF37] bg-[length:200%_auto] animate-gradient text-[#051C2C] font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all min-h-[48px] flex items-center justify-center text-base md:text-lg"
                  >
                    전체 보기 →
                  </a>
                </div>
              )}
              {/* 크루즈 상품 안내: 한 줄에 5개씩, 각 줄마다 독립적으로 좌우 스크롤 (최대 3줄, 총 15개) */}
              <div className="space-y-6">
                {(() => {
                  // 상품을 5개씩 그룹으로 나누기 (최대 3줄)
                  const productsPerRow = 5;
                  const maxRows = 3;
                  const productGroups: Product[][] = [];

                  for (let i = 0; i < Math.min(allProducts.length, maxRows * productsPerRow); i += productsPerRow) {
                    productGroups.push(allProducts.slice(i, i + productsPerRow));
                  }

                  return productGroups.map((group, rowIndex) => (
                    <div key={rowIndex} className="relative">
                      {/* 좌우 스크롤 버튼 */}
                      {group.length > 0 && (
                        <>
                          <button
                            onClick={() => {
                              const ref = allProductsScrollRefs.current[rowIndex];
                              if (ref) {
                                ref.scrollBy({ left: -400, behavior: 'smooth' });
                              }
                            }}
                            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white rounded-full p-3 shadow-lg border-2 border-gray-200 hover:border-blue-500 transition-all transform hover:scale-110"
                            aria-label={`${rowIndex + 1}줄 이전 상품`}
                          >
                            <FiChevronLeft className="w-6 h-6 text-gray-700" />
                          </button>
                          <button
                            onClick={() => {
                              const ref = allProductsScrollRefs.current[rowIndex];
                              if (ref) {
                                ref.scrollBy({ left: 400, behavior: 'smooth' });
                              }
                            }}
                            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white rounded-full p-3 shadow-lg border-2 border-gray-200 hover:border-blue-500 transition-all transform hover:scale-110"
                            aria-label={`${rowIndex + 1}줄 다음 상품`}
                          >
                            <FiChevronRight className="w-6 h-6 text-gray-700" />
                          </button>
                        </>
                      )}
                      {/* 상품 그리드 (한 줄에 10개) */}
                      <div
                        ref={(el) => {
                          allProductsScrollRefs.current[rowIndex] = el;
                        }}
                        className="flex gap-4 md:gap-5 lg:gap-6 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
                      >
                        {group.map((product) => (
                          <div
                            key={product.id}
                            className="flex-shrink-0 w-[280px] sm:w-[320px] md:w-[340px]"
                          >
                            <ProductCard product={product} partnerId={partnerId} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-12">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-6 py-3 text-base md:text-lg font-bold border-2 border-gray-400 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 min-h-[48px] transition-colors"
              >
                이전
              </button>
              <span className="px-6 py-3 text-lg md:text-xl font-black text-gray-900">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-6 py-3 text-base md:text-lg font-bold border-2 border-gray-400 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 min-h-[48px] transition-colors"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}







