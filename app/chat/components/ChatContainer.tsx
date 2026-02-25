'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ModeBar from './ModeBar';
import ChatUI from '@/components/ChatUI';
import ChatInputBar from '@/components/ChatInputBar';
import type { ChatInputMode, ChatInputPayload, Trip } from '@/lib/types';
import { csrfFetch } from '@/lib/csrf-client';
// import type { Item as PhotoAlbumItem } from '@/app/chat/components/blocks/PhotoAlbum'; // PhotoAlbumItem 타입 임포트 (더 이상 필요 없음)

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  type?: 'text' | 'map-links' | 'photos' | 'photo-gallery';
  text?: string;
  title?: string;
  links?: { label: string; href: string }[];
  images?: { url: string; title?: string }[];
  chips?: { label: string; payload: string }[];
}

type ChatContainerProps = {
  // mediaAliases: { aliases: Record<string, string[]>; }; // mediaAliases prop 제거
  user: any;             // user prop 추가
  trip: Trip | null;             // trip prop 추가
  // initialMessages: ChatMessage[]; // initialMessages prop 제거
};

export default function ChatContainer({ user, trip }: ChatContainerProps) {
  const router = useRouter();
  const [mode, setMode] = useState<ChatInputMode>('general'); // 초기 모드를 'general'로 설정
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: String(Date.now()),
      role: 'assistant',
      type: 'text',
      text: `안녕하세요! ${user.name ?? ''}님. 무엇을 도와드릴까요?\n상단에서 모드를 선택해 주세요.\n• 크루즈닷 가자: 길찾기/지도/근처검색\n• 크루즈닷 보여줘: 여행지/선박/자료 사진\n• 일반: 무엇이든 물어보세요`,
    },
  ]);
  // const [trip, setTrip] = useState<Trip | null>(null); // trip prop으로 받으므로 제거

  // PhotoAlbum에 전달할 items 데이터 가공 (mediaAliases prop이 제거되었으므로 이 로직도 제거)
  // const photoAlbumItems: PhotoAlbumItem[] = useMemo(() => {
  //   const items: PhotoAlbumItem[] = [];
  //   Object.keys(mediaAliases.aliases).forEach(aliasKey => {
  //       items.push({ url: `/images/cruise/${aliasKey}.jpg`, title: aliasKey });
  //   });
  //   return items;
  // }, [mediaAliases]);

  // PhotoAlbum 컴포넌트는 이제 자체적으로 ImageViewerModal을 관리합니다

  // useEffect 훅 전체 제거 (서버 컴포넌트에서 데이터 페칭 및 초기 메시지 생성)
  // useEffect(() => {
  //   const checkAuthAndData = async () => {
  //     const tripRes = await fetch('/api/trips');
  //     const tripData = await tripRes.json();

  //     if (!user.onboarded || !tripRes.ok || !tripData.ok || !Array.isArray(tripData.trips) || tripData.trips.length === 0) {
  //       router.push('/onboarding');
  //       return;
  //     }

  //     const sortedTrips = [...tripData.trips].sort((a: Trip, b: Trip) => {
  //       const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
  //       const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
  //       return dateB - dateA;
  //     });
  //     setTrip(sortedTrips[0]);
  //   };
  //   checkAuthAndData();
  // }, [router, user.onboarded]);

  // ChatContainer는 더 이상 사용되지 않음 - ChatClientShell에서 처리

  const handleSubmit = async (payload: ChatInputPayload) => {
    let userMessageText = '';
    if (payload.mode === 'go') {
      userMessageText = `출발지: ${payload.origin || '미지정'}, 도착지: ${payload.dest || '미지정'}`;
    } else {
      userMessageText = payload.text || '';
    }

    setMessages((prev) => [...prev, { id: String(Date.now()), role: 'user', type: 'text', text: userMessageText }]);

    if (payload.mode === 'general') {
      const res = await csrfFetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: payload.text }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessages((prev) => [...prev, { id: String(Date.now() + 1), role: 'assistant', type: 'text', text: data.text }]);
      }
    } else if (payload.mode === 'go') {
      // 'go' 모드일 때 지도 링크 API 호출 및 메시지에 추가
      // 이 부분은 /api/chat/route.ts에서 처리될 것으로 예상되므로, 여기서는 더미 응답을 가정합니다.
      const goResponse = {
        ok: true,
        links: [
          { label: '자동차 경로', href: 'https://maps.google.com/?daddr=destination&dirflg=d' },
          { label: '대중교통 경로', href: 'https://maps.google.com/?daddr=destination&dirflg=r' },
        ],
        title: `[${payload.mode}] 길찾기/지도 요청 결과`,
        text: `출발지: ${payload.origin || '미지정'}, 도착지: ${payload.dest || '미지정'}`,
      };

      setMessages((prev) => [...prev, { 
        id: String(Date.now() + 1),
        role: 'assistant',
        type: 'map-links',
        title: goResponse.title,
        text: goResponse.text,
        links: goResponse.links,
      }]);
    } else if (payload.mode === 'show') {
      setMessages((prev) => [...prev, { id: String(Date.now() + 1), role: 'assistant', type: 'text', text: `[${payload.mode}] 사진/앨범 요청 접수: "${payload.text}"` }]);
    }
  };

  // 마지막 사용자 메시지에서 query 추출
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  const photoQuery = mode === 'show' && lastUserMessage ? lastUserMessage.text : undefined;

  return (
    <div className="flex h-full flex-col">
      <ModeBar mode={mode} onChangeTab={setMode} />
      <div className="flex-1 overflow-y-auto">
        <ChatUI
          mode={mode}
          initialMessages={messages} // initialMessages prop으로 내부 messages 상태 전달
          user={user}
          lastTrip={trip ?? undefined}
          // PhotoAlbum에 필요한 props 전달
          photoAlbumProps={{
            items: [],
            query: photoQuery,
          }}
          // GoAnywhere에 필요한 props는 ChatUI 내부에서 messages를 파싱하여 생성
        />
      </div>
      <ChatInputBar
        mode={mode}
        onChangeMode={setMode}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
