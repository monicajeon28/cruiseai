export const ALLOWED_NEWS_WRITER_IDS = new Set(
  Array.from({ length: 10 }, (_, index) => `user${index + 1}`)
);

export const CRUISEDOT_IMAGE_ROOT = '크루즈정보사진';

export const normalizeMallUserId = (mallUserId?: string | null) =>
  (mallUserId || '').trim().toLowerCase();

export const isAllowedCruisedotMallId = (mallUserId?: string | null) =>
  ALLOWED_NEWS_WRITER_IDS.has(normalizeMallUserId(mallUserId));











