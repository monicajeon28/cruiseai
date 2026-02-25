// 'use client' 절대 넣지 마세요 (서버 컴포넌트)
import { getSessionUser } from '@/lib/auth';               // server-only OK
import prisma from '@/lib/prisma';                         // server-only OK
import { formatDateK } from '@/lib/utils'; // formatDateK 임포트
import TripInfoBannerClient from './TripInfoBannerClient'; // 클라로 데이터만 내려줌

export default async function TripInfoBanner() {
  const user = await getSessionUser(); // 쿠키/세션 접근은 서버에서
  let lastTripSummary: string | null = null;
  let tripNumber: number | null = null;
  let tripId: number | null = null;

  if (user) {
    // 사용자의 전체 여행 수 조회
    const tripCount = await prisma.trip.count({
      where: { userId: user.id },
    });

    const lastTrip = await prisma.trip.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { 
        id: true,
        cruiseName: true, 
        startDate: true, 
        endDate: true,
        createdAt: true,
      }
    });

    if (lastTrip) {
      tripId = lastTrip.id;
      // 전체 여행 중에서 이 여행이 몇번째인지 계산 (최신순이므로 1번째)
      tripNumber = tripCount;
      
      const formattedStartDate = lastTrip.startDate ? formatDateK(lastTrip.startDate) : '';
      const formattedEndDate = lastTrip.endDate ? formatDateK(lastTrip.endDate) : '';
      lastTripSummary = `${formattedStartDate} ~ ${formattedEndDate} · ${lastTrip.cruiseName ?? '크루즈'}`;
    }
  }

  return (
    <TripInfoBannerClient
      name={user?.name ?? null}
      lastTripSummary={lastTripSummary}
      tripNumber={tripNumber}
      tripId={tripId}
    />
  );
} 