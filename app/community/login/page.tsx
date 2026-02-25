// app/community/login/page.tsx
// 우리끼리크루즈 커뮤니티 로그인 페이지

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

function CommunityLoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/community';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // URL 파라미터에서 메시지 확인
    const message = searchParams.get('message');
    if (message) {
      alert(message);
    }
  }, [searchParams]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          phone: username.trim(), // username을 phone으로 전송 (커뮤니티 전용)
          password: password.trim(),
          name: username.trim(), // 커뮤니티 로그인은 name 없이도 가능
          mode: 'community', // 커뮤니티 전용 모드
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.error || '로그인에 실패했습니다.');
        setLoading(false);
        return;
      }

      // 로그인 성공 시 API 응답의 next 값을 우선 사용, 없으면 URL 파라미터의 next 사용
      const redirectTo = data.next || next || '/';
      console.log('[로그인] 리다이렉트:', redirectTo);
      router.push(redirectTo);
    } catch (err) {
      setError('로그인 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <Image 
            src="/images/ai-cruise-logo.png" 
            alt="크루즈닷" 
            width={80}
            height={80}
            className="mx-auto mb-4"
            priority
          />
          <h1 className="text-4xl font-bold text-gray-900 mb-2">우리끼리크루즈닷</h1>
          <p className="text-gray-600">커뮤니티에 로그인하여 리뷰와 게시글을 작성해보세요</p>
        </div>

        {/* 로그인 폼 */}
        <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                아이디
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder="아이디를 입력하세요"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder="비밀번호를 입력하세요"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 mb-2">
              아직 회원이 아니신가요?
            </p>
            <Link
              href="/signup"
              className="text-red-600 hover:text-red-700 font-semibold underline"
            >
              회원가입하기
            </Link>
          </div>

          <div className="mt-4 text-center">
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← 메인페이지로 돌아가기
            </Link>
          </div>
        </div>

        {/* 안내 */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>로그인 후 리뷰 작성, 게시글 작성, 댓글 작성이 가능합니다.</p>
        </div>
      </div>
    </div>
  );
}

export default function CommunityLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">로딩 중...</div>}>
      <CommunityLoginPageContent />
    </Suspense>
  );
}
