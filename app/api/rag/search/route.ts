/**
 * RAG 검색 API
 * 사용자 쿼리에 대한 지식 베이스 검색
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { searchKnowledgeBase, searchKnowledgeBaseByKeywords } from '@/lib/ai/ragSearch';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 인증 확인
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const { query, limit = 5, useKeywords = false } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: '검색 쿼리가 필요합니다' },
        { status: 400 }
      );
    }

    logger.debug('[RAG API] 검색 요청:', { query, limit, useKeywords });

    // 키워드 기반 검색 또는 벡터 검색
    const results = useKeywords
      ? await searchKnowledgeBaseByKeywords(query, limit)
      : await searchKnowledgeBase(query, limit);

    logger.debug('[RAG API] 검색 결과:', results.length, '개');

    return NextResponse.json({
      ok: true,
      results,
      count: results.length,
    });
  } catch (error: any) {
    logger.error('[RAG API] 검색 오류:', error);
    return NextResponse.json(
      { 
        ok: false,
        error: error.message || '검색 중 오류가 발생했습니다' 
      },
      { status: 500 }
    );
  }
}







