// src/lib/types.ts — 호환 타입(레거시 + 신규)
export type LinkBtn = { label: string; href: string };

export type TextMessage = {
  type: 'text'; // 'type'을 필수로 변경
  id: string; // 'id' 필수로 추가
  role: 'user' | 'assistant'; // 'role' 필수로 추가
  text: string;
  createdAt?: Date | string;
};

export type MapLinksMessage = {
  type: 'map-links' | 'mapLinks'; // 'type'을 필수로 변경
  id: string; // 'id' 필수로 추가
  role: 'assistant'; // 'role' 필수로 추가
  title?: string;
  links: LinkBtn[];
  note?: string;
};

export type PhotoGalleryMessage = {
  type: 'photo-gallery' | 'photoGallery' | 'photos'; // 'type'을 필수로 변경
  id: string; // 'id' 필수로 추가
  role: 'assistant'; // 'role' 필수로 추가
  title?: string;
  images: string[];
};

export type GoActionsMessage = {
  type: 'go-actions' | 'goActions'; // 'type'을 필수로 변경
  id: string; // 'id' 필수로 추가
  role: 'assistant'; // 'role' 필수로 추가
  originText?: string;
  destText?: string;
  urls?: { driving?: string; transit?: string; map?: string };
};

export type ChatMessage =
  | TextMessage
  | MapLinksMessage
  | PhotoGalleryMessage
  | GoActionsMessage
  // 마지막 폴백: 레거시 커스텀 필드가 있어도 컴파일만 지나가게
  | (Record<string, any> & { type?: string; id?: string; role?: string; createdAt?: Date | string }); // 폴백에도 id, role, createdAt 추가

export type ChatMessages = ChatMessage[];
