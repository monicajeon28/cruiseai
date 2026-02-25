export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  const u = await getSessionUser();
  return NextResponse.json({ user: u });
}
