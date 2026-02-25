'use client';

import { useRouter } from 'next/navigation';
import { FiChevronLeft } from 'react-icons/fi';
import DailyBriefingCard from '@/app/chat/components/DailyBriefingCard';

export default function SchedulePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/chat')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="채팅으로 돌아가기"
            >
              <FiChevronLeft className="w-7 h-7 text-gray-700" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">📰 오늘의 브리핑</h1>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <DailyBriefingCard />
      </main>
    </div>
  );
}

