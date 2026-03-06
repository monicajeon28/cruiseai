import { NextResponse } from 'next/server';
import { askGemini } from '@/lib/gemini';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const messages = (body?.messages ?? []) as { role: 'user' | 'assistant' | 'system'; content: string }[];

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ ok: false, error: 'messages required' }, { status: 400 });
    }
    if (messages.length > 100) {
      return NextResponse.json({ ok: false, error: '메시지가 너무 많습니다.' }, { status: 400 });
    }
    for (const m of messages) {
      if (typeof m.content === 'string' && m.content.length > 2000) {
        return NextResponse.json({ ok: false, error: '메시지가 너무 깁니다.' }, { status: 400 });
      }
    }

    const result = await askGemini(messages, body?.temperature ?? 0.7);
    return NextResponse.json({ ok: true, text: result.text });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'AI 요청 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
