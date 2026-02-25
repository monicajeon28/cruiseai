import { NextRequest, NextResponse } from 'next/server';
import { listFilesInFolder } from '@/lib/google-drive';
import * as path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug'); // 예: "코스타세레나/코스타 객실"
    const type = url.searchParams.get('type'); // "all" | "images" | "videos"
    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }

    // Google Drive 폴더 ID 가져오기
    const { getDriveFolderId } = await import('@/lib/config/drive-config');
    const cruiseImagesFolderId = await getDriveFolderId('CRUISE_IMAGES');

    // Google Drive에서 파일 목록 가져오기
    const result = await listFilesInFolder(cruiseImagesFolderId, slug);

    if (!result.ok || !result.files) {
      return NextResponse.json(
        { error: result.error || '파일 목록을 가져올 수 없습니다.' },
        { status: 404 }
      );
    }

    const images: string[] = [];
    const videos: string[] = [];

    for (const file of result.files) {
      const ext = path.extname(file.name).toLowerCase();
      // Google Drive URL 사용 (공개 링크)
      const fileUrl = file.url;
      
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        images.push(fileUrl);
      }
      if (['.mp4', '.webm', '.mov'].includes(ext)) {
        videos.push(fileUrl);
      }
    }

    const want = type === 'videos' ? { videos } :
                 type === 'images' ? { images } :
                 { images, videos };

    return NextResponse.json({ slug, ...want });
  } catch (e: any) {
    console.error('[Media API] Error:', e);
    return NextResponse.json(
      { error: e?.message || 'server error' },
      { status: 500 }
    );
  }
} 