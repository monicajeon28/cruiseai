'use client';

import { useRouter } from 'next/navigation';
import { FiLogOut } from 'react-icons/fi';
import { csrfFetch, clearCsrfToken, clearAllLocalStorage } from '@/lib/csrf-client';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const response = await csrfFetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        // 사용자 관련 모든 localStorage 데이터 정리
        clearAllLocalStorage();
        // 성공적으로 로그아웃되면 크루즈몰 메인 페이지로 이동
        // router.push('/') 보다 window.location.href를 사용해 페이지를 완전히 새로고침합니다.
        // 이를 통해 클라이언트 측에 남아있을 수 있는 모든 인증 상태를 확실하게 제거합니다.
        // 크루즈가이드 지니에서는 로그아웃 후 크루즈몰로만 이동 (온보딩으로 절대 이동하지 않음)
        window.location.href = '/';
      } else {
        console.error('로그아웃 실패');
        // 로그아웃 실패해도 크루즈몰로 이동 (세션은 서버에서 삭제됨)
        clearAllLocalStorage();
        window.location.href = '/';
      }
    } catch (error) {
      console.error('로그아웃 요청 중 오류 발생:', error);
      // 네트워크 오류 등으로 로그아웃 요청이 실패해도 크루즈몰로 이동
      clearAllLocalStorage();
      window.location.href = '/';
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors duration-200"
    >
      <FiLogOut className="mr-2" />
      로그아웃
    </button>
  );
} 