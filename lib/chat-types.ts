export type Button = { text: string; value?: string };
export type TextMessage = {
  type: 'text';
  id: string; // id 속성 추가
  role: 'user' | 'assistant'; // role 속성 추가
  text: string;
  chips?: { label: string; payload: string }[]; // chips 속성 추가
  createdAt?: Date; // createdAt 속성 추가
};
export type MapLinksMessage = {
  type: 'map-links';
  id: string; // id 속성 추가
  role: 'user' | 'assistant'; // role 속성 추가
  title?: string;
  links: Array<{ label: string; href: string; kind: string; }>; // kind 속성 추가
  note?: string;
  createdAt?: Date; // createdAt 속성 추가
  ports?: { id: string; name: string; name_ko?: string; lat: number; lng: number; city?: string; country?: string; }[]; // 추가
};
export type PhotosMessage = {
  type: 'photos';
  id: string; // id 속성 추가
  role: 'user' | 'assistant'; // role 속성 추가
  title?: string;
  photos: Array<{ url: string; alt?: string }>;
  createdAt?: Date; // createdAt 속성 추가
};
export type PhotoGalleryMessage = {
  type: 'photo-gallery';
  id: string; // id 속성 추가
  role: 'user' | 'assistant'; // role 속성 추가
  title?: string;
  images: string[];
  createdAt?: Date; // createdAt 속성 추가
};
export type GoActionsMessage = {
  type: 'go-actions';
  id: string; // id 속성 추가
  role: 'user' | 'assistant'; // role 속성 추가
  originText: string;
  destText: string;
  urls: { transit: string; driving: string; walking: string };
  createdAt?: Date; // createdAt 속성 추가
};
export type ShowMeMessage = {
  type: 'show-me';
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  query: string;
  googleImageUrl: string;
  cruisePhotos?: Array<{ url: string; title?: string; tags?: string[] }>;
  categories?: Array<{ name: string; displayName: string; icon?: string }>;
  subfolders?: Array<{ name: string; displayName: string; icon: string; photoCount: number }>;
  googleImagesOnly?: boolean;
  createdAt?: Date;
};
export type ChatMessage = TextMessage | MapLinksMessage | PhotosMessage | PhotoGalleryMessage | GoActionsMessage | ShowMeMessage;


