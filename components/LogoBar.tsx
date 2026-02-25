'use client';
import Link from 'next/link';
import Image from 'next/image';

export default function LogoBar() {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b bg-white">
      <Link href="/" className="flex items-center">
        <Image src="/images/ai-cruise-logo.png" alt="크루즈닷AI 로고" width={100} height={40} priority />
      </Link>
      <div className="flex items-center gap-2">
        <Link href="/guide" className="text-sm text-gray-700 hover:text-gray-900">사용설명서</Link>
        <Link href="/logout" className="text-sm text-gray-700 hover:text-gray-900">로그아웃</Link>
      </div>
    </div>
  );
}






