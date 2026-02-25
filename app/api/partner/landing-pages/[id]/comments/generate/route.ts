export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import { askGemini } from '@/lib/gemini';

// POST: Gemini API로 댓글 자동 생성
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const { profile } = await requirePartnerContext();
    
    // 대리점장만 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, error: '대리점장만 접근 가능합니다' }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const landingPageId = parseInt(resolvedParams.id);
    if (isNaN(landingPageId)) {
      return NextResponse.json({ ok: false, error: '잘못된 랜딩페이지 ID' }, { status: 400 });
    }

    // 랜딩페이지 소유권 확인
    const landingPage = await prisma.landingPage.findFirst({
      where: {
        id: landingPageId,
        adminId: user.id, // 대리점장이 생성한 랜딩페이지만
      },
    });

    if (!landingPage) {
      return NextResponse.json({ ok: false, error: '랜딩페이지를 찾을 수 없거나 권한이 없습니다' }, { status: 404 });
    }

    const body = await req.json();
    const { count, departureDate, endDate } = body;

    if (!count || !departureDate || !endDate) {
      return NextResponse.json(
        { ok: false, error: '댓글 개수, 시작일, 종료일이 필요합니다' },
        { status: 400 }
      );
    }

    // HTML에서 텍스트 추출 (이미지 태그 제거하고 텍스트만)
    const textContent = landingPage.htmlContent
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 이미지 URL 추출 (상대 경로를 절대 경로로 변환)
    const imageMatches = landingPage.htmlContent.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || [];
    const imageUrls = imageMatches.map(img => {
      const match = img.match(/src=["']([^"']+)["']/);
      if (match) {
        let url = match[1];
        // 상대 경로를 절대 경로로 변환
        if (url.startsWith('/')) {
          url = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${url}`;
        } else if (!url.startsWith('http')) {
          url = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/${url}`;
        }
        return url;
      }
      return null;
    }).filter(Boolean);

    // Gemini API로 댓글 생성
    const prompt = `다음은 블로그형 랜딩페이지의 내용입니다:

제목: ${landingPage.title}
내용: ${textContent.substring(0, 2000)}${textContent.length > 2000 ? '...' : ''}

이 랜딩페이지에 대한 자연스러운 댓글 ${count}개를 생성해주세요.

요구사항:
1. 한국어로 작성
2. 자연스럽고 진짜 사람이 쓴 것처럼 작성
3. 이모티콘을 자연스럽게 사용 (ㅎㅎ, ㅋㅋ, ㅋ..., ..., ^^, :), 😊, 👍 등)
4. 댓글 내용은 페이지 내용과 관련되어야 함
5. 긍정적인 댓글이 대부분이지만, 일부는 중립적이거나 약간의 의문을 제기하는 댓글도 포함
6. 각 댓글은 20-100자 정도로 작성
7. 작성자 이름은 한국 이름으로 (예: 김민수, 이영희, 박지훈 등)

응답 형식은 JSON 배열로:
[
  {
    "authorName": "김민수",
    "content": "정말 좋은 정보네요! ㅎㅎ 저도 한번 신청해볼게요 ^^"
  },
  ...
]

${imageUrls.length > 0 ? `\n\n이 페이지에는 ${imageUrls.length}개의 이미지가 포함되어 있습니다. 이미지 URL: ${imageUrls.slice(0, 5).join(', ')}${imageUrls.length > 5 ? ' ...' : ''}\n이미지의 내용과 컨텍스트를 고려하여 댓글을 작성해주세요.` : ''}`;

    const messages = [
      { role: 'user' as const, content: prompt }
    ];

    let geminiResponse;
    try {
      geminiResponse = await askGemini(messages, 0.8);
    } catch (error: any) {
      console.error('[Generate Comments] Gemini API error:', error);
      return NextResponse.json(
        { ok: false, error: '댓글 생성에 실패했습니다: ' + error.message },
        { status: 500 }
      );
    }

    // Gemini 응답에서 JSON 파싱
    let comments: Array<{ authorName: string; content: string }> = [];
    try {
      const responseText = geminiResponse?.text || '';
      
      // JSON 코드 블록 찾기 (```json ... ``` 또는 ``` ... ``` 또는 직접 JSON)
      let jsonText = responseText;
      
      // 코드 블록 제거
      const codeBlockMatch = responseText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
      } else {
        // 직접 JSON 배열 찾기
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
      }
      
      if (jsonText) {
        comments = JSON.parse(jsonText);
      } else {
        throw new Error('JSON 형식을 찾을 수 없습니다. 응답: ' + responseText.substring(0, 200));
      }
    } catch (parseError: any) {
      console.error('[Generate Comments] JSON parse error:', parseError);
      console.error('[Generate Comments] Response text:', geminiResponse?.text?.substring(0, 500));
      return NextResponse.json(
        { ok: false, error: '댓글 파싱에 실패했습니다: ' + parseError.message },
        { status: 500 }
      );
    }

    // 댓글 개수 조정
    if (comments.length > count) {
      comments = comments.slice(0, count);
    }

    // 날짜 범위 계산
    const start = new Date(departureDate);
    const end = new Date(endDate);
    const dateRange = end.getTime() - start.getTime();

    // 댓글 생성 및 저장
    const createdComments = [];
    for (let i = 0; i < comments.length; i++) {
      // 날짜 범위 내 랜덤 날짜 생성
      const randomTime = start.getTime() + Math.random() * dateRange;
      const randomDate = new Date(randomTime);

      try {
        const comment = await prisma.landingPageComment.create({
          data: {
            landingPageId,
            authorName: comments[i].authorName || `사용자${i + 1}`,
            content: comments[i].content,
            createdAt: randomDate,
            isAutoGenerated: true,
          },
        });
        createdComments.push(comment);
      } catch (error: any) {
        console.error(`[Generate Comments] Failed to create comment ${i + 1}:`, error);
      }
    }

    return NextResponse.json({
      ok: true,
      count: createdComments.length,
      comments: createdComments,
    });
  } catch (error: any) {
    console.error('[Generate Comments] Error:', error);
    return NextResponse.json(
      { ok: false, error: '댓글 생성 중 오류가 발생했습니다: ' + error.message },
      { status: 500 }
    );
  }
}
