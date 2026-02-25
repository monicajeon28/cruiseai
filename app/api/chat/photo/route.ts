export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveGeminiModelName } from '@/lib/ai/geminiModel';

export const runtime = 'nodejs';   // edge 금지 (Prisma/라이브러리 충돌 방지)

export async function POST(req: Request) {
  const form = await req.formData();
  const question = String(form.get('question') || '');
  const file = form.get('image') as File | null;

  if (!file) {
    return NextResponse.json({ ok:false, messages:[{type:'text', text:'이미지를 찾을 수 없어요.'}]}, { status:400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const b64 = bytes.toString('base64');

  try {
    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const modelName = resolveGeminiModelName();
    const model = genai.getGenerativeModel({ model: modelName });

    const prompt = question ? `이미지에 대해 다음을 알려줘: ${question}` : '이 사진을 이해하기 쉽게 설명해줘.';
    const result = await model.generateContent([
      { inlineData: { data: b64, mimeType: file.type || 'image/jpeg' } },
      { text: prompt }
    ]);
    const text = result.response.text();

    return NextResponse.json({
      ok: true,
      messages: [{ type:'text', text }]
    });

  } catch (e:any) {
    console.error(e);
    return NextResponse.json({
      ok:false,
      messages:[{ type:'text', text:'이미지 분석 중 오류가 발생했어요.' }]
    }, { status:500 });
  }
}
