export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { resolveGeminiModelName } from '@/lib/ai/geminiModel';

export async function POST(req: Request) {
  const { q } = await req.json();

  if (!q) return NextResponse.json({ answer: '질문을 입력해주세요.' }, { status: 400 });

  const API_KEY = process.env.GEMINI_API_KEY;

  // 키 없으면 바로 더미로
  if (!API_KEY) {
    return NextResponse.json({
      answer: `요청하신 "<b>${q}</b>"에 대한 답변을 준비 중입니다. (임시 응답)`,
    });
  }

  try {
    // Gemini 2.5 모델 사용 (1.5는 더 이상 존재하지 않음)
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genai = new GoogleGenerativeAI(API_KEY);
    const modelName = resolveGeminiModelName();
    const model = genai.getGenerativeModel({ model: modelName });

    const resp = await model.generateContent(q);
    const text = resp.response.text?.() ?? '답변을 생성하지 못했어요.';
    return NextResponse.json({ answer: text });
  } catch (e: any) {
    // 호출 실패 시에도 500 대신 사용자 친화적 더미
    return NextResponse.json({
      answer: `요청하신 "<b>${q}</b>"에 대한 답변을 준비 중입니다. (API 연결 준비 중)`,
      error: e?.message,
    });
  }
}
