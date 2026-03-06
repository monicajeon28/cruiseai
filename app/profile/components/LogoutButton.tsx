'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { csrfFetch, clearAllLocalStorage } from '@/lib/csrf-client';

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await csrfFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // 실패해도 로그아웃 처리 (쿠키는 서버에서 삭제됨)
    } finally {
      clearAllLocalStorage();
      router.push('/login');
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full py-3 px-6 bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-600 font-semibold rounded-xl transition-colors border border-gray-200 hover:border-red-200 disabled:opacity-50"
    >
      {loading ? '로그아웃 중...' : '로그아웃'}
    </button>
  );
}
