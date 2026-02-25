import type { ChatMessage, MapLinksMessage } from '@/lib/chat-types';
import { gmapSearch } from '@/vnext/lib/nav/urls';

export async function handleNearby(text: string, keyword: string): Promise<ChatMessage[]> {
  const responseMessages: ChatMessage[] = [];

  if (keyword) {
    responseMessages.push({
      type: 'text',
      id: Math.random().toString(36).substring(7),
      role: 'assistant',
      text: `현재 위치 주변 '${keyword}'을 찾고 있어요!`
    });
    responseMessages.push({
      type: 'map-links',
      id: Math.random().toString(36).substring(7),
      role: 'assistant',
      title: '바로 검색',
      links: [
        { label: `🔍 ${keyword} 근처`, href: gmapSearch(keyword), kind: 'poi' },
      ],
    } as MapLinksMessage);
    responseMessages.push({
      type: 'text',
      id: Math.random().toString(36).substring(7),
      role: 'assistant',
      text: '실시간 소요시간·영업시간은 링크에서 자동 갱신됩니다.'
    });
  } else {
    responseMessages.push({
      type: 'text',
      id: Math.random().toString(36).substring(7),
      role: 'assistant',
      text: '어떤 장소를 찾으시는지 알려주세요. (예: 근처 스타벅스, 주변 편의점)'
    });
  }

  return responseMessages;
}
