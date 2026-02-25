import Link from 'next/link';

export default function TopGuidance() {
  return (
    <div className="sticky top-[72px] z-20 bg-white border-b">
      <div className="mx-auto max-w-5xl px-4 py-2 text-sm text-gray-700">
        여행정보를 먼저 등록해주세요.{' '}
        <Link href="/onboarding" className="text-blue-600 font-bold underline">등록하러 가기</Link>
      </div>
    </div>
  );
}


















