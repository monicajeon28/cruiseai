import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limiter';

const SUPERTONE_BASE = 'https://supertoneapi.com/v1';

// Supertone이 지원하는 언어 코드 (한/영/일만 지원)
const SUPERTONE_SUPPORTED_LANGS = new Set(['ko', 'en', 'ja']);

// 언어 코드 → Supertone voice_id 매핑
// Grace (40대 여성, 크루즈 고객층 친화): bacc385ac094a4e0c187a0
// 환경변수로 오버라이드 가능 (코드 수정 없이 음성 교체)
const VOICE_ID = process.env.SUPERTONE_VOICE_ID ?? 'bacc385ac094a4e0c187a0';

// TTS 전용 per-user rate limit: 1분 20회 (번역 후 재생 패턴 고려)
const TTS_RATE_LIMIT = { limit: 20, windowMs: 60 * 1000, _type: 'tts' as const };

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  // per-user rate limit (same-origin 요청도 포함, 비용 폭탄 방지)
  const { limited } = await checkRateLimit(`tts:user:${user.id}`, TTS_RATE_LIMIT);
  if (limited) {
    return NextResponse.json({ ok: false, error: '잠시 후 다시 시도해주세요.' }, { status: 429 });
  }

  let text: unknown;
  let langCode: unknown;
  try {
    const body = await req.json() as Record<string, unknown>;
    text = body.text;
    langCode = body.langCode;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ ok: false, error: 'text required' }, { status: 400 });
  }
  const safeText: string = text;
  if (safeText.length > 500) {
    return NextResponse.json({ ok: false, error: 'text too long' }, { status: 400 });
  }

  // langCode 타입 및 길이 검증
  const safeLangCode: string = (!langCode || typeof langCode !== 'string' || langCode.length > 20) ? 'ja' : langCode;

  const baseLang = safeLangCode.split('-')[0].toLowerCase();

  // Supertone 미지원 언어는 204 반환 → 클라이언트가 Web Speech API로 fallback
  if (!SUPERTONE_SUPPORTED_LANGS.has(baseLang)) {
    return new NextResponse(null, { status: 204 });
  }

  const apiKey = process.env.SUPERTONE_API_KEY;
  if (!apiKey) {
    logger.error('[TTS] SUPERTONE_API_KEY not set');
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  try {
    const res = await fetch(`${SUPERTONE_BASE}/text-to-speech/${VOICE_ID}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sup-api-key': apiKey,
      },
      body: JSON.stringify({
        text: safeText.trim(),
        language: baseLang,
        style: 'neutral',
        model: 'sona_speech_1',
        output_format: 'mp3',
      }),
    });

    if (!res.ok) {
      logger.error('[TTS] Supertone API error:', res.status, res.statusText);
      return NextResponse.json({ ok: false }, { status: 502 });
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, max-age=3600',
        'Content-Length': String(audioBuffer.byteLength),
      },
    });
  } catch (err) {
    logger.error('[TTS] Supertone fetch error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
