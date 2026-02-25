'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { csrfFetch } from '@/lib/csrf-client';

interface OnboardingFormProps {
  initialName: string;
}

export default function OnboardingForm({ initialName }: OnboardingFormProps) {
  const [name, setName] = useState(initialName);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('이름을 입력해주세요.');
      return;
    }

    const r = await csrfFetch('/api/auth/onboard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: trimmedName }),
    });
    const data = await r.json().catch(() => ({}));

    if (!r.ok || !data?.ok) {
      alert(data?.error ?? '온보딩 실패');
      return;
    }

    router.replace('/chat');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-black p-4">
      <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold">여행을 떠나기 전 준비운동!</h1>
          <p className="text-sm text-gray-600 mt-2">크루즈 가이드가 회원님을 위해 <br /> 딱 맞는 정보를 찾아드릴게요.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">이름을 입력해주세요</label>
            <input
              id="name"
              name="name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="예: 김크루즈"
              autoComplete="name"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-red-600 text-white font-semibold py-3 disabled:opacity-60"
            disabled={!name.trim()}
          >
            시작하기
          </button>
        </form>
      </div>
    </div>
  );
}
