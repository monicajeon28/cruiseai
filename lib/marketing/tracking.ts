// lib/marketing/tracking.ts
// 마케팅 픽셀 이벤트 추적 유틸리티

/**
 * Google Analytics 4 이벤트 전송
 */
export function trackGA4Event(eventName: string, eventParams?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  
  if (window.gtag) {
    window.gtag('event', eventName, eventParams);
  } else {
    // gtag가 아직 로드되지 않은 경우 대기
    if (window.dataLayer) {
      window.dataLayer.push({
        event: eventName,
        ...eventParams,
      });
    }
  }
}

/**
 * Facebook Pixel 이벤트 전송
 */
export function trackFacebookEvent(eventName: string, eventParams?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  
  if (window.fbq) {
    window.fbq('track', eventName, eventParams);
  }
}

/**
 * 네이버 픽셀 이벤트 전송
 */
export function trackNaverEvent(eventName: string, eventParams?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  
  if (window.wcs && window.wcs_add) {
    window.wcs_add['ea'] = eventName;
    if (eventParams) {
      Object.assign(window.wcs_add, eventParams);
    }
    window.wcs_do = true;
  }
}

/**
 * 카카오 픽셀 이벤트 전송
 */
export function trackKakaoEvent(eventName: string, eventParams?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  
  if (window.kakaoPixel) {
    window.kakaoPixel('event', eventName, eventParams);
  }
}

/**
 * 모든 활성화된 픽셀에 이벤트 전송
 */
export function trackEvent(eventName: string, eventParams?: Record<string, any>) {
  trackGA4Event(eventName, eventParams);
  trackFacebookEvent(eventName, eventParams);
  trackNaverEvent(eventName, eventParams);
  trackKakaoEvent(eventName, eventParams);
}

/**
 * 페이지뷰 추적
 */
export function trackPageView(path?: string) {
  const pagePath = path || (typeof window !== 'undefined' ? window.location.pathname : '');
  
  trackGA4Event('page_view', {
    page_path: pagePath,
    page_title: typeof document !== 'undefined' ? document.title : '',
  });
  
  trackFacebookEvent('PageView');
  trackNaverEvent('page_view', { page_path: pagePath });
  trackKakaoEvent('page_view', { page_path: pagePath });
}

/**
 * 구매 완료 이벤트
 */
export function trackPurchase(params: {
  transactionId: string;
  value: number;
  currency?: string;
  items: Array<{
    item_id: string;
    item_name: string;
    price: number;
    quantity: number;
  }>;
}) {
  const { transactionId, value, currency = 'KRW', items } = params;

  // Google Analytics 4
  trackGA4Event('purchase', {
    transaction_id: transactionId,
    value: value,
    currency: currency,
    items: items,
  });

  // Facebook Pixel
  trackFacebookEvent('Purchase', {
    value: value,
    currency: currency,
    content_ids: items.map(item => item.item_id),
    contents: items.map(item => ({
      id: item.item_id,
      quantity: item.quantity,
      item_price: item.price,
    })),
  });

  // 네이버 픽셀
  trackNaverEvent('purchase', {
    transaction_id: transactionId,
    value: value,
    currency: currency,
  });

  // 카카오 픽셀
  trackKakaoEvent('purchase', {
    transaction_id: transactionId,
    value: value,
    currency: currency,
  });
}

/**
 * 상품 조회 이벤트
 */
export function trackViewItem(params: {
  itemId: string;
  itemName: string;
  price?: number;
  category?: string;
}) {
  const { itemId, itemName, price, category } = params;

  // Google Analytics 4
  trackGA4Event('view_item', {
    items: [{
      item_id: itemId,
      item_name: itemName,
      price: price,
      item_category: category,
    }],
  });

  // Facebook Pixel
  trackFacebookEvent('ViewContent', {
    content_ids: [itemId],
    content_name: itemName,
    content_type: 'product',
    value: price,
    currency: 'KRW',
  });

  // 네이버 픽셀
  trackNaverEvent('view_item', {
    item_id: itemId,
    item_name: itemName,
    price: price,
  });

  // 카카오 픽셀
  trackKakaoEvent('view_item', {
    item_id: itemId,
    item_name: itemName,
    price: price,
  });
}

/**
 * 리드 생성 이벤트 (문의 제출 등)
 */
export function trackLead(params?: {
  value?: number;
  currency?: string;
  contentName?: string;
}) {
  const { value, currency = 'KRW', contentName } = params || {};

  // Google Analytics 4
  trackGA4Event('generate_lead', {
    value: value,
    currency: currency,
    content_name: contentName,
  });

  // Facebook Pixel
  trackFacebookEvent('Lead', {
    value: value,
    currency: currency,
    content_name: contentName,
  });

  // 네이버 픽셀
  trackNaverEvent('lead', {
    value: value,
    currency: currency,
  });

  // 카카오 픽셀
  trackKakaoEvent('lead', {
    value: value,
    currency: currency,
  });
}

/**
 * 회원가입 이벤트
 */
export function trackSignUp(method?: string) {
  // Google Analytics 4
  trackGA4Event('sign_up', {
    method: method,
  });

  // Facebook Pixel
  trackFacebookEvent('CompleteRegistration', {
    method: method,
  });

  // 네이버 픽셀
  trackNaverEvent('sign_up', {
    method: method,
  });

  // 카카오 픽셀
  trackKakaoEvent('sign_up', {
    method: method,
  });
}

/**
 * 장바구니 추가 이벤트
 */
export function trackAddToCart(params: {
  itemId: string;
  itemName: string;
  price: number;
  quantity: number;
}) {
  const { itemId, itemName, price, quantity } = params;

  // Google Analytics 4
  trackGA4Event('add_to_cart', {
    items: [{
      item_id: itemId,
      item_name: itemName,
      price: price,
      quantity: quantity,
    }],
  });

  // Facebook Pixel
  trackFacebookEvent('AddToCart', {
    content_ids: [itemId],
    content_name: itemName,
    value: price * quantity,
    currency: 'KRW',
  });

  // 네이버 픽셀
  trackNaverEvent('add_to_cart', {
    item_id: itemId,
    item_name: itemName,
    price: price,
    quantity: quantity,
  });

  // 카카오 픽셀
  trackKakaoEvent('add_to_cart', {
    item_id: itemId,
    item_name: itemName,
    price: price,
    quantity: quantity,
  });
}

/**
 * 검색 이벤트
 */
export function trackSearch(searchTerm: string) {
  // Google Analytics 4
  trackGA4Event('search', {
    search_term: searchTerm,
  });

  // Facebook Pixel
  trackFacebookEvent('Search', {
    search_string: searchTerm,
  });

  // 네이버 픽셀
  trackNaverEvent('search', {
    search_term: searchTerm,
  });

  // 카카오 픽셀
  trackKakaoEvent('search', {
    search_term: searchTerm,
  });
}






