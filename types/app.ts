import * as React from 'react';

export type User = {
  id: string; // Prisma user.id is string
  name: string;
  phone?: string | null; // From SessionUser
  email?: string | null; // From SessionUser
  onboarded?: boolean; // From SessionUser
  hasTrip: boolean; // Derived for UI
  needOnboarding: boolean; // Derived for UI
};

export type Trip = {
  id: string; // From Prisma
  cruiseName: string;
  companionType: '친구' | '커플' | '가족' | '혼자'; // Specific union type for UI
  destination: string[]; // Expected as string[] by UI components
  startDate: string;
  endDate: string;
  nights: number;
  days: number;
  visitCount: number;
  createdAt?: string; // 추가: createdAt 필드
  updatedAt?: string; // 추가: updatedAt 필드
};

export type ChatMessage = {
  role: 'user' | 'bot'; // assistant 대신 bot 사용
  type?: 'text' | 'photos' | 'map-links' | 'custom';
  content: string; // text 대신 content 사용
  block?: 'navigation' | 'goAnywhere' | 'help' | 'error'; // 블록 타입 추가
  navigation?: { from: string; to: string }; // navigation 블록용 데이터
  isError?: boolean; // 오류 메시지 여부
};
