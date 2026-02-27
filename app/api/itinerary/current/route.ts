export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

const COUNTRY_NAMES: Record<string, string> = {
  'IT': '이탈리아', 'GR': '그리스', 'HR': '크로아티아',
  'ES': '스페인', 'FR': '프랑스', 'DE': '독일', 'TR': '터키',
  'PT': '포르투갈', 'ME': '몬테네그로', 'MT': '몰타',
  'JP': '일본', 'KR': '한국', 'CN': '중국', 'SG': '싱가포르',
  'TH': '태국', 'VN': '베트남', 'MY': '말레이시아', 'ID': '인도네시아',
  'US': '미국', 'MX': '멕시코', 'BS': '바하마', 'BM': '버뮤다',
  'NO': '노르웨이', 'IS': '아이슬란드', 'FI': '핀란드', 'SE': '스웨덴',
  'EE': '에스토니아', 'LV': '라트비아', 'RU': '러시아',
  'GB': '영국', 'NL': '네덜란드', 'BE': '벨기에', 'DK': '덴마크',
};

const LANGUAGE_MAP: Record<string, { code: string; name: string; flag: string }> = {
  일본: { code: 'ja-JP', name: '일본어', flag: '🇯🇵' },
  중국: { code: 'zh-CN', name: '중국어', flag: '🇨🇳' },
  홍콩: { code: 'zh-HK', name: '광둥어', flag: '🇭🇰' },
  대만: { code: 'zh-TW', name: '대만어', flag: '🇹🇼' },
  태국: { code: 'th-TH', name: '태국어', flag: '🇹🇭' },
  베트남: { code: 'vi-VN', name: '베트남어', flag: '🇻🇳' },
  인도네시아: { code: 'id-ID', name: '인도네시아어', flag: '🇮🇩' },
  말레이시아: { code: 'ms-MY', name: '말레이어', flag: '🇲🇾' },
  프랑스: { code: 'fr-FR', name: '프랑스어', flag: '🇫🇷' },
  이탈리아: { code: 'it-IT', name: '이탈리아어', flag: '🇮🇹' },
  스페인: { code: 'es-ES', name: '스페인어', flag: '🇪🇸' },
  독일: { code: 'de-DE', name: '독일어', flag: '🇩🇪' },
  러시아: { code: 'ru-RU', name: '러시아어', flag: '🇷🇺' },
  미국: { code: 'en-US', name: '영어', flag: '🇺🇸' },
  Japan: { code: 'ja-JP', name: '일본어', flag: '🇯🇵' },
  China: { code: 'zh-CN', name: '중국어', flag: '🇨🇳' },
  'Hong Kong': { code: 'zh-HK', name: '광둥어', flag: '🇭🇰' },
  Taiwan: { code: 'zh-TW', name: '대만어', flag: '🇹🇼' },
  Thailand: { code: 'th-TH', name: '태국어', flag: '🇹🇭' },
  Vietnam: { code: 'vi-VN', name: '베트남어', flag: '🇻🇳' },
  Indonesia: { code: 'id-ID', name: '인도네시아어', flag: '🇮🇩' },
  Malaysia: { code: 'ms-MY', name: '말레이어', flag: '🇲🇾' },
  France: { code: 'fr-FR', name: '프랑스어', flag: '🇫🇷' },
  Italy: { code: 'it-IT', name: '이탈리아어', flag: '🇮🇹' },
  Spain: { code: 'es-ES', name: '스페인어', flag: '🇪🇸' },
  Germany: { code: 'de-DE', name: '독일어', flag: '🇩🇪' },
  Russia: { code: 'ru-RU', name: '러시아어', flag: '🇷🇺' },
  US: { code: 'en-US', name: '영어', flag: '🇺🇸' },
  USA: { code: 'en-US', name: '영어', flag: '🇺🇸' },
  // ISO 코드 기반 (itinerary.country가 ISO 코드로 저장되는 경우 대응)
  GR: { code: 'el-GR', name: '그리스어', flag: '🇬🇷' },
  HR: { code: 'hr-HR', name: '크로아티아어', flag: '🇭🇷' },
  TR: { code: 'tr-TR', name: '튀르키예어', flag: '🇹🇷' },
  NO: { code: 'nb-NO', name: '노르웨이어', flag: '🇳🇴' },
  PT: { code: 'pt-PT', name: '포르투갈어', flag: '🇵🇹' },
  ME: { code: 'sr-ME', name: '몬테네그로어', flag: '🇲🇪' },
  AL: { code: 'sq-AL', name: '알바니아어', flag: '🇦🇱' },
  IT: { code: 'it-IT', name: '이탈리아어', flag: '🇮🇹' },
  ES: { code: 'es-ES', name: '스페인어', flag: '🇪🇸' },
  FR: { code: 'fr-FR', name: '프랑스어', flag: '🇫🇷' },
  JP: { code: 'ja-JP', name: '일본어', flag: '🇯🇵' },
  CN: { code: 'zh-CN', name: '중국어', flag: '🇨🇳' },
  HK: { code: 'zh-HK', name: '광둥어', flag: '🇭🇰' },
  TH: { code: 'th-TH', name: '태국어', flag: '🇹🇭' },
  VN: { code: 'vi-VN', name: '베트남어', flag: '🇻🇳' },
  MY: { code: 'ms-MY', name: '말레이어', flag: '🇲🇾' },
  // 한국어 이름 기반 (기존 미포함 국가만)
  그리스: { code: 'el-GR', name: '그리스어', flag: '🇬🇷' },
  크로아티아: { code: 'hr-HR', name: '크로아티아어', flag: '🇭🇷' },
  튀르키예: { code: 'tr-TR', name: '튀르키예어', flag: '🇹🇷' },
  노르웨이: { code: 'nb-NO', name: '노르웨이어', flag: '🇳🇴' },
  포르투갈: { code: 'pt-PT', name: '포르투갈어', flag: '🇵🇹' },
  몬테네그로: { code: 'sr-ME', name: '몬테네그로어', flag: '🇲🇪' },
  알바니아: { code: 'sq-AL', name: '알바니아어', flag: '🇦🇱' },
};

const DEFAULT_LANG = { code: 'en-US', name: '영어', flag: '🇺🇸' };

function resolveLanguage(country: string | null): { code: string; name: string; flag: string } {
  if (!country) return DEFAULT_LANG;
  if (LANGUAGE_MAP[country]) return LANGUAGE_MAP[country];
  const lower = country.toLowerCase();
  for (const [key, lang] of Object.entries(LANGUAGE_MAP)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return lang;
    }
  }
  return DEFAULT_LANG;
}

export async function GET(_req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 앱 레벨 날짜 비교로 타임존 이슈 방지 (briefing/today와 동일한 패턴)
    const allUserTrips = await prisma.userTrip.findMany({
      where: { userId: user.id },
      orderBy: { startDate: 'desc' },
    });

    const activeTrip = allUserTrips.find(t => {
      if (!t.startDate) return false;
      const s = new Date(t.startDate);
      s.setHours(0, 0, 0, 0);
      const e = t.endDate ? new Date(t.endDate) : null;
      if (e) e.setHours(23, 59, 59, 999);
      return s <= todayStart && (!e || todayStart <= e);
    }) ?? null;

    if (!activeTrip) {
      return NextResponse.json({ ok: true, hasTrip: false });
    }

    const itinerary = await prisma.itinerary.findFirst({
      where: {
        userTripId: activeTrip.id,
        date: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { date: 'asc' },
    });

    if (!itinerary) {
      return NextResponse.json({ ok: true, hasTrip: true });
    }

    const isCruisingType =
      !itinerary.type ||
      itinerary.type.toLowerCase() === 'sea' ||
      itinerary.type.toLowerCase() === 'cruising';

    if (isCruisingType) {
      return NextResponse.json({ ok: true, hasTrip: true, isCruising: true });
    }

    const language = resolveLanguage(itinerary.country);

    return NextResponse.json({
      ok: true,
      hasTrip: true,
      isCruising: false,
      currentPort: {
        location: itinerary.location,
        country: itinerary.country ? (COUNTRY_NAMES[itinerary.country] || itinerary.country) : null,
        arrival: itinerary.arrival,
        departure: itinerary.departure,
        language,
      },
    });
  } catch (error) {
    console.error('[itinerary/current] Error:', error);
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
