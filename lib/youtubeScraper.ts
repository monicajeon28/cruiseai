'use server';

/**
 * Utility helpers for scraping YouTube channel data without relying on the Data API.
 * Provides graceful fallbacks when the official API key is missing or requests fail.
 */

export interface YoutubeScrapedItem {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string | null;
  url: string;
}

type CacheEntry = {
  data: YoutubeScrapedItem[];
  expiresAt: number;
};

const CHANNEL_HANDLE = 'cruisedotgini';
const CHANNEL_URL = `https://www.youtube.com/@${CHANNEL_HANDLE}`;
const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes
const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
};

const youtubeCache: Record<'shorts' | 'videos', CacheEntry> = {
  shorts: { data: [], expiresAt: 0 },
  videos: { data: [], expiresAt: 0 },
};

const KO_UNIT_TO_MS: Record<string, number> = {
  초: 1000,
  분: 60 * 1000,
  시간: 60 * 60 * 1000,
  일: 24 * 60 * 60 * 1000,
  주: 7 * 24 * 60 * 60 * 1000,
  달: 30 * 24 * 60 * 60 * 1000,
  개월: 30 * 24 * 60 * 60 * 1000,
  년: 365 * 24 * 60 * 60 * 1000,
};

const EN_UNIT_TO_MS: Record<string, number> = {
  second: 1000,
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

function getCachedItems(
  key: 'shorts' | 'videos',
  maxResults: number
): YoutubeScrapedItem[] | null {
  const entry = youtubeCache[key];
  if (!entry?.data.length) return null;
  if (entry.expiresAt < Date.now()) return null;
  const length = Math.min(entry.data.length, maxResults);
  return entry.data.slice(0, length);
}

function setCache(key: 'shorts' | 'videos', items: YoutubeScrapedItem[]) {
  youtubeCache[key] = {
    data: items,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
}

function extractInitialData(html: string): any {
  const marker = 'var ytInitialData = ';
  const markerIndex = html.indexOf(marker);

  if (markerIndex === -1) {
    throw new Error('ytInitialData marker not found in YouTube response');
  }

  const jsonStart = html.indexOf('{', markerIndex);
  if (jsonStart === -1) {
    throw new Error('Failed to locate start of ytInitialData JSON payload');
  }

  let depth = 0;
  for (let i = jsonStart; i < html.length; i++) {
    const char = html[i];
    if (char === '{') depth++;
    else if (char === '}') depth--;
    if (depth === 0) {
      const jsonString = html.slice(jsonStart, i + 1);
      return JSON.parse(jsonString);
    }
  }

  throw new Error('ytInitialData JSON payload was not balanced');
}

async function fetchInitialData(section: 'shorts' | 'videos'): Promise<any> {
  const response = await fetch(`${CHANNEL_URL}/${section}`, {
    headers: REQUEST_HEADERS,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to load YouTube ${section} page (HTTP ${response.status})`);
  }

  const html = await response.text();
  return extractInitialData(html);
}

function findTabRenderer(tabs: any[], titles: string[]) {
  return (
    tabs?.find((tab: any) => {
      const title = tab?.tabRenderer?.title;
      return title && titles.includes(title);
    })?.tabRenderer ?? null
  );
}

function selectThumbnail(thumbnails?: Array<{ url: string }>): string {
  if (!thumbnails || thumbnails.length === 0) return '';
  return thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || '';
}

function parseRelativePublishedAt(text?: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  const now = Date.now();

  const koMatch = trimmed.match(/(\d+)\s*(초|분|시간|일|주|개월|달|년)\s*전/);
  if (koMatch) {
    const value = parseInt(koMatch[1], 10);
    const unit = koMatch[2];
    const ms = KO_UNIT_TO_MS[unit];
    if (ms) {
      return new Date(now - value * ms).toISOString();
    }
  }

  const enMatch = trimmed.match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?\s+ago/i);
  if (enMatch) {
    const value = parseInt(enMatch[1], 10);
    const unit = enMatch[2].toLowerCase();
    const ms = EN_UNIT_TO_MS[unit];
    if (ms) {
      return new Date(now - value * ms).toISOString();
    }
  }

  const absoluteMatch = trimmed.match(/(\d{4})[.\-/\s]+(\d{1,2})[.\-/\s]+(\d{1,2})/);
  if (absoluteMatch) {
    const [, year, month, day] = absoluteMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

export async function scrapeYoutubeShorts(
  maxResults = 10
): Promise<YoutubeScrapedItem[]> {
  const normalizedMax = Math.max(1, maxResults);
  const targetCount = Math.max(normalizedMax, 20);
  const cached = getCachedItems('shorts', normalizedMax);
  if (cached) {
    return cached;
  }

  const data = await fetchInitialData('shorts');
  const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs ?? [];
  const tabRenderer = findTabRenderer(tabs, ['Shorts', '쇼츠']);
  const contents = tabRenderer?.content?.richGridRenderer?.contents ?? [];

  const results: YoutubeScrapedItem[] = [];

  for (const item of contents) {
    const short =
      item?.richItemRenderer?.content?.shortsLockupViewModel ?? null;
    if (!short) continue;

    const videoId = short?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId;
    if (!videoId) continue;

    results.push({
      id: videoId,
      title: short?.overlayMetadata?.primaryText?.content || '크루즈닷 쇼츠',
      description: short?.overlayMetadata?.secondaryText?.content || '',
      thumbnail: short?.thumbnail?.sources?.[0]?.url || '',
      publishedAt: null,
      url: `https://www.youtube.com/shorts/${videoId}`,
    });

    if (results.length >= targetCount) break;
  }

  if (!results.length) {
    throw new Error('No Shorts data could be scraped from YouTube.');
  }

  setCache('shorts', results);
  return results.slice(0, normalizedMax);
}

export async function scrapeYoutubeVideos(
  maxResults = 10
): Promise<YoutubeScrapedItem[]> {
  const normalizedMax = Math.max(1, maxResults);
  const targetCount = Math.max(normalizedMax, 20);
  const cached = getCachedItems('videos', normalizedMax);
  if (cached) {
    return cached;
  }

  const data = await fetchInitialData('videos');
  const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs ?? [];
  const tabRenderer = findTabRenderer(tabs, ['동영상', 'Videos']);
  const contents = tabRenderer?.content?.richGridRenderer?.contents ?? [];

  const results: YoutubeScrapedItem[] = [];

  for (const item of contents) {
    const video = item?.richItemRenderer?.content?.videoRenderer ?? null;
    if (!video?.videoId) continue;

    const description =
      video?.descriptionSnippet?.runs
        ?.map((run: { text: string }) => run.text)
        .join(' ')
        .trim() || '';

    results.push({
      id: video.videoId,
      title:
        video?.title?.runs
          ?.map((run: { text: string }) => run.text)
          .join(' ')
          .trim() || '크루즈닷 영상',
      description,
      thumbnail: selectThumbnail(video?.thumbnail?.thumbnails),
      publishedAt: parseRelativePublishedAt(
        video?.publishedTimeText?.simpleText
      ),
      url: `https://www.youtube.com/watch?v=${video.videoId}`,
    });

    if (results.length >= targetCount) break;
  }

  if (!results.length) {
    throw new Error('No video data could be scraped from YouTube.');
  }

  setCache('videos', results);
  return results.slice(0, normalizedMax);
}

