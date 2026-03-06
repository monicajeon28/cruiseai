import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { handleShowPhotos } from './handlers/photos';
import { handleDirections } from './handlers/directions';
import { handleKeywordSearch } from './handlers/keyword-search';
import { isKeywordSearch } from '@/app/api/chat/detect';
import { buildAllDirUrls } from '@/lib/maps';
import type { ChatMessage } from '@/lib/chat-types';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveGeminiModelName } from '@/lib/ai/geminiModel';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, mode, from, to } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'text is required' },
        { status: 400 }
      );
    }

    // show 모드: 이미지 검색
    if (mode === 'show') {
      const messages = await handleShowPhotos(text);
      return NextResponse.json({ ok: true, messages });
    }

    // go 모드: 경로 안내
    if (mode === 'go') {
      let messages: ChatMessage[];

      // 키워드 검색인지 확인 (맛집, 관광지, 카페 등)
      if (isKeywordSearch(text)) {
        messages = handleKeywordSearch(text, from, to);
      } else if (from && to) {
        // from/to가 이미 파싱된 경우 직접 사용 (불필요한 변환 제거)
        const origin = { text: from };
        const dest = { text: to };
        const urls = buildAllDirUrls(origin, dest);

        messages = [
          {
            id: Date.now().toString() + '-1',
            role: 'assistant',
            type: 'text',
            text: `확인했어요.\n출발지: ${from}\n도착지: ${to}`
          },
          {
            id: Date.now().toString() + '-2',
            role: 'assistant',
            type: 'map-links',
            title: '길찾기',
            links: [
              { label: '🚗 자동차 길찾기', href: urls.driving, kind: 'directions' },
              { label: '🚇 대중교통 길찾기', href: urls.transit, kind: 'directions' },
              { label: '🚶 도보 길찾기', href: urls.walking, kind: 'directions' },
            ],
          },
          {
            id: Date.now().toString() + '-3',
            role: 'assistant',
            type: 'text',
            text: '새 창에서 열려요. 지도에서 **시작**만 누르시면 됩니다.'
          }
        ];
      } else {
        // text에서 파싱 (resolveFromTo 사용)
        messages = handleDirections(text);
      }

      return NextResponse.json({ ok: true, messages });
    }

    // translate 모드: 번역 처리
    if (mode === 'translate') {
      const user = await getSessionUser();
      if (!user) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
      }
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      if (!apiKey) {
        return NextResponse.json(
          { ok: false, error: 'GEMINI_API_KEY가 설정되지 않았습니다.' },
          { status: 500 }
        );
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const modelName = resolveGeminiModelName();
      const model = genAI.getGenerativeModel({ model: modelName });

      // 입력 길이 제한 (prompt injection 방어)
      if (text.length > 2000) {
        return NextResponse.json(
          { ok: false, error: '번역 텍스트가 너무 깁니다. (최대 2000자)' },
          { status: 400 }
        );
      }

      // from과 to가 없으면 에러
      if (!from || !to) {
        return NextResponse.json(
          { ok: false, error: 'from and to language parameters are required' },
          { status: 400 }
        );
      }

      // 번역 프롬프트 생성 함수 (재시도 시 강화 가능)
      const buildPrompt = (attempt: number) => {
        const urgency = attempt > 1
          ? `\nWARNING: Previous attempt returned untranslated text. You MUST translate NOW.\n`
          : '';
        return `You are a professional translator. Translate the following text from ${from} to ${to}.
${urgency}
CRITICAL RULES:
1. Output ONLY the translated text in ${to}. Nothing else.
2. Do NOT include the original text.
3. Do NOT add any explanations, prefixes, or suffixes.
4. Do NOT write "Translation:" or "Result:" or any similar labels.
5. Preserve all numbers, prices, currency symbols, and special characters exactly.
6. Translate the entire text completely, even if it's long.
7. If the text contains proper nouns (like "지니가이드", "지니가이드 3일체험"), translate them appropriately to ${to}.
8. Maintain the same tone and style as the original.

Source language: ${from}
Target language: ${to}

Text to translate (between <<<START>>> and <<<END>>> markers):
<<<START>>>
${text}
<<<END>>>

Now translate and output ONLY the translation in ${to} (no labels, no explanations, just the translation):`;
      };

      try {
        // 번역 시도 (최대 3회 재시도, rate limit 포함)
        let cleanedTranslation = '';
        let attempts = 0;
        const maxAttempts = 3;
        const trimmedOriginal = text.trim();

        while (attempts < maxAttempts) {
          attempts++;

          let translated = '';
          try {
            const result = await model.generateContent(buildPrompt(attempts));
            translated = result.response.text() || '';
          } catch (genError: any) {
            // Rate limit (429) 에러 처리
            if (genError?.status === 429 || genError?.message?.includes('429') || genError?.message?.includes('Too Many Requests')) {
              logger.warn(`[Translation] Rate limit hit, attempt ${attempts}/${maxAttempts}. Waiting before retry...`);

              if (attempts < maxAttempts) {
                // 지수 백오프: 2초, 4초, 8초...
                const waitTime = Math.min(2000 * Math.pow(2, attempts - 1), 10000);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
              } else {
                // 최대 재시도 횟수 초과
                logger.error('[Translation] Rate limit - max retries exceeded');
                return NextResponse.json({
                  ok: false,
                  error: '번역 서버가 바쁩니다. 잠시 후 다시 시도해주세요.',
                  retryAfter: 30,
                }, { status: 429 });
              }
            }
            // 다른 에러는 상위로 전파
            throw genError;
          }

          // 번역 결과 정리
          cleanedTranslation = translated.trim();

          // 불필요한 접두사 제거 (더 포괄적으로)
          cleanedTranslation = cleanedTranslation
            .replace(/^Translation\s*[:：]\s*/i, '')
            .replace(/^Result\s*[:：]\s*/i, '')
            .replace(/^번역\s*[:：]\s*/i, '')
            .replace(/^결과\s*[:：]\s*/i, '')
            .replace(/^Here\s+is\s+the\s+translation\s*[:：]\s*/i, '')
            .replace(/^The\s+translation\s+is\s*[:：]\s*/i, '')
            .replace(/^Translated\s+text\s*[:：]\s*/i, '')
            .trim();

          // 따옴표로 감싸진 경우 제거
          if ((cleanedTranslation.startsWith('"') && cleanedTranslation.endsWith('"')) ||
            (cleanedTranslation.startsWith("'") && cleanedTranslation.endsWith("'"))) {
            cleanedTranslation = cleanedTranslation.slice(1, -1).trim();
          }

          // 첫 줄만 추출 (여러 줄인 경우)
          const firstLine = cleanedTranslation.split('\n')[0].trim();
          if (firstLine && firstLine.length > 0) {
            cleanedTranslation = firstLine;
          }

          const trimmedTranslated = cleanedTranslation.trim();

          // 번역 결과가 원문과 동일한 경우 재시도 (단, 같은 언어 간 번역이 아닌 경우만)
          if (trimmedTranslated === trimmedOriginal && trimmedOriginal.length > 3 && from !== to) {
            logger.warn(`[Translation] Attempt ${attempts}: Translation same as original, retrying...`, {
              from,
              to,
              text: text.substring(0, 50)
            });

            if (attempts < maxAttempts) {
              // 재시도 전에 프롬프트를 더 강화
              continue;
            } else {
              // 최대 재시도 횟수 초과 - 원문 반환하되 경고
              logger.error('[Translation] Failed after max attempts - translation same as original');
              cleanedTranslation = trimmedOriginal; // 원문 반환
            }
          } else {
            // 번역 성공
            break;
          }
        }

        return NextResponse.json({
          ok: true,
          messages: [
            {
              id: Date.now().toString(),
              role: 'assistant',
              type: 'text',
              text: cleanedTranslation
            }
          ]
        });
      } catch (error: any) {
        logger.error('[Translation API] Error:', error);
        return NextResponse.json(
          { ok: false, error: '번역 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }
    }

    // 기타 모드는 일반 대화로 처리 (stream API 사용)
    return NextResponse.json(
      { ok: false, error: 'Unsupported mode. Use /api/chat/stream for general chat.' },
      { status: 400 }
    );
  } catch (error: any) {
    logger.error('[Chat API] Error:', error);
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

