import { resolveGeminiModelName } from '@/lib/ai/geminiModel';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY');
}

type Msg = { role: 'user'|'assistant'|'system'; content: string };

type AskGeminiOptions = {
  model?: string;
};

export async function askGemini(
  messages: Msg[],
  temperature = 0.7,
  options: AskGeminiOptions = {}
) {
  const modelName = options.model?.trim() || resolveGeminiModelName();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const parts = (m: Msg) => [{ text: m.content }];
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: parts(m)
  }));

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { 
        temperature,
        maxOutputTokens: 2048,
        topP: 0.9,
        topK: 32,
      },
      tools: [
        {
          googleSearch: {}
        }
      ],
      safetySettings: []
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const t = await res.text().catch(()=> '');
    throw new Error(`Gemini error ${res.status}: ${t}`);
  }

  const json = await res.json();
  const textResponse = json?.candidates?.[0]?.content?.parts
    ?.map((p: any)=>p?.text)
    .filter(Boolean)
    .join('') ?? '';

  return {
    text: (textResponse || '').trim(),
  };
}

/**
 * 여권 이미지를 분석하여 구조화된 데이터를 반환합니다.
 * @param base64Image base64 인코딩된 이미지 문자열
 * @param mimeType 이미지 MIME 타입 (예: 'image/jpeg')
 * @returns 여권 정보 객체
 */
export async function scanPassport(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<{
  korName?: string;
  engSurname?: string;
  engGivenName?: string;
  passportNo?: string;
  nationality?: string;
  dateOfBirth?: string;
  gender?: string;
  birthDate?: string;
  issueDate?: string;
  expiryDate?: string;
  residentNum?: string; // 주민번호 앞 7자리 (자동 생성)
}> {
  console.log('[scanPassport] 함수 호출 시작, mimeType:', mimeType);
  
  // 프로젝트 표준: GEMINI_API_KEY 우선 사용 (크루즈가이드 지니와 동일)
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  
  console.log('[scanPassport] API Key 확인:', {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Set (✅ Using this)' : 'Not set',
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'Set' : 'Not set',
    GOOGLE_GEMINI_API_KEY: process.env.GOOGLE_GEMINI_API_KEY ? 'Set' : 'Not set',
    apiKeyFound: !!apiKey,
  });
  
  if (!apiKey) {
    console.error('[scanPassport] Error: API Key가 설정되지 않았습니다.');
    console.error('[scanPassport] .env 파일에 GEMINI_API_KEY를 설정해주세요.');
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  console.log('[scanPassport] API Key 확인 완료, Gemini AI 초기화 중...');
  
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const { resolveGeminiModelName } = await import('@/lib/ai/geminiModel');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = resolveGeminiModelName();
    console.log('[scanPassport] 모델명:', modelName);
    
    const model = genAI.getGenerativeModel({ model: modelName });

  // 여권 분석을 위한 통합 프롬프트 (이미지 회전 보정 + 기존 데이터 포맷팅 규칙 유지)
  const prompt = `

You are an advanced AI specialized in Optical Character Recognition (OCR) for international travel documents.

**TASK:**

Analyze the provided passport image and extract specific traveler data into a JSON object.

**[CRITICAL: IMAGE HANDLING]**

1.  **Auto-Rotation:** The image may be rotated 90, 180, or 270 degrees, or be vertical. **You must mentally rotate the image to standard horizontal orientation** to read the text correctly. Do not fail due to orientation.

2.  **Source of Truth:** Prioritize the **MRZ (Machine Readable Zone)** - the two lines at the bottom. It contains the most accurate English name, number, and dates.

3.  **Visual Zone:** Use the visual zone (upper part) to extract the **Korean Name (Hangul)** and verify other data.

**[CRITICAL: DATA FORMATTING RULES]**

- **korName:** Extract the **Korean name** (Hangul) from the visual zone. If not present, return an empty string "".

- **engSurname:** Extract from MRZ. Uppercase only (e.g., "HONG").

- **engGivenName:** Extract from MRZ. Uppercase only (e.g., "GILDONG").

- **passportNo:** Extract from MRZ. Uppercase alphanumeric.

- **nationality:** Convert to **ISO 2-letter code** (e.g., "REPUBLIC OF KOREA" -> "KR").

- **gender:** Return "M" or "F".

- **Dates (birthDate, issueDate, expiryDate):**

    - **MUST be in YYYY-MM-DD format.** (e.g., "1990-01-01")

    - If the MRZ has 2-digit years, convert wisely (e.g., '25' -> 2025 for expiry, '89' -> 1989 for birth).

    - **issueDate** is usually in the visual zone.

**OUTPUT FORMAT (JSON ONLY):**

{
  "korName": "홍길동",
  "engSurname": "HONG",
  "engGivenName": "GILDONG",
  "passportNo": "M12345678",
  "nationality": "KR",
  "birthDate": "1990-01-01",
  "gender": "M",
  "issueDate": "2020-01-01",
  "expiryDate": "2030-01-01"
}

Do not include any markdown formatting (like \`\`\`json) or comments. Just the raw JSON string.

`;

    console.log('[scanPassport] Gemini API 호출 중...');
    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { data: base64Image, mimeType } },
    ]);

    console.log('[scanPassport] Gemini API 응답 수신, 텍스트 추출 중...');
    const responseText = result.response.text().trim();
    console.log('[scanPassport] 응답 텍스트 (처음 200자):', responseText.substring(0, 200));
    
    // 1. 응답 정제 로직: 마크다운 코드 블록 제거
    let cleanText = responseText;
    
    // ```json ... ``` 형식 제거 (더 강화된 정규식)
    cleanText = cleanText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    
    // JSON 객체만 추출 (중괄호로 시작하고 끝나는 부분)
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanText = jsonMatch[0];
    }
    
    console.log('[scanPassport] 정제된 텍스트 (처음 200자):', cleanText.substring(0, 200));
    console.log('[scanPassport] JSON 파싱 시도 중...');
    
    // 2. JSON 파싱 안전장치
    let passportData;
    try {
      passportData = JSON.parse(cleanText);
    } catch (parseError: any) {
      console.error('[scanPassport] JSON 파싱 실패:', parseError);
      console.error('[scanPassport] JSON 파싱 실패 - 원본 텍스트 (전체):', responseText);
      console.error('[scanPassport] JSON 파싱 실패 - 정제된 텍스트 (전체):', cleanText);
      throw new Error(`Gemini 응답 파싱 실패: ${parseError.message}`);
    }
    
    console.log('[scanPassport] JSON 파싱 완료:', {
      korName: passportData.korName ? '있음' : '없음',
      passportNo: passportData.passportNo ? '있음' : '없음',
    });

    // 3. 날짜 형식 재검증 함수
    const validateDateFormat = (dateStr: string | null | undefined): string | undefined => {
      if (!dateStr || typeof dateStr !== 'string') {
        return undefined;
      }
      
      // YYYY-MM-DD 형식 검증
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(dateStr)) {
        // 유효한 날짜인지 확인
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return dateStr;
        }
      }
      
      // 형식이 맞지 않으면 null 처리
      console.warn('[scanPassport] 날짜 형식 오류:', dateStr, '-> null 처리');
      return undefined;
    };

    // 날짜 필드 재검증
    const validatedBirthDate = validateDateFormat(passportData.dateOfBirth || passportData.birthDate);
    const validatedIssueDate = validateDateFormat(passportData.issueDate);
    const validatedExpiryDate = validateDateFormat(passportData.expiryDate);

    // 국적 코드 정규화 (REPUBLIC OF KOREA -> KR)
    let normalizedNationality = passportData.nationality || undefined;
    if (normalizedNationality) {
      const nationalityMap: Record<string, string> = {
        'REPUBLIC OF KOREA': 'KR',
        'KOREA': 'KR',
        'SOUTH KOREA': 'KR',
        'UNITED STATES OF AMERICA': 'US',
        'USA': 'US',
        'JAPAN': 'JP',
        'CHINA': 'CN',
        'TAIWAN': 'TW',
        'HONG KONG': 'HK',
        'SINGAPORE': 'SG',
        'THAILAND': 'TH',
        'VIETNAM': 'VN',
        'PHILIPPINES': 'PH',
        'INDONESIA': 'ID',
        'MALAYSIA': 'MY',
        'UNITED KINGDOM': 'GB',
        'GERMANY': 'DE',
        'FRANCE': 'FR',
        'ITALY': 'IT',
        'SPAIN': 'ES',
        'AUSTRALIA': 'AU',
        'CANADA': 'CA',
      };
      const upperNationality = normalizedNationality.toUpperCase();
      normalizedNationality = nationalityMap[upperNationality] || normalizedNationality;
    }

    // 주민번호 앞 7자리 자동 생성 (birthDate와 gender를 조합)
    let residentNumPrefix: string | undefined = undefined;
    if (validatedBirthDate && passportData.gender) {
      try {
        const birthDateMatch = validatedBirthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (birthDateMatch) {
          const year = parseInt(birthDateMatch[1], 10);
          const month = birthDateMatch[2];
          const day = birthDateMatch[3];
          
          // 생년월일 6자리 (YYMMDD)
          const yearLastTwo = year % 100;
          const birthDateStr = `${String(yearLastTwo).padStart(2, '0')}${month}${day}`;
          
          // 성별 코드 결정
          const genderUpper = (passportData.gender || '').toUpperCase();
          let genderCode = '';
          
          if (genderUpper === 'M' || genderUpper === 'MALE' || genderUpper.includes('남')) {
            genderCode = year < 2000 ? '1' : '3'; // 남성: 1900년대=1, 2000년대=3
          } else if (genderUpper === 'F' || genderUpper === 'FEMALE' || genderUpper.includes('여')) {
            genderCode = year < 2000 ? '2' : '4'; // 여성: 1900년대=2, 2000년대=4
          }
          
          if (genderCode) {
            // 주민번호 앞 7자리 생성 (생년월일 6자리 + 하이픈 + 성별코드 1자리)
            residentNumPrefix = `${birthDateStr}-${genderCode}`;
            console.log('[scanPassport] 주민번호 앞 7자리 자동 생성:', residentNumPrefix);
          }
        }
      } catch (error) {
        console.warn('[scanPassport] 주민번호 생성 실패:', error);
      }
    }

    // 결과 반환 (null 값은 undefined로 변환, korName은 빈 문자열도 허용)
    return {
      korName: passportData.korName !== null && passportData.korName !== undefined ? passportData.korName : undefined,
      engSurname: passportData.engSurname || undefined,
      engGivenName: passportData.engGivenName || undefined,
      passportNo: passportData.passportNo || undefined,
      nationality: normalizedNationality,
      dateOfBirth: validatedBirthDate,
      birthDate: validatedBirthDate,
      gender: passportData.gender || undefined,
      issueDate: validatedIssueDate,
      expiryDate: validatedExpiryDate,
      residentNum: residentNumPrefix, // 주민번호 앞 7자리 자동 생성
    };
  } catch (error: any) {
    console.error('[scanPassport] Error:', error);
    console.error('[scanPassport] Error Stack:', error.stack);
    console.error('[scanPassport] Error Details:', {
      message: error.message,
      name: error.name,
      code: error.code,
    });
    
    throw new Error(`여권 정보를 읽을 수 없습니다: ${error.message}`);
  }
}
