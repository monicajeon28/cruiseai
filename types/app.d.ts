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
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  type?: 'text' | 'photos' | 'map-links' | 'custom';
  text?: string;
  node?: React.ReactNode;
};
