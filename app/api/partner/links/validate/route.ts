export const dynamic = 'force-dynamic';

// app/api/partner/links/validate/route.ts
// 링크 유효성 검사 API

import { NextRequest, NextResponse } from 'next/server';

// POST: 링크 유효성 검사
export async function POST(req: NextRequest) {
  try {
    const { links } = await req.json();

    if (!Array.isArray(links)) {
      return NextResponse.json(
        { ok: false, error: 'links must be an array' },
        { status: 400 }
      );
    }

    // 각 링크의 유효성 검사 (비동기)
    const validationResults = await Promise.allSettled(
      links.map(async (link: { url: string }) => {
        if (!link.url) {
          return { url: link.url, valid: false, error: 'URL is missing' };
        }

        try {
          // 상대 경로인 경우 절대 경로로 변환
          let testUrl = link.url;
          if (link.url.startsWith('/')) {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cruisedot.co.kr';
            testUrl = `${baseUrl}${link.url}`;
          }

          // HEAD 요청으로 링크 유효성 검사
          const response = await fetch(testUrl, {
            method: 'HEAD',
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; LinkValidator/1.0)',
            },
            // 타임아웃 설정 (5초)
            signal: AbortSignal.timeout(5000),
          });

          return {
            url: link.url,
            valid: response.ok,
            status: response.status,
            error: response.ok ? null : `HTTP ${response.status}`,
          };
        } catch (error: any) {
          // 네트워크 오류나 타임아웃 등
          return {
            url: link.url,
            valid: false,
            error: error.message || 'Network error',
          };
        }
      })
    );

    // 결과 정리
    const results = validationResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          url: links[index]?.url || 'unknown',
          valid: false,
          error: result.reason?.message || 'Validation failed',
        };
      }
    });

    return NextResponse.json({
      ok: true,
      results,
    });
  } catch (error: any) {
    console.error('[Link Validation] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Link validation failed' },
      { status: 500 }
    );
  }
}
