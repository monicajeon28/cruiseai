export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import { getGoogleAccessToken } from '@/lib/google-auth-jwt';

// B2B 오디오 폴더 (B2B 유입 + 시스템 상담 모두 동일 폴더 사용)
// 환경변수 GOOGLE_DRIVE_B2B_AUDIO_FOLDER_ID에서 가져옴
const B2B_AUDIO_FOLDER_ID = process.env.GOOGLE_DRIVE_B2B_AUDIO_FOLDER_ID || '15h6_By31Y4Xy1MwIIWwkSc-uI-YI3A_S';

// 파일 크기 제한 (Vercel Free Plan: 4.5MB, FormData 오버헤드 고려해서 4MB)
const MAX_FILE_SIZE_MB = 4;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// GET 핸들러 - API 라우트 존재 확인용
export async function GET() {
  console.log('[Partner Audio Upload] GET request received - API route is working');
  return NextResponse.json({
    ok: true,
    message: 'Partner Audio Upload API is available',
    method: 'POST',
    maxFileSize: `${MAX_FILE_SIZE_MB}MB`,
    supportedFormats: ['mp3', 'wav', 'm4a', 'ogg', 'webm'],
  });
}

// OPTIONS 핸들러 (CORS preflight)
export async function OPTIONS() {
  console.log('[Partner Audio Upload] OPTIONS request received');
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * 파트너용 녹음파일 업로드 API
 * POST /api/partner/upload/audio
 *
 * 판매원/대리점장이 상담 녹음 파일을 Google Drive에 업로드
 * googleapis 라이브러리 대신 REST API 직접 호출 (Vercel 번들링 이슈 해결)
 */
export async function POST(request: NextRequest) {
  console.log('[Partner Audio Upload] POST request received');
  try {
    const { profile, sessionUser } = await requirePartnerContext();
    console.log('[Partner Audio Upload] Partner context:', { profileId: profile.id, type: profile.type });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const leadId = formData.get('leadId') as string;
    const customerId = formData.get('customerId') as string;
    const prospectType = formData.get('prospectType') as string; // 'lead' or 'consultation'

    if (!file) {
      return NextResponse.json({ ok: false, error: '파일이 없습니다.' }, { status: 400 });
    }

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({
        ok: false,
        error: `파일 크기가 ${MAX_FILE_SIZE_MB}MB를 초과합니다. 만능 압축기를 사용하여 오디오를 압축해주세요.`,
        fileSize: file.size,
        maxSize: MAX_FILE_SIZE_BYTES,
      }, { status: 413 });
    }

    // 파일 확장자 확인
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/webm'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|ogg|webm)$/i)) {
      return NextResponse.json({ ok: false, error: '지원하지 않는 오디오 형식입니다.' }, { status: 400 });
    }

    // 파일명 생성: [유형]_[원본파일명]_파트너타입_파트너명_고객ID_날짜시간.확장자
    const originalFileName = file.name;
    const ext = file.name.split('.').pop() || 'mp3';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const partnerType = profile.type === 'BRANCH_MANAGER' ? '대리점장' : '판매원';
    const partnerName = profile.displayName || sessionUser.name || 'unknown';
    const typePrefix = prospectType === 'lead' ? 'B2B유입' : '시스템상담';
    const baseNameWithoutExt = originalFileName.replace(/\.[^/.]+$/, '');
    const customerIdStr = customerId || leadId || 'unknown';
    const fileName = `${typePrefix}_${baseNameWithoutExt}_${partnerType}_${partnerName}_${customerIdStr}_${timestamp}.${ext}`;

    console.log(`[Partner Audio Upload] Uploading to B2B Audio folder (${B2B_AUDIO_FOLDER_ID}), type: ${typePrefix}`);

    // Google Drive REST API로 직접 업로드 (googleapis 번들링 이슈 회피)
    const accessToken = await getGoogleAccessToken();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Multipart upload 구성
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      parents: [B2B_AUDIO_FOLDER_ID],
      mimeType: file.type || 'audio/mpeg',
    };

    const multipartBody = Buffer.concat([
      Buffer.from(
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${file.type || 'audio/mpeg'}\r\n` +
        'Content-Transfer-Encoding: base64\r\n\r\n'
      ),
      Buffer.from(buffer.toString('base64')),
      Buffer.from(closeDelimiter),
    ]);

    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[Partner Audio Upload] Google Drive upload failed:', errorText);
      throw new Error(`Google Drive 업로드 실패: ${uploadResponse.status}`);
    }

    const uploadResult = await uploadResponse.json();
    const fileId = uploadResult.id;

    if (!fileId) {
      throw new Error('Google Drive 업로드 실패: 파일 ID 없음');
    }

    // 파일 공개 설정 (링크가 있는 사람 누구나)
    const permissionResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      }
    );

    if (!permissionResponse.ok) {
      const permError = await permissionResponse.text();
      console.warn('[Partner Audio Upload] Permission setting failed:', permError);
    } else {
      console.log('[Partner Audio Upload] File permission set to public');
    }

    // 웹 링크 URL 생성 (프록시 다운로드 사용)
    const driveViewUrl = `https://drive.google.com/file/d/${fileId}/view`;
    const driveDownloadUrl = `/api/drive/download/${fileId}`;

    console.log(`[Partner Audio Upload] ${partnerType} ${partnerName} uploaded ${fileName} to Google Drive: ${driveViewUrl}`);

    return NextResponse.json({
      ok: true,
      url: driveViewUrl,
      downloadUrl: driveDownloadUrl,
      fileId: fileId,
      fileName: fileName,
      originalFileName: originalFileName,
      message: '녹음 파일이 Google 드라이브에 업로드되었습니다.',
    });
  } catch (error: any) {
    console.error('[Partner Audio Upload Error]', error);
    return NextResponse.json({
      ok: false,
      error: error.message || '파일 업로드에 실패했습니다.',
    }, { status: 500 });
  }
}
