export const dynamic = 'force-dynamic';

// app/api/public/youtube/videos/route.ts
// YouTube 일반 영상 목록 조회 API (Shorts 제외)

import { NextRequest, NextResponse } from 'next/server';
import { scrapeYoutubeVideos } from '@/lib/youtubeScraper';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = 'UCKLDsk4iNXT1oYJ5ikUFggQ'; // 크루즈닷AI지니

async function fallbackWithScrapedVideos(maxResults: number, reason?: string) {
  try {
    if (reason) {
      console.warn(`[YouTube Videos API] ${reason}`);
    }
    const videos = await scrapeYoutubeVideos(maxResults);
    return NextResponse.json({
      ok: true,
      videos,
      source: 'scraped',
    });
  } catch (error) {
    console.error('[YouTube Videos API] Scraper fallback failed:', error);
    return NextResponse.json(
      { ok: false, error: 'YouTube 영상을 불러오지 못했습니다.' },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const maxResultsParam = parseInt(searchParams.get('maxResults') || '10', 10);
  const maxResults = Number.isFinite(maxResultsParam) && maxResultsParam > 0 ? maxResultsParam : 10;

  if (!YOUTUBE_API_KEY) {
    return fallbackWithScrapedVideos(maxResults, 'Missing YOUTUBE_API_KEY. Using scraped data.');
  }

  try {
    // 1단계: 채널 정보 가져오기
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${CHANNEL_ID}&key=${YOUTUBE_API_KEY}`
    );

    if (!channelResponse.ok) {
      console.error('YouTube API Error (channels):', await channelResponse.text());
      return fallbackWithScrapedVideos(
        maxResults,
        `Failed to fetch channel info (HTTP ${channelResponse.status})`
      );
    }

    const channelData = await channelResponse.json();

    if (!channelData.items || channelData.items.length === 0) {
      return fallbackWithScrapedVideos(maxResults, 'Channel not found via YouTube API');
    }

    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

    // 2단계: 최근 영상들 가져오기 (더 많이 가져온 후 필터링)
    const playlistResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${YOUTUBE_API_KEY}`
    );

    if (!playlistResponse.ok) {
      console.error('YouTube API Error (playlistItems):', await playlistResponse.text());
      return fallbackWithScrapedVideos(
        maxResults,
        `Failed to fetch playlist videos (HTTP ${playlistResponse.status})`
      );
    }

    const playlistData = await playlistResponse.json();

    // 3단계: 각 영상의 상세 정보를 가져와서 Shorts 여부 확인
    const videoIds = playlistData.items
      ?.map((item: any) => item.snippet.resourceId.videoId)
      .filter(Boolean)
      .join(',');

    if (!videoIds) {
      return fallbackWithScrapedVideos(maxResults, 'No video IDs returned from playlistItems API');
    }

    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`
    );

    if (!videosResponse.ok) {
      return fallbackWithScrapedVideos(
        maxResults,
        `Failed to fetch video details (HTTP ${videosResponse.status})`
      );
    }

    const videosData = await videosResponse.json();

    // Shorts가 아닌 일반 영상만 필터링 (길이가 60초 이하이거나 #shorts 태그가 있는 것은 제외)
    const regularVideos = (videosData.items || [])
      .filter((video: any) => {
        const duration = video.contentDetails.duration;
        const title = video.snippet.title.toLowerCase();
        const description = video.snippet.description.toLowerCase();

        const durationMatch = duration?.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
        const durationSeconds = durationMatch
          ? (parseInt(durationMatch[1] || '0', 10) * 60 +
              parseInt(durationMatch[2] || '0', 10))
          : null;

        const isShort =
          (typeof durationSeconds === 'number' && durationSeconds <= 60) ||
          title.includes('#shorts') ||
          description.includes('#shorts');

        return !isShort;
      })
      .slice(0, maxResults)
      .map((video: any) => ({
        id: video.id,
        title: video.snippet.title,
        description: video.snippet.description,
        thumbnail: video.snippet.thumbnails.high.url,
        publishedAt: video.snippet.publishedAt,
        url: `https://www.youtube.com/watch?v=${video.id}`,
      }));

    if (!regularVideos.length) {
      return fallbackWithScrapedVideos(maxResults, 'No regular videos detected via API response');
    }

    return NextResponse.json({
      ok: true,
      videos: regularVideos,
      source: 'api',
    });
  } catch (error) {
    console.error('Error fetching YouTube videos:', error);
    return fallbackWithScrapedVideos(maxResults, 'Unexpected error from YouTube API. Using scraped data.');
  }
}
