export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { resolveGeminiModelName } from '@/lib/ai/geminiModel';

/**
 * 외국어 텍스트를 한국어 발음으로 변환하는 API
 * 예: "Grazie" → "그라지에", "ありがとうございます" → "아리가토 고자이마스"
 */
export async function POST(req: NextRequest) {
  try {
    const { text, langCode }: { text: string; langCode: string } = await req.json();
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ ok: false, error: 'text required' }, { status: 400 });
    }
    
    // 한국어인 경우 발음 불필요
    if (langCode === 'ko-KR' || langCode === 'ko') {
      return NextResponse.json({ ok: true, pronunciation: text });
    }
    
    // Gemini API를 사용하여 발음 생성
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_MODEL = resolveGeminiModelName();
    
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY missing' }, { status: 500 });
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    
    const prompt = `Convert the following ${langCode} text to Korean phonetic pronunciation (한글 발음).

Text: "${text}"

IMPORTANT:
- Return ONLY the Korean pronunciation text inside parentheses
- Do NOT include any explanations, comments, or additional text
- Do NOT include the original text
- Format: (한글발음)

Examples:
- Input: "Grazie" → Output: "(그라지에)"
- Input: "ありがとうございます" → Output: "(아리가토 고자이마스)"
- Input: "Thank you" → Output: "(땡큐)"
- Input: "I am hungry" → Output: "(아이 엠 헝그리)"

Now convert: "${text}"`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 100 },
      }),
      cache: 'no-store',
    });
    
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[Pronunciation API] Gemini full response:', JSON.stringify(data, null, 2));
    
    let pronunciation = '';
    
    // Gemini 응답 구조 확인 (다양한 경우 처리)
    if (!data || !data.candidates || data.candidates.length === 0) {
      console.error('[Pronunciation API] No candidates in response:', data);
      return NextResponse.json({ ok: false, error: 'No candidates in Gemini response', pronunciation: '' }, { status: 500 });
    }
    
    const candidate = data.candidates[0];
    
    // finishReason 확인
    if (candidate.finishReason === 'SAFETY') {
      console.error('[Pronunciation API] Blocked by safety filter:', candidate.safetyRatings);
      return NextResponse.json({ ok: false, error: 'Blocked by safety filter', pronunciation: '' }, { status: 500 });
    }
    
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      console.warn('[Pronunciation API] Unexpected finishReason:', candidate.finishReason);
    }
    
    // 텍스트 추출 - /lib/gemini.ts와 동일한 패턴 사용
    pronunciation = candidate.content?.parts
      ?.map((p: any) => p?.text || '')
      .join('')
      .trim() || '';
    
    // 대체 방법: /app/api/ask/route.ts 패턴
    if (!pronunciation) {
      pronunciation = candidate.content?.parts?.[0]?.text?.trim() || '';
    }
    
    console.log('[Pronunciation API] Raw pronunciation from Gemini:', pronunciation);
    console.log('[Pronunciation API] Candidate structure:', {
      finishReason: candidate.finishReason,
      hasContent: !!candidate.content,
      hasParts: !!(candidate.content?.parts),
      partsCount: candidate.content?.parts?.length,
    });
    
    if (!pronunciation || pronunciation.length === 0) {
      console.error('[Pronunciation API] No pronunciation extracted. Full candidate:', JSON.stringify(candidate, null, 2));
      return NextResponse.json({ 
        ok: false, 
        error: 'No pronunciation received from Gemini',
        debug: {
          finishReason: candidate.finishReason,
          hasContent: !!candidate.content,
          candidateKeys: Object.keys(candidate),
        },
        pronunciation: '' 
      }, { status: 500 });
    }
    
    // 불필요한 텍스트 제거 (예: "Translation:", "Pronunciation:" 등)
    pronunciation = pronunciation
      .replace(/^(Translation|Pronunciation|발음):?\s*/i, '')
      .replace(/^Here.*?:?\s*/i, '')
      .trim();
    
    // 괄호 처리
    // 이미 괄호로 감싸져 있으면 그대로 사용
    const match = pronunciation.match(/^\((.+)\)$/);
    if (match) {
      pronunciation = match[1].trim();
    }
    
    // 괄호가 없으면 추가 (최종 형태)
    if (pronunciation && !pronunciation.startsWith('(')) {
      pronunciation = `(${pronunciation.trim()})`;
    }
    
    console.log('[Pronunciation API] Final pronunciation:', pronunciation);
    
    return NextResponse.json({ ok: true, pronunciation });
    
  } catch (error: any) {
    console.error('[Pronunciation API] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error?.message || 'Failed to generate pronunciation',
      pronunciation: '' // 실패 시 빈 문자열
    }, { status: 500 });
  }
}
