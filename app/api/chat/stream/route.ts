export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { searchKnowledgeBase } from '@/lib/ai/ragSearch';
import { getChatModelName } from '@/lib/ai/geminiModel';

// Edge runtime 제거 - Prisma를 사용하는 getSessionUser를 위해 Node.js runtime 사용
// export const runtime = 'edge';

export async function POST(req: Request) {
  logger.debug('[Stream API] POST request received');
  try {
    // 사용자 인증 확인
    logger.debug('[Stream API] Checking authentication...');
    const user = await getSessionUser();
    if (!user) {
      logger.error('[Stream API] Unauthorized - no user');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    logger.debug('[Stream API] User authenticated:', user.id);

    logger.debug('[Stream API] Parsing request body...');
    const { messages } = await req.json();
    logger.debug('[Stream API] Received messages:', messages?.length || 0);

    // 입력 검증
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: '메시지가 필요합니다.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const MAX_MESSAGES = 50;
    const MAX_MESSAGE_LENGTH = 4000;
    const trimmedMessages = messages.slice(-MAX_MESSAGES);
    for (const msg of trimmedMessages) {
      const text = msg?.content || msg?.text || '';
      if (typeof text === 'string' && text.length > MAX_MESSAGE_LENGTH) {
        return new Response(JSON.stringify({ error: '메시지가 너무 깁니다.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 3일 체험 사용자 확인
    const prisma = (await import('@/lib/prisma')).default;
    const userWithTestMode = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, testModeStartedAt: true },
    });
    const isTrialUser = !!userWithTestMode?.testModeStartedAt;
    logger.debug('[Stream API] User type:', { isTrialUser, userId: user.id });

    // 환경 변수에서 API 키 가져오기 (GEMINI_API_KEY 우선 사용)
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    // GOOGLE_GENERATIVE_AI_API_KEY가 잘못된 형식이면 경고
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY &&
      (process.env.GOOGLE_GENERATIVE_AI_API_KEY.length < 30 || !process.env.GOOGLE_GENERATIVE_AI_API_KEY.startsWith('AIza'))) {
      logger.warn('[Stream API] GOOGLE_GENERATIVE_AI_API_KEY has invalid format, using GEMINI_API_KEY instead:', {
        GOOGLE_GENERATIVE_AI_API_KEY_length: process.env.GOOGLE_GENERATIVE_AI_API_KEY.length,
        GEMINI_API_KEY_length: process.env.GEMINI_API_KEY?.length || 0
      });
    }

    logger.debug('[Stream API] API key check:', {
      hasGEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
      hasGOOGLE_GENERATIVE_AI_API_KEY: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      usingKey: process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' : 'GOOGLE_GENERATIVE_AI_API_KEY'
    });

    if (!apiKey) {
      logger.error('[Stream API] Missing Gemini API key');
      return new Response(JSON.stringify({ error: '서버 오류가 발생했습니다.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // API 키 기본 길이 검증 (30자 미만이면 명백히 잘못된 키)
    if (apiKey.trim().length < 30) {
      logger.error('[Stream API] Invalid API key format: key is too short', { length: apiKey.length });
      return new Response(JSON.stringify({ error: '서버 오류가 발생했습니다.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Gemini 모델 이름 고정 (툴 비활성화 버전)
    const modelName = getChatModelName();
    logger.debug('[Stream API] Using model:', modelName);

    // 통번역기 API와 동일한 방식으로 메시지 변환
    // 통번역기: /app/api/chat/route.ts 참고
    const parts = (m: { role: string; content?: string; text?: string }) => {
      const text = m.content || m.text || '';
      return [{ text }];
    };

    // RAG 검색: 사용자의 최신 질문에 대한 지식 베이스 검색
    let ragContext = '';
    try {
      const lastUserMessage = trimmedMessages
        .filter((m: any) => m.role === 'user')
        .pop();

      if (lastUserMessage) {
        const userQuery = lastUserMessage.content || lastUserMessage.text || '';
        if (userQuery.trim().length > 0) {
          logger.debug('[Stream API] RAG 검색 시작:', userQuery.substring(0, 50));
          const ragResults = await searchKnowledgeBase(userQuery, 3);

          if (ragResults.length > 0) {
            ragContext = '\n\n[참고 자료]\n';
            ragResults.forEach((result, index) => {
              ragContext += `${index + 1}. ${result.title}\n${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}\n\n`;
            });
            logger.debug('[Stream API] RAG 검색 결과:', ragResults.length, '개');
          }
        }
      }
    } catch (ragError: any) {
      // RAG 검색 실패해도 계속 진행
      logger.warn('[Stream API] RAG 검색 실패:', ragError.message);
    }

    // 상품 정보 추가: 크루즈 상품 관련 질문인 경우 상품 정보 제공
    let productContext = '';
    try {
      const lastUserMessage = trimmedMessages
        .filter((m: any) => m.role === 'user')
        .pop();

      if (lastUserMessage) {
        const userQuery = (lastUserMessage.content || lastUserMessage.text || '').toLowerCase();
        // 크루즈 상품 관련 키워드 확인
        const productKeywords = ['크루즈', '상품', '추천', '여행', '일본', '대만', 'msc', '벨리시마', 'royal', 'caribbean'];
        const isProductQuery = productKeywords.some(keyword => userQuery.includes(keyword));

        if (isProductQuery) {
          const prisma = (await import('@/lib/prisma')).default;
          const products = await prisma.cruiseProduct.findMany({
            where: {
              saleStatus: '판매중',
              OR: [
                { isPopular: true },
                { isRecommended: true },
              ],
            },
            select: {
              productCode: true,
              cruiseLine: true,
              shipName: true,
              packageName: true,
              nights: true,
              days: true,
              basePrice: true,
              description: true,
              category: true,
              tags: true,
            },
            take: 5,
            orderBy: [
              { isPopular: 'desc' },
              { isRecommended: 'desc' },
              { createdAt: 'desc' },
            ],
          });

          if (products.length > 0) {
            productContext = '\n\n[판매 중인 크루즈 상품 정보]\n';
            products.forEach((product, index) => {
              productContext += `${index + 1}. ${product.cruiseLine} ${product.shipName} - ${product.packageName}\n`;
              productContext += `   상품코드: ${product.productCode}\n`;
              productContext += `   기간: ${product.nights}박 ${product.days}일\n`;
              if (product.basePrice) {
                productContext += `   가격: ${product.basePrice.toLocaleString()}원\n`;
              }
              if (product.description) {
                productContext += `   설명: ${product.description.substring(0, 100)}${product.description.length > 100 ? '...' : ''}\n`;
              }
              productContext += '\n';
            });
            logger.debug('[Stream API] 상품 정보 추가:', products.length, '개');
          }
        }
      }
    } catch (productError: any) {
      // 상품 정보 조회 실패해도 계속 진행
      logger.warn('[Stream API] 상품 정보 조회 실패:', productError.message);
    }

    // 시스템 프롬프트를 첫 번째 사용자 메시지에 포함
    // 3일 체험 사용자와 일반 사용자를 구분하여 프롬프트 설정
    const baseSystemPrompt = isTrialUser
      ? `당신은 크루즈닷AI 3일 체험 전용 AI 어시스턴트입니다.
- 이 사용자는 크루즈닷AI 3일 체험 사용자입니다.
- 3일 체험 사용자들은 3일 체험 사용자들끼리만 연결되어야 합니다.
- 일반 크루즈닷AI가 아닌, 3일 체험 전용 크루즈닷AI로 동작하세요.
- 한국어로 간단명료하게 답변하세요.
- 답변은 반드시 100자 이내로 간략하게 작성하세요.
- 핵심 정보만 전달하고 불필요한 설명은 생략하세요.
- 최신 정보가 필요한 질문은 Google Search를 활용하여 정확한 정보를 제공하세요.
- 검색 결과를 바탕으로 간결하고 정확한 답변을 제공하세요.

[크루즈 상품 안내]
- 사용자가 크루즈 상품에 대해 물어보면 [판매 중인 크루즈 상품 정보]를 참고하여 추천하세요.
- 상품코드, 기간, 가격, 설명을 포함하여 간단명료하게 안내하세요.
- 여러 상품이 있으면 인기 상품을 우선 추천하세요.

사용자의 질문에 필요한 핵심만 전달하세요.${ragContext}${productContext}`
      : `당신은 크루즈 여행 전문 AI 어시스턴트 '크루즈닷AI'입니다. 
- 한국어로 간단명료하게 답변하세요.
- 답변은 반드시 100자 이내로 간략하게 작성하세요.
- 핵심 정보만 전달하고 불필요한 설명은 생략하세요.
- 최신 정보가 필요한 질문은 Google Search를 활용하여 정확한 정보를 제공하세요.
- 검색 결과를 바탕으로 간결하고 정확한 답변을 제공하세요.

[크루즈 상품 안내]
- 사용자가 크루즈 상품에 대해 물어보면 [판매 중인 크루즈 상품 정보]를 참고하여 추천하세요.
- 상품코드, 기간, 가격, 설명을 포함하여 간단명료하게 안내하세요.
- 여러 상품이 있으면 인기 상품을 우선 추천하세요.

사용자의 질문에 필요한 핵심만 전달하세요.${ragContext}${productContext}`;

    // 메시지 변환 (통번역기와 동일한 패턴)
    let contents: any[] = [];

    if (trimmedMessages.length > 0) {
      // 첫 번째 사용자 메시지에 시스템 프롬프트 포함
      const firstMsg = trimmedMessages[0];
      if (firstMsg.role === 'user') {
        const firstContent = firstMsg.content || firstMsg.text || '';
        // Prompt Injection 방어: <<<START>>>/<<<END>>> 구분자로 사용자 입력 명확히 분리
        contents.push({
          role: 'user',
          parts: [{ text: `${baseSystemPrompt}\n\n<<<START>>>\n${firstContent}\n<<<END>>>` }]
        });

        // 나머지 메시지 추가
        for (let i = 1; i < trimmedMessages.length; i++) {
          const msg = trimmedMessages[i];
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: parts(msg)
          });
        }
      } else {
        // 첫 메시지가 user가 아니면 그냥 변환
        contents = trimmedMessages.map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: parts(m)
        }));
      }
    } else {
      // 메시지가 없으면 시스템 프롬프트만
      contents = [{
        role: 'user',
        parts: [{ text: baseSystemPrompt }]
      }];
    }

    logger.debug('[Stream API] Converted contents:', contents.length, 'messages');

    // Google Generative AI API 직접 호출 (스트리밍)
    // P0-5/P0-6: API 키 URL 제거 → 헤더로 이동 + ?alt=sse 추가 (실제 SSE 스트리밍)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:streamGenerateContent?alt=sse`;

    logger.debug('[Stream API] Requesting Gemini API:', modelName);
    logger.debug('[Stream API] Contents count:', contents.length);

    // 통번역기와 동일한 fetch 설정 (단, 스트리밍용)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey, // URL ?key= 대신 헤더로 전달 (서버 로그 미노출)
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7, // 일반 대화용 (통번역기는 0.1)
          maxOutputTokens: 8192, // 충분한 답변을 위해 8192로 증가 (기존 500)
          topP: 0.9,
          topK: 20,
        },
        tools: [
          {
            googleSearch: {}
          }
        ]
      }),
      cache: 'no-store', // 통번역기와 동일
      signal: AbortSignal.timeout(30000), // WO-MOB-06: 30초 타임아웃 (모바일 네트워크 교착 방지)
    });

    logger.debug('[Stream API] Gemini response status:', response.status);
    logger.debug('[Stream API] Response ok:', response.ok);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    logger.debug('[Stream API] Response headers:', responseHeaders);
    logger.debug('[Stream API] Response Content-Type:', response.headers.get('content-type'));

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      // 상세 내용은 서버 로그에만 기록, 클라이언트에는 고정 메시지
      logger.error('[Stream API] Gemini API error:', response.status, errorText.substring(0, 200));

      return new Response(JSON.stringify({ error: '서버 오류가 발생했습니다.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    logger.debug('[Stream API] Starting to read stream...');
    const headersObj: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headersObj[key] = value;
    });
    logger.debug('[Stream API] Response headers:', headersObj);
    logger.debug('[Stream API] Response body type:', typeof response.body, 'isReadableStream:', response.body instanceof ReadableStream);

    // 스트리밍 응답을 ReadableStream으로 변환하여 반환
    const stream = new ReadableStream({
      async start(controller) {
        logger.debug('[Stream API] Stream controller started');

        if (!response.body) {
          logger.error('[Stream API] Response body is null!');
          const errorMsg = JSON.stringify('응답을 받을 수 없습니다. API 키를 확인해주세요.');
          controller.enqueue(new TextEncoder().encode(`0:${errorMsg}\n`));
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        logger.debug('[Stream API] Reader obtained, starting to read from Gemini API...');
        logger.debug('[Stream API] Response body is readable stream:', response.body instanceof ReadableStream);

        try {
          let chunkCount = 0;
          let hasSentData = false;
          let totalBytesReceived = 0;
          let lastChunkTime = Date.now();
          const TIMEOUT_MS = 60000; // 60초 타임아웃

          // WO-MOB-05: ?alt=sse 사용 → SSE 라인 파서로 교체
          while (true) {
            // 타임아웃 체크
            if (Date.now() - lastChunkTime > TIMEOUT_MS) {
              logger.warn('[Stream API] Timeout waiting for chunks');
              break;
            }

            const { done, value } = await reader.read();
            if (done) {
              logger.debug('[Stream API] Stream done, total chunks:', chunkCount, 'hasSentData:', hasSentData);

              // 버퍼에 남은 데이터 처리
              if (buffer.trim()) {
                const lines = buffer.split('\n');
                for (const line of lines) {
                  if (!line.startsWith('data: ')) continue;
                  const jsonStr = line.slice(6).trim();
                  if (!jsonStr || jsonStr === '[DONE]') continue;
                  try {
                    const json = JSON.parse(jsonStr);
                    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                      controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify(text)}\n`));
                      hasSentData = true;
                    }
                  } catch { /* 무시 */ }
                }
              }

              if (!hasSentData) {
                logger.error('[Stream API] No data received from Gemini API!');
                logger.error('[Stream API] Total chunks received:', chunkCount);
                const errorMsg = JSON.stringify('응답을 받지 못했습니다. 잠시 후 다시 시도해주세요.');
                controller.enqueue(new TextEncoder().encode(`0:${errorMsg}\n`));
              }

              break;
            }

            chunkCount++;
            lastChunkTime = Date.now();
            totalBytesReceived += value.length;
            const decoded = decoder.decode(value, { stream: true });
            buffer += decoded;
            logger.debug('[Stream API] Received chunk #' + chunkCount + ', bytes:', value.length, 'total bytes:', totalBytesReceived);

            // SSE 라인 파싱: "data: {json}\n" 형식
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // 마지막 불완전 라인은 버퍼에 유지

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === '[DONE]') continue;
              try {
                const json = JSON.parse(jsonStr);
                const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify(text)}\n`));
                  hasSentData = true;
                  logger.debug('[Stream API] SSE chunk sent:', text.substring(0, 50));
                }
                // googleSearch grounding metadata 처리
                const groundingMetadata = json?.candidates?.[0]?.groundingMetadata;
                if (groundingMetadata?.webSearchQueries?.length > 0) {
                  logger.debug('[Stream API] Search queries:', groundingMetadata.webSearchQueries);
                }
              } catch (e) {
                logger.debug('[Stream API] SSE parse skip:', (e as Error)?.message);
              }
            }
          }
        } catch (error: any) {
          logger.error('[Stream API] Stream reading error:', error);
          logger.error('[Stream API] Error details:', error?.message, error?.stack);
          // 에러 발생 시 클라이언트에 알림
          try {
            const errorMsg = '서버 오류가 발생했습니다.';
            const errorData = JSON.stringify(errorMsg);
            controller.enqueue(new TextEncoder().encode(`0:${errorData}\n`));
            logger.debug('[Stream API] Error message sent to client');
          } catch (e) {
            logger.error('[Stream API] Failed to send error message:', e);
          }
        } finally {
          logger.debug('[Stream API] Closing stream controller');
          controller.close();
        }
      }
    });

    logger.debug('[Stream API] Returning stream response');

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no', // nginx 버퍼링 비활성화
        'Connection': 'keep-alive',
      }
    });
  } catch (error: any) {
    logger.error('[Stream API] Streaming chat error:', error);
    logger.error('[Stream API] Error stack:', error?.stack);
    return new Response(JSON.stringify({
      error: '서버 오류가 발생했습니다.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
