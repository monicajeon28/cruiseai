export type User = {
  id: string; // id를 string으로 변경
  name?: string | null;
  phone?: string | null;
  hasTrip?: boolean;
  needOnboarding?: boolean;
};

export type Trip = {
  id: string;
  cruiseName?: string;
  companionType?: '친구' | '커플' | '가족' | '혼자' | string;
  destination: string[]; // string | string[] | null 에서 string[]으로 변경
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  nights?: number;
  days?: number;
  visitCount?: number;
  user?: User | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ChatMessageButton = { label: string; onClick: () => void };
export type ChatMessageLink = { label: string; href: string; color: string; emoji: string };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  jsx?: React.ReactNode;
  buttons?: ChatMessageButton[];
  links?: ChatMessageLink[];
  createdAt?: Date;
}

export type SItem = { id: string; label: string; subtitle?: string };
export type FromCoords = { lat: number; lng: number; label?: string };

// For ChatInputBar
export type ChatInputMode = 'go' | 'show' | 'general' | 'info' | 'translate' | 'free';
export type ChatInputPayload = {
  mode: ChatInputMode;
  text: string;
  files?: File[];
  origin?: string;
  dest?: string;
  fromPick?: SItem;
  toPick?: SItem;
  fromCoords?: FromCoords;
};

