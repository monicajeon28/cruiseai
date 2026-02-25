export const dynamic = 'force-dynamic';

// app/api/public/youtube/live/route.ts
// YouTube 라이브 방송 조회 API

import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = 'UCKLDsk4iNXT1oYJ5ikUFggQ'; // 크루즈닷AI지니

export async function GET(request: NextRequest) {
  try {
    if (!YOUTUBE_API_KEY) {
      return NextResponse.json(
        { ok: false, error: 'YouTube API key not configured' },
        { status: 500 }
      );
    }

    // 라이브 방송 검색
    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CHANNEL_ID}&eventType=live&type=video&key=${YOUTUBE_API_KEY}`
    );

    if (!searchResponse.ok) {
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch live streams' },
        { status: searchResponse.status }
      );
    }

    const searchData = await searchResponse.json();

    // 라이브 방송이 없으면 빈 배열 반환
    if (!searchData.items || searchData.items.length === 0) {
      return NextResponse.json({
        ok: true,
        isLive: false,
        live: null,
      });
    }

    // 첫 번째 라이브 방송 정보
    const liveVideo = searchData.items[0];

    return NextResponse.json({
      ok: true,
      isLive: true,
      live: {
        id: liveVideo.id.videoId,
        title: liveVideo.snippet.title,
        description: liveVideo.snippet.description,
        thumbnail: liveVideo.snippet.thumbnails.high.url,
        publishedAt: liveVideo.snippet.publishedAt,
        url: `https://www.youtube.com/watch?v=${liveVideo.id.videoId}`,
      },
    });
  } catch (error) {
    console.error('Error fetching YouTube Live:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
