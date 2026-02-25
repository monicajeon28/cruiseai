export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

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

    const activeTrip = await prisma.userTrip.findFirst({
      where: {
        userId: user.id,
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart },
      },
      orderBy: { startDate: 'desc' },
    });

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
        country: itinerary.country,
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
