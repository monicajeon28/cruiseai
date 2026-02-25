export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * POST: PWA 설치 완료 추적
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { type } = body; // 'genie' 또는 'mall'

    if (!type || (type !== 'genie' && type !== 'mall')) {
      return NextResponse.json(
        { ok: false, error: '올바른 타입을 지정해주세요 (genie 또는 mall)' },
        { status: 400 }
      );
    }

    // 이미 설치 기록이 있는지 확인
    const existingUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        pwaGenieInstalledAt: true,
        pwaMallInstalledAt: true,
      },
    });

    // 이미 설치되어 있으면 업데이트하지 않음 (최초 설치 시간 유지)
    if (type === 'genie' && existingUser?.pwaGenieInstalledAt) {
      return NextResponse.json({ 
        ok: true, 
        message: '이미 설치 기록이 있습니다',
        installedAt: existingUser.pwaGenieInstalledAt,
      });
    }

    if (type === 'mall' && existingUser?.pwaMallInstalledAt) {
      return NextResponse.json({ 
        ok: true, 
        message: '이미 설치 기록이 있습니다',
        installedAt: existingUser.pwaMallInstalledAt,
      });
    }

    // 설치 시간 기록
    const updateData: any = {};
    if (type === 'genie') {
      updateData.pwaGenieInstalledAt = new Date();
    } else if (type === 'mall') {
      updateData.pwaMallInstalledAt = new Date();
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        pwaGenieInstalledAt: true,
        pwaMallInstalledAt: true,
      },
    });

    console.log(`[PWA Install] ${type === 'genie' ? '크루즈가이드 지니' : '크루즈몰'} PWA 설치 기록:`, {
      userId: user.id,
      userName: user.name,
      installedAt: updateData[type === 'genie' ? 'pwaGenieInstalledAt' : 'pwaMallInstalledAt'],
    });

    return NextResponse.json({
      ok: true,
      message: `${type === 'genie' ? '크루즈가이드 지니' : '크루즈몰'} PWA 설치가 기록되었습니다`,
      installedAt: updatedUser[type === 'genie' ? 'pwaGenieInstalledAt' : 'pwaMallInstalledAt'],
    });
  } catch (error) {
    console.error('[PWA Install] Error:', error);
    return NextResponse.json(
      { ok: false, error: '설치 기록 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
