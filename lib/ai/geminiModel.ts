import { logger } from '@/lib/logger';

const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';

type AliasConfig = {
  target: string;
  reason: string;
};

const MODEL_ALIAS_MAP: Record<string, AliasConfig> = {
  'gemini-1.5-flash': {
    target: 'gemini-flash-latest',
    reason: 'Gemini 1.5 Flash is not available for the current API key, falling back to flash-latest.',
  },
  'gemini-1.5-flash-latest': {
    target: 'gemini-flash-latest',
    reason: 'Use the consolidated flash-latest alias.',
  },
  'gemini-1.5-pro': {
    target: 'gemini-pro-latest',
    reason: 'Gemini 1.5 Pro is superseded by the latest Gemini Pro release.',
  },
  'gemini-pro': {
    target: 'gemini-pro-latest',
    reason: 'Prefer the latest Gemini Pro alias.',
  },
  'gemini-flash': {
    target: 'gemini-flash-latest',
    reason: 'Prefer the latest Gemini Flash alias.',
  },
};

function normalizeInput(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^models\//i, '');
}

/**
 * Resolves the Gemini model name to use for API requests.
 * - Strips deprecated `models/` prefixes.
 * - Maps deprecated/unsupported model names to newer aliases.
 * - Falls back to a sensible default when unset.
 */
export function resolveGeminiModelName() {
  const envValue = normalizeInput(process.env.GEMINI_MODEL);
  if (!envValue) {
    return DEFAULT_GEMINI_MODEL;
  }

  const alias = MODEL_ALIAS_MAP[envValue.toLowerCase()];
  if (alias) {
    logger.warn(`[GeminiModel] "${envValue}" -> "${alias.target}" (${alias.reason})`);
    return alias.target;
  }

  return envValue;
}

export function getDefaultGeminiModel() {
  return DEFAULT_GEMINI_MODEL;
}

export function getChatModelName() {
  return DEFAULT_GEMINI_MODEL;
}

