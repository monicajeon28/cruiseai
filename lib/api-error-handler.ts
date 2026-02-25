/**
 * API Error Handler Utility
 * Provides standardized error handling for all API routes
 */

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { logger } from '@/lib/logger';

/**
 * Standard API Error Response Format
 */
export interface ApiErrorResponse {
  ok: false;
  error: string;
  code?: string;
  details?: any;
}

/**
 * Standard API Success Response Format
 */
export interface ApiSuccessResponse<T = any> {
  ok: true;
  data?: T;
  message?: string;
  [key: string]: any;
}

/**
 * Error Types
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Main Error Handler
 * Processes all types of errors and returns standardized responses
 */
export function handleApiError(error: unknown, context?: {
  path?: string;
  method?: string;
  userId?: number;
  additionalInfo?: Record<string, any>;
}): NextResponse<ApiErrorResponse> {
  // Log error with context
  logger.error('API Error', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  });

  // 1. ApiError (Custom application errors)
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        code: error.code,
        ...(error.details && { details: error.details }),
      },
      { status: error.statusCode }
    );
  }

  // 2. Prisma Errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaError(error);
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return NextResponse.json(
      {
        ok: false,
        error: '입력 데이터가 올바르지 않습니다.',
        code: 'VALIDATION_ERROR',
      },
      { status: 400 }
    );
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return NextResponse.json(
      {
        ok: false,
        error: '데이터베이스 연결에 실패했습니다.',
        code: 'DB_CONNECTION_ERROR',
      },
      { status: 503 }
    );
  }

  // 3. Zod Validation Errors
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: '입력 데이터 검증에 실패했습니다.',
        code: 'VALIDATION_ERROR',
        details: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
      { status: 400 }
    );
  }

  // 4. Standard Error
  if (error instanceof Error) {
    // Development mode: return detailed error
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: 'INTERNAL_ERROR',
          details: {
            stack: error.stack,
            name: error.name,
          },
        },
        { status: 500 }
      );
    }

    // Production: return generic error
    return NextResponse.json(
      {
        ok: false,
        error: '서버 오류가 발생했습니다.',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }

  // 5. Unknown Error
  return NextResponse.json(
    {
      ok: false,
      error: '알 수 없는 오류가 발생했습니다.',
      code: 'UNKNOWN_ERROR',
    },
    { status: 500 }
  );
}

/**
 * Handle Prisma-specific errors
 */
function handlePrismaError(
  error: Prisma.PrismaClientKnownRequestError
): NextResponse<ApiErrorResponse> {
  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      const target = error.meta?.target as string[] | undefined;
      const field = target?.[0] || '필드';
      return NextResponse.json(
        {
          ok: false,
          error: `이미 존재하는 ${field}입니다.`,
          code: 'DUPLICATE_ERROR',
          details: { field: target },
        },
        { status: 409 }
      );

    case 'P2025':
      // Record not found
      return NextResponse.json(
        {
          ok: false,
          error: '요청한 데이터를 찾을 수 없습니다.',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );

    case 'P2003':
      // Foreign key constraint failed
      return NextResponse.json(
        {
          ok: false,
          error: '관련 데이터를 찾을 수 없습니다.',
          code: 'FOREIGN_KEY_ERROR',
        },
        { status: 400 }
      );

    case 'P2014':
      // Relation violation
      return NextResponse.json(
        {
          ok: false,
          error: '관련된 데이터가 존재하여 삭제할 수 없습니다.',
          code: 'RELATION_VIOLATION',
        },
        { status: 400 }
      );

    case 'P1001':
      // Can't reach database
      return NextResponse.json(
        {
          ok: false,
          error: '데이터베이스에 연결할 수 없습니다.',
          code: 'DB_CONNECTION_ERROR',
        },
        { status: 503 }
      );

    default:
      logger.error('Unhandled Prisma Error', {
        code: error.code,
        meta: error.meta,
        message: error.message,
      });
      return NextResponse.json(
        {
          ok: false,
          error: '데이터베이스 오류가 발생했습니다.',
          code: 'DATABASE_ERROR',
        },
        { status: 500 }
      );
  }
}

/**
 * Validation helper: throws ApiError if condition is false
 */
export function validateRequest(condition: boolean, message: string, statusCode: number = 400) {
  if (!condition) {
    throw new ApiError(message, statusCode, 'VALIDATION_ERROR');
  }
}

/**
 * Authentication helper: throws ApiError if user is not authenticated
 */
export function requireAuth(user: any): asserts user {
  if (!user) {
    throw new ApiError('인증이 필요합니다.', 401, 'UNAUTHORIZED');
  }
}

/**
 * Authorization helper: throws ApiError if user doesn't have required role
 */
export function requireRole(userRole: string | undefined, allowedRoles: string[]) {
  if (!userRole || !allowedRoles.includes(userRole)) {
    throw new ApiError('권한이 없습니다.', 403, 'FORBIDDEN');
  }
}

/**
 * Success response helper
 */
export function successResponse<T = any>(
  data?: T,
  message?: string,
  statusCode: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      ok: true,
      ...(data !== undefined && { data }),
      ...(message && { message }),
    },
    { status: statusCode }
  );
}

/**
 * Error response helper (for throwing manually)
 */
export function errorResponse(
  message: string,
  statusCode: number = 500,
  code?: string
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(code && { code }),
    },
    { status: statusCode }
  );
}

/**
 * Async handler wrapper
 * Automatically catches errors and handles them with handleApiError
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  context?: Omit<NonNullable<Parameters<typeof handleApiError>[1]>, 'path' | 'method'>
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      const req = args[0];
      return handleApiError(error, {
        path: req?.url,
        method: req?.method,
        ...context,
      });
    }
  }) as T;
}
