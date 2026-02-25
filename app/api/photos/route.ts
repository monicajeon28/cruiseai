import { NextResponse } from 'next/server';
import { searchPhotos } from '@/lib/photos-search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();

  if (!q) {
    return NextResponse.json({ items: [] });
  }

  const result = await searchPhotos(q);
  return NextResponse.json(result);
}
