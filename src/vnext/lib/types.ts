export type ChatInputMode = 'go'|'show'|'general';
export type SItem = { id: string; label: string; subtitle?: string };
export type FromCoords = { lat:number; lng:number; label?:string };

export type ChatMessageLink = { label: string; href: string };

export type ChatMessage =
  | { id?:string; role:'user'|'assistant'; text:string }
  | { id?:string; role:'assistant'; type:'map-links'; title?:string; links:ChatMessageLink[]; note?:string }
  | { id?:string; role:'assistant'; type:'photo-gallery'; title?:string; images:string[] };
