import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';
import { normalizePhone, isValidMobilePhone } from '@/lib/phone-utils';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    await requirePartnerContext();
    const { name, phone } = await req.json();

    if (!name || !phone) {
      return NextResponse.json({ ok: false, error: '이름과 연락처는 필수입니다.' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || !isValidMobilePhone(normalizedPhone)) {
      return NextResponse.json({ ok: false, error: '올바른 한국 휴대폰 번호를 입력해주세요.' }, { status: 400 });
    }

    const existing = await prisma.user.findFirst({
      where: {
        name,
        phone: normalizedPhone,
      },
    });

    if (existing) {
      return NextResponse.json({
        ok: true,
        user: {
          id: existing.id,
          name: existing.name,
          phone: existing.phone,
        },
        isExisting: true,
      });
    }

    const now = new Date();
    const user = await prisma.user.create({
      data: {
        name,
        phone: normalizedPhone,
        password: '3800',
        role: 'user',
        onboarded: false,
        loginCount: 0,
        tripCount: 0,
        totalTripCount: 0,
        customerStatus: 'prospects',
        updatedAt: now,
      },
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
      },
      isExisting: false,
    });
  } catch (error) {
    logger.error('[Partner AssignTrip] create genie error:', error);
    return NextResponse.json(
      { ok: false, error: '동행자 사용자 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
