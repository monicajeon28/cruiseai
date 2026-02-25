import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext, PartnerApiError } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';
import { uploadFileToDrive } from '@/lib/google-drive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 녹음 파일 저장 폴더 ID
const VOICE_RECORDING_FOLDER_ID = '10Mdpzht3qZ0xb5gEErNmbFZlU594h2Kq';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ contractId: string }> }
) {
    try {
        const { contractId } = await params;
        const { profile } = await requirePartnerContext();

        // 대리점장 권한 확인
        if (profile.type !== 'BRANCH_MANAGER') {
            return NextResponse.json(
                { ok: false, message: '대리점장만 녹음 파일을 업로드할 수 있습니다.' },
                { status: 403 }
            );
        }

        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { ok: false, message: '파일이 제공되지 않았습니다.' },
                { status: 400 }
            );
        }

        // 파일 버퍼 변환
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Google Drive 업로드
        const uploadResult = await uploadFileToDrive({
            folderId: VOICE_RECORDING_FOLDER_ID,
            fileName: `${profile.displayName}_${contractId}_${file.name}`,
            mimeType: file.type,
            buffer: buffer,
        });

        if (!uploadResult.ok || !uploadResult.url) {
            throw new Error(uploadResult.error || 'Google Drive 업로드 실패');
        }

        // 계약서 메타데이터 업데이트
        const contract = await prisma.affiliateContract.findUnique({
            where: { id: parseInt(contractId) },
        });

        if (!contract) {
            return NextResponse.json(
                { ok: false, message: '계약서를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        const metadata = (contract.metadata as any) || {};
        const voiceRecordings = metadata.voiceRecordings || [];

        const newRecording = {
            id: uploadResult.fileId,
            url: uploadResult.url,
            name: file.name,
            uploadedAt: new Date().toISOString(),
            uploadedBy: profile.displayName,
        };

        await prisma.affiliateContract.update({
            where: { id: parseInt(contractId) },
            data: {
                metadata: {
                    ...metadata,
                    voiceRecordings: [...voiceRecordings, newRecording],
                },
            },
        });

        return NextResponse.json({
            ok: true,
            message: '녹음 파일이 성공적으로 업로드되었습니다.',
            recording: newRecording,
        });

    } catch (error: any) {
        console.error('[Voice Upload] Error:', error);
        const status = error instanceof PartnerApiError ? error.status : 500;
        return NextResponse.json(
            { ok: false, message: error.message || '업로드 중 오류가 발생했습니다.' },
            { status }
        );
    }
}
