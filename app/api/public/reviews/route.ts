// app/api/public/reviews/route.ts
// 공개 리뷰 API (메인페이지용)

// 동적 API로 설정 (req.url 사용)
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// 한글 닉네임 목록
const KOREAN_NICKNAMES = [
  '송이엄마', '찡찡', '크루즈닷만세', '바다사랑', '여행러버', '크루즈킹', '해외여행러', 
  '선상낭만', '오션뷰', '크루즈매니아', '여행의신', '바다의왕자', '선상요리사', 
  '크루즈여행자', '해외탐험가', '선상파티', '오션드림', '크루즈마스터', '여행스타', 
  '바다의별', '선상로맨스', '크루즈러버', '해외여행러버', '선상낭만주의자'
];

// 실제 고객 후기처럼 보이는 샘플 데이터
const SAMPLE_REVIEWS = [
  {
    id: 1,
    authorName: '송이엄마',
    title: 'MSC 벨리시마 지중해 크루즈 최고의 여행!',
    content: '지중해 크루즈 여행을 다녀왔는데 정말 최고였습니다. 배도 크고 시설도 좋고 음식도 맛있었어요. 특히 저녁 식사가 너무 좋았습니다. 스태프들도 친절하고 서비스도 훌륭했습니다. 다음에도 또 가고 싶어요!',
    images: [
      '/크루즈정보사진/고객 후기 자료/코스타 세레나 정찬 사진.jpg',
      '/크루즈정보사진/고객 후기 자료/오션뷰 아침 조식 사진 후기.jpg'
    ],
    rating: 5,
    cruiseLine: 'MSC',
    shipName: '벨리시마',
    travelDate: '2024-12-15',
    productCode: null,
    createdAt: '2025-01-20T10:30:00Z'
  },
  {
    id: 2,
    authorName: '찡찡',
    title: '코스타 세레나 첫 크루즈 여행 후기',
    content: '평생 처음 크루즈 여행을 했는데 너무 좋았어요. 다음에도 또 가고 싶습니다. 특히 데크에서 보는 일몰이 정말 아름다웠어요. 수영장도 넓고 깨끗했고, 공연도 재미있었습니다.',
    images: [
      '/크루즈정보사진/고객 후기 자료/코스타 세레나 공연 후기.jpg',
      '/크루즈정보사진/고객 후기 자료/코스타 세레나 수영장 행사 후기 사진.jpg',
      '/크루즈정보사진/고객 후기 자료/코스타 세레나 샴페인 후기.jpg'
    ],
    rating: 5,
    cruiseLine: '코스타',
    shipName: '세레나',
    travelDate: '2024-11-20',
    productCode: null,
    createdAt: '2025-01-18T14:20:00Z'
  },
  {
    id: 3,
    authorName: '크루즈닷만세',
    title: '로얄캐리비안 스펙트럼 가족 여행 추천',
    content: '가족 여행으로 스펙트럼을 선택했는데 아이들이 너무 좋아했어요. 수영장과 놀이터도 크고 안전해서 맘 편히 놀 수 있었습니다. 식당도 다양하고 맛있었어요.',
    images: [
      '/크루즈정보사진/고객 후기 자료/코스타 세레나 어린이 행사 후기.jpg',
      '/크루즈정보사진/고객 후기 자료/코스타 세레나호 발코니 후기 아이 사진.jpg'
    ],
    rating: 5,
    cruiseLine: '로얄캐리비안',
    shipName: '스펙트럼',
    travelDate: '2024-10-05',
    productCode: null,
    createdAt: '2025-01-15T09:15:00Z'
  },
  {
    id: 4,
    authorName: '바다사랑',
    title: '코스타 세레나 발코니 룸 추천합니다',
    content: '발코니 룸으로 예약했는데 정말 만족스러웠어요. 아침에 일어나서 발코니에서 바다를 보는 게 정말 좋았습니다. 칵테일도 맛있고 분위기도 좋았어요.',
    images: [
      '/크루즈정보사진/고객 후기 자료/코스타 세레나 칵테일 후기 2잔  레몬.jpg',
      '/크루즈정보사진/고객 후기 자료/코스타세레나호 사세보 발코니 후기 사진 오션뷰.jpg',
      '/크루즈정보사진/고객 후기 자료/코스타세레나 후기 칵테일 2잔 .jpg'
    ],
    rating: 5,
    cruiseLine: '코스타',
    shipName: '세레나',
    travelDate: '2024-09-10',
    productCode: null,
    createdAt: '2025-01-12T16:45:00Z'
  },
  {
    id: 5,
    authorName: '여행러버',
    title: 'MSC 벨리시마 유럽 크루즈 여행',
    content: '유럽 여러 나라를 한 번에 둘러볼 수 있어서 좋았어요. 배에서 내려서 관광하고 다시 돌아오는 패턴이 편리했습니다. 음식도 유럽식으로 다양하게 제공되어 만족스러웠습니다.',
    images: [
      '/크루즈정보사진/고객 후기 자료/코스타 세레나 밖에서 크루즈 외관사진 후기.jpg',
      '/크루즈정보사진/고객 후기 자료/크루즈 앞 코스타세레나호 후기 사진.jpg'
    ],
    rating: 4,
    cruiseLine: 'MSC',
    shipName: '벨리시마',
    travelDate: '2024-08-25',
    productCode: null,
    createdAt: '2025-01-10T11:30:00Z'
  },
  {
    id: 6,
    authorName: '크루즈킹',
    title: '코스타 세레나 커플 여행 후기',
    content: '커플 여행으로 다녀왔는데 정말 로맨틱했습니다. 저녁 식사 후 데크에서 산책하는 게 정말 좋았어요. 공연도 재미있고 분위기도 좋았습니다.',
    images: [
      '/크루즈정보사진/고객 후기 자료/코스타세레나호 사세보 커플 후기 사진.jpg',
      '/크루즈정보사진/고객 후기 자료/코스타세레나호 사세보 후기 사진.jpg'
    ],
    rating: 5,
    cruiseLine: '코스타',
    shipName: '세레나',
    travelDate: '2024-07-15',
    productCode: null,
    createdAt: '2025-01-08T13:20:00Z'
  }
];

const REVIEW_COPY: Record<string, { title: string; content: string }> = {
  '/크루즈정보사진/고객 후기 자료/코스타 세레나 정찬 사진.jpg': {
    title: '세레나 디너 코스, 여행 중 최고의 만찬',
    content:
      '하루 일정을 마무리하며 8코스 정찬을 즐겼는데, 셰프가 직접 메뉴를 설명해줘서 훨씬 특별했어요. 식기 세팅부터 서비스까지 모두 완벽해서 “선상에서 이런 식사를 할 수 있구나” 감탄했습니다.'
  },
  '/크루즈정보사진/고객 후기 자료/코스타 세레나 샴페인 후기.jpg': {
    title: '선셋 라운지에서 즐긴 샴페인 한 잔',
    content:
      '저녁 공연이 끝난 후 라운지 창가에 앉아 노을을 보며 샴페인을 마셨습니다. 잔잔한 음악과 바다 냄새가 어우러져, 결혼기념일을 다시 맞은 것처럼 로맨틱했어요.'
  },
  '/크루즈정보사진/고객 후기 자료/코스타 세레나 칵테일 후기 2잔  레몬.jpg': {
    title: '친구와 밤새 수다 떤 칵테일 바',
    content:
      '바텐더가 취향을 물어보고 레몬 향을 더해 준 칵테일이 정말 상큼했습니다. 늦은 밤에도 좌석이 여유로워서 친구와 마음껏 수다 떨 수 있었어요.'
  },
  '/크루즈정보사진/고객 후기 자료/코스타 세레나 수영장 행사 후기 사진.jpg': {
    title: '아이들이 반한 세레나 수영장 데크',
    content:
      '저녁이 되면 데크 조명이 켜지는데 아이들이 뛰어놀기 딱 좋았어요. 안전요원이 계속 지켜보고 있어서 부모들도 안심하고 즐길 수 있었습니다.'
  },
  '/크루즈정보사진/고객 후기 자료/코스타 세레나 앞에서 후기.jpg': {
    title: '스펙트럼 갑판에서 본 새벽 바다',
    content:
      '룸서비스로 받은 간단한 조식을 들고 갑판에 나갔더니 새벽 햇살과 파도 소리가 완벽했어요. 커피 한 잔 들고 바다를 바라보는 시간이 가장 기억에 남습니다.'
  }
};

// 리뷰 목록 조회 (비회원도 가능)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    // DB에서 리뷰 조회 시도 (이미지가 있는 후기만 - 크루즈몰용)
    let allReviews = await prisma.cruiseReview.findMany({
      where: {
        isApproved: true,
        isDeleted: false
      },
      orderBy: { createdAt: 'desc' },
      take: limit * 3, // 필터링 후에도 충분한 수를 가져오기 위해
      select: {
        id: true,
        authorName: true,
        title: true,
        content: true,
        images: true,
        rating: true,
        cruiseLine: true,
        shipName: true,
        travelDate: true,
        productCode: true,
        createdAt: true
      }
    });

    // 이미지가 실제로 있는 후기만 필터링
    let reviews = allReviews.filter(review => {
      if (!review.images) return false;
      try {
        const images = Array.isArray(review.images) 
          ? review.images 
          : (typeof review.images === 'string' ? JSON.parse(review.images) : []);
        return Array.isArray(images) && images.length > 0 && images.some((img: any) => img && img.trim());
      } catch {
        return false;
      }
    }).slice(0, limit); // 최종 limit만큼만

    // DB에 리뷰가 없거나 적으면 샘플 데이터 추가
    if (reviews.length < 6) {
      const sampleReviews = SAMPLE_REVIEWS.slice(0, Math.max(6 - reviews.length, 0));
      reviews = [
        ...reviews,
        ...sampleReviews.map(review => ({
          ...review,
          images: review.images || [],
          createdAt: new Date(review.createdAt)
        }))
      ];
    }

    // 크루즈 라인 한국어 변환 맵
    const cruiseLineMap: Record<string, string> = {
      'MSC': 'MSC',
      'Costa': '코스타',
      'Costa Cruises': '코스타',
      'Royal Caribbean': '로얄캐리비안',
      'Royal Caribbean International': '로얄캐리비안',
      'Princess': '프린세스',
      'Princess Cruises': '프린세스',
      'Norwegian': '노르웨이',
      'Norwegian Cruise Line': '노르웨이',
      'Celebrity': '셀레브리티',
      'Celebrity Cruises': '셀레브리티',
      'Holland America': '할란드아메리카',
      'Holland America Line': '할란드아메리카',
      'Carnival': '카니발',
      'Carnival Cruise Line': '카니발',
    };

    // 선박명 한국어 변환 맵
    const shipNameMap: Record<string, string> = {
      'Bellissima': '벨리시마',
      'Grandiosa': '그란디오사',
      'Seaview': '시뷰',
      'Seaside': '시사이드',
      'Serena': '세레나',
      'Costa Serena': '세레나',
      'Spectrum of the Seas': '스펙트럼',
      'Spectrum': '스펙트럼',
      'Quantum of the Seas': '퀀텀',
      'Quantum': '퀀텀',
      'Ovation of the Seas': '오베이션',
      'Ovation': '오베이션',
      'Allure of the Seas': '얼루어',
      'Allure': '얼루어',
      'Brilliance of the Seas': '브릴리언스',
      'Brilliance': '브릴리언스',
    };

    // 이미지 배열 처리 및 닉네임 한글로 변경
    const formattedReviews = reviews.map((review, index) => {
      // authorName이 영어 아이디 형식이면 한글 닉네임으로 변경
      let authorName = review.authorName;
      if (authorName && /^[a-zA-Z0-9_]+$/.test(authorName)) {
        // 영어 아이디인 경우 한글 닉네임으로 변경
        authorName = KOREAN_NICKNAMES[index % KOREAN_NICKNAMES.length];
      }

      // 크루즈 라인 한국어 변환
      let cruiseLine = review.cruiseLine;
      if (cruiseLine) {
        cruiseLine = cruiseLineMap[cruiseLine] || cruiseLine;
      }

      // 선박명 한국어 변환
      let shipName = review.shipName;
      if (shipName) {
        shipName = shipNameMap[shipName] || shipName;
      }
      
      const overrides =
        Array.isArray(review.images) && review.images.length > 0
          ? REVIEW_COPY[review.images[0]]
          : undefined;

      return {
        ...review,
        authorName,
        cruiseLine,
        shipName,
        images: Array.isArray(review.images) 
          ? review.images 
          : (typeof review.images === 'string' ? JSON.parse(review.images) : []),
        createdAt: review.createdAt instanceof Date 
          ? review.createdAt.toISOString() 
          : review.createdAt,
        ...(overrides ?? {})
      };
    });

    return NextResponse.json({
      ok: true,
      reviews: formattedReviews
    });
  } catch (error: any) {
    console.error('[PUBLIC REVIEWS] Error:', error);
    // 에러 발생 시 샘플 데이터 반환 (fallback)
    return NextResponse.json({
      ok: false,
      error: 'Failed to fetch reviews',
      reviews: SAMPLE_REVIEWS.map(review => ({
        ...review,
        images: review.images || []
      }))
    }, { status: 500 });
  }
}
