import { resolveFromTo, buildAllDirUrls } from '@/lib/maps';
import type { ChatMessage } from '@/lib/chat-types';

export function handleDirections(text: string): ChatMessage[] {
  const parsed = resolveFromTo(text);

  if (!parsed) {
    return [{
      id: Date.now().toString(),
      role: 'assistant',
      type: 'text',
      text: '입력 형식을 확인해 주세요.\n\n✅ 지원되는 형식:\n• "A에서 B까지"\n• "A부터 B까지"\n• "A → B" (화살표)\n• "A to B" (영어)\n• "마이애미" (지명만 입력 시 공항→터미널 자동 추론)\n\n📝 예시:\n• "홍콩 공항에서 카이탁 터미널까지"\n• "마이애미 공항 → 마이애미 크루즈 터미널"\n• "마이애미" (자동으로 공항→터미널 경로 찾기)'
    }];
  }

  const { origin, dest, originText, destText } = parsed;
  const urls = buildAllDirUrls(origin, dest);

  return [
    {
      id: Date.now().toString() + '-1',
      role: 'assistant',
      type: 'text',
      text: `확인했어요.\n출발지: ${originText}\n도착지: ${destText}`
    },
    {
      id: Date.now().toString() + '-2',
      role: 'assistant',
      type: 'map-links',
      title: '길찾기',
      links: [
        { label: '🚗 자동차 길찾기', href: urls.driving, kind: 'directions' },
        { label: '🚇 대중교통 길찾기', href: urls.transit, kind: 'directions' },
        { label: '🚶 도보 길찾기', href: urls.walking, kind: 'directions' },
      ],
    },
    {
      id: Date.now().toString() + '-3',
      role: 'assistant',
      type: 'text',
      text: '새 창에서 열려요. 지도에서 **시작**만 누르시면 됩니다.'
    }
  ];
}
