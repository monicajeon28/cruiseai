export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { requirePartnerContext } from '@/app/api/partner/_utils';

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'admin-settings.json');

// 설정 파일 읽기
async function readSettingsFile(): Promise<any> {
  try {
    const content = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { serverIps: [] };
  }
}

// GET: 본사 서버 IP 조회 (알리고 API 설정용)
export async function GET(req: NextRequest) {
  try {
    // 파트너 인증 확인
    await requirePartnerContext();

    const settings = await readSettingsFile();
    const serverIps = settings.serverIps || [];

    // 첫 번째 IP를 메인 IP로 사용
    const mainIp = serverIps.length > 0 ? serverIps[0].ip : null;

    return NextResponse.json({
      ok: true,
      serverIp: mainIp,
      message: mainIp
        ? '알리고 API 설정 시 아래 IP를 "발신 IP"에 입력해주세요.'
        : '서버 IP가 아직 설정되지 않았습니다. 관리자에게 문의하세요.',
    });
  } catch (error) {
    console.error('[Partner Server IP] Error:', error);
    return NextResponse.json(
      { ok: false, error: '서버 IP 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
