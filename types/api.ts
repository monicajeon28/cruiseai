/**
 * API 응답 타입 정의
 * 모든 API 엔드포인트에서 일관된 응답 형식 사용
 */

/**
 * 기본 API 응답 타입
 * @template T 성공 시 반환되는 데이터 타입
 */
export interface ApiResponse<T = unknown> {
  ok: boolean;
  message?: string;
  error?: string;
  errors?: Array<{
    path: string;
    message: string;
  }>;
  result?: T;
  data?: T; // result와 data 둘 다 지원 (하위 호환성)
}

/**
 * 성공 응답 타입
 * @template T 반환되는 데이터 타입
 */
export interface ApiSuccessResponse<T> extends ApiResponse<T> {
  ok: true;
  result: T;
  message?: string;
}

/**
 * 에러 응답 타입
 */
export interface ApiErrorResponse extends ApiResponse<never> {
  ok: false;
  message: string;
  error?: string;
  errors?: Array<{
    path: string;
    message: string;
  }>;
}

/**
 * 페이지네이션을 포함한 응답 타입
 * @template T 리스트 아이템 타입
 */
export interface PaginatedApiResponse<T> extends ApiSuccessResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * 통계를 포함한 응답 타입
 * @template T 통계 데이터 타입
 */
export interface StatsApiResponse<T> extends ApiSuccessResponse<T> {
  stats: {
    total: number;
    [key: string]: number | string;
  };
}

/**
 * 파일 업로드 응답 타입
 */
export interface FileUploadResponse extends ApiSuccessResponse<{
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}> {}

/**
 * 배치 작업 응답 타입
 */
export interface BatchOperationResponse extends ApiSuccessResponse<{
  success: number;
  failed: number;
  total: number;
  errors?: Array<{
    index: number;
    message: string;
  }>;
}> {}

/**
 * API 에러 타입 (클라이언트에서 throw할 수 있는 에러)
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public errors?: Array<{ path: string; message: string }>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * API 응답을 파싱하고 에러를 throw하는 헬퍼 함수
 * @param response fetch 응답 객체
 * @returns 파싱된 JSON 데이터
 */
export async function parseApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const data: ApiResponse<T> = await response.json();

  if (!response.ok || !data.ok) {
    throw new ApiError(
      data.message || data.error || 'API 요청 실패',
      response.status,
      data.errors
    );
  }

  return data;
}

/**
 * 성공 응답 생성 헬퍼
 */
export function createSuccessResponse<T>(result: T, message?: string): ApiSuccessResponse<T> {
  return {
    ok: true,
    result,
    message,
  };
}

/**
 * 에러 응답 생성 헬퍼
 */
export function createErrorResponse(
  message: string,
  errors?: Array<{ path: string; message: string }>
): ApiErrorResponse {
  return {
    ok: false,
    message,
    errors,
  };
}

/**
 * 페이지네이션 응답 생성 헬퍼
 */
export function createPaginatedResponse<T>(
  result: T[],
  page: number,
  limit: number,
  total: number
): PaginatedApiResponse<T> {
  return {
    ok: true,
    result,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
}
