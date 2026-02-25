// app/(server)/session.ts
import 'server-only';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

export const SESSION_COOKIE = 'cg.sid.v2';

export async function getServerSession(): Promise<{ userId: number } | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  // 데이터베이스에서 세션 조회
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true, expiresAt: true },
    });

    // 세션이 없거나 만료된 경우
    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    return { userId: session.userId };
  } catch (error) {
    console.error('[getServerSession] Error:', error);
    return null;
  }
}
