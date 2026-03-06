// lib/env.ts - 크루즈가이드 앱 (guide.cruisedot.co.kr) 환경변수 검증

import { logger } from '@/lib/logger';

const optionalEnvVars = [
  'NEXT_PUBLIC_BASE_URL',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'WEATHER_API_KEY',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
];

export function validateEnv() {
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

  if (isBuildPhase) {
    logger.log('Build phase detected: Skipping environment variable validation.');
    return;
  }

  const requiredEnvVars = [
    'GEMINI_API_KEY',
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
  ];

  const missing = requiredEnvVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    logger.error(`ERROR: Missing required environment variables: ${missing.join(', ')}`);
    logger.error('Hint: Check .env.local file and make sure all keys are set.');
    if (process.env.NODE_ENV === 'production') {
      logger.error('Production mode: Missing variables detected (continuing for debugging).');
    } else {
      logger.warn('Development mode: Continuing with warnings (not recommended for production)');
    }
  }

  const missingOptional = optionalEnvVars.filter(key => !process.env[key]);
  if (missingOptional.length > 0) {
    logger.warn(`Warning: Missing optional environment variables: ${missingOptional.join(', ')}`);
  }

  logger.log('Environment variables validated.');
}
