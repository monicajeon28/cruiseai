'use client';

import { createContext, useContext, ReactNode } from 'react';

interface Trip {
  cruiseName: string;
  destination: string[];
  startDate: string; endDate: string;
  nights?: number; days?: number;
  country?: string; // 추가: 여행 국가 정보
}

interface ChatContextType {
  trip: Trip | null;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children, trip }: { children: ReactNode; trip: Trip | null }) {
  return (
    <ChatContext.Provider value={{ trip }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useTrip() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useTrip must be used within a ChatProvider');
  }
  return context.trip;
}





