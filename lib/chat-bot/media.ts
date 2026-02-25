export type ChatBotVideoEntry = {
  title: string;
  embedHtml: string;
  keywords?: string[];
  spinStages?: ('S' | 'P' | 'I' | 'N')[]; // SPIN 단계
  specificOrder?: number; // 특정 order에만 적용 (우선순위 높음)
  cruiseLines?: string[]; // 적용할 크루즈 선사
};

export const PURCHASE_CHATBOT_VIDEOS: ChatBotVideoEntry[] = [
  // ===== S (상황 질문) - Order 1-2 =====

  // Order 1: 도입 - 선사별 소개 영상
  {
    title: 'MSC 크루즈 한국',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/FY2Hsfeyxgk?si=zlWsSyoKJv4WTRzF" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['msc', '한국'],
    spinStages: ['S'],
    specificOrder: 1,
    cruiseLines: ['MSC'],
  },
  {
    title: '로얄 캐리비안',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/AAf4CNX-7Co?si=wdJHi1uzjt4mEKFu" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['로얄', 'royal', 'caribbean'],
    spinStages: ['S'],
    specificOrder: 1,
    cruiseLines: ['Royal Caribbean', 'Royal', 'royal'],
  },
  {
    title: '로얄, MSC, 코스타 크루즈',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/vXWj7nm6FkU?si=3sH3WqtOPBVVYqd9" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['로얄', 'msc', '코스타', '선사'],
    spinStages: ['S'],
    specificOrder: 1,
    cruiseLines: ['Costa', 'COSTA', 'costa'],
  },

  // Order 2: 크루즈 경험 여부 - 크루즈가 가성비 베스트인 이유
  {
    title: '크루즈가 가성비 베스트인 이유',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/3SUQvs4qtXo?si=6R5HFKuvT7G7H0-i" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['가성비 베스트', '가격', '가치'],
    spinStages: ['S'],
    specificOrder: 2,
  },

  // ===== P (문제 질문) - Order 3-6 =====

  // Order 3: 가장 걱정되는 부분 - 크루즈 여행 처음이라구요?
  {
    title: '크루즈 여행 처음이라구요? 그렇다면 안내를 꼭 받으셔야 합니다.',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/DaKs6uK6IQM?si=1L2dXOvq7FsMVzTb" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['처음', '안내', '서비스', '걱정'],
    spinStages: ['P'],
    specificOrder: 3,
  },

  // Order 4: 터미널 위치 - 크루즈 터미널 어떻게 가야해요?
  {
    title: '크루즈 터미널 어떻게 가야해요? 자유여행 현실',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/Gv7b6pVKt38?si=SvDpqndtXc-YaqKM" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['어떻게 가야해요', '터미널', '길'],
    spinStages: ['P'],
    specificOrder: 4,
  },

  // Order 5: 혼자 준비 불안 - 크루즈 여행 현실적인 자유여행
  {
    title: '크루즈 여행 현실적인 자유여행은 이렇습니다.',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/pDxwnanm3C4?si=HLNuk3_bUJpYrY7n" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['현실적인 자유여행', '준비', '혼자'],
    spinStages: ['P'],
    specificOrder: 5,
  },

  // Order 6: 숨겨진 비용 - 크루즈 무조건 싸다? 숨겨진 비용
  {
    title: '크루즈 무조건 싸다? 숨겨진 비용 찾는 법',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/MpqqmlsaA3E?si=KDK3Z-GxxPLxhPn5" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['숨겨진 비용', '가격', '비용', '싸다'],
    spinStages: ['P'],
    specificOrder: 6,
  },

  // ===== I (시사 질문) - Order 7-9 =====

  // Order 7: 못 타면 어떻게? - 크루즈 탑승 시간 꿀팁
  {
    title: '크루즈 탑승 시간 꿀팁 크루즈 탑승 이렇게 하면 못타요',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/JURxMno7mME?si=00brXbd5RRmkKsDH" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['탑승', '못타요', '시간', '늦으면'],
    spinStages: ['I'],
    specificOrder: 7,
  },

  // Order 8: 선상신문 영어 - 크루즈 선상신문은 영어로 빽빽
  {
    title: '크루즈 선상신문은 영어로 빽빽…',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/LcznGjMokqs?si=s94aV7qAUQBvH4Gj" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['선상신문', '영어', '읽을 수', '프로그램'],
    spinStages: ['I'],
    specificOrder: 8,
  },

  // Order 9: 혼자 준비 후회 - 크루즈 터미널 초행길
  {
    title: '크루즈 터미널 초행길이라면 꼭 체크해야 할 꿀 팁',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/CSZy5MSUfx8?si=-EfmtkPD4X-i5xIy" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['초행길', '체크', '후회', '혼자'],
    spinStages: ['I'],
    specificOrder: 9,
  },

  // ===== N (해결 질문) - Order 10-17 =====

  // Order 10: 크루즈닷 소개 - AI 지니 설명
  {
    title: '크루즈닷 크루즈가이드 AI 설명',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/-p_6G69MgyQ?si=_-bmwVgkjm1QnDfY" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['ai', '크루즈가이드', '지니', '도와드려요'],
    spinStages: ['N'],
    specificOrder: 10,
  },

  // Order 11: 실제 고객 후기 - (크루즈몰 후기 API로 표시, 영상 없음)

  // Order 12: 고객 후기 영상 - APEC 크루즈 객실 퀄리티 후기
  {
    title: 'APEC 크루즈 객실 퀄리티 후기',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/BIsNfX0-5UI?si=Zd_OHcFCk4rz0CFB" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['apec', '객실', '퀄리티', '후기', '영상'],
    spinStages: ['N'],
    specificOrder: 12,
  },

  // Order 13: 터미널까지 서포트 - 크루즈닷이 하는 일
  {
    title: '크루즈 터미널까지 크루즈닷이 하는 일',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/i7Btan_R09Q?si=BCZjJIF38Cexm46b" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['터미널까지', '하는 일', '서포트', '도와드려요'],
    spinStages: ['N'],
    specificOrder: 13,
  },

  // Order 14: 가격 안내 - 자유여행 비행기 체크
  {
    title: '자유여행 비행기 탈 때 어떻게 해야하나 이것만은 꼭 체크하세요 꿀팁',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/F2NuiidLYSI?si=wRg2SfJTvXfCSlwy" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['비행기', '체크', '준비', '가격'],
    spinStages: ['N'],
    specificOrder: 14,
  },

  // Order 15: 객실 선택 - APEC 숙소 피아노랜드
  {
    title: 'APEC 숙소 피아노랜드 크루즈',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/QkC4Ymf7CR8?si=sLT2rJx1ATvi0gv7" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['apec', '피아노랜드', '숙소', '객실', '선택'],
    spinStages: ['N'],
    specificOrder: 15,
  },

  // Order 16: 마감 임박 - 크루즈 티켓팅 빡쎈 이유
  {
    title: '크루즈 티켓팅 빡쎈 이유 무조건 일찍 타셔야 합니다.',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/VpUgh6oIK6g?si=YjGraTPgKQRN9nt2" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['티켓팅', '마감', '일찍', '서두르세요'],
    spinStages: ['N'],
    specificOrder: 16,
  },

  // Order 17: 최종 결정 - 크루즈 가성비 갑으로 가는 방법
  {
    title: '크루즈 가성비 갑으로 가는 방법',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/5WvjUNk71a8?si=irxHlISbtLf12tLM" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['가성비 갑', '방법', '결정', '예약'],
    spinStages: ['N'],
    specificOrder: 17,
  },

  // ===== 추가 영상 (키워드 매칭용) =====
  {
    title: '크루즈 사고율은 600만분의 1 입니다.',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/VpUgh6oIK6g?si=tRyg_Az3zJEQ4leC" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['사고율', '안전', '600만분의1'],
    spinStages: ['P', 'I'],
  },
  {
    title: '크루즈 국내 출발이 없는 이유',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/E0iLWnqjGfA?si=iIrMj9nIlq8XBamU" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['국내 출발', '부산', '출발지'],
    spinStages: ['P'],
  },
  {
    title: '크루즈 여행 무료는 뭐고 유료는 뭐에요?',
    embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/IKPCY9G0Uc4?si=4ymQ4C8lBMc_WFab" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    keywords: ['무료', '유료', '비용', '포함'],
    spinStages: ['N'],
  },
];

/**
 * 선사 이름을 정규화하는 함수
 */
function normalizeCruiseLine(cruiseLine?: string): string {
  if (!cruiseLine) return '';
  const normalized = cruiseLine.toLowerCase().trim();
  if (normalized.includes('costa') || normalized.includes('코스타')) return 'costa';
  if (normalized.includes('msc')) return 'msc';
  if (normalized.includes('royal') || normalized.includes('로얄')) return 'royal';
  return normalized;
}

/**
 * SPIN 단계와 order, 선사 정보를 기반으로 적합한 영상을 선택하는 함수
 * - specificOrder가 정확히 일치하는 영상 우선 선택 (중복 방지)
 */
export function pickVideoByContext(
  order?: number,
  spinStage?: 'S' | 'P' | 'I' | 'N',
  cruiseLine?: string,
  questionText?: string
): ChatBotVideoEntry | undefined {
  if (!order) return undefined;

  const normalizedCruiseLine = normalizeCruiseLine(cruiseLine);

  // 1순위: specificOrder가 정확히 일치하는 영상 (선사 필터링 포함)
  let candidate = PURCHASE_CHATBOT_VIDEOS.find(video => {
    if (video.specificOrder !== order) return false;

    // 선사 필터링
    if (video.cruiseLines && normalizedCruiseLine) {
      const hasMatchingCruiseLine = video.cruiseLines.some(
        line => normalizeCruiseLine(line) === normalizedCruiseLine
      );
      return hasMatchingCruiseLine;
    }

    // 선사 제한이 없으면 바로 매칭
    if (!video.cruiseLines) return true;

    return false;
  });

  // 선사별 영상이 없으면 일반 영상 찾기
  if (!candidate) {
    candidate = PURCHASE_CHATBOT_VIDEOS.find(video => {
      if (video.specificOrder !== order) return false;
      return !video.cruiseLines; // 선사 제한이 없는 영상만
    });
  }

  // 2순위: 키워드 매칭 (specificOrder가 없는 영상만)
  if (!candidate && questionText) {
    const normalized = questionText.replace(/\s+/g, '').toLowerCase();
    candidate = PURCHASE_CHATBOT_VIDEOS.find(video => {
      // specificOrder가 있는 영상은 제외 (중복 방지)
      if (video.specificOrder) return false;

      return video.keywords?.some(keyword =>
        normalized.includes(keyword.replace(/\s+/g, '').toLowerCase())
      );
    });
  }

  return candidate;
}

/**
 * order 번호로 영상 선택 (기존 호환성 유지)
 */
export function pickVideoByOrder(order?: number): ChatBotVideoEntry | undefined {
  if (typeof order !== 'number') return undefined;
  return pickVideoByContext(order, undefined, undefined, undefined);
}

/**
 * 질문 텍스트의 키워드로 영상 선택
 */
export function pickVideoByQuestionText(text?: string): ChatBotVideoEntry | undefined {
  if (!text) return undefined;
  const normalized = text.replace(/\s+/g, '').toLowerCase();
  return PURCHASE_CHATBOT_VIDEOS.find((video) =>
    video.keywords?.some((keyword) => normalized.includes(keyword.replace(/\s+/g, '').toLowerCase()))
  );
}












