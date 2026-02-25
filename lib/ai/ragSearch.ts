/**
 * RAG 검색 유틸리티
 * 벡터 유사도 검색을 통한 지식 베이스 검색
 */

import { generateEmbedding, normalizeVector } from './embeddingUtils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface SearchResult {
  id: number;
  title: string;
  content: string;
  category: string;
  similarity: number;
}

/**
 * 코사인 유사도 계산
 * @param vecA 벡터 A
 * @param vecB 벡터 B
 * @returns 코사인 유사도 (0-1)
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('벡터 차원이 일치하지 않습니다.');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * KnowledgeBase에서 유사한 문서 검색
 * @param query 검색 쿼리
 * @param limit 반환할 결과 수 (기본값: 5)
 * @returns 검색 결과 배열
 */
export async function searchKnowledgeBase(
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  try {
    logger.debug('[RAG] 검색 쿼리:', query);

    // 1. 쿼리 임베딩 생성
    const queryEmbedding = await generateEmbedding(query);
    const normalizedQueryEmbedding = normalizeVector(queryEmbedding);

    logger.debug('[RAG] 쿼리 임베딩 생성 완료, 차원:', normalizedQueryEmbedding.length);

    // 2. KnowledgeBase에서 활성화된 문서 가져오기 (임베딩 포함)
    const knowledgeItems = await prisma.knowledgeBase.findMany({
      where: {
        isActive: true,
        embedding: { not: null }, // 임베딩이 있는 문서만 검색
      },
      select: {
        id: true,
        title: true,
        content: true,
        category: true,
        keywords: true,
        embedding: true, // 저장된 임베딩 사용
      },
    });

    logger.debug('[RAG] KnowledgeBase 문서 수 (임베딩 있음):', knowledgeItems.length);

    if (knowledgeItems.length === 0) {
      logger.warn('[RAG] KnowledgeBase에 활성화된 문서가 없거나 임베딩이 없습니다.');
      // 임베딩이 없는 문서는 키워드 검색으로 폴백
      return await searchKnowledgeBaseByKeywords(query, limit);
    }

    // 3. 각 문서와의 유사도 계산 (저장된 임베딩 사용)
    const results: Array<SearchResult> = [];

    for (const item of knowledgeItems) {
      try {
        // 저장된 임베딩 사용 (API 호출 없음)
        const storedEmbedding = item.embedding as number[] | null;
        if (!storedEmbedding || !Array.isArray(storedEmbedding)) {
          logger.warn(`[RAG] 문서 ${item.id}의 임베딩이 유효하지 않습니다.`);
          continue;
        }

        const normalizedItemEmbedding = normalizeVector(storedEmbedding);

        // 코사인 유사도 계산
        const similarity = cosineSimilarity(normalizedQueryEmbedding, normalizedItemEmbedding);

        results.push({
          id: item.id,
          title: item.title,
          content: item.content,
          category: item.category,
          similarity,
        });
      } catch (error: any) {
        logger.warn(`[RAG] 문서 ${item.id} 유사도 계산 실패:`, error.message);
        // 유사도 계산 실패 시 키워드 기반 간단한 매칭 시도
        const keywords = item.keywords.toLowerCase().split(/\s+/);
        const queryLower = query.toLowerCase();
        const keywordMatch = keywords.some(kw => queryLower.includes(kw));

        if (keywordMatch) {
          results.push({
            id: item.id,
            title: item.title,
            content: item.content,
            category: item.category,
            similarity: 0.3, // 낮은 유사도로 설정
          });
        }
      }
    }

    // 4. 유사도 순으로 정렬하고 상위 N개 반환
    results.sort((a, b) => b.similarity - a.similarity);
    const topResults = results.slice(0, limit);

    logger.debug('[RAG] 검색 결과:', topResults.length, '개');

    // embedding 필드 제거 (반환값에는 포함하지 않음)
    return topResults;
  } catch (error: any) {
    logger.error('[RAG] 검색 오류:', error);
    throw new Error(`RAG 검색 실패: ${error.message || '알 수 없는 오류'}`);
  }
}

/**
 * 간단한 키워드 기반 검색 (폴백)
 * 임베딩 생성 실패 시 사용
 */
export async function searchKnowledgeBaseByKeywords(
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  try {
    const queryLower = query.toLowerCase();
    const queryKeywords = queryLower.split(/\s+/);

    const knowledgeItems = await prisma.knowledgeBase.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        content: true,
        category: true,
        keywords: true,
      },
    });

    const results: SearchResult[] = [];

    for (const item of knowledgeItems) {
      const itemText = `${item.title} ${item.content} ${item.keywords}`.toLowerCase();
      const keywords = item.keywords.toLowerCase().split(/\s+/);

      // 키워드 매칭 점수 계산
      let matchScore = 0;
      for (const keyword of queryKeywords) {
        if (itemText.includes(keyword)) {
          matchScore += 1;
        }
        if (keywords.includes(keyword)) {
          matchScore += 2; // keywords 필드에 직접 매칭되면 더 높은 점수
        }
      }

      if (matchScore > 0) {
        results.push({
          id: item.id,
          title: item.title,
          content: item.content,
          category: item.category,
          similarity: Math.min(matchScore / queryKeywords.length, 1), // 0-1 범위로 정규화
        });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  } catch (error: any) {
    logger.error('[RAG] 키워드 검색 오류:', error);
    return [];
  }
}

