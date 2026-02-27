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

    // 3일 체험 사용자 확인
    const prisma = (await import('@/lib/prisma')).default;
    const userWithTestMode = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, testModeStartedAt: true },
    });
    const isTrialUser = !!userWithTestMode?.testModeStartedAt;
    logger.debug('[Stream API] User type:', { isTrialUser, userId: user.id });

    // 환경 변수에서 API 키 가져오기 (GEMINI_API_KEY 우선, 형식 검증 후 GOOGLE_GENERATIVE_AI_API_KEY 사용)
    const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const isGoogleKeyValid = !!googleKey && googleKey.length >= 30 && googleKey.startsWith('AIza');

    if (googleKey && !isGoogleKeyValid) {
      logger.warn('[Stream API] GOOGLE_GENERATIVE_AI_API_KEY has invalid format, ignoring it:', {
        GOOGLE_GENERATIVE_AI_API_KEY_length: googleKey.length,
        GEMINI_API_KEY_length: process.env.GEMINI_API_KEY?.length || 0
      });
    }

    const apiKey = process.env.GEMINI_API_KEY || (isGoogleKeyValid ? googleKey : undefined);

    logger.debug('[Stream API] API key check:', {
      hasGEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
      GEMINI_API_KEY_length: process.env.GEMINI_API_KEY?.length || 0,
      hasGOOGLE_GENERATIVE_AI_API_KEY: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      GOOGLE_GENERATIVE_AI_API_KEY_length: process.env.GOOGLE_GENERATIVE_AI_API_KEY?.length || 0,
      apiKeyLength: apiKey?.length || 0,
      apiKeyPrefix: apiKey?.substring(0, 10) || 'N/A',
      usingKey: process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' : 'GOOGLE_GENERATIVE_AI_API_KEY'
    });

    if (!apiKey) {
      logger.error('[Stream API] Missing Gemini API key');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing API key. Please set GEMINI_API_KEY environment variable.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // API 키 기본 길이 검증 (30자 미만이면 명백히 잘못된 키)
    if (apiKey.trim().length < 30) {
      logger.error('[Stream API] Invalid API key format: key is too short', {
        length: apiKey.length,
      });
      return new Response(JSON.stringify({
        error: 'Invalid API key: key is too short. Please set GEMINI_API_KEY in Vercel environment variables.',
        details: `Current key length: ${apiKey.length}`
      }), {
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
      const lastUserMessage = messages
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
      const lastUserMessage = messages
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

    if (messages.length > 0) {
      // 첫 번째 사용자 메시지에 시스템 프롬프트 포함
      const firstMsg = messages[0];
      if (firstMsg.role === 'user') {
        const firstContent = firstMsg.content || firstMsg.text || '';
        contents.push({
          role: 'user',
          parts: [{ text: `${baseSystemPrompt}\n\n${firstContent}` }]
        });

        // 나머지 메시지 추가
        for (let i = 1; i < messages.length; i++) {
          const msg = messages[i];
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: parts(msg)
          });
        }
      } else {
        // 첫 메시지가 user가 아니면 그냥 변환
        contents = messages.map((m: any) => ({
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
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:streamGenerateContent?key=${encodeURIComponent(apiKey)}`;

    logger.debug('[Stream API] Requesting Gemini API:', modelName);
    logger.debug('[Stream API] URL (key hidden):', url.replace(/key=[^&]+/, 'key=***'));
    logger.debug('[Stream API] Contents count:', contents.length);

    // 통번역기와 동일한 fetch 설정 (단, 스트리밍용)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      logger.error('[Stream API] Gemini API error:', response.status, errorText);
      logger.error('[Stream API] Request URL was:', url.replace(/key=[^&]+/, 'key=***'));
      logger.error('[Stream API] Model name used:', modelName);

      // 403 에러인 경우 API 키 문제 (유출된 키 등)
      if (response.status === 403) {
        let errorMessage = 'Gemini API 접근이 거부되었습니다 (403).';
        let suggestion = 'API 키를 확인해주세요.';

        try {
          const errorJson = JSON.parse(errorText);
          const apiErrorMessage = errorJson?.error?.message || '';

          if (apiErrorMessage.includes('leaked') || apiErrorMessage.includes('reported as leaked')) {
            errorMessage = 'API 키가 유출로 보고되어 차단되었습니다.';
            suggestion = '새로운 API 키를 발급받아 GEMINI_API_KEY 환경 변수를 업데이트해주세요.';
          } else if (apiErrorMessage.includes('PERMISSION_DENIED')) {
            errorMessage = 'API 키 권한이 없습니다.';
            suggestion = 'API 키가 올바른지, 그리고 Gemini API가 활성화되어 있는지 확인해주세요.';
          } else if (apiErrorMessage) {
            errorMessage = `API 오류: ${apiErrorMessage}`;
          }
        } catch (e) {
          // JSON 파싱 실패 시 원본 에러 텍스트 사용
          if (errorText.includes('leaked') || errorText.includes('reported as leaked')) {
            errorMessage = 'API 키가 유출로 보고되어 차단되었습니다.';
            suggestion = '새로운 API 키를 발급받아 GEMINI_API_KEY 환경 변수를 업데이트해주세요.';
          }
        }

        return new Response(JSON.stringify({
          error: errorMessage,
          details: errorText,
          suggestion: suggestion,
          status: 403
        }), {
          status: 500, // 클라이언트에는 500으로 반환 (내부 서버 설정 오류로 처리)
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 400 에러인 경우 API 키 문제일 가능성이 높음
      if (response.status === 400) {
        let errorMessage = 'Gemini API 키가 유효하지 않습니다 (400).';
        let suggestion = 'Vercel 환경변수에서 GEMINI_API_KEY를 확인하고 올바른 키로 업데이트해주세요.';

        try {
          const errorJson = JSON.parse(errorText);
          const apiErrorMessage = errorJson?.error?.message || '';

          if (apiErrorMessage.includes('API key not valid') || apiErrorMessage.includes('INVALID_ARGUMENT')) {
            errorMessage = 'API 키가 유효하지 않거나 잘못되었습니다.';
            suggestion = `1. Google AI Studio (https://aistudio.google.com/apikey)에서 새 API 키 발급\n2. Vercel → Settings → Environment Variables → GEMINI_API_KEY 업데이트\n3. Redeploy 실행\n\n현재 키 길이: ${apiKey.length}자 (정상: 약 39자)`;
          } else if (apiErrorMessage) {
            errorMessage = `API 오류: ${apiErrorMessage}`;
          }
        } catch (e) {
          // JSON 파싱 실패 시 원본 에러 텍스트 사용
          if (errorText.includes('API key not valid') || errorText.includes('INVALID_ARGUMENT')) {
            errorMessage = 'API 키가 유효하지 않습니다.';
            suggestion = `Vercel 환경변수에서 GEMINI_API_KEY를 확인해주세요. 현재 키 길이: ${apiKey.length}자`;
          }
        }

        return new Response(JSON.stringify({
          error: errorMessage,
          details: errorText,
          suggestion: suggestion,
          status: 400
        }), {
          status: 500, // 클라이언트에는 500으로 반환 (내부 서버 설정 오류로 처리)
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 404 에러인 경우 모델 이름 문제일 가능성이 높음
      if (response.status === 404) {
        return new Response(JSON.stringify({
          error: `모델을 찾을 수 없습니다 (404). 모델 이름을 확인해주세요: ${modelName}`,
          details: errorText,
          suggestion: 'GEMINI_MODEL 환경 변수를 확인하거나 gemini-flash-latest로 변경해보세요.'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        error: `Gemini API error: ${response.status}`,
        details: errorText
      }), {
        status: response.status,
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

          while (true) {
            // 타임아웃 체크
            if (Date.now() - lastChunkTime > TIMEOUT_MS) {
              logger.warn('[Stream API] Timeout waiting for chunks');
              break;
            }

            const { done, value } = await reader.read();
            if (done) {
              logger.debug('[Stream API] Stream done, total chunks:', chunkCount, 'hasSentData:', hasSentData);
              logger.debug('[Stream API] Final buffer length:', buffer.length, 'content preview:', buffer.substring(0, 500));

              // 버퍼에 남은 데이터 처리 (최종 버퍼)
              if (buffer.trim()) {
                try {
                  // 최종 버퍼도 JSON 파싱 시도
                  const json = JSON.parse(buffer.trim());
                  logger.debug('[Stream API] Final buffer parsed, keys:', Object.keys(json));

                  const jsonArray = Array.isArray(json) ? json : [json];
                  for (const item of jsonArray) {
                    const candidates = item?.candidates || [];
                    for (const candidate of candidates) {
                      const parts = candidate?.content?.parts || [];
                      for (const part of parts) {
                        const text = part?.text;
                        if (text && text.trim()) {
                          const data = JSON.stringify(text);
                          controller.enqueue(new TextEncoder().encode(`0:${data}\n`));
                          hasSentData = true;
                          logger.debug('[Stream API] Final chunk:', text.substring(0, 50));
                        }
                      }
                    }
                  }
                } catch (e) {
                  logger.warn('[Stream API] Failed to parse final buffer:', e, 'buffer preview:', buffer.substring(0, 200));
                }
              }

              // 데이터가 전혀 없으면 에러 메시지 전송 (상세 정보 포함)
              if (!hasSentData) {
                logger.error('[Stream API] No data received from Gemini API!');
                logger.error('[Stream API] Total chunks received:', chunkCount);
                logger.error('[Stream API] Buffer content:', buffer.substring(0, 1000));
                const errorMsg = JSON.stringify('응답을 받지 못했습니다. 잠시 후 다시 시도해주세요.');
                controller.enqueue(new TextEncoder().encode(`0:${errorMsg}\n`));
                logger.debug('[Stream API] No data received, sent error message');
              }

              break;
            }

            // 버퍼에 추가
            chunkCount++;
            lastChunkTime = Date.now(); // 마지막 청크 시간 업데이트
            totalBytesReceived += value.length;
            const decoded = decoder.decode(value, { stream: true });
            buffer += decoded;
            logger.debug('[Stream API] Received chunk #' + chunkCount + ', bytes:', value.length, 'decoded length:', decoded.length, 'buffer length:', buffer.length, 'total bytes:', totalBytesReceived);

            // 버퍼가 너무 커지면 경고 (메모리 보호)
            if (buffer.length > 1000000) { // 1MB 제한
              logger.warn('[Stream API] Buffer too large, truncating');
              buffer = buffer.substring(buffer.length - 500000); // 마지막 500KB만 유지
            }

            // Gemini 스트리밍 응답은 JSON 배열로 옵니다: "[{...}]"
            // 버퍼에서 완전한 JSON 배열 찾기 (여러 개일 수 있음)
            let bufferProcessed = false;

            while (true) {
              const trimmedBuffer = buffer.trim();
              if (!trimmedBuffer.startsWith('[')) {
                break; // 배열이 아니면 중단
              }

              // 완전한 JSON 배열 찾기
              let depth = 0;
              let inString = false;
              let escapeNext = false;
              let completeEndIndex = -1;

              for (let i = 0; i < trimmedBuffer.length; i++) {
                const char = trimmedBuffer[i];

                if (escapeNext) {
                  escapeNext = false;
                  continue;
                }

                if (char === '\\') {
                  escapeNext = true;
                  continue;
                }

                if (char === '"' && !escapeNext) {
                  inString = !inString;
                  continue;
                }

                if (!inString) {
                  if (char === '[' || char === '{') {
                    depth++;
                  } else if (char === ']' || char === '}') {
                    depth--;
                    if (depth === 0 && char === ']') {
                      completeEndIndex = i;
                      break;
                    }
                  }
                }
              }

              if (completeEndIndex >= 0) {
                // 완전한 JSON 배열 발견
                try {
                  const jsonStr = trimmedBuffer.substring(0, completeEndIndex + 1);
                  const json = JSON.parse(jsonStr);
                  logger.debug('[Stream API] Parsed complete JSON array, length:', Array.isArray(json) ? json.length : 'not array');

                  // 배열의 각 항목 처리
                  const jsonArray = Array.isArray(json) ? json : [json];
                  for (const item of jsonArray) {
                    const candidates = item?.candidates || [];
                    logger.debug('[Stream API] Found candidates:', candidates.length);

                    for (const candidate of candidates) {
                      const parts = candidate?.content?.parts || [];
                      for (const part of parts) {
                        const text = part?.text;
                        if (text && text.trim()) {
                          const data = JSON.stringify(text);
                          controller.enqueue(new TextEncoder().encode(`0:${data}\n`));
                          hasSentData = true;
                          logger.debug('[Stream API] Sending chunk:', text.substring(0, 50));
                        }
                        const functionCall = part?.functionCall;
                        if (functionCall) {
                          const toolData = JSON.stringify({
                            type: 'tool_call',
                            name: functionCall.name,
                            args: functionCall.args
                          });
                          controller.enqueue(new TextEncoder().encode(`8:${toolData}\n`));
                          hasSentData = true;
                          logger.debug('[Stream API] Tool call:', functionCall.name);
                        }
                      }
                    }
                  }

                  // 처리한 부분 제거
                  buffer = trimmedBuffer.substring(completeEndIndex + 1).trim();
                  bufferProcessed = true;
                } catch (e: any) {
                  // 파싱 실패 - 다음 청크 기다림
                  logger.debug('[Stream API] JSON array parse failed:', e?.message);
                  break;
                }
              } else {
                // 완전한 배열이 아직 없음 - 다음 청크 기다림
                break;
              }
            }

            // 버퍼 미리보기 (처리되지 않은 경우만)
            if (!bufferProcessed && buffer.length > 0) {
              logger.debug('[Stream API] Buffer preview (not processed yet):', buffer.substring(0, 500));
            }
          }
        } catch (error: any) {
          logger.error('[Stream API] Stream reading error:', error);
          logger.error('[Stream API] Error details:', error?.message, error?.stack);
          // 에러 발생 시 클라이언트에 알림
          try {
            const errorMsg = error?.message || 'Stream processing error';
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
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // nginx 버퍼링 비활성화
      }
    });
  } catch (error: any) {
    logger.error('[Stream API] Streaming chat error:', error);
    logger.error('[Stream API] Error stack:', error?.stack);
    // 더 자세한 에러 정보 반환
    const errorMessage = error?.message || 'Error processing request';
    return new Response(JSON.stringify({
      error: errorMessage,
      details: error?.stack,
      name: error?.name
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
