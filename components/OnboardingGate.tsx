'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingGate({ userId }: { userId: number }) {
  const router = useRouter();
  useEffect(() => {
    const flag = localStorage.getItem(`onboarding_done__${userId}`);
    if (flag !== 'true') router.replace('/onboarding');
  }, [userId, router]);
  return null;
}
