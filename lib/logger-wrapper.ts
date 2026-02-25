/**
 * Phase 1: Wrapper Logger
 *
 * 전략 A의 1단계: console.log를 감싸는 래퍼 함수
 *
 * 초기에는 내부적으로 console을 호출하지만,
 * 모든 파일이 이 래퍼를 사용하도록 변경되면
 * Winston logger로 전환할 수 있습니다.
 *
 * Feature Flag를 통해 온/오프 가능합니다.
 *
 * Vercel 호환성:
 * - logger-v2를 지연 로드하여 필요할 때만 초기화
 * - Winston 비활성화 시 logger-v2 모듈이 전혀 로드되지 않음
 */

import type winston from 'winston';

// Feature Flag: 환경변수로 Winston 사용 여부 제어
const USE_WINSTON = process.env.USE_WINSTON === 'true';

// Winston logger 캐시 (지연 로드)
let winstonLogger: winston.Logger | null = null;

/**
 * Winston logger 가져오기 (지연 로드)
 * USE_WINSTON이 true일 때만 실제로 로드됨
 */
const getWinstonLogger = (): winston.Logger | null => {
  if (!USE_WINSTON) {
    return null;
  }

  // 이미 로드된 경우 캐시된 인스턴스 반환
  if (winstonLogger) {
    return winstonLogger;
  }

  // 처음 사용 시에만 logger-v2 모듈 로드
  try {
    // 동적 import를 사용하면 더 좋지만, 동기 함수에서는 require 사용
    const loggerModule = require('./logger-v2');
    winstonLogger = loggerModule.default;
    return winstonLogger;
  } catch (error) {
    // logger-v2 로드 실패 시 fallback to console
    console.error('Failed to load Winston logger, falling back to console:', error);
    return null;
  }
};

/**
 * 인자를 Winston 호환 형식으로 변환
 * Winston은 spread 연산자를 지원하지 않으므로 모든 인자를 하나의 문자열로 결합
 */
const formatArgs = (args: any[]): string => {
  return args
    .map((arg) => {
      try {
        if (typeof arg === 'object' && arg !== null) {
          return JSON.stringify(arg);
        }
        return String(arg);
      } catch (error) {
        // 순환 참조 객체 등 JSON.stringify 실패 시
        return '[Object]';
      }
    })
    .join(' ');
};

/**
 * Info 레벨 로그 (console.log 대체)
 */
export const log = (...args: any[]) => {
  const logger = getWinstonLogger();
  if (logger) {
    // Winston 사용
    logger.info(formatArgs(args));
  } else {
    // 기존 console.log 유지
    console.log(...args);
  }
};

/**
 * Error 레벨 로그 (console.error 대체)
 */
export const error = (...args: any[]) => {
  const logger = getWinstonLogger();
  if (logger) {
    logger.error(formatArgs(args));
  } else {
    console.error(...args);
  }
};

/**
 * Warning 레벨 로그 (console.warn 대체)
 */
export const warn = (...args: any[]) => {
  const logger = getWinstonLogger();
  if (logger) {
    logger.warn(formatArgs(args));
  } else {
    console.warn(...args);
  }
};

/**
 * Debug 레벨 로그 (console.debug 대체)
 */
export const debug = (...args: any[]) => {
  const logger = getWinstonLogger();
  if (logger) {
    logger.debug(formatArgs(args));
  } else {
    console.debug(...args);
  }
};

/**
 * 기본 export (import logger from '@/lib/logger-wrapper')
 */
export default {
  log,
  info: log, // log와 info는 동일
  error,
  warn,
  debug,
};

/**
 * Named exports (import { log, error } from '@/lib/logger-wrapper')
 */
export { log as info };
