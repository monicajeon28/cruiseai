// app/api/public/youtube/route.ts
// YouTube 채널 영상 목록 조회 API (공개)

export const runtime = 'nodejs';        // Edge Runtime 금지 (외부 API 호출)
export const dynamic = 'force-dynamic'; // 동적 데이터는 캐시 X

import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = 'UCKLDsk4iNXT1oYJ5ikUFggQ'; // 크루즈닷AI지니

export async function GET(request: NextRequest) {
  try {
    if (!YOUTUBE_API_KEY) {
      console.warn('[YouTube API] YOUTUBE_API_KEY 환경 변수가 설정되지 않았습니다.');
      // API 키가 없어도 빈 배열 반환하여 로딩이 멈추도록 함
      return NextResponse.json({
        ok: true,
        channel: null,
        videos: [],
      });
    }

    const { searchParams } = new URL(request.url);
    const maxResults = parseInt(searchParams.get('maxResults') || '6');

    // 타임아웃 설정 (10초)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      // 1단계: 채널 정보 가져오기
      const channelResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&id=${CHANNEL_ID}&key=${YOUTUBE_API_KEY}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!channelResponse.ok) {
        const error = await channelResponse.json();
        console.error('YouTube API Error (channels):', error);
        return NextResponse.json(
          { ok: false, error: 'Failed to fetch channel info' },
          { status: channelResponse.status }
        );
      }

      const channelData = await channelResponse.json();

      if (!channelData.items || channelData.items.length === 0) {
        return NextResponse.json({
          ok: true,
          channel: null,
          videos: [],
        });
      }

      const channel = channelData.items[0];
      const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

      // 2단계: 업로드 플레이리스트에서 인기 영상 가져오기 (조회수 기준)
      // 인기영상을 가져오기 위해 videos API를 사용하여 조회수 기준으로 정렬
      const videosResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CHANNEL_ID}&type=video&order=viewCount&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!videosResponse.ok) {
        const error = await videosResponse.json();
        console.error('YouTube API Error (search):', error);
        // 실패 시 기존 방식으로 폴백
        const playlistController = new AbortController();
        const playlistTimeoutId = setTimeout(() => playlistController.abort(), 10000);
        
        try {
          const playlistResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`,
            { signal: playlistController.signal }
          );
          
          clearTimeout(playlistTimeoutId);

          if (!playlistResponse.ok) {
            return NextResponse.json({
              ok: true,
              channel: null,
              videos: [],
            });
          }

          const playlistData = await playlistResponse.json();
          const videos = playlistData.items.map((item: any) => ({
            id: item.snippet.resourceId.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.high.url,
            publishedAt: item.snippet.publishedAt,
            url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
          }));

          return NextResponse.json({
            ok: true,
            channel: {
              id: channel.id,
              title: channel.snippet.title,
              description: channel.snippet.description,
              thumbnail: channel.snippet.thumbnails.default.url,
              customUrl: channel.snippet.customUrl,
            },
            videos,
          });
        } catch (playlistError: any) {
          clearTimeout(playlistTimeoutId);
          if (playlistError.name === 'AbortError') {
            console.error('[YouTube API] 타임아웃 발생 (playlist)');
          } else {
            console.error('[YouTube API] Playlist fetch error:', playlistError);
          }
          return NextResponse.json({
            ok: true,
            channel: null,
            videos: [],
          });
        }
      }

      const videosData = await videosResponse.json();

      // 영상 정보 포맷팅 (인기영상)
      const videos = videosData.items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.high.url,
        publishedAt: item.snippet.publishedAt,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      }));

      return NextResponse.json({
        ok: true,
        channel: {
          id: channel.id,
          title: channel.snippet.title,
          description: channel.snippet.description,
          thumbnail: channel.snippet.thumbnails.default.url,
          customUrl: channel.snippet.customUrl,
        },
        videos,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('[YouTube API] 타임아웃 발생');
      } else {
        console.error('[YouTube API] Fetch error:', fetchError);
      }
      // 타임아웃이나 에러 발생 시 빈 배열 반환하여 로딩이 멈추도록 함
      return NextResponse.json({
        ok: true,
        channel: null,
        videos: [],
      });
    }
  } catch (error) {
    console.error('[YouTube API] Error fetching YouTube videos:', error);
    // 에러 발생 시 빈 배열 반환하여 로딩이 멈추도록 함
    return NextResponse.json({
      ok: true,
      channel: null,
      videos: [],
    });
  }
}
