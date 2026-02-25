export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';
import { uploadFileToDrive } from '@/lib/google-drive';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext();

    console.log('[upload-image] Request received, content-type:', req.headers.get('content-type'));

    // Next.js 13+ App Router에서는 req.formData() 사용
    let formData: FormData;
    try {
      formData = await req.formData();
      console.log('[upload-image] FormData parsed successfully');
    } catch (error: any) {
      console.error('[upload-image] FormData parsing error:', error);
      console.error('[upload-image] Error stack:', error.stack);
      return NextResponse.json(
        { ok: false, error: `파일 데이터를 읽을 수 없습니다: ${error.message}` },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File | null;
    console.log('[upload-image] File extracted:', file ? { name: file.name, type: file.type, size: file.size } : 'null');

    if (!file) {
      return NextResponse.json(
        { ok: false, error: '파일이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      console.error('[upload-image] File is not a File instance:', typeof file, file);
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 파일 형식입니다.' },
        { status: 400 }
      );
    }

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: '지원하지 않는 이미지 형식입니다.' },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { ok: false, error: '파일 크기는 5MB를 초과할 수 없습니다.' },
        { status: 400 }
      );
    }

    // Google Drive에 업로드
    console.log('[upload-image] Converting file to buffer...');
    let bytes: ArrayBuffer;
    try {
      bytes = await file.arrayBuffer();
      console.log('[upload-image] File converted to ArrayBuffer, size:', bytes.byteLength);
    } catch (error: any) {
      console.error('[upload-image] ArrayBuffer conversion error:', error);
      return NextResponse.json(
        { ok: false, error: `파일을 읽을 수 없습니다: ${error.message}` },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(bytes);
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `profile-${profile.id}-${Date.now()}.${fileExtension}`;

    let imageUrl: string;

    // Google Drive 프로필 폴더 ID 가져오기
    // Google Drive 프로필 폴더 ID 가져오기
    const { getDriveFolderId } = await import('@/lib/config/drive-config');
    const profilesFolderId = await getDriveFolderId('PROFILES');

    // Google Drive에 업로드 시도
    console.log('[upload-image] Attempting Google Drive upload, fileName:', fileName);
    const uploadResult = await uploadFileToDrive({
      folderId: profilesFolderId || undefined,
      fileName,
      mimeType: file.type,
      buffer,
      makePublic: true,
    });

    console.log('[upload-image] Upload result:', { ok: uploadResult.ok, fileId: uploadResult.fileId, error: uploadResult.error });

    if (uploadResult.ok && uploadResult.fileId) {
      // Google Drive 업로드 성공
      const fileId = typeof uploadResult.fileId === 'string'
        ? uploadResult.fileId
        : String(uploadResult.fileId);

      console.log('[upload-image] File ID:', fileId, 'type:', typeof fileId);
      imageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
      console.log('[upload-image] Generated Google Drive URL:', imageUrl);
    } else {
      // Google Drive 업로드 실패 시 로컬 저장소로 fallback
      console.warn('[upload-image] Google Drive upload failed, falling back to local storage:', uploadResult.error);

      // 업로드 디렉토리 확인/생성
      const uploadDir = join(process.cwd(), 'public', 'uploads', 'profiles');
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }

      // 파일명 생성 (타임스탬프 + 랜덤 + 원본 파일명)
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const localFileName = `${timestamp}_${random}_${originalName}`;
      const filepath = join(uploadDir, localFileName);

      // 파일 저장
      await writeFile(filepath, buffer);

      // 로컬 URL 생성
      imageUrl = `/uploads/profiles/${localFileName}`;
      console.log('[upload-image] Saved to local storage, URL:', imageUrl);
    }

    // 프로필 업데이트
    const updatedProfile = await prisma.affiliateProfile.update({
      where: { id: profile.id },
      data: { profileImage: imageUrl },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            mallUserId: true,
            mallNickname: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      profileImage: imageUrl,
      profile: {
        ...updatedProfile,
        user: updatedProfile.User,
      },
      message: '프로필 이미지가 업로드되었습니다.',
    });
  } catch (error: any) {
    console.error('[POST /api/partner/profile/upload-image] error:', error);

    if (error.name === 'PartnerApiError') {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status || 403 }
      );
    }

    return NextResponse.json(
      { ok: false, error: error.message || '이미지 업로드에 실패했습니다.' },
      { status: 500 }
    );
  }
}
