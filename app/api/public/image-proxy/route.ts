
import { NextRequest, NextResponse } from 'next/server';
import { getDriveClient } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET: 구글 드라이브 이미지 프록시 (공개용)
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const fileId = url.searchParams.get('id') || url.searchParams.get('fileId');

        if (!fileId) {
            return NextResponse.json({ ok: false, error: 'File ID is required' }, { status: 400 });
        }

        const drive = getDriveClient();

        try {
            // 1. 파일 메타데이터 조회 (MIME 타입 확인)
            const fileInfoOptions: any = {
                fileId,
                fields: 'mimeType, size',
                supportsAllDrives: true,
            };

            let fileInfo;
            try {
                const response = await drive.files.get(fileInfoOptions);
                fileInfo = response.data;
            } catch (error: any) {
                if (error.code === 404) {
                    return new NextResponse('File not found', { status: 404 });
                }
                throw error;
            }

            const mimeType = fileInfo.mimeType || 'image/jpeg';

            // 이미지가 아니면 에러 반환
            if (!mimeType.startsWith('image/')) {
                console.warn(`[Public Image Proxy] File is not an image: ${fileId}, mimeType: ${mimeType}`);
                return NextResponse.json({ ok: false, error: 'File is not an image' }, { status: 400 });
            }

            // 2. 이미지 데이터 가져오기
            const imageResponse = await drive.files.get(
                { fileId, alt: 'media', supportsAllDrives: true },
                { responseType: 'arraybuffer' }
            );

            if (!imageResponse.data) {
                throw new Error('Failed to fetch image data: response data is empty');
            }

            const imageBuffer = Buffer.from(imageResponse.data as ArrayBuffer);

            if (imageBuffer.length === 0) {
                throw new Error('Failed to fetch image data: buffer is empty');
            }

            // 이미지 반환
            return new NextResponse(imageBuffer, {
                headers: {
                    'Content-Type': mimeType,
                    'Cache-Control': 'public, max-age=31536000, immutable',
                    'Access-Control-Allow-Origin': '*', // CORS 허용
                    'Access-Control-Allow-Methods': 'GET',
                },
            });
        } catch (error: any) {
            console.error('[Public Image Proxy] Error fetching image:', {
                fileId,
                error: error.message,
            });

            return NextResponse.json(
                {
                    ok: false,
                    error: error.message || 'Failed to fetch image from Google Drive',
                    fileId,
                },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error('[Public Image Proxy] Error:', error);
        return NextResponse.json(
            { ok: false, error: error.message || 'Failed to proxy image' },
            { status: 500 }
        );
    }
}
