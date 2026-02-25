// 꼭 추가 ⬇️  Edge가 아닌 Node 런타임에서 실행 (Buffer 사용 가능)
export const runtime = 'nodejs';
// 이미지/파일 업로드는 캐시 X
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveGeminiModelName } from '@/lib/ai/geminiModel';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(request: NextRequest) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '이미지 파일이 없습니다.' },
        { status: 400 }
      );
    }

    // 파일 → base64
    const bytes = await file.arrayBuffer();
    const base64String = Buffer.from(bytes).toString('base64');

    const modelName = resolveGeminiModelName();
    const model = genAI.getGenerativeModel({ model: modelName });

    // ⚡ 최적화된 프롬프트: 한국어 번역 + 숫자(가격) 보존
    const prompt = `이 이미지에서 모든 텍스트를 찾아서 한국어로 번역해주세요.

중요:
- 원본 언어(영어, 일본어 등)는 표시하지 마세요
- 한국어 번역만 답변하세요
- 숫자, 가격, 통화 기호(US$, $, ₩, ¥ 등)는 반드시 그대로 보존하세요
- 예: "US$7.5", "₩1000", "10개" 등은 숫자와 기호를 그대로 유지
- 텍스트가 없으면 "텍스트를 찾을 수 없습니다"라고만 답변
- 불필요한 설명이나 형식 없이 번역 결과만 답변하세요`;

    // Gemini 권장 형식
    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { data: base64String, mimeType: file.type || 'image/jpeg' } },
    ]);

    const text = result.response.text() || '';

    // 한국어 번역만 추출 (원본 텍스트 제거)
    let translatedText = '';
    
    if (text.includes('텍스트를 찾을 수 없습니다') || text.toLowerCase().includes('no text') || text.toLowerCase().includes('텍스트 없음')) {
      translatedText = '이미지에서 텍스트를 찾을 수 없습니다.';
    } else {
      // 응답을 정리: 불필요한 설명 제거 (숫자와 통화 기호는 보존)
      translatedText = text
        .replace(/원본\s*텍스트\s*[:：].*?(\n|$)/gi, '')
        .replace(/한국어\s*번역\s*[:：]\s*/gi, '')
        .replace(/번역\s*결과\s*[:：]\s*/gi, '')
        .trim();
      
      // 원본 언어 텍스트 패턴 제거 (영어, 일본어 등) - 하지만 숫자와 통화 기호는 보존
      // 한국어 + 숫자 + 통화 기호 + 공백만 남기기
      const lines = translatedText.split('\n');
      const cleanedLines = lines.map(line => {
        // 한국어, 숫자, 통화 기호, 공백, 일반 구두점만 추출
        // 패턴: 한국어 + 숫자 + US$, $, ₩, ¥, 원, 달러 등
        const cleaned = line.replace(/[^가-힣\s\d\.,\-\$₩¥원달러US\$%\*]+/g, '').trim();
        return cleaned;
      }).filter(line => line.length > 0);
      
      translatedText = cleanedLines.join('\n').trim();
      
      // 여전히 원본 텍스트가 섞여있으면 한국어 + 숫자 + 통화 기호만 추출
      if (translatedText.length > 1000) {
        // 너무 길면 한국어와 숫자가 포함된 라인만 추출
        const koreanWithNumbers = translatedText.match(/[가-힣\s]+[\d\s\.,\-\$₩¥원달러US\$%]+/g);
        if (koreanWithNumbers && koreanWithNumbers.length > 0) {
          translatedText = koreanWithNumbers.join('\n').trim();
        }
      }
      
      // 최종 결과가 비어있으면 전체 텍스트 사용 (숫자는 보존)
      if (!translatedText || translatedText.length < 5) {
        translatedText = text.trim();
      }
    }

    return NextResponse.json({
      success: true,
      originalText: '', // 원본 텍스트 제거
      translatedText, // 한국어 번역만 반환
      fullResponse: text,
    });
  } catch (err: any) {
    console.error('[Vision API Error]', err?.message || err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || '이미지 분석 중 오류가 발생했습니다.',
        originalText: '',
        translatedText: '이미지 분석에 실패했습니다. 다시 시도해주세요.',
      },
      { status: 500 }
    );
  }
} 