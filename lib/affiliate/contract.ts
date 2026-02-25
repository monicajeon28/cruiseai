// lib/affiliate/contract.ts
// 계약서 관리 유틸리티 (구글 문서 연동, 서명 기능)

import prisma from '@/lib/prisma';
import { google } from 'googleapis';
import { getGoogleAuth } from '@/lib/google-drive';
import { nanoid } from 'nanoid';

/**
 * 계약서 상태 업데이트 함수
 * API route에서 사용되던 함수를 여기로 이동
 */
export async function updateContractStatus(
  contractId: number,
  status: string,
  reviewerId?: number,
  data: Record<string, any> = {},
) {
  return prisma.affiliateContract.update({
    where: { id: contractId },
    data: {
      status,
      reviewerId: reviewerId ?? null,
      reviewedAt: new Date(),
      ...data,
    },
  });
}

// 구글 문서 API 클라이언트 초기화
function getGoogleDocsClient() {
  const auth = getGoogleAuth([
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive',
  ]);

  return {
    docs: google.docs({ version: 'v1', auth }),
    drive: google.drive({ version: 'v3', auth }),
  };
}

// 계약서 템플릿에서 변수 추출 (예: {이름}, {전화번호} 등)
function extractVariables(template: string): string[] {
  const matches = template.match(/\{([^}]+)\}/g);
  return matches ? matches.map((m) => m.slice(1, -1)) : [];
}

// 계약서 템플릿에 데이터 채우기
function fillTemplate(template: string, data: Record<string, string>): string {
  let filled = template;
  for (const [key, value] of Object.entries(data)) {
    filled = filled.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  return filled;
}

// 구글 문서에서 계약서 생성
export async function createContractDocument(
  templateId: string,
  data: {
    affiliateName: string;
    affiliatePhone: string;
    affiliateEmail?: string;
    affiliateAddress?: string;
    bankName?: string;
    bankAccount?: string;
    bankAccountHolder?: string;
    contractDate: string;
    [key: string]: string | undefined;
  }
): Promise<{ documentId: string; documentUrl: string }> {
  try {
    // 구글 서비스 계정 인증 정보 확인 (getGoogleAuth 내부에서 처리됨)
    // if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    //   throw new Error('구글 서비스 계정 설정이 필요합니다.');
    // }

    const { docs, drive } = getGoogleDocsClient();

    // 템플릿 문서 복사
    const copiedFile = await drive.files.copy({
      fileId: templateId,
      requestBody: {
        name: `계약서_${data.affiliateName}_${new Date().toISOString().split('T')[0]}`,
      },
    });

    const documentId = copiedFile.data.id!;

    // 템플릿 내용 읽기
    const document = await docs.documents.get({
      documentId: templateId,
    });

    const content = document.data.body?.content || [];
    const requests: any[] = [];

    // 텍스트 내용에서 변수 찾아서 치환
    // 간단한 방법: 전체 문서를 읽어서 변수 치환
    let fullText = '';
    for (const element of content) {
      if (element.paragraph) {
        for (const elem of element.paragraph.elements || []) {
          if (elem.textRun) {
            fullText += elem.textRun.content || '';
          }
        }
      }
    }

    // 변수 추출 및 치환 요청 생성
    const variables = extractVariables(fullText);
    for (const variable of variables) {
      const value = data[variable] || '';
      if (value) {
        requests.push({
          replaceAllText: {
            containsText: {
              text: `{${variable}}`,
              matchCase: false,
            },
            replaceText: value,
          },
        });
      }
    }

    // 변수 치환 실행
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests,
        },
      });
    }

    // 문서 공유 설정 (읽기 전용)
    // 공유 드라이브에서는 상위 폴더 권한을 상속받으므로 실패할 수 있음
    try {
      await drive.permissions.create({
        fileId: documentId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
        supportsAllDrives: true,
      });
    } catch (permError: any) {
      console.warn('[Contract] Permission setting skipped:', permError?.message);
    }

    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;

    return {
      documentId,
      documentUrl,
    };
  } catch (error) {
    console.error('[Contract] Google Docs creation error:', error);
    throw new Error('계약서 문서 생성에 실패했습니다.');
  }
}

// 서명 링크 생성
export async function createSignatureLink(
  contractId: number,
  recipientEmail: string,
  recipientPhone?: string
): Promise<{ signatureToken: string; signatureUrl: string; expiresAt: Date }> {
  const signatureToken = nanoid(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7일 유효

  // 계약서에 서명 토큰 저장
  await prisma.affiliateContract.update({
    where: { id: contractId },
    data: {
      metadata: {
        signatureToken,
        signatureExpiresAt: expiresAt.toISOString(),
        signatureRecipientEmail: recipientEmail,
        signatureRecipientPhone: recipientPhone,
      },
    },
  });

  const signatureUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/affiliate/contract/sign/${signatureToken}`;

  return {
    signatureToken,
    signatureUrl,
    expiresAt,
  };
}

// 서명 토큰 검증 및 계약서 조회
export async function verifySignatureToken(token: string): Promise<{
  contract: any;
  isValid: boolean;
  isExpired: boolean;
}> {
  const contract = await prisma.affiliateContract.findFirst({
    where: {
      metadata: {
        path: ['signatureToken'],
        equals: token,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      reviewer: {
        select: {
          id: true,
          name: true,
        },
      },
      invitedBy: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  if (!contract) {
    return { contract: null, isValid: false, isExpired: false };
  }

  const metadata = contract.metadata as any;
  const expiresAt = metadata?.signatureExpiresAt
    ? new Date(metadata.signatureExpiresAt)
    : null;

  const isExpired = expiresAt ? new Date() > expiresAt : false;
  const isValid = !isExpired && contract.status !== 'SIGNED';

  return {
    contract,
    isValid,
    isExpired,
  };
}

// 서명 완료 처리
export async function completeSignature(
  token: string,
  signatureData: {
    signatureImage?: string; // 서명 이미지 (base64)
    signedByName: string;
    signedAt: string;
  }
): Promise<{ success: boolean; contract: any }> {
  const verification = await verifySignatureToken(token);

  if (!verification.isValid) {
    throw new Error(verification.isExpired ? '서명 링크가 만료되었습니다.' : '유효하지 않은 서명 링크입니다.');
  }

  const contract = await prisma.affiliateContract.update({
    where: { id: verification.contract.id },
    data: {
      status: 'SIGNED',
      contractSignedAt: new Date(),
      metadata: {
        ...(verification.contract.metadata as any),
        signature: {
          signedByName: signatureData.signedByName,
          signedAt: signatureData.signedAt,
          signatureImage: signatureData.signatureImage,
        },
        signatureCompletedAt: new Date().toISOString(),
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      invitedBy: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  return {
    success: true,
    contract,
  };
}

// 계약서 발송 (이메일/SMS/카카오톡)
export async function sendContractLink(
  contractId: number,
  recipientEmail: string,
  recipientPhone?: string,
  aligoSettings?: {
    apiKey: string;
    userId: string;
    senderPhone: string;
    kakaoSenderKey?: string;
    kakaoChannelId?: string;
  }
): Promise<{ success: boolean; signatureUrl: string }> {
  const { signatureUrl } = await createSignatureLink(contractId, recipientEmail, recipientPhone);

  const contract = await prisma.affiliateContract.findUnique({
    where: { id: contractId },
    include: {
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!contract) {
    throw new Error('계약서를 찾을 수 없습니다.');
  }

  const results: any = {
    email: false,
    sms: false,
    kakao: false,
  };

  // 이메일 발송
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: recipientEmail,
      subject: '[계약서 서명 요청] 어필리에이트 계약서',
      html: `
        <div style="font-family: 'Malgun Gothic', sans-serif; padding: 20px;">
          <h2>계약서 서명 요청</h2>
          <p>안녕하세요, ${contract.user?.name || '고객'}님,</p>
          <p>어필리에이트 계약서 서명을 요청드립니다.</p>
          <p>아래 링크를 클릭하여 계약서를 확인하고 서명해주세요.</p>
          <p><a href="${signatureUrl}" style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">계약서 서명하기</a></p>
          <p style="color: #999; font-size: 12px;">이 링크는 7일간 유효합니다.</p>
        </div>
      `,
    });

    results.email = true;
  } catch (error) {
    console.error('[Contract] Email send error:', error);
  }

  // SMS/카카오톡 발송 (알리고 설정이 있는 경우)
  if (recipientPhone && aligoSettings) {
    const message = `[계약서 서명 요청]\n\n${contract.user?.name || '고객'}님, 어필리에이트 계약서 서명을 요청드립니다.\n\n링크: ${signatureUrl}\n\n이 링크는 7일간 유효합니다.`;

    // SMS 발송
    try {
      const smsResponse = await fetch('https://apis.aligo.in/send/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          key: aligoSettings.apiKey,
          user_id: aligoSettings.userId,
          sender: aligoSettings.senderPhone,
          receiver: recipientPhone.replace(/[^0-9]/g, ''),
          msg: message,
          testmode_yn: 'N',
        }),
      });

      const smsResult = await smsResponse.json();
      if (smsResult.result_code === '1') {
        results.sms = true;
      }
    } catch (error) {
      console.error('[Contract] SMS send error:', error);
    }

    // 카카오톡 알림톡 발송 (설정된 경우)
    if (aligoSettings.kakaoSenderKey && aligoSettings.kakaoChannelId) {
      try {
        const kakaoResponse = await fetch('https://apis.aligo.in/akv10/alimtalk/send/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            key: aligoSettings.apiKey,
            user_id: aligoSettings.userId,
            senderkey: aligoSettings.kakaoSenderKey,
            channel: aligoSettings.kakaoChannelId,
            receiver: recipientPhone.replace(/[^0-9]/g, ''),
            message: message,
            testmode_yn: 'N',
          }),
        });

        const kakaoResult = await kakaoResponse.json();
        if (kakaoResult.result_code === '1') {
          results.kakao = true;
        }
      } catch (error) {
        console.error('[Contract] KakaoTalk send error:', error);
      }
    }
  }

  // 발송 로그 기록
  await prisma.adminActionLog.create({
    data: {
      adminId: 1, // TODO: 실제 관리자 ID
      targetUserId: contract.userId || null,
      action: 'affiliate.contract.sent',
      details: {
        contractId,
        signatureUrl,
        sent: results,
        sentAt: new Date().toISOString(),
      },
    },
  });

  return {
    success: results.email || results.sms || results.kakao,
    signatureUrl,
  };
}
