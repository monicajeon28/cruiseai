// components/mall/ProductDetail.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { FiStar, FiCheck, FiX, FiEdit2, FiSave, FiEdit3, FiMaximize2, FiChevronLeft, FiAlertCircle } from 'react-icons/fi';
import { getKoreanCruiseLineName, getKoreanShipName, formatTravelPeriod } from '@/lib/utils/cruiseNames';
import { PRODUCT_TAGS } from '@/components/admin/ProductTagsSelector';
import DOMPurify from 'isomorphic-dompurify';
import LiveViewerCount from '@/components/marketing/LiveViewerCount';
import RemainingRooms from '@/components/marketing/RemainingRooms';

interface ProductDetailProps {
  product: {
    id: number;
    productCode: string;
    cruiseLine: string;
    shipName: string;
    packageName: string;
    nights: number;
    days: number;
    basePrice: number | null;
    source: string | null;
    itineraryPattern: any;
    description: string | null;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    tripCount?: number;
    tags?: string[] | null;
    mallProductContent?: {
      thumbnail?: string | null;
      images?: string[] | null;
      videos?: string[] | null;
      layout?: any;
    } | null;
    MallProductContent?: {
      thumbnail?: string | null;
      images?: string[] | null;
      videos?: string[] | null;
      layout?: any;
    } | null;
  };
  partnerId?: string;
  hasUserTrip?: boolean;
}

export default function ProductDetail({ product, partnerId, hasUserTrip }: ProductDetailProps) {
  const router = useRouter();
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [isAdminUser, setIsAdminUser] = useState(false); // user1~user10 관리자 확인
  const [isSuperAdmin, setIsSuperAdmin] = useState(false); // 01024958013 관리자 확인
  const [isBranchManager, setIsBranchManager] = useState(false); // 대리점장 확인
  const [canEditProductText, setCanEditProductText] = useState(false); // 상품 텍스트 수정 권한
  const [showPricingModal, setShowPricingModal] = useState(false); // 요금표 모달
  const [showImageModal, setShowImageModal] = useState(false); // 이미지 모달
  const [showVideoModal, setShowVideoModal] = useState(false); // 동영상 모달
  const [showReviewModal, setShowReviewModal] = useState(false); // 리뷰 미리보기 모달
  const [reviews, setReviews] = useState<{ id: number; authorName: string; rating: number; content: string; createdAt: string }[]>([]); // 리뷰 데이터
  const [reviewsLoading, setReviewsLoading] = useState(false); // 리뷰 로딩 상태
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null); // 모달에 표시할 이미지 URL
  const [modalVideoUrl, setModalVideoUrl] = useState<string | null>(null); // 모달에 표시할 동영상 URL

  // SOLD OUT 관련 상태
  const [soldOutRooms, setSoldOutRooms] = useState<{ roomId: string; roomType: string; soldOutAt: string; soldOutBy: string }[]>([]);
  const [togglingRoom, setTogglingRoom] = useState<string | null>(null); // SOLD OUT 토글 중인 객실

  // 모바일 뒤로가기 버튼 처리 - 모달이 열려있으면 모달만 닫기
  const isAnyModalOpen = showPricingModal || showImageModal || showVideoModal || showReviewModal || showInquiryModal;

  useEffect(() => {
    // 모달이 열릴 때 히스토리에 상태 추가
    if (isAnyModalOpen) {
      window.history.pushState({ modal: true }, '');
    }

    // 뒤로가기 이벤트 핸들러
    const handlePopState = (event: PopStateEvent) => {
      // 모달이 열려있으면 모달을 닫음
      if (showPricingModal) {
        setShowPricingModal(false);
        event.preventDefault();
      } else if (showImageModal) {
        setShowImageModal(false);
        event.preventDefault();
      } else if (showVideoModal) {
        setShowVideoModal(false);
        event.preventDefault();
      } else if (showReviewModal) {
        setShowReviewModal(false);
        event.preventDefault();
      } else if (showInquiryModal) {
        setShowInquiryModal(false);
        event.preventDefault();
      }
    };

    // popstate 이벤트 리스너 등록
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isAnyModalOpen, showPricingModal, showImageModal, showVideoModal, showReviewModal, showInquiryModal]);

  // 리뷰 데이터 가져오기 (모달 열릴 때)
  useEffect(() => {
    if (showReviewModal && reviews.length === 0) {
      const fetchReviews = async () => {
        setReviewsLoading(true);
        try {
          const res = await fetch(`/api/products/${product.productCode}/reviews`);
          const data = await res.json();
          if (data.ok && data.reviews) {
            setReviews(data.reviews);
          }
        } catch (error) {
          console.error('Failed to fetch reviews:', error);
        } finally {
          setReviewsLoading(false);
        }
      };
      fetchReviews();
    }
  }, [showReviewModal, product.productCode, reviews.length]);

  // SOLD OUT 상태 조회
  useEffect(() => {
    const fetchSoldOutStatus = async () => {
      try {
        const res = await fetch(`/api/admin/products/${product.productCode}/soldout`);
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.soldOutRooms) {
            setSoldOutRooms(data.soldOutRooms);
          }
        }
      } catch (error) {
        console.error('Failed to fetch sold out status:', error);
      }
    };
    fetchSoldOutStatus();
  }, [product.productCode]);

  // SOLD OUT 토글 함수 (관리자 전용)
  const handleToggleSoldOut = async (roomId: string, roomType: string) => {
    if (!isAdminUser && !isSuperAdmin) return;
    setTogglingRoom(roomId);

    try {
      const res = await fetch(`/api/admin/products/${product.productCode}/soldout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, roomType })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setSoldOutRooms(data.soldOutRooms);
        }
      }
    } catch (error) {
      console.error('Failed to toggle sold out:', error);
    } finally {
      setTogglingRoom(null);
    }
  };

  // 특정 객실이 SOLD OUT인지 확인
  const isRoomSoldOut = (roomId: string) => {
    return soldOutRooms.some(r => r.roomId === roomId);
  };

  // Google Drive 이미지 URL을 public proxy URL로 변환하는 헬퍼 함수
  const getProxyImageUrl = (url: string | null | undefined): string => {
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
  };

  // 한국어 이름 가져오기
  const koreanCruiseLine = getKoreanCruiseLineName(product.cruiseLine);
  const koreanShipName = getKoreanShipName(product.cruiseLine, product.shipName);
  const travelPeriod = formatTravelPeriod(product.startDate, product.endDate, product.nights, product.days);

  // 크루즈 라인은 직접 사용 (한국어 변환 없이)
  const displayCruiseLine = product.cruiseLine || koreanCruiseLine;

  // 방문 국가 추출
  const visitedCountries = (() => {
    const itineraryPattern = Array.isArray(product.itineraryPattern) ? product.itineraryPattern : [];
    const countries = new Set<string>();
    const countryNames: Record<string, string> = {
      'JP': '일본', 'KR': '한국', 'TH': '태국', 'VN': '베트남', 'MY': '말레이시아',
      'SG': '싱가포르', 'ES': '스페인', 'FR': '프랑스', 'IT': '이탈리아', 'GR': '그리스',
      'TR': '터키', 'US': '미국', 'CN': '중국', 'TW': '대만', 'HK': '홍콩',
      'PH': '필리핀', 'ID': '인도네시아'
    };
    itineraryPattern.forEach((day: any) => {
      if (day.country && day.country !== 'KR' && (day.type === 'PortVisit' || day.type === 'Embarkation' || day.type === 'Disembarkation')) {
        countries.add(day.country);
      }
    });
    return Array.from(countries).map(code => countryNames[code] || code).join(', ');
  })();

  // 상품 조회 추적
  useEffect(() => {
    const trackProductView = async () => {
      try {
        // 로그인된 사용자 ID 확인
        let userId: number | null = null;
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await res.json();
        if (data.ok && data.user) {
          userId = data.user.id;
        }

        // 상품 조회 기록 저장
        await fetch('/api/products/track-view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            productCode: product.productCode,
            userId
          })
        });

        // 마케팅 픽셀 이벤트 추적
        const { trackViewItem } = await import('@/lib/marketing/tracking');
        trackViewItem({
          itemId: product.productCode,
          itemName: `${product.cruiseLine} ${product.shipName} - ${product.packageName}`,
          price: product.basePrice ? Number(product.basePrice) : undefined,
          category: product.cruiseLine || '크루즈',
        });
      } catch (error) {
        console.error('[ProductDetail] Failed to track view:', error);
      }
    };

    trackProductView();
  }, [product.productCode, product.cruiseLine, product.shipName, product.packageName, product.basePrice]);

  // 편집 상태 관리
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState({
    packageName: product.packageName,
    nights: product.nights,
    days: product.days,
    cruiseLine: product.cruiseLine,
    shipName: product.shipName,
    basePrice: product.basePrice?.toString() || '',
    description: product.description || '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // layout 데이터 파싱 (포함/불포함, 예약안내 등)
  // Prisma 관계명이 MallProductContent 또는 mallProductContent일 수 있으므로 둘 다 확인
  const mallContent = (product as any).mallProductContent || (product as any).MallProductContent || null;
  const layoutData = mallContent?.layout
    ? (typeof mallContent.layout === 'string'
      ? JSON.parse(mallContent.layout)
      : mallContent.layout)
    : null;

  // 상세페이지 블록 (이미지, 동영상, 텍스트)
  const detailBlocks = layoutData?.blocks || [];

  // 향상된 여행일정
  const enhancedItinerary = layoutData?.itinerary || null;

  // 추천 키워드 (layout에서 가져오기)
  const recommendedKeywords = layoutData?.recommendedKeywords || [];

  // 후킹태그 (tags에서 가져오기)
  const tags = product.tags
    ? (Array.isArray(product.tags) ? product.tags : typeof product.tags === 'string' ? JSON.parse(product.tags) : [])
    : [];

  // 태그 정보 가져오기
  const getTagById = (id: string) => PRODUCT_TAGS.find((tag: any) => tag.id === id);

  // 항공 정보 (layout에서 가져오기)
  const flightInfo = layoutData?.flightInfo || null;

  // 별점과 리뷰 개수 (layout에서 가져오기)
  const rating = layoutData?.rating || 4.4;
  const reviewCount = layoutData?.reviewCount || 0;

  // 서비스 옵션 (layout에서 가져오기)
  const hasEscort = layoutData?.hasEscort || false;
  const hasLocalGuide = layoutData?.hasLocalGuide || false;
  const hasCruisedotStaff = layoutData?.hasCruisedotStaff || false;
  const hasTravelInsurance = layoutData?.hasTravelInsurance || false;

  // 요금표 데이터 (layout에서 가져오기)
  const pricingRows = layoutData?.pricing || [];

  // 환불/취소 규정 (layout에서 가져오기)
  const refundPolicy = layoutData?.refundPolicy || '';

  // 문의 옵션 (layout에서 가져오기)
  const contactOptions = (() => {
    if (layoutData?.contactOptions) {
      return {
        payment: layoutData.contactOptions.payment || layoutData.contactOptions.priceInquiry || false, // 하위 호환성: priceInquiry도 payment로 변환
        phoneCall: layoutData.contactOptions.phoneCall || false,
        aiChatbot: layoutData.contactOptions.aiChatbot !== false, // 기본값: true
      };
    } else if (layoutData?.contactType) {
      // 기존 contactType 형식 지원 (하위 호환성)
      const oldType = layoutData.contactType;
      return {
        payment: oldType === 'priceInquiry' || oldType === 'payment',
        phoneCall: oldType === 'phoneCall' || oldType === 'phoneConsultation',
        aiChatbot: oldType === 'aiChatbot' || !oldType,
      };
    } else {
      // 기본값: 3개 버튼 모두 활성화
      return {
        payment: true,
        phoneCall: true,
        aiChatbot: true,
      };
    }
  })();

  // 출발일 기준 만나이 계산 및 범위 표시 (PricingTableEditor와 동일한 로직)
  const calculateAgeRange = (minAge: number, maxAge: number | null) => {
    // 출발일 가져오기 (product.startDate 또는 layoutData.departureDate)
    const departureDateStr = product.startDate
      ? (typeof product.startDate === 'string' ? product.startDate : new Date(product.startDate).toISOString().split('T')[0])
      : layoutData?.departureDate;

    if (!departureDateStr) return null;

    try {
      const departure = new Date(departureDateStr + 'T00:00:00');
      const departureYear = departure.getFullYear();
      const departureMonth = departure.getMonth();
      const departureDay = departure.getDate();

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}.${month}.${day}`;
      };

      if (maxAge !== null) {
        // 만 minAge세 이상 만 maxAge세 이하
        // 출발일 기준으로 만 maxAge세가 되는 마지막 날짜 (생년월일의 최대값)
        const maxBirthYear = departureYear - maxAge;
        const maxBirthDate = new Date(maxBirthYear, departureMonth, departureDay);

        // 출발일 기준으로 만 minAge세가 되는 첫 날짜 (생년월일의 최소값)
        // 만 minAge세가 되려면 출발일 기준으로 minAge년 전에 태어나야 함
        const minBirthYear = departureYear - minAge - 1;
        const minBirthDate = new Date(minBirthYear, departureMonth, departureDay);
        minBirthDate.setDate(minBirthDate.getDate() + 1); // 다음날부터 만 minAge세

        return `${formatDate(minBirthDate)} ~ ${formatDate(maxBirthDate)}`;
      } else {
        // 만 minAge세 미만 (만2세 미만의 경우)
        // 출발일 기준으로 만 2세가 되는 첫 날짜 이전에 태어난 사람
        const minBirthYear = departureYear - 2;
        const maxBirthDate = new Date(minBirthYear, departureMonth, departureDay);

        // 최소값은 없음 (과거로 무한대)
        return `${formatDate(maxBirthDate)} 이전`;
      }
    } catch (error) {
      console.error('Failed to calculate age range:', error);
      return null;
    }
  };

  // 날짜 포맷팅 (요일 포함)
  const formatDateWithDay = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dayOfWeek = days[date.getDay()];
      return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
    } catch {
      return dateStr;
    }
  };

  // 시간 포맷팅 (HH:MM)
  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    // HH:MM 형식이면 그대로 반환
    if (/^\d{2}:\d{2}$/.test(timeStr)) {
      return timeStr;
    }
    // 다른 형식이면 시도
    try {
      const [hours, minutes] = timeStr.split(':');
      return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
    } catch {
      return timeStr;
    }
  };

  // 방문 국가 (layout.destination 또는 itineraryPattern.destination에서)
  const destinationFromLayout = layoutData?.destination || null;
  const destinationFromPattern = (() => {
    if (product.itineraryPattern) {
      try {
        const pattern = typeof product.itineraryPattern === 'string'
          ? JSON.parse(product.itineraryPattern)
          : product.itineraryPattern;
        if (pattern && typeof pattern === 'object' && !Array.isArray(pattern) && pattern.destination) {
          return pattern.destination;
        }
      } catch (e) {
        return null;
      }
    }
    return null;
  })();

  const finalDestination = destinationFromLayout || destinationFromPattern || null;

  // 포함/불포함 기본값
  const defaultIncluded = [
    '크루즈 객실료 (TAX 및 항구세 포함)',
    '하루 3식 이상의 식사 (뷔페, 정찬 레스토랑 등)',
    '크루즈 편의 시설 이용 (각종 쇼, 라이브 공연 등)',
    'AI 크루즈닷 가이드 서비스 지원'
  ];
  const defaultExcluded = [
    '크루즈 선상팁 (1인 1박당 $16)',
    '기항지 관광 (승선 후 선사프로그램 개별 신청 가능)',
    '선내 유료 시설 (음료, 스페셜티 레스토랑, 인터넷 등)',
    '여행자보험'
  ];

  const [includedItems, setIncludedItems] = useState<string[]>(
    layoutData?.included || defaultIncluded
  );
  const [excludedItems, setExcludedItems] = useState<string[]>(
    layoutData?.excluded || defaultExcluded
  );
  const [bookingInfo, setBookingInfo] = useState<string[]>(
    layoutData?.bookingInfo || [
      '2인1실 기준 1인당 금액입니다. 1인 예약 시 정상가의 100% 싱글차지가 추가됩니다.',
      '3/4인실 이용 시 3/4번째 고객님은 매니저 필수 상담 하셔야 합니다.',
      '예약 후 상품가 전액 결제되면 예약이 확정됩니다.',
      '여권만료일 6개월 이상 남은 여권사본을 보내주세요.'
    ]
  );
  // 일정 패턴 파싱 (먼저 정의)
  const parseItinerary = () => {
    if (!product.itineraryPattern) return null;

    try {
      if (typeof product.itineraryPattern === 'string') {
        return JSON.parse(product.itineraryPattern);
      }
      return product.itineraryPattern;
    } catch {
      return null;
    }
  };

  const itinerary = parseItinerary();

  const [itineraryText, setItineraryText] = useState<string>(
    layoutData?.itineraryText || JSON.stringify(itinerary || [], null, 2)
  );
  const [priceTableNote, setPriceTableNote] = useState<string>(
    layoutData?.priceTableNote || '• 위 요금은 2인1실 기준 1인당 금액입니다.\n• 1인 예약 시 정상가의 100% 싱글차지가 추가됩니다.\n• 3/4인실 이용 시 3/4번째 고객님은 매니저 필수 상담 하셔야 합니다.'
  );

  // 로그인 상태 확인
  useEffect(() => {
    checkLoginStatus();
    checkAdminStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const response = await fetch('/api/user/profile', { credentials: 'include' });
      setIsLoggedIn(response.ok);
    } catch {
      setIsLoggedIn(false);
    }
  };

  const checkAdminStatus = async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await response.json();
      // user1~user10: 상품 설명 즉석 수정 가능 (크루즈몰 관리자)
      const adminUser = data.ok && data.user && data.user.role === 'admin' &&
        data.user.phone && /^user(1[0]|[1-9])$/.test(data.user.phone);
      // 모든 admin role 사용자: 관리자 기능 접근 가능 (SOLD OUT 등)
      const superAdmin = data.ok && data.user && data.user.role === 'admin';

      setIsAdminUser(!!adminUser);
      setIsSuperAdmin(!!superAdmin);

      // 대리점장 여부 확인
      if (data.ok && data.user) {
        try {
          const profileResponse = await fetch('/api/affiliate/me/profile', { credentials: 'include' });
          const profileData = await profileResponse.json();
          if (profileData.ok && profileData.profile && profileData.profile.type === 'BRANCH_MANAGER') {
            setIsBranchManager(true);
          } else {
            setIsBranchManager(false);
          }
        } catch {
          setIsBranchManager(false);
        }
      }

      // 크루즈몰 관리자인 경우 기능 설정 확인
      if (adminUser) {
        try {
          const permResponse = await fetch('/api/mall-admin/check-permissions', {
            credentials: 'include',
          });
          const permData = await permResponse.json();
          if (permData.ok && permData.isMallAdmin && permData.featureSettings) {
            setCanEditProductText(permData.featureSettings.canEditProductText !== false);
          } else {
            setCanEditProductText(true); // 기본값: 활성화
          }
        } catch {
          setCanEditProductText(true); // 기본값: 활성화
        }
      } else {
        setCanEditProductText(false);
      }
    } catch {
      setIsAdminUser(false);
      setIsSuperAdmin(false);
      setIsBranchManager(false);
      setCanEditProductText(false);
    }
  };

  // 인라인 편집 저장 함수
  const handleSaveField = async (field: string) => {
    if (!isAdminUser && !isSuperAdmin) return;

    // 크루즈몰 관리자인 경우 기능 설정 확인
    if (isAdminUser && !canEditProductText) {
      alert('상품 텍스트 수정 권한이 없습니다.');
      return;
    }

    setIsSaving(true);
    try {
      const updateData: any = { id: product.id };

      // 필드별 데이터 변환
      switch (field) {
        case 'packageName':
          updateData.packageName = editedValues.packageName;
          break;
        case 'nights':
          updateData.nights = parseInt(editedValues.nights.toString()) || product.nights;
          break;
        case 'days':
          updateData.days = parseInt(editedValues.days.toString()) || product.days;
          break;
        case 'cruiseLine':
          updateData.cruiseLine = editedValues.cruiseLine;
          break;
        case 'shipName':
          updateData.shipName = editedValues.shipName;
          break;
        case 'basePrice':
          updateData.basePrice = editedValues.basePrice ? parseInt(editedValues.basePrice.replace(/[^0-9]/g, '')) : null;
          break;
        case 'description':
          updateData.description = editedValues.description;
          break;
        default:
          return;
      }

      const response = await fetch('/api/admin/products', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updateData)
      });

      const data = await response.json();
      if (data.ok) {
        setEditingField(null);
        alert(`${field === 'packageName' ? '제목' : field === 'nights' ? '여행 기간' : field === 'cruiseLine' ? '크루즈 라인' : field === 'shipName' ? '선박명' : field === 'basePrice' ? '시작가' : '상품 설명'}이 수정되었습니다.`);
        window.location.reload();
      } else {
        alert(data.error || '수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to save field:', error);
      alert('수정 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 취소 핸들러
  const handleCancelEdit = useCallback(() => {
    setEditingField(null);
    setEditedValues({
      packageName: product.packageName,
      nights: product.nights,
      days: product.days,
      cruiseLine: product.cruiseLine,
      shipName: product.shipName,
      basePrice: product.basePrice?.toString() || '',
      description: product.description || '',
    });
  }, [product]);

  // layout 데이터 저장 (포함/불포함, 예약안내 등)
  const handleSaveLayout = async () => {
    if (!isAdminUser && !isSuperAdmin) return;

    setIsSaving(true);
    try {
      const layout = {
        included: includedItems,
        excluded: excludedItems,
        bookingInfo: bookingInfo,
        itineraryText: itineraryText,
        priceTableNote: priceTableNote,
      };

      const response = await fetch(`/api/admin/mall/products/${product.productCode}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ layout })
      });

      const data = await response.json();
      if (data.ok) {
        setEditingField(null);
        alert('저장되었습니다.');
        window.location.reload();
      } else {
        alert(data.message || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to save layout:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartTrip = () => {
    const partnerQuery = partnerId ? `&partner=${encodeURIComponent(partnerId)}` : '';
    if (!isLoggedIn) {
      const redirectUrl = encodeURIComponent(`/onboarding?productCode=${product.productCode}${partnerQuery}`);
      router.push(`/login?next=${redirectUrl}`);
    } else {
      router.push(`/onboarding?productCode=${product.productCode}${partnerQuery}`);
    }
  };

  const appendPartnerQuery = (url: string) => {
    if (!partnerId) return url;
    return `${url}${url.includes('?') ? '&' : '?'}partner=${encodeURIComponent(partnerId)}`;
  };

  // 개인 결제 링크 생성
  const getPaymentUrl = () => {
    if (partnerId) {
      return `/${partnerId}/payment?productCode=${encodeURIComponent(product.productCode)}`;
    }
    return `/products/${product.productCode}/payment`;
  };

  // 개인 전화상담 링크 생성
  const getInquiryUrl = () => {
    if (partnerId) {
      return `/products/${product.productCode}/inquiry?partner=${encodeURIComponent(partnerId)}`;
    }
    return `/products/${product.productCode}/inquiry`;
  };

  // 개인 AI 지니 채팅봇 링크 생성
  const getChatBotUrl = () => {
    if (partnerId) {
      return `/chat-bot?productCode=${encodeURIComponent(product.productCode)}&partner=${encodeURIComponent(partnerId)}`;
    }
    return `/chat-bot?productCode=${encodeURIComponent(product.productCode)}`;
  };


  // 출처 배지
  const getSourceBadge = () => {
    if (product.source === 'cruisedot') {
      return (
        <span className="inline-block px-3 py-1 text-sm font-semibold bg-blue-100 text-blue-800 rounded-full">
          크루즈닷 제공
        </span>
      );
    } else if (product.source === 'wcruise') {
      return (
        <span className="inline-block px-3 py-1 text-sm font-semibold bg-green-100 text-green-800 rounded-full">
          W크루즈 제공
        </span>
      );
    } else if (product.source === 'lottejtb') {
      return (
        <span className="inline-block px-3 py-1 text-sm font-semibold bg-purple-100 text-purple-800 rounded-full">
          롯데 제이티비 제공
        </span>
      );
    }
    return null;
  };

  // 가격 포맷팅 (천원 단위 또는 만원 단위로 표시)
  const formatPricingPrice = (price: number | null | undefined) => {
    if (!price) return '-';
    // 천단위 구분 표시 (예: 1,000원, 10,000원)
    return `${price.toLocaleString('ko-KR')}원`;
  };

  // 가격 포맷팅 (basePrice용)
  const formatPrice = (price: number | null) => {
    if (!price) return '가격 문의';
    return `${price.toLocaleString('ko-KR')}원`;
  };

  // detailBlocks에서 이미지와 비디오 추출 (images/videos 배열 대신 사용)
  const imagesFromBlocks = detailBlocks
    .filter((block: any) => block.type === 'image')
    .map((block: any) => block.url);

  const videosFromBlocks = detailBlocks
    .filter((block: any) => block.type === 'video')
    .map((block: any) => block.url);

  // 하위 호환성을 위해 기존 images/videos 배열도 확인 (detailBlocks가 없을 때만 사용)
  const images = imagesFromBlocks.length > 0
    ? imagesFromBlocks
    : (mallContent?.images
      ? (typeof mallContent.images === 'string'
        ? JSON.parse(mallContent.images)
        : mallContent.images)
      : []);

  const videos = videosFromBlocks.length > 0
    ? videosFromBlocks
    : (mallContent?.videos
      ? (typeof mallContent.videos === 'string'
        ? JSON.parse(mallContent.videos)
        : mallContent.videos)
      : []);

  return (
    <div className="container mx-auto px-3 sm:px-4 md:px-6 py-0 md:py-8 bg-[#F5F7FA] min-h-screen">
      <div className="max-w-7xl mx-auto w-full">
        {/* 이전으로 돌아가기 버튼 - 상단 */}
        <button
          onClick={() => router.back()}
          className="mb-3 flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors px-4 pt-4 md:px-0 md:pt-0"
        >
          <FiChevronLeft size={20} />
          <span className="text-sm font-medium">이전으로 돌아가기</span>
        </button>
        {/* 메인 콘텐츠 영역 */}
        <div>
          {/* 상품 헤더 */}
          <div className="bg-white md:rounded-2xl md:shadow-xl p-4 md:p-8 mb-0 md:mb-10 md:border md:border-gray-100">
            {/* 출처 배지 */}
            <div className="mb-4">
              {getSourceBadge()}
            </div>

            {/* 상품 이미지/비디오 섹션 */}
            <div className="mb-6">
              {/* 메인 이미지/비디오 - 썸네일 우선 표시 */}
              <div className="relative h-[260px] sm:h-80 md:h-[500px] bg-gradient-to-br from-[#051C2C] to-[#0A2E46] md:rounded-2xl overflow-hidden mb-4 md:mb-6 md:shadow-2xl -mx-3 md:mx-0">
                {mallContent?.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getProxyImageUrl(mallContent.thumbnail)}
                    alt={`${product.cruiseLine} ${product.shipName} - ${product.packageName} 크루즈 여행 상품 썸네일`}
                    className="w-full h-full object-contain"
                  />
                ) : videos.length > 0 && selectedVideoIndex < videos.length ? (
                  <iframe
                    src={videos[selectedVideoIndex]}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : images.length > 0 && selectedImageIndex < images.length ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getProxyImageUrl(images[selectedImageIndex])}
                    alt={`${product.cruiseLine} ${product.shipName} - ${product.packageName} 크루즈 여행 상품 썸네일`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-white">
                      <p className="text-4xl font-bold">{koreanShipName}</p>
                      <p className="text-lg mt-2">{displayCruiseLine}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 썸네일 갤러리 - detailBlocks가 없을 때만 표시 (하위 호환성) */}
              {detailBlocks.length === 0 && (images.length > 1 || videos.length > 0) && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {videos.map((video: string, index: number) => (
                    <button
                      key={`video-${index}`}
                      onClick={() => {
                        setSelectedVideoIndex(index);
                        setSelectedImageIndex(-1);
                      }}
                      className={`flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden border transition-all ${selectedVideoIndex === index ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center text-white">
                        <span className="text-xs md:text-sm">🎥 {index + 1}</span>
                      </div>
                    </button>
                  ))}
                  {images.map((image: string, index: number) => (
                    <button
                      key={`image-${index}`}
                      onClick={() => {
                        setSelectedImageIndex(index);
                        setSelectedVideoIndex(-1);
                      }}
                      className={`flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden border transition-all ${selectedImageIndex === index ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getProxyImageUrl(image)}
                        alt={`${product.cruiseLine} ${product.shipName} - ${product.packageName} 크루즈 여행 상세 이미지 ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 패키지명 및 수정 버튼 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1">
                {editingField === 'packageName' ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editedValues.packageName}
                      onChange={(e) => setEditedValues({ ...editedValues, packageName: e.target.value })}
                      className="w-full px-4 py-2 text-3xl font-bold text-gray-800 border-2 border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveField('packageName')}
                        disabled={isSaving}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      >
                        <FiSave size={14} />
                        <span>저장</span>
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        <FiX size={14} />
                        <span>취소</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group relative">
                    {/* 추천 키워드 (마케팅 태그) - 상품 제목 위에 표시 */}
                    {recommendedKeywords.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {recommendedKeywords.map((keyword: string) => (
                          <span
                            key={keyword}
                            className="px-3 py-1.5 bg-gradient-to-r from-[#051C2C] to-[#0A2E46] text-[#FDB931] rounded-md text-sm md:text-base font-semibold shadow-sm"
                            style={{ wordBreak: 'keep-all', lineHeight: '1.3' }}
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    )}

                    <h1
                      className="text-3xl md:text-5xl font-black text-[#051C2C] mb-4 tracking-tight"
                      style={{
                        wordBreak: 'keep-all',
                        lineHeight: '1.4',
                        letterSpacing: '-0.02em'
                      }}
                    >
                      {editedValues.packageName}
                    </h1>

                    {/* 별점과 리뷰 개수 */}
                    <div className="flex flex-col gap-3 mt-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div
                          className="flex items-center gap-1.5 bg-[#FDB931]/10 px-3 py-1.5 rounded-lg border border-[#FDB931]/30 cursor-pointer hover:bg-[#FDB931]/20 transition-colors"
                          onClick={() => setShowReviewModal(true)}
                          title="리뷰 보기"
                        >
                          <FiStar className="text-[#FDB931] fill-[#FDB931]" size={20} />
                          <span className="text-xl md:text-2xl font-bold text-[#051C2C]">{rating.toFixed(1)}</span>
                        </div>
                        {reviewCount > 0 ? (
                          <button
                            onClick={() => setShowReviewModal(true)}
                            className="text-base md:text-lg text-gray-600 font-semibold hover:text-blue-600 transition-colors cursor-pointer"
                            style={{ wordBreak: 'keep-all' }}
                          >
                            리뷰 {reviewCount.toLocaleString('ko-KR')}개
                          </button>
                        ) : (
                          <span className="text-base md:text-lg text-gray-600 font-semibold">
                            리뷰 {reviewCount.toLocaleString('ko-KR')}개
                          </span>
                        )}
                      </div>

                      {/* 후킹 태그 - 이용자 리뷰 밑에 표시 */}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {tags.map((tagId: string) => {
                            const tag = getTagById(tagId);
                            if (!tag) return null;
                            return (
                              <span
                                key={tagId}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs md:text-sm font-semibold text-white ${tag.color} shadow-sm`}
                              >
                                <span>{tag.emoji}</span>
                                <span>{tag.label}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {(isSuperAdmin || (isAdminUser && canEditProductText)) && (
                      <button
                        onClick={() => setEditingField('packageName')}
                        className="absolute -right-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                        title="더블클릭 또는 버튼 클릭으로 수정"
                      >
                        <FiEdit2 size={18} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {/* 수정 버튼 (관리자 또는 대리점장만 표시) */}
              {(isSuperAdmin || isBranchManager) && (
                <Link
                  href={`/admin/products?edit=${product.productCode}`}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
                  title="관리자 패널에서 전체 수정"
                >
                  <FiEdit2 size={18} />
                  <span>전체 수정</span>
                </Link>
              )}
            </div>

            {/* 기본 정보 - 모바일: 세로 배치, 데스크톱: 가로 배치 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 mb-5 md:mb-6 w-full">
              {/* 여행 기간 */}
              <div className="bg-white rounded-2xl p-5 md:p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:border-[#FDB931]/50 transition-all duration-300 group w-full">
                <div className="text-sm md:text-base text-gray-600 mb-2 font-medium">여행기간</div>
                {editingField === 'nights' || editingField === 'days' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={editedValues.nights}
                        onChange={(e) => setEditedValues({ ...editedValues, nights: parseInt(e.target.value) || 0 })}
                        className="w-16 px-2 py-1 border-2 border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg font-semibold"
                        placeholder="박"
                      />
                      <span className="text-lg font-semibold text-gray-800">박</span>
                      <input
                        type="number"
                        value={editedValues.days}
                        onChange={(e) => setEditedValues({ ...editedValues, days: parseInt(e.target.value) || 0 })}
                        className="w-16 px-2 py-1 border-2 border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg font-semibold"
                        placeholder="일"
                      />
                      <span className="text-lg font-semibold text-gray-800">일</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveField('nights')}
                        disabled={isSaving}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <FiSave size={12} />
                        <span>저장</span>
                      </button>
                      <button
                        onClick={() => {
                          setEditingField(null);
                          setEditedValues({ ...editedValues, nights: product.nights, days: product.days });
                        }}
                        className="flex items-center gap-1 px-2 py-1 border border-gray-300 text-gray-700 text-xs font-semibold rounded hover:bg-gray-50 transition-colors"
                      >
                        <FiX size={12} />
                        <span>취소</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group/item relative">
                    <div className="text-2xl md:text-2xl font-bold text-gray-900 break-words" style={{ lineHeight: '1.3', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      {travelPeriod || `${editedValues.nights}박 ${editedValues.days}일`}
                    </div>
                    {(isSuperAdmin || (isAdminUser && canEditProductText)) && (
                      <button
                        onClick={() => setEditingField('nights')}
                        className="absolute -right-6 top-0 opacity-0 group-hover/item:opacity-100 transition-opacity p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                        title="수정"
                      >
                        <FiEdit2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 크루즈 라인 */}
              <div className="bg-white rounded-2xl p-5 md:p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:border-[#FDB931]/50 transition-all duration-300 group w-full">
                <div className="text-sm md:text-base text-gray-600 mb-2 font-medium">크루즈라인</div>
                {editingField === 'cruiseLine' ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editedValues.cruiseLine}
                      onChange={(e) => setEditedValues({ ...editedValues, cruiseLine: e.target.value })}
                      className="w-full px-3 py-2 text-lg font-semibold text-gray-800 border-2 border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveField('cruiseLine')}
                        disabled={isSaving}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <FiSave size={12} />
                        <span>저장</span>
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="flex items-center gap-1 px-2 py-1 border border-gray-300 text-gray-700 text-xs font-semibold rounded hover:bg-gray-50 transition-colors"
                      >
                        <FiX size={12} />
                        <span>취소</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group/item relative">
                    <div className="text-xl md:text-xl font-bold text-gray-900 break-words" style={{ lineHeight: '1.4', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      {displayCruiseLine}
                    </div>
                    {(isSuperAdmin || (isAdminUser && canEditProductText)) && (
                      <button
                        onClick={() => setEditingField('cruiseLine')}
                        className="absolute -right-6 top-0 opacity-0 group-hover/item:opacity-100 transition-opacity p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                        title="수정"
                      >
                        <FiEdit2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 선박명 */}
              <div className="bg-white rounded-2xl p-5 md:p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:border-[#FDB931]/50 transition-all duration-300 group w-full">
                <div className="text-sm md:text-base text-gray-600 mb-2 font-medium">선박명</div>
                {editingField === 'shipName' ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editedValues.shipName}
                      onChange={(e) => setEditedValues({ ...editedValues, shipName: e.target.value })}
                      className="w-full px-3 py-2 text-lg font-semibold text-gray-800 border-2 border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveField('shipName')}
                        disabled={isSaving}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <FiSave size={12} />
                        <span>저장</span>
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="flex items-center gap-1 px-2 py-1 border border-gray-300 text-gray-700 text-xs font-semibold rounded hover:bg-gray-50 transition-colors"
                      >
                        <FiX size={12} />
                        <span>취소</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group/item relative">
                    <div className="text-xl md:text-xl font-bold text-gray-900 break-words" style={{ lineHeight: '1.4', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      {koreanShipName}
                    </div>
                    {(isSuperAdmin || (isAdminUser && canEditProductText)) && (
                      <button
                        onClick={() => setEditingField('shipName')}
                        className="absolute -right-6 top-0 opacity-0 group-hover/item:opacity-100 transition-opacity p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                        title="수정"
                      >
                        <FiEdit2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 시작가 */}
              <div className="bg-white rounded-2xl p-5 md:p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:border-[#FDB931]/50 transition-all duration-300 group w-full">
                <div className="text-sm md:text-base text-gray-600 mb-2 font-medium">시작가</div>
                {editingField === 'basePrice' ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editedValues.basePrice}
                      onChange={(e) => {
                        const numValue = e.target.value.replace(/[^0-9]/g, '');
                        setEditedValues({ ...editedValues, basePrice: numValue });
                      }}
                      className="w-full px-3 py-2 border-2 border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-xl font-bold"
                      placeholder="가격 입력"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveField('basePrice')}
                        disabled={isSaving}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <FiSave size={12} />
                        <span>저장</span>
                      </button>
                      <button
                        onClick={() => {
                          setEditingField(null);
                          setEditedValues({ ...editedValues, basePrice: product.basePrice?.toString() || '' });
                        }}
                        className="flex items-center gap-1 px-2 py-1 border border-gray-300 text-gray-700 text-xs font-semibold rounded hover:bg-gray-50 transition-colors"
                      >
                        <FiX size={12} />
                        <span>취소</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group/item relative">
                    {product.basePrice ? (
                      <div className="space-y-2">
                        <div className="flex flex-col">
                          <div
                            className="text-xl md:text-lg font-bold text-gray-900 break-words"
                            style={{
                              lineHeight: '1.3',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                              maxWidth: '100%'
                            }}
                          >
                            {formatPrice(product.basePrice)}
                          </div>
                          <span className="text-xs md:text-xs text-gray-500 mt-1">전체 금액</span>
                        </div>
                        <div className="flex flex-col pt-2 border-t border-gray-100">
                          <div
                            className="text-base md:text-base font-semibold text-rose-600 break-words"
                            style={{
                              lineHeight: '1.3',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                              maxWidth: '100%'
                            }}
                          >
                            월 {formatPrice(Math.ceil(product.basePrice / 12))}
                          </div>
                          <span className="text-xs md:text-xs text-gray-500 mt-1">12개월 할부</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xl md:text-lg font-semibold text-gray-600 break-words">가격 문의</div>
                    )}
                    {(isSuperAdmin || (isAdminUser && canEditProductText)) && (
                      <button
                        onClick={() => setEditingField('basePrice')}
                        className="absolute -right-6 top-0 opacity-0 group-hover/item:opacity-100 transition-opacity p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                        title="수정"
                      >
                        <FiEdit2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 방문 국가 (파란색 버튼) - 상품 설명 위에 표시 */}
            {finalDestination && Array.isArray(finalDestination) && finalDestination.length > 0 && (
              <div className="mb-5 md:mb-6 flex flex-wrap gap-2">
                {finalDestination.map((countryCode: string) => {
                  const countryNames: Record<string, string> = {
                    'JP': '일본', 'KR': '한국', 'TH': '태국', 'VN': '베트남', 'MY': '말레이시아',
                    'SG': '싱가포르', 'ES': '스페인', 'FR': '프랑스', 'IT': '이탈리아', 'GR': '그리스',
                    'TR': '터키', 'US': '미국', 'CN': '중국', 'TW': '대만', 'HK': '홍콩',
                    'PH': '필리핀', 'ID': '인도네시아', 'CA': '캐나다'
                  };
                  const countryName = countryNames[countryCode] || countryCode;
                  return (
                    <span
                      key={countryCode}
                      className="px-4 py-2 bg-[#051C2C] text-white rounded-full text-sm md:text-base font-bold hover:bg-[#0A2E46] transition-colors shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                      style={{ wordBreak: 'keep-all' }}
                    >
                      {countryName}
                    </span>
                  );
                })}
              </div>
            )}

            {/* 설명 */}
            <div className="mb-4 md:mb-6 bg-white md:rounded-xl p-4 md:p-6 md:border md:border-gray-200 md:shadow-sm border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl md:text-2xl font-bold text-[#051C2C]">상품 설명</h2>
              </div>
              {editingField === 'description' ? (
                <div className="space-y-2">
                  <textarea
                    value={editedValues.description}
                    onChange={(e) => setEditedValues({ ...editedValues, description: e.target.value })}
                    className="w-full min-h-[200px] p-4 border-2 border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y transition-all"
                    placeholder="상품 설명을 입력하세요"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSaveField('description')}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      <FiSave size={18} />
                      <span>{isSaving ? '저장 중...' : '저장'}</span>
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      <FiX size={18} />
                      <span>취소</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group relative">
                  <p
                    className="text-base md:text-lg text-gray-700 whitespace-pre-wrap min-h-[50px]"
                    style={{
                      wordBreak: 'keep-all',
                      lineHeight: '1.8',
                      letterSpacing: '0.01em',
                      fontWeight: '400'
                    }}
                  >
                    {editedValues.description || ((isAdminUser || isSuperAdmin) ? '상품 설명이 없습니다. 더블클릭하여 추가하세요.' : '상품 설명이 없습니다.')}
                  </p>
                  {(isAdminUser || isSuperAdmin) && (
                    <button
                      onClick={() => setEditingField('description')}
                      className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                      title="더블클릭 또는 버튼 클릭으로 수정"
                    >
                      <FiEdit2 size={18} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 항공 미포함 안내 */}
            {!flightInfo && (
              <div className="mb-4 md:mb-6 bg-white md:rounded-2xl p-4 md:p-6 md:border md:border-gray-200 md:shadow-sm border-t border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🚢</span>
                  <div>
                    <span className="text-lg font-bold text-gray-800">항공 미포함</span>
                    <p className="text-sm text-gray-500 mt-0.5">본 상품은 항공권이 포함되지 않습니다. (크루즈 국내 출·도착)</p>
                  </div>
                </div>
              </div>
            )}

            {/* 항공 정보 */}
            {flightInfo && (
              <div className="mb-6 bg-white md:rounded-2xl p-4 md:p-8 border border-gray-200 md:shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl md:text-2xl font-bold text-[#051C2C] mb-0">항공여정</h2>
                </div>

                {/* 비행기 정보 (가운데 정렬, 크게 표시) */}
                {flightInfo.aircraftType && (
                  <div className="mb-8 text-center bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
                    <div className="text-4xl md:text-5xl font-extrabold text-blue-700 mb-2" style={{ wordBreak: 'keep-all', lineHeight: '1.3' }}>
                      {flightInfo.aircraftType}
                    </div>
                  </div>
                )}

                {/* 여행기간 */}
                {flightInfo.travelPeriod && (
                  <div className="mb-6 p-6 bg-gradient-to-br from-gray-50 to-white rounded-xl border-2 border-gray-200 shadow-md">
                    <div className="text-base md:text-lg font-bold text-gray-700 mb-3">여행기간</div>
                    <div className="text-xl md:text-2xl font-extrabold text-gray-900" style={{ wordBreak: 'keep-all', lineHeight: '1.5' }}>
                      {flightInfo.travelPeriod.startDate && flightInfo.travelPeriod.endDate ? (
                        <>
                          {formatDateWithDay(flightInfo.travelPeriod.startDate)} ~ {formatDateWithDay(flightInfo.travelPeriod.endDate)}
                          <br />
                          <span className="text-lg md:text-xl font-bold text-gray-700 mt-2 block">{flightInfo.travelPeriod.nights}박 {flightInfo.travelPeriod.days}일</span>
                        </>
                      ) : (
                        `${flightInfo.travelPeriod.nights}박 ${flightInfo.travelPeriod.days}일`
                      )}
                    </div>
                  </div>
                )}

                {/* 출국 */}
                {flightInfo.departure && !flightInfo.departure.flightNumber?.includes('항공없음') && (
                  <div className="mb-6 p-6 bg-white rounded-xl border-2 border-gray-300 shadow-md">
                    <h3 className="text-lg md:text-xl font-extrabold text-gray-900 mb-4">출국</h3>
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3 text-base md:text-lg" style={{ wordBreak: 'keep-all', lineHeight: '1.6' }}>
                        <span className="text-gray-600 font-semibold">({flightInfo.departure.from})</span>
                        <span className="font-bold text-gray-800">{flightInfo.departure.date ? formatDateWithDay(flightInfo.departure.date) : ''}</span>
                        <span className="text-2xl md:text-3xl font-extrabold text-gray-900">{formatTime(flightInfo.departure.time)}</span>
                        <span className="text-gray-400 text-2xl">→</span>
                        <span className="text-gray-600 font-semibold">({flightInfo.departure.to})</span>
                        <span className="font-bold text-gray-800">{flightInfo.departure.date ? formatDateWithDay(flightInfo.departure.date) : ''}</span>
                        {flightInfo.departure.arrivalTime && (
                          <span className="text-2xl md:text-3xl font-extrabold text-gray-900">{formatTime(flightInfo.departure.arrivalTime)}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-base md:text-lg text-gray-700 pt-3 border-t border-gray-200">
                        <span className="font-extrabold text-lg md:text-xl">{flightInfo.departure.flightNumber}</span>
                        <span className="font-semibold">총 {flightInfo.departure.duration} 소요</span>
                        <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm md:text-base font-bold border-2 border-blue-300">{flightInfo.departure.type}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 귀국 */}
                {flightInfo.return && !flightInfo.return.flightNumber?.includes('항공없음') && (
                  <div className="mb-6 p-6 bg-white rounded-xl border-2 border-gray-300 shadow-md">
                    <h3 className="text-lg md:text-xl font-extrabold text-gray-900 mb-4">귀국</h3>
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3 text-base md:text-lg" style={{ wordBreak: 'keep-all', lineHeight: '1.6' }}>
                        <span className="text-gray-600 font-semibold">({flightInfo.return.from})</span>
                        <span className="font-bold text-gray-800">{flightInfo.return.date ? formatDateWithDay(flightInfo.return.date) : ''}</span>
                        <span className="text-2xl md:text-3xl font-extrabold text-gray-900">{formatTime(flightInfo.return.time)}</span>
                        <span className="text-gray-400 text-2xl">→</span>
                        <span className="text-gray-600 font-semibold">({flightInfo.return.to})</span>
                        <span className="font-bold text-gray-800">{flightInfo.return.date ? formatDateWithDay(flightInfo.return.date) : ''}</span>
                        {flightInfo.return.arrivalTime && (
                          <span className="text-2xl md:text-3xl font-extrabold text-gray-900">{formatTime(flightInfo.return.arrivalTime)}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-base md:text-lg text-gray-700 pt-3 border-t border-gray-200">
                        <span className="font-extrabold text-lg md:text-xl">{flightInfo.return.flightNumber}</span>
                        <span className="font-semibold">총 {flightInfo.return.duration} 소요</span>
                        <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm md:text-base font-bold border-2 border-blue-300">{flightInfo.return.type}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 서비스 옵션 (항공여정 밑에 표시) */}
            {(hasEscort || hasLocalGuide || hasCruisedotStaff || hasTravelInsurance) && (
              <div className="mb-4 md:mb-8 bg-white md:rounded-2xl p-4 md:p-8 md:border md:border-gray-200 md:shadow-md border-t border-gray-100">
                <h2 className="text-xl md:text-2xl font-bold text-[#051C2C] mb-4 md:mb-6">서비스 옵션</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {hasEscort && (
                    <div className="flex items-center gap-4 p-4 bg-white rounded-xl border-2 border-gray-200 shadow-md hover:shadow-lg transition-all">
                      <FiCheck className="text-green-600 flex-shrink-0" size={24} />
                      <span className="text-base md:text-lg font-bold text-gray-900" style={{ wordBreak: 'keep-all', lineHeight: '1.5' }}>인솔자 있음</span>
                    </div>
                  )}
                  {hasLocalGuide && (
                    <div className="flex items-center gap-4 p-4 bg-white rounded-xl border-2 border-gray-200 shadow-md hover:shadow-lg transition-all">
                      <FiCheck className="text-green-600 flex-shrink-0" size={24} />
                      <span className="text-base md:text-lg font-bold text-gray-900" style={{ wordBreak: 'keep-all', lineHeight: '1.5' }}>현지가이드 있음</span>
                    </div>
                  )}
                  {hasCruisedotStaff && (
                    <div className="flex items-center gap-4 p-4 bg-white rounded-xl border-2 border-gray-200 shadow-md hover:shadow-lg transition-all">
                      <FiCheck className="text-green-600 flex-shrink-0" size={24} />
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/images/ai-cruise-logo.png"
                          alt="Cruisedot"
                          className="w-6 h-6 md:w-8 md:h-8 object-contain flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <span className="text-base md:text-lg font-bold text-gray-900" style={{ wordBreak: 'keep-all', lineHeight: '1.5' }}>크루즈닷 전용 스탭 있음</span>
                      </div>
                    </div>
                  )}
                  {hasTravelInsurance && (
                    <div className="flex items-center gap-4 p-4 bg-white rounded-xl border-2 border-gray-200 shadow-md hover:shadow-lg transition-all">
                      <FiCheck className="text-green-600 flex-shrink-0" size={24} />
                      <span className="text-base md:text-lg font-bold text-gray-900" style={{ wordBreak: 'keep-all', lineHeight: '1.5' }}>여행자보험 있음</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 상세페이지 블록 (이미지, 동영상, 텍스트) */}
            {detailBlocks.length > 0 && (
              <div className="mb-6 space-y-6">
                {detailBlocks.map((block: any, index: number) => {
                  if (block.type === 'image') {
                    return (
                      <div key={block.id || index} className="bg-white md:rounded-xl overflow-hidden md:shadow-md -mx-3 md:mx-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getProxyImageUrl(block.url)}
                          alt={block.alt || `${product.cruiseLine} ${product.shipName} - ${product.packageName} 크루즈 여행 이미지 ${index + 1}`}
                          className="w-full h-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => {
                            setModalImageUrl(getProxyImageUrl(block.url));
                            setShowImageModal(true);
                          }}
                        />
                        {block.alt && (
                          <div className="p-5 md:p-6 bg-gradient-to-br from-gray-50 to-gray-100 border-t border-gray-200">
                            <p className="text-base md:text-lg text-gray-800 leading-relaxed tracking-wide font-medium not-italic break-words" style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
                              {block.alt}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  } else if (block.type === 'video') {
                    // 유튜브 URL 파싱 함수
                    const getYouTubeEmbedUrl = (url: string): string | null => {
                      if (!url) return null;

                      // 이미 embed URL인 경우
                      if (url.includes('youtube.com/embed/') || url.includes('youtu.be/embed/')) {
                        return url.split('?')[0]; // 쿼리 파라미터 제거
                      }

                      // youtube.com/watch?v= 형식
                      const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
                      if (watchMatch) {
                        return `https://www.youtube.com/embed/${watchMatch[1]}`;
                      }

                      // youtu.be/ 형식
                      const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
                      if (shortMatch) {
                        return `https://www.youtube.com/embed/${shortMatch[1]}`;
                      }

                      // youtube.com/ 형식 (다양한 패턴)
                      const youtubeMatch = url.match(/youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]+)/);
                      if (youtubeMatch) {
                        return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
                      }

                      return null;
                    };

                    const embedUrl = getYouTubeEmbedUrl(block.url);

                    return (
                      <div key={block.id || index} className="bg-white rounded-xl overflow-hidden shadow-md">
                        {embedUrl ? (
                          <div
                            className="relative w-full cursor-pointer hover:opacity-90 transition-opacity"
                            style={{ paddingBottom: '56.25%' }}
                            onClick={() => {
                              setModalVideoUrl(embedUrl);
                              setShowVideoModal(true);
                            }}
                          >
                            <iframe
                              src={embedUrl}
                              className="absolute top-0 left-0 w-full h-full rounded-t-xl pointer-events-none"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              frameBorder="0"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-10 transition-all">
                              <FiMaximize2 size={48} className="text-white opacity-0 hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        ) : (
                          <video
                            src={block.url}
                            controls
                            className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => {
                              setModalVideoUrl(block.url);
                              setShowVideoModal(true);
                            }}
                          />
                        )}
                        {block.title && (
                          <div className="p-5 md:p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-t border-blue-200">
                            <p className="text-xl md:text-2xl font-bold text-gray-900 leading-relaxed tracking-wide break-words" style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
                              {block.title}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  } else if (block.type === 'text') {
                    return (
                      <div key={block.id || index} className="bg-white rounded-xl p-4 md:p-6 shadow-md">
                        <div
                          className="prose prose-base md:prose-xl max-w-none text-gray-800"
                          style={{
                            wordBreak: 'keep-all',
                            overflowWrap: 'break-word',
                            lineHeight: '1.9',
                            letterSpacing: '0.025em',
                            fontSize: '16px'
                          }}
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.content) }}
                        />
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}

            {/* 포함/불포함 항목 */}
            <div className="mb-4 md:mb-6 grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-5">
              {/* 포함 사항 */}
              <div className="bg-white md:rounded-xl p-4 md:p-6 md:border md:border-gray-200 md:shadow-sm border-t border-gray-100 group relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
                    <FiCheck className="text-emerald-500" size={20} />
                    <span>포함 사항</span>
                  </h3>
                  {(isAdminUser || isSuperAdmin) && (
                    <button
                      onClick={() => setEditingField('included')}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                      title="수정"
                    >
                      <FiEdit2 size={18} />
                    </button>
                  )}
                </div>
                {editingField === 'included' ? (
                  <div className="space-y-3">
                    {includedItems.map((item, index) => (
                      <div key={`included-edit-${index}-${item.slice(0, 20)}`} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => {
                            const newItems = [...includedItems];
                            newItems[index] = e.target.value;
                            setIncludedItems(newItems);
                          }}
                          className="flex-1 px-3 py-2 border-2 border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <button
                          onClick={() => {
                            setIncludedItems(includedItems.filter((_, i) => i !== index));
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <FiX size={18} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setIncludedItems([...includedItems, ''])}
                      className="w-full px-3 py-2 border-2 border-dashed border-green-400 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      + 항목 추가
                    </button>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={handleSaveLayout}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <FiSave size={16} className="inline mr-1" />
                        저장
                      </button>
                      <button
                        onClick={() => {
                          setEditingField(null);
                          setIncludedItems(layoutData?.included || defaultIncluded);
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {includedItems.map((item, index) => (
                      <div key={`included-${index}-${item.slice(0, 20)}`} className="bg-white rounded-lg p-3 md:p-4 border border-gray-200 hover:border-emerald-300 transition-colors">
                        <div className="flex items-start gap-2.5" style={{ wordBreak: 'keep-all', lineHeight: '1.6' }}>
                          <span className="text-emerald-500 mt-0.5 flex-shrink-0 text-lg font-bold">✓</span>
                          <span className="text-sm md:text-base flex-1">{item}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 불포함 사항 */}
              <div className="bg-white md:rounded-xl p-4 md:p-6 md:border md:border-gray-200 md:shadow-sm border-t border-gray-100 group relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
                    <FiX className="text-rose-500" size={20} />
                    <span>불포함 사항</span>
                  </h3>
                  {(isAdminUser || isSuperAdmin) && (
                    <button
                      onClick={() => setEditingField('excluded')}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                      title="수정"
                    >
                      <FiEdit2 size={18} />
                    </button>
                  )}
                </div>
                {editingField === 'excluded' ? (
                  <div className="space-y-3">
                    {excludedItems.map((item, index) => (
                      <div key={`excluded-edit-${index}-${item.slice(0, 20)}`} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => {
                            const newItems = [...excludedItems];
                            newItems[index] = e.target.value;
                            setExcludedItems(newItems);
                          }}
                          className="flex-1 px-3 py-2 border-2 border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <button
                          onClick={() => {
                            setExcludedItems(excludedItems.filter((_, i) => i !== index));
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <FiX size={18} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setExcludedItems([...excludedItems, ''])}
                      className="w-full px-3 py-2 border-2 border-dashed border-red-400 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      + 항목 추가
                    </button>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={handleSaveLayout}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <FiSave size={16} className="inline mr-1" />
                        저장
                      </button>
                      <button
                        onClick={() => {
                          setEditingField(null);
                          setExcludedItems(layoutData?.excluded || defaultExcluded);
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {excludedItems.map((item, index) => (
                      <div key={`excluded-${index}-${item.slice(0, 20)}`} className="bg-white rounded-lg p-3 md:p-4 border border-gray-200 hover:border-rose-300 transition-colors">
                        <div className="flex items-start gap-2.5" style={{ wordBreak: 'keep-all', lineHeight: '1.6' }}>
                          <span className="text-rose-500 mt-0.5 flex-shrink-0 text-lg font-bold">✗</span>
                          <span className="text-sm md:text-base flex-1">{item}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 향상된 여행일정 */}
            {enhancedItinerary && Array.isArray(enhancedItinerary) && enhancedItinerary.length > 0 && (
              <div className="mb-4 md:mb-6 bg-white md:rounded-xl p-4 md:p-6 md:border md:border-gray-200 md:shadow-sm border-t border-gray-100">
                <h2 className="text-xl md:text-2xl font-bold text-[#051C2C] mb-4">여행 일정</h2>
                <div className="space-y-8">
                  {enhancedItinerary.map((day: any, index: number) => {
                    // 날짜 계산 (startDate 기준)
                    const startDate = product.startDate ? new Date(product.startDate) : new Date();
                    const dayDate = new Date(startDate);
                    dayDate.setDate(startDate.getDate() + (day.day - 1));
                    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dayDate.getDay()];
                    const formattedDate = `${dayDate.getFullYear()}/${String(dayDate.getMonth() + 1).padStart(2, '0')}/${String(dayDate.getDate()).padStart(2, '0')}(${dayOfWeek})`;

                    return (
                      <div
                        key={day.day || index}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4"
                      >
                        {/* 일차 헤더 */}
                        <div className="bg-[#051C2C] text-white p-5 md:p-6">
                          <div className="flex items-center gap-4">
                            {day.emoji && (
                              <span className="text-3xl md:text-4xl drop-shadow-md">{day.emoji}</span>
                            )}
                            <h3 className="text-lg md:text-xl font-bold" style={{ wordBreak: 'keep-all', lineHeight: '1.4' }}>
                              <span className="text-[#FDB931] mr-2">{day.day || index + 1}일차</span> | {formattedDate}
                            </h3>
                          </div>
                        </div>

                        <div className="p-6 md:p-8 space-y-6">
                          {/* 관광지 도착지 */}
                          {day.arrivalLocation && (
                            <div className="flex items-center gap-3 text-gray-900 bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                              <span className="text-red-600 text-2xl md:text-3xl">📍</span>
                              <span className="text-lg md:text-xl font-extrabold" style={{ wordBreak: 'keep-all', lineHeight: '1.5' }}>{day.arrivalLocation}</span>
                            </div>
                          )}

                          {/* 일정 시작 */}
                          {(day.scheduleStartTime || day.scheduleStartTitle) && (
                            <div className="space-y-3 bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                              <div className="flex flex-wrap items-center gap-3 text-gray-800" style={{ wordBreak: 'keep-all', lineHeight: '1.6' }}>
                                {day.scheduleStartTime && (
                                  <span className="font-bold text-base md:text-lg">[{day.scheduleStartTime}]</span>
                                )}
                                {day.scheduleStartTitle && (
                                  <span className="text-base md:text-lg font-semibold">{day.scheduleStartTitle}</span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 관광이미지 */}
                          {day.tourImages && Array.isArray(day.tourImages) && day.tourImages.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {day.tourImages.slice(0, 2).map((img: string, idx: number) => (
                                <div key={idx} className="relative rounded-lg overflow-hidden shadow-md">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={img}
                                    alt={`${product.packageName} 기항지 관광 이미지 ${idx + 1}`}
                                    className="w-full h-64 object-cover"
                                  />
                                </div>
                              ))}
                              {day.tourImages.length > 2 && (
                                <div className="relative rounded-lg overflow-hidden shadow-md bg-gray-100 flex items-center justify-center h-64">
                                  <div className="text-center">
                                    <div className="text-4xl font-bold text-gray-400 mb-2">+{day.tourImages.length - 2}</div>
                                    <div className="text-sm text-gray-600">크루즈 관광지 더보기</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 관광 텍스트 */}
                          {day.tourText && (() => {
                            // 텍스트를 HTML로 변환 (줄바꿈과 문단 구분 보존)
                            const formatTourText = (text: string): string => {
                              if (!text) return '';
                              // HTML 태그가 있는지 확인
                              const hasHtml = /<[a-z][\s\S]*>/i.test(text);
                              if (hasHtml) {
                                // HTML이 이미 있으면 그대로 사용하되 줄바꿈 처리
                                return text.replace(/\n\n+/g, '</p><p class="mb-4">').replace(/\n/g, '<br />');
                              }
                              // 일반 텍스트인 경우 줄바꿈과 문단 구분 처리
                              const paragraphs = text.split(/\n\n+/);
                              return paragraphs.map(p => {
                                const lines = p.split(/\n/);
                                return `<p class="mb-4">${lines.join('<br />')}</p>`;
                              }).join('');
                            };

                            return (
                              <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 md:p-8 border-l-4 border-gray-400 shadow-md">
                                <div
                                  className="text-lg md:text-xl text-gray-800"
                                  style={{
                                    wordBreak: 'keep-all',
                                    lineHeight: '2.2',
                                    letterSpacing: '0.03em',
                                    whiteSpace: 'pre-wrap',
                                    fontWeight: '400'
                                  }}
                                  dangerouslySetInnerHTML={{
                                    __html: DOMPurify.sanitize(formatTourText(day.tourText))
                                  }}
                                />
                              </div>
                            );
                          })()}

                          {/* 일정 마무리 */}
                          {(day.scheduleEndTime || day.scheduleEndTitle) && (
                            <div className="space-y-3 bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                              <div className="flex flex-wrap items-center gap-3 text-gray-800" style={{ wordBreak: 'keep-all', lineHeight: '1.6' }}>
                                {day.scheduleEndTime && (
                                  <span className="font-bold text-base md:text-lg">[{day.scheduleEndTime}]</span>
                                )}
                                {day.scheduleEndTitle && (
                                  <span className="text-base md:text-lg font-semibold">{day.scheduleEndTitle}</span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 숙박 */}
                          {(day.accommodation || day.accommodationImage || (day.accommodationImages && day.accommodationImages.length > 0)) && (
                            <div className="space-y-4 pt-6 border-t-2 border-gray-200">
                              <div className="flex items-center gap-3 text-gray-800 bg-gray-50 rounded-xl p-4">
                                <span className="text-2xl md:text-3xl">🛏️</span>
                                {day.accommodation && (
                                  <span className="font-extrabold text-lg md:text-xl" style={{ wordBreak: 'keep-all', lineHeight: '1.5' }}>{day.accommodation}</span>
                                )}
                              </div>
                              {/* 여러 장 (새 필드) */}
                              {(day.accommodationImages && day.accommodationImages.length > 0) ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-3xl">
                                  {day.accommodationImages.map((imgUrl: string, idx: number) => (
                                    <div key={idx} className="w-full">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={imgUrl}
                                        alt={`${product.cruiseLine} ${product.shipName} 크루즈 선박 객실 사진 ${idx + 1}`}
                                        className="w-full h-auto object-cover rounded-xl border-2 border-gray-300 shadow-lg"
                                      />
                                    </div>
                                  ))}
                                </div>
                              ) : day.accommodationImage ? (
                                <div className="w-full">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={day.accommodationImage}
                                    alt={`${product.cruiseLine} ${product.shipName} 크루즈 선박 객실 사진`}
                                    className="w-full max-w-3xl h-auto object-cover rounded-xl border-2 border-gray-300 shadow-lg"
                                  />
                                </div>
                              ) : null}
                            </div>
                          )}

                          {/* 식사 정보 */}
                          {(day.breakfast || day.lunch || day.dinner) && (
                            <div className="flex flex-wrap items-center gap-4 text-gray-900 bg-[#051C2C]/5 rounded-xl p-4 border border-[#051C2C]/20">
                              <span className="text-2xl md:text-3xl">🍴</span>
                              <div className="flex flex-wrap gap-3 text-base md:text-lg font-extrabold">
                                {day.breakfast && (
                                  <span className="flex items-center gap-1 px-3 py-1 bg-[#051C2C]/5 rounded-lg border border-[#051C2C]/20" style={{ wordBreak: 'keep-all' }}>
                                    <span className="text-[#051C2C] text-sm md:text-base font-bold">아침</span>
                                    <span className="text-gray-300">|</span>
                                    <span className="text-[#051C2C]">{day.breakfast}</span>
                                  </span>
                                )}
                                {day.lunch && (
                                  <span className="flex items-center gap-1 px-3 py-1 bg-[#051C2C]/5 rounded-lg border border-[#051C2C]/20" style={{ wordBreak: 'keep-all' }}>
                                    <span className="text-[#051C2C] text-sm md:text-base font-bold">점심</span>
                                    <span className="text-gray-300">|</span>
                                    <span className="text-[#051C2C]">{day.lunch}</span>
                                  </span>
                                )}
                                {day.dinner && (
                                  <span className="flex items-center gap-1 px-3 py-1 bg-[#051C2C]/5 rounded-lg border border-[#051C2C]/20" style={{ wordBreak: 'keep-all' }}>
                                    <span className="text-[#051C2C] text-sm md:text-base font-bold">저녁</span>
                                    <span className="text-gray-300">|</span>
                                    <span className="text-[#051C2C]">{day.dinner}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 기존 블록 (하위 호환성) */}
                          {day.blocks && Array.isArray(day.blocks) && day.blocks.length > 0 && (
                            <div className="space-y-4 mt-4 pt-4 border-t border-gray-200">
                              {day.blocks.map((block: any, blockIdx: number) => {
                                if (block.type === 'image') {
                                  return (
                                    <div key={block.id || blockIdx} className="rounded-lg overflow-hidden shadow-md">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={getProxyImageUrl(block.url)}
                                        alt={block.alt || `${product.packageName} ${day.day}일차 크루즈 여행 일정 이미지 ${blockIdx + 1}`}
                                        className="w-full h-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => {
                                          setModalImageUrl(getProxyImageUrl(block.url));
                                          setShowImageModal(true);
                                        }}
                                      />
                                      {block.alt && (
                                        <div className="p-3 bg-white border-t border-gray-200">
                                          <p className="text-xs text-gray-600 italic">{block.alt}</p>
                                        </div>
                                      )}
                                    </div>
                                  );
                                } else if (block.type === 'video') {
                                  const getYouTubeEmbedUrl = (url: string): string | null => {
                                    if (!url) return null;
                                    if (url.includes('youtube.com/embed/') || url.includes('youtu.be/embed/')) {
                                      return url.split('?')[0];
                                    }
                                    const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
                                    if (watchMatch) {
                                      return `https://www.youtube.com/embed/${watchMatch[1]}`;
                                    }
                                    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
                                    if (shortMatch) {
                                      return `https://www.youtube.com/embed/${shortMatch[1]}`;
                                    }
                                    const youtubeMatch = url.match(/youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]+)/);
                                    if (youtubeMatch) {
                                      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
                                    }
                                    return null;
                                  };

                                  const embedUrl = getYouTubeEmbedUrl(block.url);

                                  return (
                                    <div key={block.id || blockIdx} className="rounded-lg overflow-hidden shadow-md">
                                      {embedUrl ? (
                                        <div
                                          className="relative w-full cursor-pointer hover:opacity-90 transition-opacity"
                                          style={{ paddingBottom: '56.25%' }}
                                          onClick={() => {
                                            setModalVideoUrl(embedUrl);
                                            setShowVideoModal(true);
                                          }}
                                        >
                                          <iframe
                                            src={embedUrl}
                                            className="absolute top-0 left-0 w-full h-full pointer-events-none"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            frameBorder="0"
                                          />
                                          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-10 transition-all">
                                            <FiMaximize2 size={48} className="text-white opacity-0 hover:opacity-100 transition-opacity" />
                                          </div>
                                        </div>
                                      ) : (
                                        <video
                                          src={block.url}
                                          controls
                                          className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                                          onClick={() => {
                                            setModalVideoUrl(block.url);
                                            setShowVideoModal(true);
                                          }}
                                        />
                                      )}
                                      {block.title && (
                                        <div className="p-3 bg-white border-t border-gray-200">
                                          <p className="text-sm font-semibold text-gray-800">{block.title}</p>
                                        </div>
                                      )}
                                    </div>
                                  );
                                } else if (block.type === 'text') {
                                  const isTip = block.content?.toLowerCase().includes('꿀팁') ||
                                    block.content?.toLowerCase().includes('tip') ||
                                    block.content?.includes('♥');

                                  return (
                                    <div
                                      key={block.id || blockIdx}
                                      className={`rounded-lg p-4 ${isTip
                                        ? 'bg-[#FDB931]/10 border-l-4 border-[#FDB931]/40'
                                        : 'bg-gray-50 border-l-4 border-gray-300'
                                        }`}
                                    >
                                      {isTip && (
                                        <div className="font-bold text-[#051C2C] mb-2 flex items-center gap-2">
                                          <span>💡</span>
                                          <span>꿀팁</span>
                                        </div>
                                      )}
                                      <div
                                        className={`prose prose-sm max-w-none ${isTip ? 'text-yellow-900' : 'text-gray-700'
                                          }`}
                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.content) }}
                                      />
                                    </div>
                                  );
                                }
                                return null;
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 일정 정보 (기존 itineraryPattern) */}
            {(!enhancedItinerary || !Array.isArray(enhancedItinerary) || enhancedItinerary.length === 0) && itinerary && Array.isArray(itinerary) && itinerary.length > 0 && (
              <div className="mb-6 group relative">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">여행 일정</h2>
                  {(isAdminUser || isSuperAdmin) && (
                    <button
                      onClick={() => setEditingField('itinerary')}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                      title="수정"
                    >
                      <FiEdit2 size={18} />
                    </button>
                  )}
                </div>
                {editingField === 'itinerary' ? (
                  <div className="space-y-3 bg-white rounded-lg p-4 border-2 border-blue-400">
                    <textarea
                      value={itineraryText}
                      onChange={(e) => setItineraryText(e.target.value)}
                      className="w-full min-h-[300px] p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y font-mono text-sm"
                      placeholder="JSON 형식으로 여행 일정을 입력하세요"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveLayout}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <FiSave size={16} className="inline mr-1" />
                        저장
                      </button>
                      <button
                        onClick={() => {
                          setEditingField(null);
                          setItineraryText(layoutData?.itineraryText || JSON.stringify(itinerary || [], null, 2));
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="space-y-3">
                        {itinerary.map((day: any, index: number) => (
                          <div
                            key={`itinerary-${day.day || index}-${day.location || index}`}
                            className="bg-white rounded-lg p-4 border-l-4 border-blue-500 shadow-sm"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-bold text-gray-800 text-lg">
                                Day {day.day || index + 1}
                              </div>
                              {day.date && (
                                <div className="text-sm text-gray-500">
                                  {new Date(day.date).toLocaleDateString('ko-KR')}
                                </div>
                              )}
                            </div>
                            {day.location && (
                              <div className="text-gray-700 mb-1 flex items-center gap-2">
                                <span className="text-xl">📍</span>
                                <span className="font-semibold">{day.location}</span>
                                {day.country && (
                                  <span className="text-gray-500">({day.country})</span>
                                )}
                              </div>
                            )}
                            {day.type && (
                              <div className="text-sm text-gray-600 mt-2 flex items-center gap-2">
                                <span>
                                  {day.type === 'Embarkation' && '🚢 승선'}
                                  {day.type === 'PortVisit' && '🏝️ 항구 방문'}
                                  {day.type === 'Cruising' && '🌊 해상 순항'}
                                  {day.type === 'Disembarkation' && '🚪 하선'}
                                </span>
                                {day.arrival && day.departure && (
                                  <span className="text-gray-500">
                                    ({day.arrival} ~ {day.departure})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 요금표 */}
            <div className="mb-4 md:mb-6 bg-white md:rounded-2xl p-4 md:p-6 md:border md:border-gray-200 md:shadow-md border-t border-gray-100">
              {/* 실시간 조회수 마케팅 */}
              <div className="flex items-center justify-center mb-4 py-2 bg-[#051C2C]/5 rounded-lg border border-[#051C2C]/10">
                <LiveViewerCount />
              </div>

              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl md:text-2xl font-bold text-[#051C2C]">요금표</h2>
                {pricingRows && Array.isArray(pricingRows) && pricingRows.length > 0 && (
                  <button
                    onClick={() => setShowPricingModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FiMaximize2 size={18} />
                    <span className="text-sm font-medium">크게 보기</span>
                  </button>
                )}
              </div>
              {pricingRows && Array.isArray(pricingRows) && pricingRows.length > 0 ? (
                <div className="overflow-x-auto cursor-pointer" onClick={() => setShowPricingModal(true)}>
                  <table className="w-full border-collapse text-sm md:text-base">
                    <thead>
                      <tr className="bg-[#051C2C] text-white border-b-2 border-[#051C2C]">
                        <th className="px-4 py-4 text-left font-bold border border-[#1e3a52]">객실 타입</th>
                        <th className="px-4 py-4 text-center font-bold border border-[#1e3a52]">
                          <span className="text-[#FDB931]">1,2번째 성인</span>
                        </th>
                        <th className="px-4 py-4 text-center font-bold border border-[#1e3a52]">만 12세 이상</th>
                        <th className="px-4 py-4 text-center font-bold border border-[#1e3a52]">
                          만 2-11세
                          {(product.startDate || layoutData?.departureDate) && (
                            <div className="text-xs font-normal text-gray-300 mt-1">
                              {calculateAgeRange(2, 11)}
                            </div>
                          )}
                        </th>
                        <th className="px-4 py-4 text-center font-bold border border-[#1e3a52]">
                          만 2세 미만
                          {(product.startDate || layoutData?.departureDate) && (
                            <div className="text-xs font-normal text-gray-300 mt-1">
                              {calculateAgeRange(0, 1)}
                            </div>
                          )}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pricingRows.map((row: any, index: number) => {
                        const roomId = row.id || `room-${index}`;
                        const isSoldOut = isRoomSoldOut(roomId);

                        return (
                          <tr
                            key={roomId}
                            className={`hover:bg-gray-50 ${index % 2 === 1 ? 'bg-gray-50/50' : ''} ${isSoldOut ? 'opacity-60 bg-gray-100' : ''}`}
                          >
                            <td className="px-4 py-3 font-semibold text-gray-800 border border-gray-300">
                              <div className="flex flex-col gap-1">
                                <span>{row.roomType || '객실 타입 미설정'}</span>
                                {/* 남은 객실 수 (SOLD OUT이 아닌 경우만) */}
                                {!isSoldOut && (
                                  <RemainingRooms roomId={roomId} />
                                )}
                                {/* SOLD OUT 표시 */}
                                {isSoldOut && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-white bg-red-600 rounded">
                                    <FiAlertCircle size={12} />
                                    SOLD OUT
                                  </span>
                                )}
                                {/* 관리자 전용 SOLD OUT 토글 버튼 */}
                                {(isAdminUser || isSuperAdmin) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleSoldOut(roomId, row.roomType);
                                    }}
                                    disabled={togglingRoom === roomId}
                                    className={`mt-1 text-xs px-2 py-1 rounded font-medium transition-colors ${
                                      isSoldOut
                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                                    } ${togglingRoom === roomId ? 'opacity-50' : ''}`}
                                  >
                                    {togglingRoom === roomId ? '처리중...' : isSoldOut ? '판매 재개' : 'SOLD OUT 설정'}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className={`px-4 py-3 text-center font-bold text-lg border border-gray-300 ${isSoldOut ? 'line-through text-gray-400' : 'text-red-600'}`}>
                              {isSoldOut ? 'SOLD OUT' : formatPricingPrice(row.adult)}
                            </td>
                            <td className={`px-4 py-3 text-center border border-gray-300 ${isSoldOut ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                              {isSoldOut ? '-' : formatPricingPrice(row.adult3rd)}
                            </td>
                            <td className={`px-4 py-3 text-center border border-gray-300 ${isSoldOut ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                              {isSoldOut ? '-' : formatPricingPrice(row.child2to11)}
                            </td>
                            <td className={`px-4 py-3 text-center border border-gray-300 ${isSoldOut ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                              {isSoldOut ? '-' : formatPricingPrice(row.infantUnder2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>요금표 정보가 없습니다.</p>
                </div>
              )}
              <div className="mt-4 text-sm text-gray-600 space-y-1 group/note relative">
                {(isAdminUser || isSuperAdmin) && (
                  <button
                    onClick={() => setEditingField('priceTableNote')}
                    className="absolute -top-8 right-0 opacity-0 group-hover/note:opacity-100 transition-opacity p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                    title="수정"
                  >
                    <FiEdit2 size={16} />
                  </button>
                )}
                {editingField === 'priceTableNote' ? (
                  <div className="space-y-3">
                    <textarea
                      value={priceTableNote}
                      onChange={(e) => setPriceTableNote(e.target.value)}
                      className="w-full min-h-[100px] p-3 border-2 border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
                      placeholder="요금표 하단 안내 문구를 입력하세요 (줄바꿈: \n)"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveLayout}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <FiSave size={16} className="inline mr-1" />
                        저장
                      </button>
                      <button
                        onClick={() => {
                          setEditingField(null);
                          setPriceTableNote(layoutData?.priceTableNote || '• 위 요금은 2인1실 기준 1인당 금액입니다.\n• 1인 예약 시 정상가의 100% 싱글차지가 추가됩니다.\n• 3/4인실 이용 시 3/4번째 고객님은 매니저 필수 상담 하셔야 합니다.');
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="whitespace-pre-line">
                    {priceTableNote.split('\n').map((line, index) => (
                      <p key={`price-note-${index}-${line.slice(0, 20)}`}>{line}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 환불/취소 규정 */}
            {refundPolicy && refundPolicy.trim() !== '' && (
              <div className="mb-4 md:mb-6 bg-white md:rounded-xl p-4 md:p-6 md:border md:border-gray-200 md:shadow-sm border-t border-gray-100">
                <h2 className="text-xl md:text-2xl font-bold text-[#051C2C] mb-4">환불/취소 규정</h2>
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line">
                  {refundPolicy.split('\n').map((line, index) => (
                    <p key={`refund-${index}-${line.slice(0, 20)}`} className="mb-2">{line}</p>
                  ))}
                </div>
              </div>
            )}

            {/* 예약 안내 */}
            <div className="mb-5 md:mb-6 bg-white rounded-xl p-5 md:p-6 border border-gray-200 shadow-sm group relative">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">예약 안내</h2>
                {(isAdminUser || isSuperAdmin) && (
                  <button
                    onClick={() => setEditingField('bookingInfo')}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-lg"
                    title="수정"
                  >
                    <FiEdit2 size={18} />
                  </button>
                )}
              </div>
              {editingField === 'bookingInfo' ? (
                <div className="space-y-3">
                  {bookingInfo.map((item, index) => (
                    <div key={`booking-edit-${index}-${item.slice(0, 20)}`} className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold mt-2">•</span>
                      <textarea
                        value={item}
                        onChange={(e) => {
                          const newItems = [...bookingInfo];
                          newItems[index] = e.target.value;
                          setBookingInfo(newItems);
                        }}
                        className="flex-1 px-3 py-2 border-2 border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y min-h-[60px]"
                      />
                      <button
                        onClick={() => {
                          setBookingInfo(bookingInfo.filter((_, i) => i !== index));
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg mt-2"
                      >
                        <FiX size={18} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setBookingInfo([...bookingInfo, ''])}
                    className="w-full px-3 py-2 border-2 border-dashed border-blue-400 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    + 항목 추가
                  </button>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={handleSaveLayout}
                      disabled={isSaving}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <FiSave size={16} className="inline mr-1" />
                      저장
                    </button>
                    <button
                      onClick={() => {
                        setEditingField(null);
                        setBookingInfo(layoutData?.bookingInfo || [
                          '2인1실 기준 1인당 금액입니다. 1인 예약 시 정상가의 100% 싱글차지가 추가됩니다.',
                          '3/4인실 이용 시 3/4번째 고객님은 매니저 필수 상담 하셔야 합니다.',
                          '예약 후 상품가 전액 결제되면 예약이 확정됩니다.',
                          '여권만료일 6개월 이상 남은 여권사본을 보내주세요.'
                        ]);
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-gray-700">
                  {bookingInfo.map((item, index) => (
                    <div key={`booking-${index}-${item.slice(0, 20)}`} className="flex items-start gap-3 bg-gray-50 rounded-lg p-4 border border-gray-200" style={{ wordBreak: 'keep-all', lineHeight: '1.6' }}>
                      <span className="text-blue-600 font-bold mt-0.5 flex-shrink-0 text-base">•</span>
                      <span className="text-sm md:text-base flex-1">{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 하단 고정 버튼 여백 (모바일 + PC 공통) */}
            <div className="h-24 md:h-32" />

            {/* 구매 문의 버튼 — 모바일 + PC 모두 하단 고정 */}
            {/* z-40: 모달(z-[9999])보다 낮아서 모달 열릴 때 배너가 뒤로 숨음 */}
            <div
              className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.2)] px-3 pt-3 md:px-6 md:pt-4"
              style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}
            >
              {(() => {
                // 활성화된 버튼 개수 계산
                const activeButtons = [
                  contactOptions.payment && { type: 'payment', url: getPaymentUrl(), label: '구매하기', icon: '₩', color: 'bg-gradient-to-r from-[#FDB931] to-[#E1A21E] hover:from-[#E1A21E] hover:to-[#C68C12] text-[#051C2C]' },
                  contactOptions.phoneCall && { type: 'phone', url: getInquiryUrl(), label: '상담신청', icon: '☎', color: 'bg-gradient-to-r from-[#051C2C] to-[#0A2E46] hover:from-[#0A2E46] hover:to-[#051C2C] text-white' },
                  contactOptions.aiChatbot && { type: 'chatbot', url: getChatBotUrl(), label: 'AI상담', icon: 'AI', color: 'bg-gradient-to-r from-[#0A2E46] to-[#051C2C] hover:from-[#051C2C] hover:to-[#0A2E46] text-[#FDB931]' },
                ].filter(Boolean) as Array<{ type: string; url: string; label: string; icon: string; color: string }>;

                const buttonCount = activeButtons.length;

                // 버튼 개수에 따른 레이아웃 클래스 결정
                // 모바일 3개: 상단 2개 + 하단 1개(전폭) 레이아웃
                let layoutClass = '';
                if (buttonCount === 3) {
                  // 3개: 모바일은 2+1 grid, PC는 3열
                  layoutClass = 'grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4';
                } else if (buttonCount === 2) {
                  layoutClass = 'grid grid-cols-2 gap-2 md:gap-4';
                } else {
                  // 1개 버튼: 모바일 전폭, PC 가운데 정렬
                  layoutClass = 'flex justify-center';
                }

                return (
                  // 버튼 폭을 페이지 콘텐츠(max-w-7xl)에 맞춤
                  <div className="max-w-7xl mx-auto">
                    <div className={layoutClass}>
                      {activeButtons.map((button, idx) => (
                        <Link
                          key={button.type}
                          href={button.url}
                          className={`
                            ${buttonCount === 3 && idx === 2 ? 'col-span-2 md:col-span-1' : ''}
                            ${buttonCount === 1 ? 'w-full md:w-auto md:min-w-[280px]' : 'w-full'}
                            px-3 md:px-6 py-3 md:py-4 ${button.color} font-bold text-center rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-1 md:gap-3 text-sm md:text-xl
                          `.trim().replace(/\s+/g, ' ')}
                        >
                          <span className="text-base md:text-xl">{button.icon}</span>
                          <span className="leading-tight">{button.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* AI 지니 안내 */}
          <div className="bg-blue-50 rounded-xl p-5 md:p-6 mb-6 border border-blue-100">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-3">
              🤖 AI 크루즈닷과 함께하는 특별한 여행
            </h2>
            <p className="text-gray-700 mb-4 text-sm md:text-base">
              크루즈닷AI는 여행 준비부터 여행 중까지 당신의 여행 파트너입니다.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl mb-2">🗺️</div>
                <div className="text-sm font-semibold">경로 안내</div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">📸</div>
                <div className="text-sm font-semibold">관광지 정보</div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">💰</div>
                <div className="text-sm font-semibold">경비 관리</div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">📝</div>
                <div className="text-sm font-semibold">여행 기록</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  width="100%"
                  height="100%"
                  src="https://www.youtube.com/embed/-p_6G69MgyQ?si=pkZS6VBi3XMqdcps&autoplay=1&loop=1&playlist=-p_6G69MgyQ&mute=1"
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  className="absolute top-0 left-0 w-full h-full rounded-lg"
                  style={{ aspectRatio: '16/9' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 요금표 모달 - Portal로 렌더링하여 스마트폰 미리보기에서도 작동 */}
      {typeof window !== 'undefined' && showPricingModal && pricingRows && Array.isArray(pricingRows) && pricingRows.length > 0 && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4" onClick={() => setShowPricingModal(false)}>
          <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-2xl font-bold text-gray-900">요금표</h3>
              <button
                onClick={() => setShowPricingModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <FiX size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-base md:text-lg">
                  <thead>
                    <tr className="bg-[#051C2C] text-white border-b-2 border-[#051C2C]">
                      <th className="px-6 py-5 text-left font-bold border border-[#1e3a52]">객실 타입</th>
                      <th className="px-6 py-5 text-center font-bold border border-[#1e3a52]">
                        <span className="text-[#FDB931]">1,2번째 성인</span>
                      </th>
                      <th className="px-6 py-5 text-center font-bold border border-[#1e3a52]">만 12세 이상</th>
                      <th className="px-6 py-5 text-center font-bold border border-[#1e3a52]">
                        만 2-11세
                        {(product.startDate || layoutData?.departureDate) && (
                          <div className="text-xs font-normal text-gray-300 mt-1">
                            {calculateAgeRange(2, 11)}
                          </div>
                        )}
                      </th>
                      <th className="px-6 py-5 text-center font-bold border border-[#1e3a52]">
                        만 2세 미만
                        {(product.startDate || layoutData?.departureDate) && (
                          <div className="text-xs font-normal text-gray-300 mt-1">
                            {calculateAgeRange(0, 1)}
                          </div>
                        )}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingRows.map((row: any, index: number) => (
                      <tr
                        key={row.id || index}
                        className={`hover:bg-gray-50 ${index % 2 === 1 ? 'bg-gray-50/50' : ''}`}
                      >
                        <td className="px-6 py-4 font-semibold text-gray-800 border border-gray-300">
                          {row.roomType || '객실 타입 미설정'}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-red-600 text-xl border border-gray-300">
                          {formatPricingPrice(row.adult)}
                        </td>
                        <td className="px-6 py-4 text-center text-gray-700 border border-gray-300">
                          {formatPricingPrice(row.adult3rd)}
                        </td>
                        <td className="px-6 py-4 text-center text-gray-700 border border-gray-300">
                          {formatPricingPrice(row.child2to11)}
                        </td>
                        <td className="px-6 py-4 text-center text-gray-700 border border-gray-300">
                          {formatPricingPrice(row.infantUnder2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {layoutData?.priceTableNote && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-700 whitespace-pre-line">
                    {layoutData.priceTableNote}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 이미지 모달 - Portal로 렌더링 */}
      {typeof window !== 'undefined' && showImageModal && modalImageUrl && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex items-center justify-center p-4" onClick={() => setShowImageModal(false)}>
          <div className="max-w-7xl w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 p-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full z-10"
            >
              <FiX size={24} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={modalImageUrl}
              alt="확대 이미지"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>,
        document.body
      )}

      {/* 동영상 모달 - Portal로 렌더링 */}
      {typeof window !== 'undefined' && showVideoModal && modalVideoUrl && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex items-center justify-center p-4" onClick={() => setShowVideoModal(false)}>
          <div className="max-w-7xl w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowVideoModal(false)}
              className="absolute top-4 right-4 p-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full z-10"
            >
              <FiX size={24} />
            </button>
            <div className="w-full max-w-5xl" style={{ aspectRatio: '16/9' }}>
              {modalVideoUrl.includes('youtube.com') || modalVideoUrl.includes('youtu.be') ? (
                <iframe
                  src={modalVideoUrl}
                  className="w-full h-full rounded-lg"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={modalVideoUrl}
                  controls
                  autoPlay
                  className="w-full h-full rounded-lg"
                />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 리뷰 미리보기 모달 - Portal로 렌더링 */}
      {typeof window !== 'undefined' && showReviewModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4" onClick={() => setShowReviewModal(false)}>
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b-2 border-gray-300 px-6 py-4 flex items-center justify-between z-10 shadow-sm">
              <div className="flex items-center gap-3">
                <FiStar className="text-[#FDB931] fill-[#FDB931]" size={24} />
                <h3 className="text-2xl font-bold text-gray-900">
                  리뷰 {reviewCount > 0 ? `${reviewCount.toLocaleString('ko-KR')}개` : '미리보기'}
                </h3>
                <div className="flex items-center gap-1">
                  <span className="text-xl font-bold text-gray-900">{rating.toFixed(1)}</span>
                </div>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="p-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-md"
                title="닫기"
              >
                <FiX size={24} />
              </button>
            </div>

            <div className="p-6">
              {reviewsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">리뷰를 불러오는 중...</p>
                </div>
              ) : reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                            {review.authorName.charAt(0)}
                          </div>
                          <span className="font-semibold text-gray-800">{review.authorName}</span>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, starIndex) => (
                              <FiStar
                                key={starIndex}
                                className={starIndex < review.rating ? 'text-[#FDB931] fill-[#FDB931]' : 'text-gray-300'}
                                size={14}
                              />
                            ))}
                          </div>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(review.createdAt).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed">
                        {review.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : reviewCount > 0 ? (
                <div className="text-center py-12">
                  <FiStar className="text-[#FDB931] fill-[#FDB931] mx-auto mb-4" size={48} />
                  <p className="text-lg text-gray-600 mb-2">리뷰를 불러올 수 없습니다.</p>
                  <p className="text-sm text-gray-500">
                    잠시 후 다시 시도해 주세요.
                  </p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FiStar className="text-[#FDB931] fill-[#FDB931] mx-auto mb-4" size={48} />
                  <p className="text-lg text-gray-600 mb-2">아직 리뷰가 없습니다.</p>
                  <p className="text-sm text-gray-500">
                    평균 별점: {rating.toFixed(1)}점
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* 이전으로 돌아가기 버튼 - 하단 */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
        >
          <FiChevronLeft size={20} />
          <span className="text-sm font-medium">이전으로 돌아가기</span>
        </button>
      </div>
    </div>
  );
}
































