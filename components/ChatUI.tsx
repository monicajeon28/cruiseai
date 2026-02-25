'use client';

import { useState, useRef, useEffect, useMemo } from 'react'; // useMemo 추가
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

import { ChatInputMode, Trip } from '@/lib/types';
import { UserSession } from '../src/lib/auth'; // UserSession import
import { toDestArray } from '@/lib/normalize';

// 실제 컴포넌트 임포트
import GoAnywhere from '@/app/chat/components/blocks/GoAnywhere';
import PhotoAlbum from '@/app/chat/components/blocks/PhotoAlbum';

// PhotoAlbumProps 타입 정의 (PhotoAlbum.tsx에서 가져온 타입)
import type { PhotoAlbumProps } from '@/app/chat/components/blocks/PhotoAlbum';

type ChatMessage = {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  type?: 'text' | 'map-links' | 'photos' | 'photo-gallery';
  text?: string;
  title?: string;
  links?: any[]; // links 타입 any[]로 변경
  images?: { url: string; title?: string }[];
  chips?: { label: string; payload: string }[];
};

type Props = {
  mode: ChatInputMode;
  initialMessages: ChatMessage[]; // initialMessages prop 추가, 타입 변경
  user: UserSession;             // user prop 추가
  lastTrip?: Trip;
  photoAlbumProps: PhotoAlbumProps; // PhotoAlbumProps 추가
};

const mid = () => Math.random().toString(36).slice(2);

export default function ChatUI({ mode, initialMessages: _initialMessages, user, lastTrip, photoAlbumProps }: Props) {
  const router = useRouter();
  const initialMessages: ChatMessage[] = Array.isArray(_initialMessages) ? _initialMessages : []; // 항상 배열로 보정
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages); // messages 상태 초기값을 initialMessages로 설정
  const trip = lastTrip;

  const [photoItems, setPhotoItems] = useState<Array<{ url: string; title?: string; tags?: string[] }>>(photoAlbumProps.items || []);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);

  // 'show' 모드일 때 query가 있으면 사진 검색
  useEffect(() => {
    if (mode === 'show' && photoAlbumProps.query && photoAlbumProps.query.trim()) {
      setIsLoadingPhotos(true);
      fetch(`/api/photos?q=${encodeURIComponent(photoAlbumProps.query)}`)
        .then(res => res.json())
        .then(data => {
          if (data.items && Array.isArray(data.items)) {
            setPhotoItems(data.items);
          }
        })
        .catch(err => {
          console.error('Failed to load photos:', err);
        })
        .finally(() => {
          setIsLoadingPhotos(false);
        });
    }
  }, [mode, photoAlbumProps.query]);

  if (mode === 'show') {
    if (isLoadingPhotos) {
      return (
        <div className="p-8 text-center">
          <div className="text-lg">사진을 불러오는 중...</div>
        </div>
      );
    }
    return <PhotoAlbum {...photoAlbumProps} items={photoItems} />;
  }

  if (mode === 'go') {
    return <GoAnywhere />;
  }

  return (
    <div className="p-4 space-y-3">
      {trip && (
        <div className="rounded-md border p-3 text-sm">
          <div className="font-medium">등록된 여행</div>
          <div>
            🚢 {trip.cruiseName ?? ''} ❤️ {Array.isArray(trip?.destination) ? trip.destination.join(', ') : (trip?.destination ?? '')}
          </div>
          <div>
            {(typeof trip?.startDate === 'string' ? trip.startDate.slice(0, 10) : '')} ~ {(typeof trip?.endDate === 'string' ? trip.endDate.slice(0, 10) : '')}
          </div>
        </div>
      )}
      {messages.map((m,i)=>( 
        <div key={m.id || i} className="rounded-md border p-3">
          {m.text}
        </div>
      ))}
    </div>
  );
} 