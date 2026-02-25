/**
 * 페이지네이션 유틸리티
 * 1만명 규모에서 효율적인 페이지네이션을 위한 유틸리티 함수
 */

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string; // 커서 기반 페이지네이션
}

export interface PaginationResult<T> {
  items: T[];
  pagination: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasMore?: boolean; // 커서 기반 페이지네이션
    nextCursor?: string | null; // 다음 페이지 커서
  };
}

/**
 * OFFSET 기반 페이지네이션 (기존 방식)
 */
export function parseOffsetPagination(
  page: number = 1,
  limit: number = 20,
  maxLimit: number = 100
): { skip: number; take: number; page: number; limit: number } {
  const validPage = Math.max(1, page);
  const validLimit = Math.min(Math.max(1, limit), maxLimit);
  const skip = (validPage - 1) * validLimit;
  
  return {
    skip,
    take: validLimit,
    page: validPage,
    limit: validLimit,
  };
}

/**
 * 커서 기반 페이지네이션 파싱
 */
export function parseCursorPagination(
  cursor: string | null | undefined,
  limit: number = 20,
  maxLimit: number = 100
): { cursor: number | undefined; take: number; limit: number } {
  const validLimit = Math.min(Math.max(1, limit), maxLimit);
  let parsedCursor: number | undefined;
  
  if (cursor) {
    try {
      // 커서는 보통 ID이므로 숫자로 파싱
      parsedCursor = parseInt(cursor, 10);
      if (isNaN(parsedCursor) || parsedCursor < 0) {
        parsedCursor = undefined;
      }
    } catch {
      parsedCursor = undefined;
    }
  }
  
  return {
    cursor: parsedCursor,
    take: validLimit + 1, // hasMore 확인을 위해 +1
    limit: validLimit,
  };
}

/**
 * 커서 기반 페이지네이션 결과 생성
 */
export function createCursorPaginationResult<T>(
  items: T[],
  limit: number,
  getId: (item: T) => number
): PaginationResult<T> {
  const hasMore = items.length > limit;
  const resultItems = hasMore ? items.slice(0, limit) : items;
  const lastItem = resultItems[resultItems.length - 1];
  const nextCursor = hasMore && lastItem ? String(getId(lastItem)) : null;
  
  return {
    items: resultItems,
    pagination: {
      limit,
      hasMore,
      nextCursor,
    },
  };
}

/**
 * OFFSET 기반 페이지네이션 결과 생성
 */
export function createOffsetPaginationResult<T>(
  items: T[],
  page: number,
  limit: number,
  total: number
): PaginationResult<T> {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 하이브리드 페이지네이션: OFFSET과 커서 모두 지원
 */
export function parseHybridPagination(params: PaginationParams, maxLimit: number = 100) {
  const { page, limit = 20, cursor } = params;
  
  // 커서가 있으면 커서 기반, 없으면 OFFSET 기반
  if (cursor) {
    const cursorResult = parseCursorPagination(cursor, limit, maxLimit);
    return {
      type: 'cursor' as const,
      ...cursorResult,
    };
  } else {
    const offsetResult = parseOffsetPagination(page || 1, limit, maxLimit);
    return {
      type: 'offset' as const,
      ...offsetResult,
    };
  }
}


