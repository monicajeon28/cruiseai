import type { PhraseCategory } from './types';

// 언어별 동적 로더 맵 (코드 스플리팅 — 필요한 언어만 로드)
const PHRASE_LOADERS: Record<string, () => Promise<{ default: PhraseCategory[] }>> = {
  'en-US': () => import('./en-US'),
  'ja-JP': () => import('./ja-JP'),
  'zh-CN': () => import('./zh-CN'),
  'it-IT': () => import('./it-IT'),
  'zh-HK': () => import('./zh-HK'),
  'zh-TW': () => import('./zh-TW'),
  'th-TH': () => import('./th-TH'),
  'vi-VN': () => import('./vi-VN'),
  'id-ID': () => import('./id-ID'),
  'ms-MY': () => import('./ms-MY'),
  'fr-FR': () => import('./fr-FR'),
  'es-ES': () => import('./es-ES'),
  'de-DE': () => import('./de-DE'),
  'ru-RU': () => import('./ru-RU'),
};

// 메모리 캐시 (같은 언어는 두 번 다운로드하지 않음)
const cache: Record<string, PhraseCategory[]> = {};

/**
 * 특정 언어의 회화 카테고리를 동적으로 로드합니다.
 * 지원하지 않는 언어는 영어(en-US)로 폴백합니다.
 */
export async function loadPhrasesForLang(langCode: string): Promise<PhraseCategory[]> {
  const effectiveLang = PHRASE_LOADERS[langCode] ? langCode : 'en-US';

  if (cache[effectiveLang]) return cache[effectiveLang];

  const loader = PHRASE_LOADERS[effectiveLang];
  const mod = await loader();
  cache[effectiveLang] = mod.default;
  return cache[effectiveLang];
}

export type { PhraseCategory };
