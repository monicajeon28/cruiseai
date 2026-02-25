// components/OnboardingCard.tsx
import 'server-only';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { getDdayMessage } from '@/lib/dday';
import { formatDateK } from '@/lib/utils';

export default async function OnboardingCard() {
  const user = await getSessionUser();

  // 비로그인 카드
  if (!user) {
    return (
      <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center justify-between">
        <div>
          <div className="font-bold text-[18px]">크루즈닷과 여행 시작하기</div>
          <div className="text-sm text-gray-500">로그인하면 내 정보/여행/체크리스트가 바로 떠요.</div>
        </div>
        <Link href="/login" className="px-4 py-2 bg-red-600 text-white rounded-lg">로그인</Link>
      </div>
    );
  }

  const trip = await prisma.userTrip.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  // 온보딩 유도 카드 (이름/연락처 없는 경우)
  if (!user.onboarded) {
    return (
      <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center justify-between">
        <div>
          <div className="font-bold text-[18px]">온보딩을 완료해 주세요</div>
          <div className="text-sm text-gray-500">이름/연락처 입력 후 여행을 등록하면 크루즈닷이 더 똑똑해집니다.</div>
        </div>
        <Link href="/onboarding" className="px-4 py-2 bg-blue-600 text-white rounded-lg">온보딩</Link>
      </div>
    );
  }

  // 로그인+온보딩 완료: 여행 정보 + D-day
  const ddayMessage = (trip?.startDate && user.name)
    ? await getDdayMessage({
        startDateISO: trip.startDate instanceof Date ? trip.startDate.toISOString() : trip.startDate,
        customerName: user.name ?? undefined,
        cruiseName: trip?.cruiseName ?? undefined,
        customerPhone: user.phone ?? undefined,
      })
    : null;

  return (
    <div className="bg-white rounded-2xl shadow p-4 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-bold text-[18px]">
          안녕하세요, {user.name ?? '고객'}님
        </div>
        <Link href="/profile" className="px-3 py-2 bg-gray-900 text-white rounded-lg">나의 정보</Link>
      </div>

      {trip ? (
        <div className="mt-2 text-[15px] text-gray-700">
          📅 {formatDateK(trip.startDate instanceof Date ? trip.startDate.toISOString() : trip.startDate)} ~ {formatDateK(trip.endDate instanceof Date ? trip.endDate.toISOString() : trip.endDate)} ·
          🚢 <span className="font-semibold">{trip.cruiseName ?? '—'}</span>
        </div>
      ) : (
        <div className="mt-2">
          <Link href="/onboarding" className="text-blue-600 underline">여행을 등록</Link>하면 맞춤 안내가 제공됩니다.
        </div>
      )}

      {ddayMessage && (
        <div className="mt-3 p-3 rounded-lg bg-blue-50 text-blue-800">
          <div className="font-bold">
            {ddayMessage}
          </div>
        </div>
      )}
    </div>
  );
}
