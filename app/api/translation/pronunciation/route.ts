export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { resolveGeminiModelName } from '@/lib/ai/geminiModel';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * 외국어 텍스트를 한국어 발음으로 변환하는 API
 * 예: "Grazie" → "그라지에", "ありがとうございます" → "아리가토 고자이마스"
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.', pronunciation: '' }, { status: 401 });
    }

    const { text, langCode }: { text: string; langCode: string } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ ok: false, error: 'text required' }, { status: 400 });
    }

    if (text.length > 500) {
      return NextResponse.json({ ok: false, error: '텍스트가 너무 깁니다.', pronunciation: '' }, { status: 400 });
    }

    // 한국어인 경우 발음 불필요
    if (langCode === 'ko-KR' || langCode === 'ko') {
      return NextResponse.json({ ok: true, pronunciation: text });
    }

    // Gemini API를 사용하여 발음 생성
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_MODEL = resolveGeminiModelName();

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY missing', pronunciation: '' }, { status: 500 });
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

    let pronunciation = '';

    if (!data || !data.candidates || data.candidates.length === 0) {
      logger.error('[Pronunciation API] No candidates in response');
      return NextResponse.json({ ok: false, error: '발음 생성에 실패했습니다.', pronunciation: '' }, { status: 500 });
    }

    const candidate = data.candidates[0];

    if (candidate.finishReason === 'SAFETY') {
      logger.warn('[Pronunciation API] Blocked by safety filter');
      return NextResponse.json({ ok: false, error: '발음 생성에 실패했습니다.', pronunciation: '' }, { status: 500 });
    }

    // 텍스트 추출
    pronunciation = candidate.content?.parts
      ?.map((p: any) => p?.text || '')
      .join('')
      .trim() || '';

    if (!pronunciation) {
      pronunciation = candidate.content?.parts?.[0]?.text?.trim() || '';
    }

    if (!pronunciation || pronunciation.length === 0) {
      logger.error('[Pronunciation API] No pronunciation extracted');
      return NextResponse.json({
        ok: false,
        error: '발음 생성에 실패했습니다.',
        pronunciation: ''
      }, { status: 500 });
    }

    // 불필요한 텍스트 제거
    pronunciation = pronunciation
      .replace(/^(Translation|Pronunciation|발음):?\s*/i, '')
      .replace(/^Here.*?:?\s*/i, '')
      .trim();

    // 괄호 처리
    const match = pronunciation.match(/^\((.+)\)$/);
    if (match) {
      pronunciation = match[1].trim();
    }

    if (pronunciation && !pronunciation.startsWith('(')) {
      pronunciation = `(${pronunciation.trim()})`;
    }

    return NextResponse.json({ ok: true, pronunciation });

  } catch (error: any) {
    logger.error('[Pronunciation API] Error', { message: error?.message || String(error) });
    return NextResponse.json({
      ok: false,
      error: '발음 생성 중 오류가 발생했습니다.',
      pronunciation: ''
    }, { status: 500 });
  }
}
