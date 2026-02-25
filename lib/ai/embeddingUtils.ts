/**
 * 임베딩 생성 유틸리티
 * Google Generative AI Embedding API를 사용하여 텍스트를 벡터로 변환
 * 
 * 참고: Google AI Embedding API는 별도 엔드포인트를 사용합니다.
 * https://ai.google.dev/api/rest/v1beta/models/embedContent
 */

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey && process.env.NODE_ENV === 'development') {
  console.warn('[Embedding] GEMINI_API_KEY가 설정되지 않았습니다. RAG 기능이 제한될 수 있습니다.');
}

/**
 * 텍스트를 임베딩 벡터로 변환
 * @param text 임베딩할 텍스트
 * @returns 임베딩 벡터 (number[])
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!apiKey) {
    // API 키가 없으면 간단한 해시 기반 벡터 생성 (개발용)
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Embedding] API 키가 없어 간단한 해시 기반 임베딩을 사용합니다.');
    }
    return generateSimpleEmbedding(text);
  }

  if (!text || text.trim().length === 0) {
    throw new Error('임베딩할 텍스트가 비어있습니다.');
  }

  try {
    // Google AI Embedding API 직접 호출
    // 모델: text-embedding-004 (최신) 또는 text-embedding-004
    const modelName = 'text-embedding-004'; // 또는 'embedding-001'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent?key=${encodeURIComponent(apiKey)}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: {
          parts: [{ text: text.trim() }]
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Embedding API 오류: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const embedding = data.embedding?.values;
    
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('임베딩 응답 형식이 올바르지 않습니다.');
    }

    return embedding;
  } catch (error: any) {
    // API 호출 실패 시 간단한 해시 기반 벡터 생성 (폴백)
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Embedding] API 호출 실패, 해시 기반 임베딩 사용:', error.message);
    }
    return generateSimpleEmbedding(text);
  }
}

/**
 * 간단한 해시 기반 임베딩 생성 (임시 구현)
 * 실제로는 Google Embedding API를 사용해야 합니다.
 */
function generateSimpleEmbedding(text: string): number[] {
  // 간단한 해시 기반 벡터 생성 (768차원)
  const vector: number[] = [];
  const hash = simpleHash(text);
  
  for (let i = 0; i < 768; i++) {
    const seed = hash + i;
    vector.push(Math.sin(seed) * 0.5 + 0.5); // 0-1 범위로 정규화
  }
  
  return vector;
}

/**
 * 간단한 해시 함수
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit 정수로 변환
  }
  return Math.abs(hash);
}

/**
 * 벡터 정규화 (L2 norm)
 */
export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return vector;
  return vector.map(val => val / magnitude);
}

