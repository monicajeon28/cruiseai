// lib/redis.ts
// Redis 클라이언트 설정 및 캐싱 유틸리티
// Upstash REST API 지원

import { logger } from './logger';

// Upstash REST API 클라이언트 (동적 import)
let redisClient: any = null;
let connectionFailed = false; // 연결 실패 플래그 (재시도 방지)
let errorLogged = false; // 에러 로그 중복 방지

/**
 * Redis 클라이언트 초기화 (Upstash REST API 사용)
 */
async function getRedisClient(): Promise<any | null> {
  // 이미 초기화된 경우 재사용
  if (redisClient) {
    return redisClient;
  }

  // 연결 실패한 경우 재시도하지 않음
  if (connectionFailed) {
    return null;
  }

  // Upstash REST API 환경변수 확인
  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // 기존 REDIS_URL도 확인 (하위 호환성)
  const redisUrl = process.env.REDIS_URL;

  // 디버깅: 환경 변수 확인 (개발 환경에서만)
  if (process.env.NODE_ENV === 'development' && !errorLogged) {
    logger.log('[Redis] 환경 변수 확인:', {
      hasUpstashUrl: !!restUrl,
      hasUpstashToken: !!restToken,
      hasRedisUrl: !!redisUrl,
      urlPrefix: restUrl ? restUrl.substring(0, 30) : 'N/A',
    });
  }

  if (!restUrl || !restToken) {
    if (!redisUrl) {
      if (!errorLogged) {
        logger.warn('[Redis] UPSTASH_REDIS_REST_URL 또는 UPSTASH_REDIS_REST_TOKEN이 설정되지 않아 캐싱이 비활성화됩니다.');
        errorLogged = true;
      }
      connectionFailed = true;
      return null;
    }
    // 기존 ioredis 방식 (TCP 연결)
    try {
      const Redis = (await import('ioredis')).default;
      
      // 연결 실패 플래그를 사용하여 재시도 방지
      let connectionAttempted = false;
      
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 0, // 재시도 비활성화
        retryStrategy: () => {
          // 재시도하지 않음 (연결 실패 시 즉시 포기)
          return null;
        },
        reconnectOnError: () => {
          // 자동 재연결 비활성화
          return false;
        },
        enableOfflineQueue: false, // 오프라인 큐 비활성화
        lazyConnect: false, // 즉시 연결 시도 (하지만 에러 핸들러로 제어)
        connectTimeout: 2000, // 2초 타임아웃
        commandTimeout: 1000, // 명령 타임아웃
      });
      
      // 에러 핸들러를 먼저 등록 (연결 실패 즉시 감지)
      redisClient.on('error', (err: Error) => {
        // ECONNREFUSED 에러는 연결 실패를 의미
        if (err.message.includes('ECONNREFUSED') || err.message.includes('connect')) {
          connectionAttempted = true;
          connectionFailed = true;
          if (!errorLogged) {
            logger.warn('[Redis] 연결 실패. 캐싱이 비활성화됩니다. Redis 서버가 실행 중인지 확인하세요.');
            errorLogged = true;
          }
          // 클라이언트 정리
          if (redisClient) {
            try {
              redisClient.disconnect();
            } catch (e) {
              // 무시
            }
            redisClient = null;
          }
        }
      });
      
      redisClient.on('connect', () => {
        logger.log('[Redis] TCP 연결 성공');
        connectionFailed = false;
        errorLogged = false;
        connectionAttempted = true;
      });
      
      // 연결 타임아웃 설정 (2초 후 연결 실패로 간주)
      const timeoutId = setTimeout(() => {
        if (!connectionAttempted && redisClient) {
          connectionFailed = true;
          if (!errorLogged) {
            logger.warn('[Redis] 연결 타임아웃. 캐싱이 비활성화됩니다. Redis 서버가 실행 중인지 확인하세요.');
            errorLogged = true;
          }
          try {
            redisClient.disconnect();
          } catch (e) {
            // 무시
          }
          redisClient = null;
        }
      }, 2000);
      
      // 연결 상태 확인 (비동기로 처리)
      try {
        await Promise.race([
          redisClient.ping(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
        ]);
        clearTimeout(timeoutId);
        return redisClient;
      } catch (pingError) {
        clearTimeout(timeoutId);
        // ping 실패 시 연결 실패로 처리
        connectionFailed = true;
        if (redisClient) {
          try {
            redisClient.disconnect();
          } catch (e) {
            // 무시
          }
          redisClient = null;
        }
        if (!errorLogged) {
          logger.warn('[Redis] 연결 실패. 캐싱이 비활성화됩니다. Redis 서버가 실행 중인지 확인하세요.');
          errorLogged = true;
        }
        return null;
      }
    } catch (error) {
      connectionFailed = true;
      if (!errorLogged) {
        logger.warn('[Redis] 초기화 실패. 캐싱이 비활성화됩니다:', error instanceof Error ? error.message : '알 수 없는 오류');
        errorLogged = true;
      }
      return null;
    }
  }

  // Upstash REST API 사용
  try {
    // URL 형식 검증
    if (restUrl && !restUrl.startsWith('https://')) {
      connectionFailed = true;
      if (!errorLogged) {
        logger.error('[Redis] Upstash URL 형식 오류: URL은 https://로 시작해야 합니다.', {
          url: restUrl.substring(0, 50),
        });
        errorLogged = true;
      }
      return null;
    }

    const { Redis } = await import('@upstash/redis');
    redisClient = new Redis({
      url: restUrl,
      token: restToken,
    });
    
    // 실제 연결 테스트 (ping 명령 실행)
    try {
      const pingResult = await Promise.race([
        redisClient.ping(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout after 5 seconds')), 5000)
        )
      ]);
      
      logger.log('[Redis] Upstash REST API 연결 성공', { pingResult });
      connectionFailed = false;
      errorLogged = false;
      return redisClient;
    } catch (pingError: any) {
      // ping 실패 시 상세 에러 로그
      const errorMessage = pingError?.message || '알 수 없는 오류';
      const errorStatus = pingError?.status || pingError?.statusCode || 'N/A';
      const errorResponse = pingError?.response || pingError?.data || 'N/A';
      
      const errorDetails = {
        message: errorMessage,
        status: errorStatus,
        response: typeof errorResponse === 'string' ? errorResponse.substring(0, 100) : errorResponse,
        url: restUrl ? `${restUrl.substring(0, 40)}...` : 'N/A',
        hasToken: !!restToken,
        tokenLength: restToken ? restToken.length : 0,
      };
      
      connectionFailed = true;
      if (!errorLogged) {
        logger.error('[Redis] Upstash 연결 테스트 실패:', errorDetails);
        
        // 일반적인 오류 원인 안내
        if (errorStatus === 401 || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
          logger.error('[Redis] 인증 실패: 토큰이 올바르지 않거나 만료되었을 수 있습니다.');
        } else if (errorStatus === 404 || errorMessage.includes('404')) {
          logger.error('[Redis] URL을 찾을 수 없음: URL이 올바른지 확인하세요.');
        } else if (errorMessage.includes('timeout')) {
          logger.error('[Redis] 연결 타임아웃: 네트워크 연결을 확인하세요.');
        }
        
        logger.error('[Redis] 상세 에러:', pingError);
        errorLogged = true;
      }
      redisClient = null;
      return null;
    }
  } catch (error) {
    connectionFailed = true;
    if (!errorLogged) {
      const errorDetails = {
        message: error instanceof Error ? error.message : '알 수 없는 오류',
        url: restUrl ? `${restUrl.substring(0, 40)}...` : 'N/A',
        hasToken: !!restToken,
        hasUrl: !!restUrl,
        tokenLength: restToken ? restToken.length : 0,
      };
      logger.error('[Redis] Upstash 초기화 실패:', errorDetails);
      logger.error('[Redis] 상세 에러:', error);
      errorLogged = true;
    }
    return null;
  }
}

/**
 * 캐시에서 데이터 가져오기
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }

  try {
    const data = await client.get(key);
    if (!data) {
      return null;
    }
    // Upstash는 이미 JSON을 파싱해서 반환하므로, 문자열인 경우만 파싱
    if (typeof data === 'string') {
      return JSON.parse(data) as T;
    }
    return data as T;
  } catch (error) {
    logger.error(`[Redis] 캐시 조회 오류 (key: ${key}):`, error);
    return null;
  }
}

/**
 * 캐시에 데이터 저장
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number = 300 // 기본 5분
): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) {
    return false;
  }

  try {
    // Upstash REST API는 setex 대신 set with ex 옵션 사용
    const serialized = JSON.stringify(value);
    await client.set(key, serialized, { ex: ttlSeconds });
    return true;
  } catch (error) {
    logger.error(`[Redis] 캐시 저장 오류 (key: ${key}):`, error);
    return false;
  }
}

/**
 * 캐시 삭제
 */
export async function deleteCache(key: string): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) {
    return false;
  }

  try {
    await client.del(key);
    return true;
  } catch (error) {
    logger.error(`[Redis] 캐시 삭제 오류 (key: ${key}):`, error);
    return false;
  }
}

/**
 * 패턴으로 캐시 삭제 (예: "dashboard:*")
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  const client = await getRedisClient();
  if (!client) {
    return 0;
  }

  try {
    // Upstash는 keys 명령을 지원하지만, keys는 프로덕션에서 주의해야 함
    // 대신 SCAN을 사용하는 것이 좋지만, 간단한 구현을 위해 keys 사용
    const keys = await client.keys(pattern);
    if (!keys || keys.length === 0) {
      return 0;
    }
    // 배열인 경우와 단일 값인 경우 처리
    const keyArray = Array.isArray(keys) ? keys : [keys];
    if (keyArray.length > 0) {
      await client.del(...keyArray);
    }
    return keyArray.length;
  } catch (error) {
    logger.error(`[Redis] 패턴 캐시 삭제 오류 (pattern: ${pattern}):`, error);
    return 0;
  }
}

/**
 * 캐시 키 생성 헬퍼
 */
export function createCacheKey(prefix: string, ...parts: (string | number | null | undefined)[]): string {
  const validParts = parts.filter(p => p !== null && p !== undefined).map(String);
  return `${prefix}:${validParts.join(':')}`;
}

/**
 * Redis 연결 종료 (테스트/종료 시 사용)
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    // Upstash REST API는 연결을 닫을 필요가 없지만, ioredis는 quit() 필요
    if (typeof redisClient.quit === 'function') {
      await redisClient.quit();
    }
    redisClient = null;
  }
  // 연결 실패 플래그도 리셋 (재시도 가능하도록)
  connectionFailed = false;
  errorLogged = false;
}

/**
 * Redis 연결 상태 리셋 (재연결 시도용)
 */
export function resetRedisConnection(): void {
  connectionFailed = false;
  errorLogged = false;
  redisClient = null;
}

