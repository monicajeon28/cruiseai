/**
 * API 응답 정리 유틸리티
 * 디버그 정보 및 민감한 정보 제거
 */

/**
 * 프로덕션 환경에서 디버그 정보 제거
 */
export function sanitizeResponse(data: any, isProduction: boolean = process.env.NODE_ENV === 'production'): any {
  if (!isProduction) {
    return data; // 개발 환경에서는 모든 정보 유지
  }
  
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeResponse(item, isProduction));
  }
  
  const sanitized: any = {};
  const debugKeys = [
    'stack',
    'stackTrace',
    'errorDetails',
    'debug',
    'debugInfo',
    'internal',
    '_internal',
    '__proto__',
    'constructor',
  ];
  
  for (const [key, value] of Object.entries(data)) {
    // 디버그 키 제거
    if (debugKeys.includes(key)) {
      continue;
    }
    
    // 내부 속성 제거
    if (key.startsWith('_') || key.startsWith('__')) {
      continue;
    }
    
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeResponse(value, isProduction);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * 에러 응답 정리
 * 프로덕션에서는 상세한 에러 정보를 숨김
 */
export function sanitizeError(error: any, isProduction: boolean = process.env.NODE_ENV === 'production'): {
  message: string;
  code?: string;
  details?: any;
} {
  if (!isProduction) {
    return {
      message: error?.message || 'An error occurred',
      code: error?.code,
      details: error,
    };
  }
  
  // 프로덕션에서는 일반적인 에러 메시지만 반환
  const message = error?.message || 'An error occurred';
  
  // 민감한 정보가 포함된 메시지 필터링
  const sensitivePatterns = [
    /password/i,
    /token/i,
    /key/i,
    /secret/i,
    /api/i,
    /database/i,
    /connection/i,
    /sql/i,
    /query/i,
  ];
  
  const hasSensitiveInfo = sensitivePatterns.some(pattern => pattern.test(message));
  
  return {
    message: hasSensitiveInfo ? 'An error occurred. Please try again later.' : message,
    code: error?.code,
  };
}




