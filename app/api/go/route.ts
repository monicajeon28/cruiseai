export const dynamic = 'force-dynamic';

// app/api/go/route.ts
import { NextResponse } from 'next/server';
export async function GET(req:Request){
  const { searchParams } = new URL(req.url);
  const u = searchParams.get('u');
  if (!u) return NextResponse.json({error:'missing u'}, {status:400});
  return NextResponse.redirect(u, 302);
} 
