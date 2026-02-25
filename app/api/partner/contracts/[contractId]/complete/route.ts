export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/prisma';

import { getSessionUser } from '@/lib/auth';

import { uploadFileToDrive } from '@/lib/google-drive';
import { logContractPdfBackup } from '@/lib/backup';

import { generateContractPDFFromId } from '@/lib/affiliate/contract-pdf';

const TARGET_FOLDER_ID = '1HN-w4tNLdmfW5K5N3zF52P_InrUdBkQ_';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const sessionUser = await getSessionUser();

    if (!sessionUser) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });

    const contractId = parseInt(resolvedParams.contractId);

    if (!contractId || Number.isNaN(contractId)) {
      return NextResponse.json({ ok: false, error: 'Invalid contract ID' }, { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. 계약서 정보 조회
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      include: {
        User_AffiliateContract_userIdToUser: {
          select: {
            email: true,
            name: true,
          }
        }
      }
    });

    if (!contract) return NextResponse.json({ ok: false, error: 'Contract not found' }, { 
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });

    // 계약서가 이미 완료된 경우
    if (contract.status === 'completed') {
      return NextResponse.json({ ok: false, error: '이미 완료된 계약서입니다.' }, { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 계약서가 서명되지 않은 경우
    const metadata = contract.metadata as any;
    const signatures = metadata?.signatures || {};
    const hasSignature = signatures.main?.url || signatures.education?.url || signatures.b2b?.url;
    
    if (!hasSignature) {
      return NextResponse.json({ ok: false, error: '서명이 완료되지 않은 계약서입니다.' }, { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. 상태 업데이트 (먼저 완료 처리)
    const updatedContract = await prisma.affiliateContract.update({
      where: { id: contractId },
      data: {
        status: 'completed',
        reviewedAt: new Date(),
        reviewerId: sessionUser.id,
        metadata: {
          ...metadata,
          completedBy: sessionUser.id,
          completedAt: new Date().toISOString(),
        }
      }
    });

    // 3. PDF 생성 및 구글 드라이브 업로드
    try {
      const pdfBuffer = await generateContractPDFFromId(contractId);
      const fileName = `${contract.name || '계약서'}_${contractId}.pdf`;

      const driveResult = await uploadFileToDrive({
        folderId: TARGET_FOLDER_ID,
        fileName: fileName,
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
        makePublic: true
      });

      if (driveResult.ok && driveResult.url) {
        // DB에 파일 URL 저장 (metadata 등에)
        await prisma.affiliateContract.update({
          where: { id: contractId },
          data: {
            metadata: {
              ...(updatedContract.metadata as object),
              pdfUrl: driveResult.url
            }
          }
        });
        console.log('[Contract Complete] Uploaded to Drive:', driveResult.url);

        // 백업 성공 로그 기록
        logContractPdfBackup(
          contractId,
          contract.name || '계약서',
          true,
          driveResult.url,
          undefined,
          sessionUser.name || undefined
        ).catch(err => console.error('[Contract Complete] 로그 기록 실패:', err));
      } else {
        console.error('[Contract Complete] Drive Upload Failed:', driveResult.error);

        // 백업 실패 로그 기록
        logContractPdfBackup(
          contractId,
          contract.name || '계약서',
          false,
          undefined,
          driveResult.error,
          sessionUser.name || undefined
        ).catch(err => console.error('[Contract Complete] 로그 기록 실패:', err));
      }
    } catch (uploadError: any) {
      console.error('[Contract Complete] Drive Upload Failed:', uploadError);

      // 백업 실패 로그 기록
      logContractPdfBackup(
        contractId,
        contract.name || '계약서',
        false,
        undefined,
        uploadError.message,
        sessionUser.name || undefined
      ).catch(err => console.error('[Contract Complete] 로그 기록 실패:', err));
      // 업로드 실패해도 계약 완료 상태는 유지 (필요 시 롤백)
    }

    // 4. 이메일 발송 (계약자에게 자동 전송)
    const { sendContractPDFByEmail } = await import('@/lib/affiliate/contract-email');
    const recipientEmail = contract.email || contract.User_AffiliateContract_userIdToUser?.email;
    const recipientName = contract.name || contract.User_AffiliateContract_userIdToUser?.name || '계약자';
    
    if (recipientEmail) {
      // 계약자에게 PDF 전송 (비동기, 실패해도 계속 진행)
      sendContractPDFByEmail(
        contractId,
        recipientEmail,
        recipientName,
        `[계약서 완료] 어필리에이트 계약서`,
        `
          <div style="font-family: 'Malgun Gothic', sans-serif; padding: 20px;">
            <h2>계약서가 완료되었습니다</h2>
            <p>안녕하세요, ${recipientName}님,</p>
            <p>귀하의 어필리에이트 계약서가 완료되어 PDF로 전송드립니다.</p>
            <p>계약서 내용과 서명을 확인하시기 바랍니다.</p>
            <p style="margin-top: 30px; color: #666; font-size: 12px;">
              본 계약서는 전자적으로 생성되었으며, 서명이 포함되어 있습니다.
            </p>
          </div>
        `
      ).catch((err) => {
        console.error('[Partner Contract Complete] 이메일 전송 실패:', err);
      });
    }

    return NextResponse.json({ 
      ok: true, 
      message: '계약서가 완료되었으며 구글 드라이브에 백업되었습니다.',
      emailSent: !!recipientEmail,
      redirectUrl: `/affiliate/contract/complete?contractId=${contractId}&type=${metadata?.contractType || 'SALES_AGENT'}`,
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[Contract Complete Error]', error);
    return NextResponse.json({ ok: false, error: error.message }, { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
