import type { ChatMessage } from '@/lib/chat-types';
import { buildSearchUrl } from '@/lib/maps';

export function handleNearby(term = '스타벅스'): ChatMessage[] {
  return [
    {
      id: Date.now().toString() + '-1',
      role: 'assistant',
      type: 'text',
      text: `현재 위치 기준으로 **${term}** 찾기를 준비했습니다.`
    },
    {
      id: Date.now().toString() + '-2',
      role: 'assistant',
      type: 'map-links',
      links: [
        { label: `🔎 ${term} 검색`, href: buildSearchUrl(term), kind: 'search' },
      ]
    },
    {
      id: Date.now().toString() + '-3',
      role: 'assistant',
      type: 'text',
      text: '버튼을 누르면 새 창에서 주변 결과가 열립니다.'
    }
  ];
} 