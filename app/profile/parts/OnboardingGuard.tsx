import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/session'; // Corrected import
import prisma from '@/lib/prisma';

export default async function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const userId = await getSessionUserId(); // Use getSessionUserId

  if (!userId) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    redirect('/login'); // User not found, redirect to login
  }

  // 현재 스키마에 requireOnboarding 필드가 없으므로, 이 로직은 일시적으로 제거합니다.
  // if (user.requireOnboarding) {
  //   redirect('/onboarding');
  // }

  return <>{children}</>;
}
