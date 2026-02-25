import type { ChatMessage, PhotoGalleryMessage, MapLinksMessage } from '@/lib/chat-types';
import { gmapDir, gmapSearch } from '@/vnext/lib/nav/urls';

export async function handleTaiwanNav(text: string): Promise<ChatMessage[]> {
  const responseMessages: ChatMessage[] = [];

  if (text.includes('타이베이') || text.includes('타이완') || text.includes('대만')) {
    responseMessages.push({
      id: Math.random().toString(36).substring(7),
      role: 'assistant',
      type: 'text',
      text: '타이완 관련 길찾기 정보를 찾고 있어요!'
    });

    const taipei101 = '타이베이 101'
    const taoyuanAirport = '타오위안 국제공항'
    const keelungPort = '지룽항 크루즈 터미널'

    responseMessages.push({
      id: Math.random().toString(36).substring(7),
      role: 'assistant',
      type: 'map-links',
      title: '타이완 주요 지점',
      links: [
        { label: `🏙️ ${taipei101} 찾아가기`, href: gmapSearch(taipei101), kind: 'poi' },
        { label: `✈️ ${taoyuanAirport} 가는 길`, href: gmapSearch(taoyuanAirport), kind: 'poi' },
        { label: `🚢 ${keelungPort} 위치`, href: gmapSearch(keelungPort), kind: 'poi' },
        { label: `🚏 ${taoyuanAirport} ↔ ${keelungPort} 대중교통`, href: gmapDir(taoyuanAirport, keelungPort, 'transit'), kind: 'directions' },
        { label: `🚗 ${taoyuanAirport} ↔ ${keelungPort} 자동차`, href: gmapDir(taoyuanAirport, keelungPort, 'driving'), kind: 'directions' },
      ],
    } as MapLinksMessage);

    responseMessages.push({
      id: Math.random().toString(36).substring(7),
      role: 'assistant',
      type: 'text',
      text: '실시간 소요시간·영업시간은 링크에서 자동 갱신됩니다.'
    });

  } else {
    responseMessages.push({
      id: Math.random().toString(36).substring(7),
      role: 'assistant',
      type: 'text',
      text: '죄송해요, 타이완 관련 길찾기 정보를 찾을 수 없었어요. 다른 검색어를 시도해 보시겠어요?'
    });
  }

  return responseMessages;
}
