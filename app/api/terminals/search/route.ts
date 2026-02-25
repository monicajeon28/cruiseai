export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';

interface Terminal {
  name: string;
  name_ko: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  keywords: string[];
  keywords_ko: string[];
}

/**
 * GET: 기항지 이름으로 터미널 위치 검색
 */
export async function GET(req: NextRequest) {
  try {
    const location = req.nextUrl.searchParams.get('location');

    if (!location) {
      return NextResponse.json(
        { error: '위치 정보가 필요합니다' },
        { status: 400 }
      );
    }

    // terminals.json 파일 읽기
    const terminalsPath = path.join(process.cwd(), 'data', 'terminals.json');
    const terminalsData = JSON.parse(readFileSync(terminalsPath, 'utf-8'));
    const terminals: Terminal[] = terminalsData.terminals || [];

    // 검색 로직 (이름 또는 키워드 매칭)
    const searchTerm = location.toLowerCase();
    const results = terminals.filter(
      (terminal) =>
        terminal.name.toLowerCase().includes(searchTerm) ||
        terminal.name_ko.toLowerCase().includes(searchTerm) ||
        terminal.city.toLowerCase().includes(searchTerm) ||
        terminal.keywords.some((k) => k.toLowerCase().includes(searchTerm)) ||
        terminal.keywords_ko.some((k) => k.toLowerCase().includes(searchTerm))
    );

    return NextResponse.json(
      { data: results },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] 터미널 검색 오류:', error);
    return NextResponse.json(
      { error: '터미널 검색 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
