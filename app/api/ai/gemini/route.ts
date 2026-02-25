import { NextResponse } from 'next/server';
import { askGemini } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(()=> ({}));
    const messages = (body?.messages ?? []) as {role:'user'|'assistant'|'system', content:string}[];

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ ok:false, error:'messages required' }, { status:400 });
    }

    const result = await askGemini(messages, body?.temperature ?? 0.7);
    // askGemini returns { text: string }, extract the text value
    return NextResponse.json({ ok:true, text: result.text });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message || 'AI error' }, { status:500 });
  }
}
