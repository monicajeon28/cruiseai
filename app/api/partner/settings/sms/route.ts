export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  PartnerApiError,
  requirePartnerContext,
} from '@/app/api/partner/_utils';

// GET: SMS API 설정 조회
export async function GET(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext();

    // 대리점장인지 판매원인지 확인
    const isManager = profile.type === 'BRANCH_MANAGER' || profile.type === 'manager';
    
    let config;
    if (isManager) {
      config = await prisma.partnerSmsConfig.findUnique({
        where: { profileId: profile.id },
      });
    } else {
      config = await prisma.affiliateSmsConfig.findUnique({
        where: { profileId: profile.id },
      });
    }

    if (!config) {
      return NextResponse.json({
        ok: true,
        config: {
          provider: 'aligo',
          apiKey: '',
          userId: '',
          senderPhone: '',
          ipAddress: '',
          kakaoSenderKey: '',
          kakaoChannelId: '',
          isActive: false,
        },
      });
    }

    // metadata에서 ipAddress 추출
    const metadata = config.metadata as { ipAddress?: string } | null;
    const ipAddress = metadata?.ipAddress || '';

    return NextResponse.json({
      ok: true,
      config: {
        provider: config.provider,
        apiKey: config.apiKey,
        userId: config.userId,
        senderPhone: config.senderPhone,
        ipAddress,
        kakaoSenderKey: config.kakaoSenderKey || '',
        kakaoChannelId: config.kakaoChannelId || '',
        isActive: config.isActive,
      },
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error('[Partner SMS Config GET] Error:', error);
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'SMS 설정을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: SMS API 설정 저장/업데이트
export async function POST(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext();
    const body = await req.json();
    const { provider, apiKey, userId, senderPhone, ipAddress, kakaoSenderKey, kakaoChannelId, isActive } = body;

    // metadata에 ipAddress 저장
    const metadata = ipAddress ? { ipAddress } : null;

    // 필수 필드 검증
    if (!provider || !apiKey || !userId || !senderPhone) {
      throw new PartnerApiError('필수 필드를 모두 입력해주세요. (제공자, API 키, 사용자 ID, 발신번호)', 400);
    }

    // 대리점장인지 판매원인지 확인
    const isManager = profile.type === 'BRANCH_MANAGER' || profile.type === 'manager';

    if (isManager) {
      // 대리점장 설정
      const existing = await prisma.partnerSmsConfig.findUnique({
        where: { profileId: profile.id },
      });

      if (existing) {
        await prisma.partnerSmsConfig.update({
          where: { profileId: profile.id },
          data: {
            provider,
            apiKey,
            userId,
            senderPhone,
            kakaoSenderKey: kakaoSenderKey || null,
            kakaoChannelId: kakaoChannelId || null,
            isActive: isActive !== undefined ? isActive : true,
            metadata,
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.partnerSmsConfig.create({
          data: {
            profileId: profile.id,
            provider,
            apiKey,
            userId,
            senderPhone,
            kakaoSenderKey: kakaoSenderKey || null,
            kakaoChannelId: kakaoChannelId || null,
            isActive: isActive !== undefined ? isActive : true,
            metadata,
            updatedAt: new Date(),
          },
        });
      }
    } else {
      // 판매원 설정
      const existing = await prisma.affiliateSmsConfig.findUnique({
        where: { profileId: profile.id },
      });

      if (existing) {
        await prisma.affiliateSmsConfig.update({
          where: { profileId: profile.id },
          data: {
            provider,
            apiKey,
            userId,
            senderPhone,
            kakaoSenderKey: kakaoSenderKey || null,
            kakaoChannelId: kakaoChannelId || null,
            isActive: isActive !== undefined ? isActive : true,
            metadata,
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.affiliateSmsConfig.create({
          data: {
            profileId: profile.id,
            provider,
            apiKey,
            userId,
            senderPhone,
            kakaoSenderKey: kakaoSenderKey || null,
            kakaoChannelId: kakaoChannelId || null,
            isActive: isActive !== undefined ? isActive : true,
            metadata,
            updatedAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'SMS API 설정이 저장되었습니다.',
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error('[Partner SMS Config POST] Error:', error);
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'SMS 설정 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
