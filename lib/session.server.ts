// lib/session.server.ts
import 'server-only';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'cg.sid.v2';
export type Session = { userId: string } | null;

export async function getSession(): Promise<Session> {
  const cookieStore = await cookies();
  const c = cookieStore.get(SESSION_COOKIE)?.value;
  if (!c) return null;
  try {
    const parsed = JSON.parse(Buffer.from(c, 'base64').toString('utf8'));
    if (parsed?.userId) return { userId: String(parsed.userId) };
  } catch {}
  return null;
}
