export const dynamic = 'force-dynamic';

// app/api/session/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/(server)/session';

export async function GET() {
  const s = await getServerSession();
  return NextResponse.json(s); // { userId } | null
}
