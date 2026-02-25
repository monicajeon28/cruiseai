// lib/env.ts - 크루즈가이드 앱 (guide.cruisedot.co.kr) 환경변수 검증

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
    console.log('🔧 Build phase detected: Skipping environment variable validation.');
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
    console.error(`❌ ERROR: Missing required environment variables: ${missing.join(', ')}`);
    console.error('💡 Hint: Check .env.local file and make sure all keys are set.');
    if (process.env.NODE_ENV === 'production') {
      console.error('🚨 Production mode: Missing variables detected (continuing for debugging).');
    } else {
      console.warn('⚠️  Development mode: Continuing with warnings (not recommended for production)');
    }
  }

  const missingOptional = optionalEnvVars.filter(key => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn(`⚠️  Warning: Missing optional environment variables: ${missingOptional.join(', ')}`);
  }

  console.log('✅ Environment variables validated.');
}
