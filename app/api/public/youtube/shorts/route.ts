export const dynamic = 'force-dynamic';

// app/api/public/youtube/shorts/route.ts
// YouTube Shorts 영상 목록 조회 API

import { NextRequest, NextResponse } from 'next/server';
import { scrapeYoutubeShorts } from '@/lib/youtubeScraper';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = 'UCKLDsk4iNXT1oYJ5ikUFggQ'; // 크루즈닷AI지니

async function fallbackWithScrapedShorts(maxResults: number, reason?: string) {
  try {
    if (reason) {
      console.warn(`[YouTube Shorts API] ${reason}`);
    }
    const shorts = await scrapeYoutubeShorts(maxResults);
    return NextResponse.json({
      ok: true,
      shorts,
      source: 'scraped',
    });
  } catch (error) {
    console.error('[YouTube Shorts API] Scraper fallback failed:', error);
    return NextResponse.json(
      { ok: false, error: 'YouTube Shorts 데이터를 불러오지 못했습니다.' },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const maxResultsParam = parseInt(searchParams.get('maxResults') || '10', 10);
  const maxResults = Number.isFinite(maxResultsParam) && maxResultsParam > 0 ? maxResultsParam : 10;

  if (!YOUTUBE_API_KEY) {
    return fallbackWithScrapedShorts(maxResults, 'Missing YOUTUBE_API_KEY. Using scraped data.');
  }

  try {
    // 1단계: 채널 정보 가져오기
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${CHANNEL_ID}&key=${YOUTUBE_API_KEY}`
    );

    if (!channelResponse.ok) {
      return fallbackWithScrapedShorts(
        maxResults,
        `Failed to fetch channel info (HTTP ${channelResponse.status})`
      );
    }

    const channelData = await channelResponse.json();
    if (!channelData.items || channelData.items.length === 0) {
      return fallbackWithScrapedShorts(maxResults, 'Channel not found via YouTube API');
    }

    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

    // 2단계: 최근 영상들 가져오기
    const playlistResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${YOUTUBE_API_KEY}`
    );

    if (!playlistResponse.ok) {
      return fallbackWithScrapedShorts(
        maxResults,
        `Failed to fetch playlist videos (HTTP ${playlistResponse.status})`
      );
    }

    const playlistData = await playlistResponse.json();
    const videoIds = playlistData.items
      ?.map((item: any) => item.snippet.resourceId.videoId)
      .filter(Boolean)
      .join(',');

    if (!videoIds) {
      return fallbackWithScrapedShorts(maxResults, 'No video IDs returned from playlistItems API');
    }

    // 3단계: 각 영상의 상세 정보 가져오기 (duration 확인용)
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`
    );

    if (!videosResponse.ok) {
      return fallbackWithScrapedShorts(
        maxResults,
        `Failed to fetch video details (HTTP ${videosResponse.status})`
      );
    }

    const videosData = await videosResponse.json();

    // 4단계: Shorts 영상만 필터링 (60초 이하)
    const shorts = (videosData.items || [])
      .filter((video: any) => {
        const duration = video.contentDetails.duration;
        const match = duration?.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
        if (match) {
          const minutes = parseInt(match[1] || '0');
          const seconds = parseInt(match[2] || '0');
          const totalSeconds = minutes * 60 + seconds;
          return totalSeconds <= 60;
        }
        return false;
      })
      .slice(0, maxResults)
      .map((video: any) => ({
        id: video.id,
        title: video.snippet.title,
        description: video.snippet.description,
        thumbnail: video.snippet.thumbnails.high.url,
        publishedAt: video.snippet.publishedAt,
        url: `https://www.youtube.com/shorts/${video.id}`,
      }));

    if (!shorts.length) {
      return fallbackWithScrapedShorts(maxResults, 'No Shorts items detected via API response');
    }

    return NextResponse.json({
      ok: true,
      shorts,
      source: 'api',
    });
  } catch (error) {
    console.error('Error fetching YouTube Shorts:', error);
    return fallbackWithScrapedShorts(maxResults, 'Unexpected error from YouTube API. Using scraped data.');
  }
}
