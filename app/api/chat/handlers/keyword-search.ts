import { gmSearchUrl } from '@/lib/maps';
import { extractSearchKeyword, parseOriginDestination } from '@/app/api/chat/detect';
import type { ChatMessage } from '@/lib/chat-types';

export function handleKeywordSearch(text: string, from?: string, to?: string): ChatMessage[] {
  // 키워드 추출
  const keyword = extractSearchKeyword(text);
  if (!keyword) {
    return [{
      id: Date.now().toString(),
      role: 'assistant',
      type: 'text',
      text: '키워드를 찾을 수 없습니다. 맛집, 관광지, 카페 등을 입력해 주세요.'
    }];
  }

  // 출발지 추출 (from 파라미터 우선, 없으면 text에서 파싱)
  let location = from;
  if (!location) {
    const parsed = parseOriginDestination(text);
    location = parsed.originText || '현재 위치';
  }

  // 검색 쿼리 생성
  // 예: "홍콩 맛집" 또는 "맛집 near 홍콩"
  const searchQuery = location && location !== '현재 위치'
    ? `${location} ${keyword}`
    : keyword;

  const searchUrl = gmSearchUrl(searchQuery);

  // 키워드 한글 표시 (영어 키워드를 한글로 변환)
  const keywordDisplay = keyword === 'restaurant' || keyword === 'food' || keyword === 'dining' ? '맛집' :
    keyword === 'cafe' || keyword === 'coffee' ? '카페' :
      keyword === 'tourist' || keyword === 'attraction' || keyword === 'sightseeing' ? '관광지' :
        keyword === 'bank' ? '은행' :
          keyword === 'hospital' || keyword === 'clinic' ? '병원' :
            keyword === 'gas station' || keyword === 'gasoline' ? '주유소' :
              keyword === 'supermarket' || keyword === 'grocery' ? '마트' :
                keyword === 'pharmacy' || keyword === 'drugstore' ? '약국' :
                  keyword === 'hotel' ? '호텔' :
                    keyword;

  return [
    {
      id: Date.now().toString() + '-1',
      role: 'assistant',
      type: 'text',
      text: `${location} 근처 **${keywordDisplay}** 검색 결과를 준비했습니다.`
    },
    {
      id: Date.now().toString() + '-2',
      role: 'assistant',
      type: 'map-links',
      title: `주변 ${keywordDisplay} 검색`,
      links: [
        {
          label: `🔎 ${location} 근처 ${keywordDisplay} 찾기`,
          href: searchUrl,
          kind: 'search'
        },
      ],
    },
    {
      id: Date.now().toString() + '-3',
      role: 'assistant',
      type: 'text',
      text: '버튼을 누르면 새 창에서 주변 검색 결과가 열립니다. 지도에서 여러 결과를 확인할 수 있어요.'
    }
  ];
}


