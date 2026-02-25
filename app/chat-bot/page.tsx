'use client';

import { logger } from '@/lib/logger';
// app/chat-bot/page.tsx
// AI 지니 채팅봇 (구매) - SPIN 기반 상담

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import ReviewModal from '@/components/chat-bot/ReviewModal';

const supportsAbortSignalTimeout =
  typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function';

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> => {
  if (init.signal) {
    return fetch(input, init);
  }

  if (supportsAbortSignalTimeout) {
    return fetch(input, {
      ...init,
      signal: (AbortSignal as any).timeout(timeoutMs) as AbortSignal,
    });
  }

  if (typeof AbortController === 'undefined') {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};


interface ChatBotQuestion {
  id: number;
  questionText: string;
  questionType: string;
  spinType?: string;
  information?: string;
  optionA?: string;
  optionB?: string;
  options?: string[]; // 5가지 선택지용
  nextQuestionIdA?: number;
  nextQuestionIdB?: number;
  nextQuestionIds?: number[]; // 5가지 선택지용
  order?: number; // 질문 순서
  attachments?: ChatAttachment[];
}

type GalleryItem = {
  url: string;
  title: string;
};

interface DestinationGalleryAttachment {
  type: 'destinationGallery';
  id: string;
  title: string;
  subtitle?: string;
  items: GalleryItem[];
}

interface VideoAttachment {
  type: 'video';
  title: string;
  embedHtml: string;
}

type ChatAttachment = DestinationGalleryAttachment | VideoAttachment;

function DestinationGalleryAttachmentBlock({ attachment }: { attachment: DestinationGalleryAttachment }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handlePrev = useCallback(() => {
    setOpenIndex((prev) => {
      if (prev === null) return null;
      const nextIndex = (prev - 1 + attachment.items.length) % attachment.items.length;
      return nextIndex;
    });
  }, [attachment.items.length]);

  const handleNext = useCallback(() => {
    setOpenIndex((prev) => {
      if (prev === null) return null;
      const nextIndex = (prev + 1) % attachment.items.length;
      return nextIndex;
    });
  }, [attachment.items.length]);

  useEffect(() => {
    if (openIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenIndex(null);
      } else if (event.key === 'ArrowLeft') {
        handlePrev();
      } else if (event.key === 'ArrowRight') {
        handleNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openIndex, handlePrev, handleNext]);

  if (!attachment.items || attachment.items.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-blue-900">{attachment.title}</h3>
          {attachment.subtitle && (
            <p className="text-sm text-blue-700 mt-1">{attachment.subtitle}</p>
          )}
        </div>
        <p className="text-xs text-blue-400">사진을 누르면 크게 볼 수 있어요</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {attachment.items.map((item, index) => (
          <button
            key={`${attachment.id}-${index}`}
            type="button"
            onClick={() => setOpenIndex(index)}
            className="group relative overflow-hidden rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Image
              src={item.url}
              alt={item.title}
              width={400}
              height={144}
              className="w-full h-32 sm:h-36 object-cover transition-transform duration-200 group-hover:scale-105"
              unoptimized
              onError={(event) => {
                event.currentTarget.classList.add('hidden');
              }}
            />
            <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-xs px-2 py-1 line-clamp-1">
              {item.title}
            </span>
          </button>
        ))}
      </div>

      {openIndex !== null && attachment.items[openIndex] && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setOpenIndex(null)}
          />
          <div className="relative z-10 max-w-4xl w-full">
            <Image
              src={attachment.items[openIndex].url}
              alt={attachment.items[openIndex].title}
              width={800}
              height={600}
              className="w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl"
              unoptimized
              onError={(event) => {
                event.currentTarget.classList.add('hidden');
              }}
            />
            <p className="mt-4 text-center text-white text-base">
              {attachment.items[openIndex].title}
            </p>

            <button
              type="button"
              onClick={() => setOpenIndex(null)}
              className="absolute top-3 right-3 text-white bg-black/60 hover:bg-black/80 w-10 h-10 rounded-full flex items-center justify-center text-2xl"
              aria-label="닫기"
            >
              ×
            </button>

            {attachment.items.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handlePrev();
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white bg-black/60 hover:bg-black/80 w-11 h-11 rounded-full flex items-center justify-center text-xl"
                  aria-label="이전"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleNext();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white bg-black/60 hover:bg-black/80 w-11 h-11 rounded-full flex items-center justify-center text-xl"
                  aria-label="다음"
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function VideoAttachmentBlock({ attachment }: { attachment: VideoAttachment }) {
  const embedHtml = useMemo(() => {
    let html = attachment.embedHtml;
    html = html.replace(/width="[^"]+"/gi, 'width="100%"');
    html = html.replace(/height="[^"]+"/gi, 'height="100%"');
    if (!/style="[^"]*width:100%/.test(html)) {
      html = html.replace(
        /<iframe/i,
        '<iframe style="width:100%;height:100%;"'
      );
    }
    return html;
  }, [attachment.embedHtml]);

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-blue-900 mb-3">📺 {attachment.title}</h3>
      <div className="relative w-full overflow-hidden rounded-xl shadow-xl" style={{ paddingTop: '56.25%' }}>
        <div
          className="absolute inset-0"
          dangerouslySetInnerHTML={{ __html: embedHtml }}
        />
      </div>
    </div>
  );
}

interface Review {
  id: number;
  authorName: string;
  title?: string;
  content: string;
  images: string[] | string | null;
  rating: number;
  cruiseLine?: string;
  shipName?: string;
  travelDate?: string;
  createdAt: string;
}

interface ChatMessage {
  type: 'bot' | 'user';
  content: string;
  questionId?: number;
  options?: { label: string; nextId?: number }[];
  reviews?: Review[]; // 리뷰 데이터
  attachments?: ChatAttachment[];
}

interface ProductInfo {
  productCode: string;
  packageName: string;
  cruiseLine: string;
  shipName: string;
  nights: number;
  days: number;
  basePrice: number | null;
  destination?: string[];
  startDate?: string | null;
  endDate?: string | null;
  contactOptions?: {
    payment?: boolean;
    phoneCall?: boolean;
    aiChatbot?: boolean;
  };
}

interface ChatBotPageContentProps {
  shareToken?: string;
}

export function ChatBotPageContent({ shareToken }: ChatBotPageContentProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [productCode, setProductCode] = useState<string | null>(() => searchParams.get('productCode'));
  // URL의 partner 파라미터를 최우선으로 사용 (정확한 판매원 추적)
  const [partnerId, setPartnerId] = useState<string | null>(() => searchParams.get('partner'));
  // 이미지 모달 상태
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalImages, setImageModalImages] = useState<string[]>([]);
  const [imageModalIndex, setImageModalIndex] = useState(0);

  // 동영상 모달 상태
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoModalUrl, setVideoModalUrl] = useState<string>('');

  useEffect(() => {
    const paramCode = searchParams.get('productCode');
    if (paramCode) {
      setProductCode(paramCode);
    }
    // URL의 partner 파라미터를 우선 사용 (쿠키 무시)
    const paramPartner = searchParams.get('partner');
    if (paramPartner) {
      setPartnerId(paramPartner);
    } else {
      // URL에 partner 파라미터가 없으면 null로 설정 (쿠키 사용 안 함)
      setPartnerId(null);
    }
  }, [searchParams]);

  // 이미지 클릭 모달 핸들러 - 모든 챗봇 이미지에 적용 (터치 이벤트 포함)
  useEffect(() => {
    const handleImageInteraction = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;

      // 1. 기존 방식: cruise-image-clickable 클래스가 있는 이미지
      if (target.classList.contains('cruise-image-clickable')) {
        const galleryData = target.getAttribute('data-image-gallery');
        const indexData = target.getAttribute('data-image-index');
        if (galleryData && indexData !== null) {
          try {
            const images = JSON.parse(galleryData);
            const index = parseInt(indexData, 10);
            if (Array.isArray(images) && !isNaN(index)) {
              setImageModalImages(images);
              setImageModalIndex(index);
              setImageModalOpen(true);
              e.preventDefault();
              e.stopPropagation();
            }
          } catch (error) {
            console.error('[Image Modal] Failed to parse gallery data:', error);
          }
          return;
        }
      }

      // 2. 새 방식: 챗봇 메시지 영역 내 모든 이미지 (img 태그)
      if (target.tagName === 'IMG') {
        const chatContainer = target.closest('.chat-message-content, [class*="bg-blue-50"], [class*="bg-gray-50"]');
        if (chatContainer) {
          const imgSrc = (target as HTMLImageElement).src;
          if (imgSrc && !imgSrc.includes('placeholder') && !imgSrc.includes('data:')) {
            // 같은 컨테이너 내 모든 이미지 수집
            const containerImages = chatContainer.querySelectorAll('img');
            const imageUrls: string[] = [];
            let clickedIndex = 0;

            containerImages.forEach((img) => {
              const src = (img as HTMLImageElement).src;
              if (src && !src.includes('placeholder') && !src.includes('data:')) {
                if (src === imgSrc) {
                  clickedIndex = imageUrls.length;
                }
                imageUrls.push(src);
              }
            });

            if (imageUrls.length > 0) {
              setImageModalImages(imageUrls);
              setImageModalIndex(clickedIndex);
              setImageModalOpen(true);
              e.preventDefault();
              e.stopPropagation();
            }
          }
        }
      }
    };

    // 클릭과 터치 이벤트 모두 등록
    document.addEventListener('click', handleImageInteraction);
    document.addEventListener('touchend', handleImageInteraction, { passive: false });
    return () => {
      document.removeEventListener('click', handleImageInteraction);
      document.removeEventListener('touchend', handleImageInteraction);
    };
  }, []);

  // 동영상 클릭 모달 핸들러 - iframe 위에 오버레이 클릭 시 모달 열기 (터치 이벤트 포함)
  useEffect(() => {
    const handleVideoInteraction = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;

      // 동영상 오버레이 또는 그 자식 요소 클릭 시 (closest로 부모도 확인)
      const videoTrigger = target.closest('.video-modal-trigger') as HTMLElement;
      if (videoTrigger) {
        const videoUrl = videoTrigger.getAttribute('data-video-url');
        if (videoUrl) {
          setVideoModalUrl(videoUrl);
          setVideoModalOpen(true);
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    // 클릭과 터치 이벤트 모두 등록
    document.addEventListener('click', handleVideoInteraction);
    document.addEventListener('touchend', handleVideoInteraction, { passive: false });
    return () => {
      document.removeEventListener('click', handleVideoInteraction);
      document.removeEventListener('touchend', handleVideoInteraction);
    };
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<ChatBotQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [flowId, setFlowId] = useState<number | null>(null);
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef<boolean>(false);
  const sessionStartTimeRef = useRef<number | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState<Review[]>([]);
  const [pendingNextQuestionId, setPendingNextQuestionId] = useState<number | null>(null);
  const [activeReviewIndex, setActiveReviewIndex] = useState<number>(0);
  const [cachedReviews, setCachedReviews] = useState<Review[]>([]);
  const displayedReviewContextsRef = useRef<Set<string>>(new Set());
  const usedReviewIdsRef = useRef<Set<number>>(new Set());
  const openReviewModal = useCallback(
    (reviews: Review[], startIndex = 0, nextQuestionId?: number | null) => {
      if (!reviews || reviews.length === 0) {
        setReviewData([]);
        setShowReviewModal(true);
        setPendingNextQuestionId(nextQuestionId ?? null);
        setActiveReviewIndex(0);
        return;
      }

      setReviewData(reviews);
      setPendingNextQuestionId(nextQuestionId ?? null);
      setActiveReviewIndex(Math.max(0, Math.min(startIndex, reviews.length - 1)));
      setShowReviewModal(true);
    },
    [],
  );

  const fetchReviewsForProduct = useCallback(
    async (
      limit = 3,
      options?: { cruiseLineOverride?: string; fallbackToAll?: boolean; forceAll?: boolean },
    ): Promise<Review[]> => {
      const { cruiseLineOverride, fallbackToAll = true, forceAll = false } = options ?? {};

      const buildQuery = (params: Record<string, string | undefined>) => {
        const search = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            search.append(key, value);
          }
        });
        return search.toString();
      };

      const requestReviews = async (query: string) => {
        try {
          const response = await fetchWithTimeout(`/api/chat-bot/reviews?${query}`, {}, 10000);
          if (!response.ok) {
            console.warn('[fetchReviewsForProduct] Response not ok:', response.status);
            return [];
          }
          const data = await response.json().catch(() => ({ ok: false }));
          if (data.ok && Array.isArray(data.reviews)) {
            return data.reviews;
          }
          return [];
        } catch (error) {
          console.error('[fetchReviewsForProduct] Error:', error);
          return [];
        }
      };

      let primaryReviews: Review[] = [];
      if (!forceAll && productCode) {
        const query = buildQuery({
          productCode,
          limit: String(limit),
          cruiseLine: cruiseLineOverride || productInfo?.cruiseLine || undefined,
        });
        primaryReviews = await requestReviews(query);
      }

      if (primaryReviews.length > 0) {
        setCachedReviews((prev) => (prev.length >= primaryReviews.length ? prev : primaryReviews));
        return primaryReviews;
      }

      if (fallbackToAll) {
        const query = buildQuery({
          limit: String(Math.max(limit, 6)),
          cruiseLine: cruiseLineOverride || productInfo?.cruiseLine || undefined,
        });
        const fallback = await requestReviews(query);
        if (fallback.length > 0) {
          setCachedReviews((prev) => (prev.length >= fallback.length ? prev : fallback));
        }
        return fallback;
      }

      return cachedReviews.slice(0, limit);
    },
    [productCode, productInfo?.cruiseLine, cachedReviews],
  );

  const ensureReviews = useCallback(
    async (minimum = 3): Promise<Review[]> => {
      if (cachedReviews.length >= minimum) {
        return cachedReviews;
      }
      const fetched = await fetchReviewsForProduct(Math.max(minimum, 6), {
        fallbackToAll: true,
      });
      if (fetched.length > 0) {
        setCachedReviews((prev) => (prev.length >= fetched.length ? prev : fetched));
        return fetched;
      }
      return cachedReviews;
    },
    [cachedReviews, fetchReviewsForProduct],
  );

  const pickRandomReviews = useCallback(
    (count = 1): Review[] => {
      const pool = cachedReviews;
      if (!pool || pool.length === 0) {
        return [];
      }
      let available = pool.filter((review) => !usedReviewIdsRef.current.has(review.id));
      if (available.length === 0) {
        usedReviewIdsRef.current.clear();
        available = pool;
      }
      const source = available;
      const shuffled = [...source].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(count, shuffled.length));
      selected.forEach((review) => usedReviewIdsRef.current.add(review.id));
      return selected;
    },
    [cachedReviews],
  );

  const injectRandomReviewCard = useCallback(
    async (contextKey: string, messagePrefix?: string, count = 1) => {
      if (displayedReviewContextsRef.current.has(contextKey)) {
        return;
      }

      const reviews = await ensureReviews(Math.max(count, 3));
      if (!reviews || reviews.length === 0) {
        return;
      }

      const randomReviews = pickRandomReviews(count);
      if (randomReviews.length === 0) {
        return;
      }

      displayedReviewContextsRef.current.add(contextKey);
      const introText =
        messagePrefix ?? '실제 고객님의 생생한 이야기를 하나 소개해드릴게요. 함께 들어보시죠!';

      addBotMessage(introText, undefined, randomReviews);
    },
    [ensureReviews, pickRandomReviews],
  );

  useEffect(() => {
    // 이미 초기화되었으면 실행하지 않음 (React Strict Mode 대응)
    if (initializedRef.current) return;
    initializedRef.current = true;

    createSessionAndLoadQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps

    // 페이지 이탈 시 추적
    const handleBeforeUnload = () => {
      if (sessionId && currentQuestion) {
        const responseTime = Date.now() - questionStartTime;
        const answeredAtIso = new Date().toISOString();
        const displayedAtIso =
          questionStartTime > 0 ? new Date(questionStartTime).toISOString() : undefined;

        fetch('/api/chat-bot/response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            questionId: currentQuestion.id,
            selectedOption: null,
            selectedText: null,
            responseTime,
            isAbandoned: true,
            nextQuestionId: null,
            questionOrder: currentQuestion.order ?? null,
            optionLabel: null,
            displayedAt: displayedAtIso,
            answeredAt: answeredAtIso,
          }),
          keepalive: true,
        }).catch(() => { });

        if (!sessionId.startsWith('local-')) {
          const durationMs =
            sessionStartTimeRef.current !== null
              ? Date.now() - sessionStartTimeRef.current
              : undefined;
          fetch('/api/chat-bot/session', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              finalStatus: 'ABANDONED',
              isCompleted: false,
              endedAt: answeredAtIso,
              durationMs,
            }),
            keepalive: true,
          }).catch(() => { });
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 빈 의존성 배열로 한 번만 실행

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const createSessionAndLoadQuestion = async () => {
    try {
      setIsLoading(true);
      sessionStartTimeRef.current = Date.now();

      // 1. 상품 정보 로드 (상품 코드가 있는 경우)
      let productData = null;
      if (productCode) {
        try {
          const productResponse = await fetchWithTimeout(
            `/api/public/products/${productCode}`,
            {},
            10000
          );

          if (!productResponse.ok) {
            throw new Error(`상품 정보 로드 실패: ${productResponse.status}`);
          }

          const productResult = await productResponse.json();
          if (productResult.ok && productResult.product) {
            // layout에서 contactOptions 추출
            const layout = productResult.product.MallProductContent?.layout || {};
            const contactOptions = layout.contactOptions || {};

            productData = {
              productCode: productResult.product.productCode,
              packageName: productResult.product.packageName,
              cruiseLine: productResult.product.cruiseLine,
              shipName: productResult.product.shipName,
              nights: productResult.product.nights,
              days: productResult.product.days,
              basePrice: productResult.product.basePrice,
              startDate: productResult.product.startDate,
              endDate: productResult.product.endDate,
              contactOptions: {
                payment: contactOptions.payment || contactOptions.priceInquiry || false,
                phoneCall: contactOptions.phoneCall || false,
                aiChatbot: contactOptions.aiChatbot !== false,
              },
            };
            setProductInfo(productData);
          }
        } catch (error) {
          console.error('[createSessionAndLoadQuestion] Failed to load product:', error);
          // 상품 정보 로드 실패해도 계속 진행
        }
      }

      // 2. 시작 질문 로드 (상품 정보 포함)
      const startSearchParams = new URLSearchParams();
      if (productCode) {
        startSearchParams.set('productCode', productCode);
      }
      if (shareToken) {
        startSearchParams.set('shareToken', shareToken);
      }
      // partner 파라미터 추가 (구매 추적용)
      if (partnerId) {
        startSearchParams.set('partner', partnerId);
      }

      const startUrl =
        startSearchParams.toString().length > 0
          ? `/api/chat-bot/start?${startSearchParams.toString()}`
          : '/api/chat-bot/start';

      let startResponse: Response;
      try {
        startResponse = await fetchWithTimeout(startUrl, {}, 15000);
      } catch (error) {
        if (error instanceof Error && error.name === 'TimeoutError') {
          throw new Error('서버 응답 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.');
        }
        throw new Error('시작 질문을 불러올 수 없습니다. 네트워크 연결을 확인해주세요.');
      }

      if (!startResponse.ok) {
        const errorText = await startResponse.text().catch(() => 'Unknown error');
        throw new Error(`시작 질문 로드 실패 (${startResponse.status}): ${errorText}`);
      }

      let startData;
      try {
        startData = await startResponse.json();
      } catch (error) {
        throw new Error('서버 응답을 파싱할 수 없습니다.');
      }

      if (!startData.ok || !startData.question) {
        throw new Error(startData.error || '시작 질문을 불러올 수 없습니다.');
      }

      setFlowId(startData.flowId);
      if ((!productCode || productCode.length === 0) && startData.resolvedProductCode) {
        setProductCode(startData.resolvedProductCode);
      }
      if (startData.productInfo) {
        setProductInfo(startData.productInfo);
      }

      // 🚀 질문 먼저 표시 (로딩 시간 최적화)
      setCurrentQuestion(startData.question);
      setQuestionStartTime(Date.now());

      let initialReviews: Review[] | undefined;
      if (productCode && startData.question.order === 5) {
        const reviews = await fetchReviewsForProduct(3, productData?.cruiseLine || undefined);
        if (reviews.length > 0) {
          initialReviews = reviews;
          setCachedReviews((prev) => (prev.length >= reviews.length ? prev : reviews));
        }
      }

      // Introductory random review (only once per session) - 먼저 보여주고 아래에 질문 버튼 노출
      if (productCode) {
        await injectRandomReviewCard(
          'intro',
          '💡 방금 소개한 후기처럼 우리 고객님들도 멋진 경험을 하고 계세요. 계속 상담 도와드릴게요!',
          1,
        );
      }

      addBotMessage(startData.question.questionText, startData.question, initialReviews);

      // 🚀 세션 생성은 백그라운드에서 처리 (화면 표시 후)
      (async () => {
        try {
          const sessionResponse = await fetchWithTimeout(
            '/api/chat-bot/session',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                flowId: startData.flowId,
                productCode: productCode || null,
                partnerId: partnerId || null,
              }),
            },
            10000
          );

          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json().catch(() => ({ ok: false }));
            if (sessionData.ok && sessionData.data) {
              setSessionId(sessionData.data.sessionId || sessionData.data.id);
              logger.log('[createSessionAndLoadQuestion] Session ID set:', sessionData.data.sessionId || sessionData.data.id);
            }
          }
        } catch (error) {
          console.error('[createSessionAndLoadQuestion] Failed to create session:', error);
          const localSessionId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
          setSessionId(localSessionId);
          logger.log('[createSessionAndLoadQuestion] Using local session ID:', localSessionId);
        }
      })();
    } catch (error) {
      console.error('[createSessionAndLoadQuestion] Failed to initialize chat bot:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : '채팅봇을 불러오는 중 오류가 발생했습니다.';
      addBotMessage(`죄송합니다. ${errorMessage}\n\n페이지를 새로고침하거나 잠시 후 다시 시도해주세요.`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadQuestion = async (questionId: number) => {
    logger.log('[loadQuestion] Loading question:', questionId);
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      if (productCode) {
        queryParams.set('productCode', productCode);
      }
      if (partnerId) {
        queryParams.set('partner', partnerId); // 파트너 ID 전달 (구매 추적용)
      }
      const url = `/api/chat-bot/question/${questionId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      logger.log('[loadQuestion] Fetching URL:', url);

      let response: Response;
      try {
        response = await fetchWithTimeout(url, {}, 15000);
      } catch (error) {
        if (error instanceof Error && error.name === 'TimeoutError') {
          throw new Error('서버 응답 시간이 초과되었습니다.');
        }
        throw new Error('질문을 불러올 수 없습니다. 네트워크 연결을 확인해주세요.');
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`질문 로드 실패 (${response.status}): ${errorText}`);
      }

      let data;
      try {
        data = await response.json();
      } catch (error) {
        throw new Error('서버 응답을 파싱할 수 없습니다.');
      }

      logger.log('[loadQuestion] Response data:', data);

      if (data.ok && data.question) {
        logger.log('[loadQuestion] Question loaded:', data.question);
        setCurrentQuestion(data.question);
        setQuestionStartTime(Date.now());

        let questionReviews: Review[] | undefined;
        const lowerQuestionText = (data.question.questionText || '').toLowerCase();
        const isReviewQuestion =
          productCode &&
          (data.question.order === 5 ||
            data.question.order === 11 ||
            lowerQuestionText.includes('실제 고객 후기') ||
            lowerQuestionText.includes('후기 보여드릴게요'));
        if (isReviewQuestion) {
          const limit = data.question.order === 11 ? 6 : 3;
          const reviews = await fetchReviewsForProduct(limit);
          if (reviews.length > 0) {
            questionReviews = reviews;
          }
        }

        const situationOrders = new Set([4, 5, 6, 7, 8, 9]);
        const solutionOrders = new Set([20, 21, 22, 23, 24, 25]);

        if (productCode && situationOrders.has(data.question.order ?? -1)) {
          await injectRandomReviewCard(
            `situation-${data.question.order}`,
            '비슷한 상황을 겪은 고객님의 후기를 잠깐 소개드렸어요. 공감되셨나요?',
            1,
          );
        }

        if (productCode && solutionOrders.has(data.question.order ?? -1)) {
          await injectRandomReviewCard(
            `solution-${data.question.order}`,
            '🎉 실제로 이렇게 문제를 해결하신 분도 계세요. 우리도 이어서 해결책을 준비해볼까요?',
            1,
          );
        }

        // 리뷰 안내가 끝난 뒤 실제 질문 + 버튼 노출
        addBotMessage(data.question.questionText || '', data.question, questionReviews);
      } else if (data.finalPageUrl) {
        // 세션 완료 처리 (실패해도 계속 진행)
        if (sessionId && !sessionId.startsWith('local-')) {
          try {
            const endedAtIso = new Date().toISOString();
            const durationMs =
              sessionStartTimeRef.current !== null
                ? Date.now() - sessionStartTimeRef.current
                : undefined;
            await fetchWithTimeout(
              '/api/chat-bot/session',
              {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId,
                  isCompleted: true,
                  finalPageUrl: data.finalPageUrl,
                  conversionRate: 1.0,
                  finalStatus: 'COMPLETED',
                  endedAt: endedAtIso,
                  durationMs,
                }),
              },
              5000
            ).catch(() => { }); // 실패해도 무시
          } catch (error) {
            console.error('[loadQuestion] Failed to update session:', error);
          }
        }

        // 최종 구매 페이지로 이동
        if (data.finalPageUrl) {
          const query = new URLSearchParams();
          if (partnerId) {
            query.set('partner', partnerId);
          }
          const queryString = query.toString() ? `?${query.toString()}` : '';

          // 상품의 contactOptions 확인 - 결제하기 버튼이 없으면 전화상담으로
          const hasPaymentButton = productInfo?.contactOptions?.payment !== false;
          const hasPhoneCallButton = productInfo?.contactOptions?.phoneCall !== false;

          if (productCode && data.finalPageUrl.includes('payment')) {
            // 결제 페이지로 가려는데 결제 버튼이 없으면 전화상담으로 유도
            if (hasPaymentButton) {
              router.push(`/products/${productCode}/payment${queryString}`);
            } else if (hasPhoneCallButton) {
              // 결제 버튼 없고 전화상담 있으면 상담 페이지로
              router.push(`/products/${productCode}/inquiry${queryString}`);
            } else {
              // 둘 다 없으면 상품 페이지로
              router.push(`/products/${productCode}${queryString}`);
            }
          } else if (data.finalPageUrl.includes('inquiry') && productCode) {
            router.push(`/products/${productCode}/inquiry${queryString}`);
          } else {
            // 최종 페이지 URL에 partner 정보 추가
            const finalUrl = new URL(data.finalPageUrl, window.location.origin);
            if (partnerId) {
              finalUrl.searchParams.set('partner', partnerId);
            }
            router.push(finalUrl.pathname + finalUrl.search);
          }
        }
      } else {
        throw new Error(data.error || '질문을 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('[loadQuestion] Failed to load question:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : '질문을 불러오는 중 오류가 발생했습니다.';
      addBotMessage(`죄송합니다. ${errorMessage}\n\n다시 시도해주세요.`);
    } finally {
      setIsLoading(false);
    }
  };

  const addBotMessage = (text: string, question?: ChatBotQuestion, reviews?: Review[]) => {
    logger.log('[addBotMessage] Called with:', { text, question, reviews });

    const sanitizeContent = (input?: string | null) => {
      if (!input) return '';
      return input
        .replace(/\(.*?크루즈몰 후기 API.*?\)/gi, '')
        .replace(/\*\*크루즈몰 후기 API\*\*/gi, '')
        .replace(/크루즈몰 후기 API/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    };

    const sanitizedQuestionText = sanitizeContent(text) || text;
    const sanitizedInformation = sanitizeContent(question?.information);

    // information이 있고 비어있지 않으면 questionText + information을 content로 사용
    // information이 없거나 비어있으면 questionText만 사용
    let content = sanitizedQuestionText; // 기본값은 questionText
    if (sanitizedInformation.length > 0) {
      content = (content ? `${content}\n\n` : '') + sanitizedInformation;
    }
    content = content.trim();
    // 후기 카드는 별도 안내 없이 자연스럽게 표시 (대화 흐름 유지)

    // 선택지 준비
    let optionsToAdd: { label: string; nextId?: number }[] | undefined = undefined;

    if (question?.options && Array.isArray(question.options) && question.options.length > 0) {
      // 5가지 선택지
      const nextIds = (question.nextQuestionIds && Array.isArray(question.nextQuestionIds))
        ? question.nextQuestionIds
        : [];
      optionsToAdd = question.options.map((opt, index) => ({
        label: opt,
        nextId: nextIds[index] || undefined,
      }));
      logger.log('[addBotMessage] Prepared options:', optionsToAdd);
    } else if (question?.optionA && question?.optionB) {
      // A/B 선택지
      optionsToAdd = [
        { label: question.optionA, nextId: question.nextQuestionIdA || undefined },
        { label: question.optionB, nextId: question.nextQuestionIdB || undefined },
      ];
      logger.log('[addBotMessage] Prepared A/B options:', optionsToAdd);
    } else if (question?.optionA && !question?.optionB) {
      // optionA만 있는 경우 (결제 버튼 등)
      optionsToAdd = [
        { label: question.optionA, nextId: question.nextQuestionIdA || undefined },
      ];
      logger.log('[addBotMessage] Prepared single option:', optionsToAdd);
    }

    const attachments = question?.attachments ?? [];

    if (reviews && reviews.length > 0 && question?.id) {
      const hasReviewOption =
        optionsToAdd?.some((opt) => opt.label.includes('후기') || opt.label.includes('리뷰')) ?? false;
      if (!hasReviewOption) {
        const reviewOption = { label: '📸 실제 고객 후기 더 보기', nextId: undefined };
        if (optionsToAdd) {
          optionsToAdd = [...optionsToAdd, reviewOption];
        } else {
          optionsToAdd = [reviewOption];
        }
      }
    }

    const message: ChatMessage = {
      type: 'bot',
      content: content,
      questionId: question?.id,
      reviews: reviews,
      options: optionsToAdd, // 옵션을 메시지와 함께 추가
      attachments,
    };

    // 중복 메시지 방지: 같은 내용의 메시지가 이미 있으면 추가하지 않음
    setMessages(prev => {
      // 메시지 내용이 정확히 일치하는지 확인
      const hasExactMessage = prev.some(m =>
        m.type === 'bot' &&
        m.content === content &&
        (!question || m.questionId === question.id) &&
        JSON.stringify(m.attachments ?? []) === JSON.stringify(attachments ?? [])
      );

      if (hasExactMessage) {
        logger.log('[addBotMessage] Duplicate message detected, skipping');
        return prev; // 중복 메시지이면 추가하지 않음
      }

      // 옵션이 있는 경우, 같은 questionId의 옵션이 이미 있는지 확인
      if (optionsToAdd && optionsToAdd.length > 0 && question?.id) {
        const hasOptions = prev.some(m =>
          m.options &&
          m.questionId === question.id &&
          m.options.length === optionsToAdd.length &&
          m.options.every((opt, idx) => opt.label === optionsToAdd![idx].label)
        );
        if (hasOptions) {
          logger.log('[addBotMessage] Options already exist for this question, skipping');
          return prev;
        }
      }

      logger.log('[addBotMessage] Adding message with options:', { content, optionsToAdd, questionId: question?.id });
      return [...prev, message];
    });
  };

  const handleOptionClick = async (option: { label: string; nextId?: number }) => {
    logger.log('[handleOptionClick] Called with option:', option);
    logger.log('[handleOptionClick] currentQuestion:', currentQuestion);
    logger.log('[handleOptionClick] sessionId:', sessionId);

    if (!currentQuestion) {
      console.error('[handleOptionClick] No currentQuestion');
      return;
    }

    const normalizedLabel = option.label.trim();

    const goToPayment = (durationMs?: number) => {
      const validSessionId = sessionId && !sessionId.startsWith('local-') ? sessionId : null;
      if (validSessionId && productCode) {
        fetchWithTimeout(
          '/api/chat-bot/session',
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: validSessionId,
              isCompleted: true,
              finalPageUrl: `/products/${productCode}/payment`,
              conversionRate: 1.0,
              finalStatus: 'COMPLETED',
              endedAt: new Date().toISOString(),
              durationMs,
              paymentStatus: 'PENDING',
              paymentAttemptedAt: new Date().toISOString(),
            }),
          },
          5000,
        ).catch(() => { });
      }
      if (productCode) {
        const query = new URLSearchParams();
        if (validSessionId) {
          query.set('sessionId', validSessionId);
        }
        // partner 파라미터가 있으면 쿼리스트링에 추가
        if (partnerId) {
          query.set('partner', partnerId);
        }
        router.push(`/products/${productCode}/payment${query.toString() ? `?${query.toString()}` : ''}`);
      }
    };

    const nextAction: 'payment' | 'inquiry' | 'family' | null =
      productCode && (normalizedLabel.includes('결제') || normalizedLabel.includes('예약'))
        ? 'payment'
        : productCode && (normalizedLabel.includes('상담 신청') || normalizedLabel.includes('상담신청'))
          ? 'inquiry'
          : normalizedLabel.includes('가족') && normalizedLabel.includes('상의')
            ? 'family'
            : null;

    // 후기 보기 옵션 처리 (order 11, 19 등)
    const isReviewOption =
      productCode &&
      (option.label.includes('후기 보기') ||
        option.label.includes('더 많이 보고') ||
        option.label.includes('리뷰 더 보기') ||
        option.label.includes('실제 고객 후기'));

    // sessionId가 없어도 계속 진행 (로컬 세션 ID 생성)
    let effectiveSessionId = sessionId;
    if (!effectiveSessionId) {
      effectiveSessionId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      setSessionId(effectiveSessionId);
      logger.log('[handleOptionClick] Created local session ID:', effectiveSessionId);
    }

    // 응답 시간 계산
    const responseTime = Date.now() - questionStartTime;

    // 선택지 식별 (A/B 또는 인덱스)
    let selectedOption: string | null = null;
    if (currentQuestion.optionA && currentQuestion.optionB) {
      if (option.label === currentQuestion.optionA) {
        selectedOption = 'A';
      } else if (option.label === currentQuestion.optionB) {
        selectedOption = 'B';
      } else {
        selectedOption = null;
      }
    } else if (currentQuestion.options && Array.isArray(currentQuestion.options)) {
      const index = currentQuestion.options.findIndex((opt: string) => opt === option.label);
      selectedOption = index >= 0 ? `OPTION_${index}` : null;
    }

    if (isReviewOption) {
      setMessages((prev) => [...prev, { type: 'user', content: option.label }]);

      if (effectiveSessionId && !effectiveSessionId.startsWith('local-')) {
        try {
          await fetch('/api/chat-bot/response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: effectiveSessionId,
              questionId: currentQuestion.id,
              selectedOption: selectedOption ?? 'REVIEW_POPUP',
              selectedText: option.label,
              responseTime,
              isAbandoned: false,
              nextQuestionId: option.nextId || null,
              questionOrder: currentQuestion.order ?? null,
              optionLabel: option.label,
              displayedAt:
                questionStartTime > 0 ? new Date(questionStartTime).toISOString() : undefined,
              answeredAt: new Date().toISOString(),
            }),
            keepalive: true,
          });
        } catch (error) {
          console.error('Failed to save review popup response:', error);
        }
      }

      const reviews = await ensureReviews(6);
      const randomReviews = pickRandomReviews(2);

      if (randomReviews.length > 0) {
        addBotMessage('추가로 이런 후기도 있었어요. 도움이 되셨나요?', undefined, randomReviews);
      } else if (reviews.length > 0) {
        const fallback =
          reviews[Math.floor(Math.random() * reviews.length)];
        addBotMessage('추가 후기를 잠깐 소개드렸어요. 계속 상담 이어갈게요!', undefined, [fallback]);
      } else {
        addBotMessage('추가 후기를 불러오는 데 잠시 문제가 있었어요. 다른 질문으로 계속 도와드릴게요!');
      }

      if (option.nextId) {
        await loadQuestion(option.nextId);
      }

      return;
    }

    // 사용자 선택 메시지 추가
    setMessages(prev => [...prev, {
      type: 'user',
      content: option.label,
    }]);

    // 응답 저장 (세션이 있으면)
    if (effectiveSessionId && !effectiveSessionId.startsWith('local-')) {
      try {
        await fetch('/api/chat-bot/response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: effectiveSessionId,
            questionId: currentQuestion.id,
            selectedOption,
            selectedText: option.label,
            responseTime,
            isAbandoned: false,
            nextQuestionId: option.nextId || null,
            questionOrder: currentQuestion.order ?? null,
            optionLabel: option.label,
            displayedAt:
              questionStartTime > 0 ? new Date(questionStartTime).toISOString() : undefined,
            answeredAt: new Date().toISOString(),
          }),
          keepalive: true,
        });
      } catch (error) {
        console.error('Failed to save response:', error);
      }
    }

    if (nextAction === 'family') {
      addBotMessage(
        '물론이에요! 😊 가족분들과 충분히 상의하시고요.\n\n궁금한 점이 생기면 언제든지 다시 불러주세요. AI 크루즈닷이 24시간 기다리고 있을게요!'
      );
      return;
    }

    if (nextAction === 'payment') {
      addBotMessage(
        '최고의 선택이에요! 💙\n\n잠시 후 안전한 결제 페이지로 이동해 드릴게요. 창이 자동으로 열리지 않으면 새로고침 후 다시 시도해 주세요.'
      );
      const durationMs =
        sessionStartTimeRef.current !== null
          ? Date.now() - sessionStartTimeRef.current
          : undefined;
      setTimeout(() => {
        goToPayment(durationMs);
      }, 1200);
      return;
    }

    if (nextAction === 'inquiry') {
      const query = new URLSearchParams();
      if (partnerId) {
        query.set('partner', partnerId);
      }
      router.push(`/products/${productCode}/inquiry${query.toString() ? `?${query.toString()}` : ''}`);
      return;
    }

    // 다음 질문 로드
    if (option.nextId) {
      logger.log('[handleOptionClick] Loading next question:', option.nextId);
      setPendingNextQuestionId(null);
      await loadQuestion(option.nextId);
    } else {
      logger.log('[handleOptionClick] No nextId, checking finalPageUrl');
      // 최종 페이지로 이동
      if (currentQuestion) {
        setPendingNextQuestionId(null);
        await loadQuestion(currentQuestion.id); // 최종 페이지 URL 확인
      }
    }
  };

  const handleReviewModalClose = () => {
    setShowReviewModal(false);
    if (pendingNextQuestionId) {
      const nextId = pendingNextQuestionId;
      setPendingNextQuestionId(null);
      loadQuestion(nextId);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* 헤더 - 모바일 가독성 개선 */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-5">
          <div className="flex items-center gap-4">
            <span className="text-4xl md:text-5xl">🤖</span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">AI 크루즈닷 채팅봇</h1>
              <p className="text-base md:text-lg text-gray-700">크루즈 여행 상담을 도와드립니다</p>
            </div>
          </div>
        </div>
      </div>

      {/* 채팅 영역 - 모바일 패딩 조정 */}
      <div className="flex-1 container mx-auto px-3 md:px-6 py-4 md:py-6 max-w-4xl">
        <div className="bg-white rounded-xl md:rounded-2xl shadow-lg h-full flex flex-col">
          {/* 메시지 영역 - 모바일 패딩 및 간격 조정 */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 md:space-y-6">
            {messages.length === 0 && !isLoading && (
              <div className="text-center text-gray-500 py-8">
                채팅을 시작합니다...
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} w-full`}
              >
                <div
                  className={`${message.type === 'user' ? 'max-w-[85%] md:max-w-[75%]' : 'w-full'} rounded-xl md:rounded-2xl p-4 md:p-5 ${message.type === 'user'
                    ? 'bg-blue-600 text-white text-lg md:text-xl'
                    : 'bg-gray-50 text-gray-900'
                    }`}
                >
                  {message.type === 'bot' && (
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-3xl md:text-4xl">🤖</span>
                    </div>
                  )}
                  {/* 일반 텍스트 메시지는 표시하지 않음 - 파란색 박스만 표시 */}

                  {/* 리뷰 표시 - 모바일 가독성 개선 */}
                  {message.type === 'bot' && message.reviews && message.reviews.length > 0 && (
                    <div className="mt-5 space-y-6 md:space-y-8">
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 md:p-6 mb-5">
                        <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                          <span className="text-3xl md:text-4xl">💬</span>
                          실제 고객 후기
                        </h3>
                        <p className="text-base md:text-lg text-gray-700">
                          실제로 다녀오신 분들의 생생한 경험담을 확인해보세요!
                        </p>
                      </div>

                      {message.reviews.map((review, reviewIndex) => {
                        // 이미지 배열 처리
                        const reviewImages = Array.isArray(review.images)
                          ? review.images.filter(img => img && typeof img === 'string')
                          : [];
                        const hasImages = reviewImages.length > 0;

                        return (
                          <button
                            key={review.id}
                            type="button"
                            onClick={() => openReviewModal(message.reviews ?? [], reviewIndex)}
                            className="w-full text-left bg-white border-2 border-blue-300 rounded-xl md:rounded-2xl p-5 md:p-6 shadow-lg hover:shadow-2xl transition-transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400"
                          >
                            <div className="flex items-center gap-4 mb-5 pb-5 border-b border-gray-200">
                              {/* 작성자 정보 및 평점 */}
                              <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-xl md:text-2xl shadow-md">
                                {review.authorName.charAt(0)}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="font-bold text-xl md:text-2xl text-gray-900">{review.authorName}님</span>
                                  <div className="flex text-yellow-400 text-xl md:text-2xl">
                                    {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                                  </div>
                                </div>
                                {review.cruiseLine && (
                                  <div className="text-base md:text-lg text-gray-600">
                                    {review.cruiseLine} {review.shipName && `· ${review.shipName}`}
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* 이미지 먼저 표시 (있으면) */}
                            {hasImages && (
                              <div className="mb-4">
                                {reviewImages.length === 1 ? (
                                  // 이미지가 1개면 큰 사이즈로
                                  <div className="w-full">
                                    <Image
                                      src={reviewImages[0]}
                                      alt={`${review.authorName}님의 후기 사진`}
                                      width={800}
                                      height={384}
                                      className="w-full h-auto max-h-96 object-cover rounded-lg shadow-md border-2 border-gray-200"
                                      unoptimized
                                      onError={(e) => {
                                        // 이미지 로드 실패 시 숨기기
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  </div>
                                ) : reviewImages.length === 2 ? (
                                  // 이미지가 2개면 2열
                                  <div className="grid grid-cols-2 gap-3">
                                    {reviewImages.slice(0, 2).map((image, imgIndex) => (
                                      <Image
                                        key={imgIndex}
                                        src={image}
                                        alt={`${review.authorName}님의 후기 사진 ${imgIndex + 1}`}
                                        width={400}
                                        height={192}
                                        className="w-full h-48 object-cover rounded-lg shadow-md border-2 border-gray-200 hover:scale-105 transition-transform cursor-pointer"
                                        unoptimized
                                        onError={(e) => {
                                          // 이미지 로드 실패 시 숨기기
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  // 이미지가 3개 이상이면 첫 번째는 크게, 나머지는 작게
                                  <div className="space-y-3">
                                    <Image
                                      src={reviewImages[0]}
                                      alt={`${review.authorName}님의 후기 사진 1`}
                                      width={800}
                                      height={320}
                                      className="w-full h-auto max-h-80 object-cover rounded-lg shadow-md border-2 border-gray-200"
                                      unoptimized
                                      onError={(e) => {
                                        // 이미지 로드 실패 시 숨기기
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                    {reviewImages.length > 1 && (
                                      <div className="grid grid-cols-2 gap-3">
                                        {reviewImages.slice(1, 3).map((image, imgIndex) => (
                                          <Image
                                            key={imgIndex + 1}
                                            src={image}
                                            alt={`${review.authorName}님의 후기 사진 ${imgIndex + 2}`}
                                            width={400}
                                            height={160}
                                            className="w-full h-40 object-cover rounded-lg shadow-md border-2 border-gray-200 hover:scale-105 transition-transform cursor-pointer"
                                            unoptimized
                                            onError={(e) => {
                                              (e.target as HTMLImageElement).src = '/images/placeholder.jpg';
                                            }}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 제목과 내용 - 모바일 가독성 개선 */}
                            <div className="space-y-4">
                              {review.title && (
                                <h4 className="font-bold text-xl md:text-2xl text-gray-900 leading-snug">
                                  {review.title}
                                </h4>
                              )}
                              <p className="text-lg md:text-xl text-gray-800 leading-relaxed whitespace-pre-wrap">
                                {review.content}
                              </p>
                            </div>

                            {/* 여행 날짜 (있는 경우) */}
                            {review.travelDate && (
                              <div className="mt-5 pt-5 border-t border-gray-200">
                                <span className="text-base md:text-lg text-gray-600">
                                  📅 여행일: {new Date(review.travelDate).toLocaleDateString('ko-KR')}
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })}

                      {/* (이전 이탈 방지 메시지 제거) */}
                    </div>
                  )}

                  {/* 정보 박스 (파란색 배경) - 50대 이상 모바일 가독성 최적화 */}
                  {message.type === 'bot' && message.content && (
                    <div className="mt-4 p-4 md:p-5 bg-blue-50 border-l-4 border-blue-500 rounded-r-xl w-full">
                      <div
                        className="text-lg md:text-xl text-blue-900 whitespace-pre-wrap leading-relaxed font-medium break-words"
                        dangerouslySetInnerHTML={{
                          __html: (() => {
                            let processed = message.content;

                            // 1. HTML 태그가 이미 있으면 먼저 보호 (임시 마커로 교체)
                            const htmlTags: string[] = [];
                            // <div>, <img>, <iframe> 등 모든 HTML 태그 보호 (더 정교한 정규식)
                            // 먼저 복잡한 중첩 태그부터 처리 (iframe이 포함된 div 등)
                            processed = processed.replace(/<div[^>]*>[\s\S]*?<\/div>/g, (match) => {
                              const marker = `__HTML_TAG_${htmlTags.length}__`;
                              htmlTags.push(match);
                              return marker;
                            });
                            // 자체 닫는 태그 (<img />, <br /> 등)
                            processed = processed.replace(/<[^>]+\/>/g, (match) => {
                              const marker = `__HTML_TAG_${htmlTags.length}__`;
                              htmlTags.push(match);
                              return marker;
                            });
                            // 열리고 닫히는 태그 (<iframe>...</iframe> 등)
                            processed = processed.replace(/<(\w+)[^>]*>[\s\S]*?<\/\1>/g, (match) => {
                              const marker = `__HTML_TAG_${htmlTags.length}__`;
                              htmlTags.push(match);
                              return marker;
                            });

                            // 2. 마크다운 처리
                            processed = processed
                              // 이미지 마크다운 처리 (![alt](url)) - 먼저 처리하여 일반 링크로 변환되지 않도록
                              .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
                                // 서버에서 이미 인코딩된 URL인 경우 다시 인코딩하지 않음
                                let encodedUrl = url;

                                // 서버에서 인코딩된 URL인지 확인
                                const isServerEncoded = url.includes('%') && (() => {
                                  try {
                                    const decoded = decodeURIComponent(url);
                                    return decoded !== url;
                                  } catch {
                                    return false;
                                  }
                                })();

                                if (!isServerEncoded) {
                                  try {
                                    // 절대 URL인 경우
                                    if (url.startsWith('http://') || url.startsWith('https://')) {
                                      const urlObj = new URL(url);
                                      const pathParts = urlObj.pathname.split('/').filter(p => p);
                                      const encodedPath = '/' + pathParts.map(part => encodeURIComponent(part)).join('/');
                                      encodedUrl = urlObj.origin + encodedPath + (urlObj.search || '') + (urlObj.hash || '');
                                    } else {
                                      // 상대 경로인 경우
                                      const pathParts = url.split('/').filter(p => p);
                                      encodedUrl = '/' + pathParts.map(part => encodeURIComponent(part)).join('/');
                                    }
                                  } catch {
                                    // URL 파싱 실패 시 원본 URL 사용
                                    encodedUrl = url;
                                  }
                                }

                                // 이미지 로드 실패 시 처리하기 위한 onerror 핸들러 추가 + 탭하여 확대 표시
                                return `<div class="relative my-3 cursor-pointer group"><img src="${encodedUrl}" alt="${alt || '여행지 사진'}" class="w-full h-auto rounded-xl shadow-lg object-cover border-2 border-gray-200" loading="lazy" onerror="this.parentElement.style.display='none';" /><div class="absolute bottom-2 right-2 bg-blue-600 text-white text-base font-bold px-4 py-2 rounded-full shadow-lg">🔍 탭하여 확대</div></div>`;
                              })
                              // 남은 마크다운 이미지 패턴 처리 (이스케이프된 경우)
                              .replace(/\\!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
                                let encodedUrl = url;
                                if (!url.includes('%')) {
                                  try {
                                    if (url.startsWith('http://') || url.startsWith('https://')) {
                                      const urlObj = new URL(url);
                                      const pathParts = urlObj.pathname.split('/').filter(p => p);
                                      const encodedPath = '/' + pathParts.map(part => encodeURIComponent(part)).join('/');
                                      encodedUrl = urlObj.origin + encodedPath + (urlObj.search || '') + (urlObj.hash || '');
                                    } else {
                                      const pathParts = url.split('/').filter(p => p);
                                      encodedUrl = '/' + pathParts.map(part => encodeURIComponent(part)).join('/');
                                    }
                                  } catch {
                                    encodedUrl = url;
                                  }
                                }
                                return `<div class="relative my-3 cursor-pointer group"><img src="${encodedUrl}" alt="${alt || '여행지 사진'}" class="w-full h-auto rounded-xl shadow-lg object-cover border-2 border-gray-200" loading="lazy" onerror="this.parentElement.style.display='none';" /><div class="absolute bottom-2 right-2 bg-blue-600 text-white text-base font-bold px-4 py-2 rounded-full shadow-lg">🔍 탭하여 확대</div></div>`;
                              })
                              // 유튜브 링크를 임베드 iframe으로 변환 (마크다운 링크 형식)
                              .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+youtu\.be\/[^)]+)\)/g, (match, linkText, url) => {
                                // YouTube Shorts URL 처리
                                if (url.includes('/shorts/')) {
                                  const videoIdMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
                                  if (videoIdMatch && videoIdMatch[1]) {
                                    const videoId = videoIdMatch[1];
                                    return `<div class="mt-3 mb-3"><div class="aspect-video w-full rounded-xl overflow-hidden bg-gray-900 shadow-lg relative cursor-pointer border-2 border-blue-400 video-modal-trigger" data-video-url="https://www.youtube.com/watch?v=${videoId}"><iframe src="https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="w-full h-full pointer-events-none"></iframe><div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30"><span class="text-white text-xl font-bold bg-blue-600 px-5 py-3 rounded-full shadow-lg">📺 탭하여 크게 보기</span></div></div></div>`;
                                  }
                                }
                                // 일반 YouTube URL 처리
                                const videoIdMatch = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/);
                                if (videoIdMatch && videoIdMatch[1]) {
                                  const videoId = videoIdMatch[1];
                                  return `<div class="mt-3 mb-3"><div class="aspect-video w-full rounded-xl overflow-hidden bg-gray-900 shadow-lg relative cursor-pointer border-2 border-blue-400 video-modal-trigger" data-video-url="https://www.youtube.com/watch?v=${videoId}"><iframe src="https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="w-full h-full pointer-events-none"></iframe><div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30"><span class="text-white text-xl font-bold bg-blue-600 px-5 py-3 rounded-full shadow-lg">📺 탭하여 크게 보기</span></div></div></div>`;
                                }
                                return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline font-semibold text-xl">${linkText}</a>`;
                              })
                              // 일반 YouTube URL을 임베드로 변환 (Shorts 포함)
                              .replace(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g, (match, videoId, offset, string) => {
                                // 이미 마크다운 링크로 처리된 경우는 건너뛰기
                                if (offset > 0 && string[offset - 1] === ')') {
                                  return match;
                                }
                                // 이미 iframe으로 처리된 경우는 건너뛰기
                                if (string.includes(`embed/${videoId}`)) {
                                  return match;
                                }
                                return `<div class="mt-3 mb-3"><div class="aspect-video w-full rounded-xl overflow-hidden bg-gray-900 shadow-lg relative cursor-pointer border-2 border-blue-400 video-modal-trigger" data-video-url="https://www.youtube.com/watch?v=${videoId}"><iframe src="https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="w-full h-full pointer-events-none"></iframe><div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30"><span class="text-white text-xl font-bold bg-blue-600 px-5 py-3 rounded-full shadow-lg">📺 탭하여 크게 보기</span></div></div></div>`;
                              })
                              // 일반 링크 처리 (YouTube 링크가 아닌 경우, 이미지가 아닌 경우)
                              .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
                                // YouTube 링크는 이미 처리되었으므로 건너뛰기
                                if (url.match(/youtube\.com|youtu\.be/)) {
                                  return match;
                                }
                                // 이미지 URL은 이미 처리되었으므로 건너뛰기
                                if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                                  return match;
                                }
                                // 이미 HTML 태그로 변환된 경우 건너뛰기
                                if (match.includes('<img') || match.includes('<iframe') || match.includes('<a')) {
                                  return match;
                                }
                                return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline font-semibold text-xl">${linkText}</a>`;
                              })
                              // 남은 마크다운 링크 패턴 처리 (이스케이프된 경우)
                              .replace(/\\\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
                                if (url.match(/youtube\.com|youtu\.be/)) {
                                  return match;
                                }
                                if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                                  return match;
                                }
                                return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline font-semibold text-xl">${linkText}</a>`;
                              })
                              // 볼드 텍스트 처리
                              .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-2xl">$1</strong>')
                              // 불릿 포인트 처리
                              .replace(/^\- /gm, '• ')
                              // 남은 마크다운 문법 제거 (소스 코드 노출 방지) - 모든 처리 후 마지막에 실행
                              // HTML 태그로 변환되지 않은 남은 마크다운만 제거
                              .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match) => {
                                // 이미 HTML 태그로 변환된 경우는 건너뛰기
                                return match.includes('<img') ? match : '';
                              })
                              .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
                                // 이미 HTML 태그로 변환된 경우는 건너뛰기
                                if (match.includes('<a') || match.includes('<img') || match.includes('<iframe')) {
                                  return match;
                                }
                                // YouTube 링크는 이미 처리되었으므로 텍스트만 표시
                                if (url.match(/youtube\.com|youtu\.be/)) {
                                  return linkText;
                                }
                                // 일반 링크는 텍스트만 표시 (소스 코드 노출 방지)
                                return linkText;
                              })
                              // HTML 태그 안의 \n은 변환하지 않고, HTML 태그 밖의 \n만 <br />로 변환
                              .replace(/\n/g, (match, offset, string) => {
                                // 앞뒤 100자 확인
                                const before = string.substring(Math.max(0, offset - 100), offset);
                                const after = string.substring(offset + 1, Math.min(string.length, offset + 101));

                                // HTML 태그 안에 있는지 확인 (<div>...</div>, <img /> 등)
                                const lastOpenTag = before.lastIndexOf('<');
                                const nextCloseTag = after.indexOf('>');
                                const lastCloseTag = before.lastIndexOf('>');

                                // 열린 태그가 있고 닫히지 않았으면 HTML 태그 안에 있음
                                if (lastOpenTag >= 0 && lastCloseTag < lastOpenTag && nextCloseTag >= 0) {
                                  return match; // HTML 태그 안에 있으면 그대로 유지
                                }

                                return '<br />';
                              })
                              .replace(/^\- /gm, '• ');

                            // 3. HTML 태그 복원
                            htmlTags.forEach((tag, index) => {
                              processed = processed.replace(`__HTML_TAG_${index}__`, tag);
                            });

                            return processed;
                          })()
                        }}
                      />
                    </div>
                  )}

                  {message.type === 'bot' && message.attachments && message.attachments.length > 0 && (
                    <div className="mt-4 space-y-6">
                      {message.attachments.map((attachment, attachmentIndex) => {
                        if (attachment.type === 'destinationGallery') {
                          return (
                            <DestinationGalleryAttachmentBlock
                              key={`${message.questionId}-gallery-${attachment.id}-${attachmentIndex}`}
                              attachment={attachment}
                            />
                          );
                        }
                        if (attachment.type === 'video') {
                          return (
                            <VideoAttachmentBlock
                              key={`${message.questionId}-video-${attachmentIndex}`}
                              attachment={attachment}
                            />
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}

                  {/* 선택지 버튼 - 모바일 가독성 대폭 개선 */}
                  {(() => {
                    logger.log('[Render] Checking options for message:', {
                      messageId: message.questionId,
                      hasOptions: !!message.options,
                      optionsLength: message.options?.length,
                      options: message.options,
                    });
                    return message.options && message.options.length > 0 ? (
                      <div className="mt-5 md:mt-6 space-y-4">
                        {message.options.map((option, optIndex) => {
                          // "실제 고객 후기 보기" 버튼은 특별한 스타일 적용
                          const isReviewButton = option.label.includes('실제 고객 후기');
                          return (
                            <button
                              key={`${message.questionId}-${optIndex}`}
                              onClick={() => handleOptionClick(option)}
                              disabled={isLoading}
                              className={`w-full text-left px-5 md:px-6 py-4 md:py-5 rounded-xl md:rounded-2xl transition-all font-bold text-lg md:text-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-[0.98] ${isReviewButton
                                ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white border-2 border-yellow-500 hover:from-yellow-500 hover:to-orange-500 text-xl md:text-2xl'
                                : 'bg-white border-3 border-blue-600 text-blue-700 hover:bg-blue-50 active:bg-blue-100'
                                }`}
                            >
                              {isReviewButton && <span className="mr-2 text-2xl">💬</span>}
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* 후기 팝업 모달 */}
      <ReviewModal
        isOpen={showReviewModal}
        onClose={handleReviewModalClose}
        reviews={reviewData}
        cruiseLine={productInfo?.cruiseLine}
        shipName={productInfo?.shipName}
        initialIndex={activeReviewIndex}
      />

      {/* 이미지 모달 - 전체화면 뷰어 */}
      {imageModalOpen && imageModalImages.length > 0 && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          onClick={() => setImageModalOpen(false)}
        >
          {/* X 닫기 버튼 */}
          <button
            onClick={() => setImageModalOpen(false)}
            className="absolute top-4 right-4 z-60 text-white text-4xl font-bold hover:text-gray-300 bg-black bg-opacity-50 rounded-full w-12 h-12 flex items-center justify-center"
          >
            ×
          </button>

          {/* 이미지 카운터 */}
          <div className="absolute top-4 left-4 text-white text-lg bg-black bg-opacity-50 px-3 py-1 rounded-full">
            {imageModalIndex + 1} / {imageModalImages.length}
          </div>

          {/* 메인 이미지 */}
          <div
            className="max-w-[95vw] max-h-[85vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={imageModalImages[imageModalIndex]}
              alt={`크루즈 사진 ${imageModalIndex + 1}`}
              width={1200}
              height={800}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
              unoptimized
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          {/* 이전 버튼 */}
          {imageModalImages.length > 1 && imageModalIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setImageModalIndex(imageModalIndex - 1);
              }}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white text-5xl font-bold hover:text-gray-300 bg-black bg-opacity-50 rounded-full w-14 h-14 flex items-center justify-center"
            >
              ‹
            </button>
          )}

          {/* 다음 버튼 */}
          {imageModalImages.length > 1 && imageModalIndex < imageModalImages.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setImageModalIndex(imageModalIndex + 1);
              }}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white text-5xl font-bold hover:text-gray-300 bg-black bg-opacity-50 rounded-full w-14 h-14 flex items-center justify-center"
            >
              ›
            </button>
          )}

          {/* 썸네일 네비게이션 */}
          {imageModalImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 overflow-x-auto max-w-[90vw] p-2 bg-black bg-opacity-50 rounded-lg">
              {imageModalImages.map((url, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageModalIndex(index);
                  }}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${index === imageModalIndex ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                >
                  <Image
                    src={url}
                    alt={`썸네일 ${index + 1}`}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 동영상 모달 - 전체화면 뷰어 */}
      {videoModalOpen && videoModalUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50"
          onClick={() => setVideoModalOpen(false)}
        >
          {/* X 닫기 버튼 */}
          <button
            onClick={() => setVideoModalOpen(false)}
            className="absolute top-4 right-4 z-60 text-white text-4xl font-bold hover:text-gray-300 bg-black bg-opacity-50 rounded-full w-12 h-12 flex items-center justify-center"
          >
            ×
          </button>

          {/* 동영상 플레이어 */}
          <div
            className="w-[95vw] max-w-5xl aspect-video"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={videoModalUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/') + '?autoplay=1&rel=0'}
              className="w-full h-full rounded-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          {/* 닫기 안내 - 50대 이상 가독성 */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-lg font-bold bg-black bg-opacity-60 px-5 py-3 rounded-full">
            ✕ 화면을 탭하여 닫기
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatBotPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">로딩 중...</div>}>
      <ChatBotPageContent />
    </Suspense>
  );
}
