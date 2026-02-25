export const dynamic = 'force-dynamic';

// Edge runtime 제거 - Prisma 사용을 위해 Node.js runtime 사용
// export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { resolveGeminiModelName } from '@/lib/ai/geminiModel';
import {
  detectAdvisorType,
  getAdvisorPrompt,
  getAdvisorName,
  DISCLAIMER,
  type AdvisorType
} from '@/lib/prompts/legal-advisor';

export async function POST(req: Request) {
  try {
    const { prompt, useAdvisor, context } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    const model = resolveGeminiModelName();

    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY missing' }, { status: 500 });
    }
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ ok: false, error: 'prompt required' }, { status: 400 });
    }

    // AI 고문 모드 처리
    if (useAdvisor) {
      const advisorType = detectAdvisorType(prompt);
      const advisorPrompt = getAdvisorPrompt(advisorType);
      const advisorName = getAdvisorName(advisorType);

      const fullPrompt = `${advisorPrompt}

${context ? `**추가 컨텍스트:**\n${context}\n\n` : ''}**질문:**
${prompt}

**${advisorName} 답변:**`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.3, // 더 정확한 답변을 위해 낮은 온도
            topP: 0.9,
            maxOutputTokens: 2048,
            topK: 40,
          },
        }),
      });

      const data = await res.json();

      if (data.error) {
        console.error('[API /ask] Advisor mode - Gemini API error:', data.error);
        return NextResponse.json(
          { ok: false, error: data.error.message || 'AI 고문 응답 생성 중 오류가 발생했습니다' },
          { status: 500 }
        );
      }

      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
        '죄송해요. 답변을 생성하지 못했어요. 다시 시도해주세요.';

      // 면책 조항 추가
      const answerWithDisclaimer = `${text}\n${DISCLAIMER}`;

      return NextResponse.json({
        ok: true,
        text: answerWithDisclaimer,
        answer: answerWithDisclaimer,
        advisorType,
        advisorName,
      });
    }

    // 사용자 정보 및 여행 정보 가져오기
    let userContext = '';
    const user = await getSessionUser();
    if (user) {
      const latestTrip = await prisma.trip.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        select: {
          cruiseName: true,
          destination: true,
          startDate: true,
          endDate: true,
          status: true,
        },
      });

      if (latestTrip) {
        const destinations = Array.isArray(latestTrip.destination)
          ? latestTrip.destination.join(', ')
          : typeof latestTrip.destination === 'string'
          ? latestTrip.destination
          : '';

        userContext = `\n\n[사용자 여행 정보]
- 크루즈명: ${latestTrip.cruiseName || '미정'}
- 목적지: ${destinations || '미정'}
- 여행 상태: ${latestTrip.status === 'InProgress' ? '여행 중' : latestTrip.status === 'Upcoming' ? '출발 예정' : '종료'}
`;
        
        if (latestTrip.startDate && latestTrip.endDate) {
          const startDate = new Date(latestTrip.startDate).toLocaleDateString('ko-KR');
          const endDate = new Date(latestTrip.endDate).toLocaleDateString('ko-KR');
          userContext += `- 여행 기간: ${startDate} ~ ${endDate}\n`;
        }
      }
    }

    // 향상된 시스템 프롬프트
    const systemPrompt = `당신은 "크루즈닷AI"라는 이름의 크루즈 여행 전문 AI 어시스턴트입니다.

**역할과 목표:**
- 크루즈 여행에 대한 전문적인 조언과 정보를 제공합니다
- 사용자의 질문에 명확하고 구체적으로 답변합니다
- 한국어로 친절하고 자연스러운 말투로 대화합니다
- 크루즈 여행, 항구, 목적지, 선박, 여행 팁 등에 대해 정확한 정보를 제공합니다

**답변 원칙:**
1. 질문의 핵심을 정확히 파악하여 직접적이고 명확하게 답변합니다
2. 불확실한 정보는 추측하지 않고, 정확한 정보만 제공합니다
3. 필요한 경우 구체적인 예시나 단계별 안내를 제공합니다
4. 사용자의 여행 정보가 있으면 이를 참고하여 개인화된 답변을 제공합니다
5. 답변이 길어지면 핵심을 먼저 전달하고 상세 정보는 이어서 제공합니다

**응답 형식:**
- 간결하고 읽기 쉽게 작성합니다
- 필요한 경우 번호나 불릿 포인트를 사용합니다
- 이모지는 적절히 사용하여 친근함을 더합니다`;

    // 프롬프트 구성: 시스템 프롬프트 + 사용자 컨텍스트 + 사용자 질문
    const fullPrompt = `${systemPrompt}${userContext}

**사용자 질문:**
${prompt}

**답변:**`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: 0.7, // 창의성과 정확성의 균형
          topP: 0.95,
          maxOutputTokens: 2048, // 더 긴 답변 가능
          topK: 40,
        },
      }),
    });

    const data = await res.json();

    // 에러 처리
    if (data.error) {
      console.error('[API /ask] Gemini API error:', data.error);
      return NextResponse.json(
        { ok: false, error: data.error.message || 'AI 응답 생성 중 오류가 발생했습니다' },
        { status: 500 }
      );
    }

    // 응답 추출
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType ||
      '죄송해요. 답변을 생성하지 못했어요. 다시 시도해주세요.';

    // text와 answer 둘 다 반환하여 호환성 유지
    return NextResponse.json({ ok: true, text, answer: text });
  } catch (e: any) {
    console.error('[API /ask] Error:', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
