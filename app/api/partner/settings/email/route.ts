export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  PartnerApiError,
  requirePartnerContext,
} from '@/app/api/partner/_utils';

// GET: 이메일 설정 조회
export async function GET(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext();

    // 대리점장인지 판매원인지 확인
    const isManager = profile.type === 'BRANCH_MANAGER' || profile.type === 'manager';

    let config;
    if (isManager) {
      config = await prisma.partnerEmailConfig.findUnique({
        where: { profileId: profile.id },
      });
    } else {
      config = await prisma.affiliateEmailConfig.findUnique({
        where: { profileId: profile.id },
      });
    }

    if (!config) {
      return NextResponse.json({
        ok: true,
        config: {
          senderName: '',
          senderEmail: '',
          signature: '',
          isActive: false,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      config: {
        senderName: config.senderName || '',
        senderEmail: config.senderEmail,
        signature: config.signature || '',
        isActive: config.isActive,
      },
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error('[Partner Email Config GET] Error:', error);
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : '이메일 설정을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 이메일 설정 저장/업데이트
export async function POST(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext();
    const body = await req.json();
    const { senderName, senderEmail, signature, isActive } = body;

    // 필수 필드 검증
    if (!senderEmail) {
      throw new PartnerApiError('발신자 이메일은 필수입니다.', 400);
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(senderEmail)) {
      throw new PartnerApiError('올바른 이메일 형식을 입력해주세요.', 400);
    }

    // 대리점장인지 판매원인지 확인
    const isManager = profile.type === 'BRANCH_MANAGER' || profile.type === 'manager';

    if (isManager) {
      // 대리점장 설정
      const existing = await prisma.partnerEmailConfig.findUnique({
        where: { profileId: profile.id },
      });

      if (existing) {
        await prisma.partnerEmailConfig.update({
          where: { profileId: profile.id },
          data: {
            senderName: senderName || null,
            senderEmail,
            signature: signature || null,
            isActive: isActive !== undefined ? isActive : true,
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.partnerEmailConfig.create({
          data: {
            profileId: profile.id,
            senderName: senderName || null,
            senderEmail,
            signature: signature || null,
            isActive: isActive !== undefined ? isActive : true,
            updatedAt: new Date(),
          },
        });
      }
    } else {
      // 판매원 설정
      const existing = await prisma.affiliateEmailConfig.findUnique({
        where: { profileId: profile.id },
      });

      if (existing) {
        await prisma.affiliateEmailConfig.update({
          where: { profileId: profile.id },
          data: {
            senderName: senderName || null,
            senderEmail,
            signature: signature || null,
            isActive: isActive !== undefined ? isActive : true,
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.affiliateEmailConfig.create({
          data: {
            profileId: profile.id,
            senderName: senderName || null,
            senderEmail,
            signature: signature || null,
            isActive: isActive !== undefined ? isActive : true,
            updatedAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: '이메일 설정이 저장되었습니다.',
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error('[Partner Email Config POST] Error:', error);
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : '이메일 설정 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
