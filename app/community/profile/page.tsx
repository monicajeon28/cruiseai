// app/community/profile/page.tsx
// 커뮤니티 프로필 수정 페이지

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiSave, FiX } from 'react-icons/fi';

export default function ProfileEditPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<{
    name: string | null;
    email: string | null;
    phone: string | null;
    role: string;
    genieStatus?: string | null;
    loginId?: string | null;
    geniePhone?: string | null;
    genieName?: string | null;
    mallUserId?: string | null;
    mallNickname?: string | null;
    linkedGenieUser?: {
      id: number;
      name: string | null;
      phone: string | null;
      genieStatus: string | null;
      genieLinkedAt: string | null;
      isLocked: boolean;
    } | null;
    linkedMallUser?: {
      id: number;
      name: string | null;
      phone: string | null;
      email: string | null;
      createdAt: string;
      lastActiveAt: string | null;
      nickname: string | null;
    } | null;
  } | null>(null);
  const [formData, setFormData] = useState({
    nickname: '', // 닉네임 (user1~user10만 수정 가능)
    genieName: '', // 크루즈 가이드 지니 연동용 이름 (별도 필드)
    geniePhone: '',
    password: '',
    passwordConfirm: ''
  });
  const [genieStatus, setGenieStatus] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/community/profile', {
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        if (response.status === 401) {
          router.push('/community/login?next=/community/profile');
          return;
        }
        setError(data.error || '프로필 정보를 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
        return;
      }

      setUser(data.user);
      setFormData({
        nickname: data.user.name || '', // 닉네임 초기값 설정
        genieName: '',
        geniePhone: '',
        password: '',
        passwordConfirm: ''
      });
      
      // 지니AI 상태 설정 (API에서 받은 값 또는 null)
      if (data.user.genieStatus) {
        setGenieStatus(data.user.genieStatus);
      } else {
        setGenieStatus(null);
      }
    } catch (err) {
      setError('프로필 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // 비밀번호 확인
    if (formData.password && formData.password !== formData.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setSubmitting(true);
    try {
      if (!user) {
        setError('사용자 정보를 불러올 수 없습니다.');
        setSubmitting(false);
        return;
      }

      const isAdminAccount = user.role === 'admin' && user.phone && user.phone.startsWith('user');
      const updateData: any = {};
      
      // ⚠️ 중요: 크루즈몰 사용자의 아이디(phone)는 절대 변경 불가!
      // 지니 가이드 연동용 이름과 연락처는 별도로 관리
      
      // 닉네임 변경 (user1~user10 관리자만 가능)
      if (isAdminAccount && formData.nickname !== undefined && formData.nickname !== user.name) {
        updateData.name = formData.nickname.trim() || null;
      }
      
      // 비밀번호 변경 (관리자 계정이 아닌 경우만)
      if (formData.password && formData.password.trim()) {
        updateData.password = formData.password.trim();
      }

      // 이름과 연락처가 입력되었지만, 아이디는 변경하지 않음
      // 연동은 별도 API로 처리
      const hasGenieInfo = Boolean(formData.genieName.trim() && formData.geniePhone.trim());
      
      if (Object.keys(updateData).length === 0 && !hasGenieInfo) {
        setError('변경할 정보가 없습니다.');
        setSubmitting(false);
        return;
      }

      // 프로필 수정이 필요한 경우 API 호출
      if (Object.keys(updateData).length > 0) {
        const response = await fetch('/api/community/profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            ...(updateData.name !== undefined && { name: updateData.name }),
            ...(updateData.password && { password: updateData.password }),
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
          setError(data.error || '프로필 수정에 실패했습니다.');
          setSubmitting(false);
          return;
        }
      }

      // 크루즈 가이드 지니 연동용 이름과 연락처가 모두 입력된 경우 연동 시도
      if (hasGenieInfo) {
        try {
          const linkResponse = await fetch('/api/community/link-genie', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              name: formData.genieName.trim(),
              phone: formData.geniePhone.trim()
            })
          });
          
          const linkData = await linkResponse.json();
          
          if (linkResponse.ok && linkData.ok) {
            // 연동 성공 - 상태 업데이트
            setGenieStatus(linkData.genieStatus || null);
            setSuccess('크루즈 가이드 지니와 연동되었습니다.');
            
            // 프로필 정보 다시 불러오기 (genieStatus 업데이트 확인)
            await fetchProfile();
          } else {
            const errorMsg = linkData.error || '지니 연동에 실패했습니다.';
            const detailsMsg = linkData.details ? ` (${linkData.details})` : '';
            console.error('[PROFILE] Link genie error:', linkData);
            setError(errorMsg + detailsMsg);
            setSubmitting(false);
            return;
          }
        } catch (linkErr: any) {
          console.error('지니 연동 실패:', linkErr);
          const errorMsg = linkErr?.message || '지니 연동 중 오류가 발생했습니다.';
          setError(errorMsg);
          setSubmitting(false);
          return;
        }
      } else if (Object.keys(updateData).length > 0) {
        setSuccess('프로필이 수정되었습니다.');
        // 프로필 다시 불러오기
        await fetchProfile();
        // 닉네임이 변경된 경우 formData.nickname도 업데이트
        if (updateData.name !== undefined) {
          setFormData(prev => ({
            ...prev,
            nickname: updateData.name || ''
          }));
        }
      }

      setFormData(prev => ({
        ...prev,
        password: '',
        passwordConfirm: ''
      }));
    } catch (err) {
      setError('프로필 수정 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">프로필 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">사용자 정보를 불러올 수 없습니다.</p>
          <Link
            href="/"
            className="inline-block px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            메인으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === 'admin';
  const isAdminAccount = isAdmin && user.phone && user.phone.startsWith('user');

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* 이전으로 가기 */}
          <div className="mb-6">
            <Link
              href="/community/my-info"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
            >
              <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" size={20} />
              <span className="font-medium">이전으로 가기</span>
            </Link>
          </div>

          {/* 헤더 */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">
              프로필 수정
            </h1>
          </div>

          {/* 프로필 수정 폼 */}
          <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
                {success}
              </div>
            )}

            {/* 지니AI 사용 상태 표시 (아이디 위에) */}
            {genieStatus && (
              <div className="mb-6">
                {genieStatus === 'active' ? (
                  <div className="w-full px-6 py-4 bg-green-50 border-2 border-green-500 rounded-lg text-center">
                    <p className="text-lg font-bold text-green-700">
                      🟢 크루즈닷AI 사용중입니다. 행복한 여행 되세요!
                    </p>
                  </div>
                ) : (
                  <div className="w-full px-6 py-4 bg-red-50 border-2 border-red-500 rounded-lg text-center">
                    <p className="text-lg font-bold text-red-700">
                      🔴 크루즈닷AI 사용종료 되셨습니다. 다음에 또 만나요
                    </p>
                  </div>
                )}
              </div>
            )}

            {!genieStatus && (
              <div className="mb-6 space-y-4">
                <div className="w-full px-6 py-4 bg-red-50 border-2 border-red-500 rounded-lg text-center">
                  <p className="text-lg font-bold text-red-700">
                    🔴 이런! 크루즈닷AI를 사용하지 않고 있군요? 빨리 만나길 바래요!
                  </p>
                </div>
                <div className="aspect-video w-full rounded-xl overflow-hidden shadow-lg border border-gray-200">
                  <iframe
                    src="https://www.youtube.com/embed/-p_6G69MgyQ?si=3KTuC8W6n5Be1zzY"
                    title="크루즈닷AI 소개 영상"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    className="w-full h-full"
                  ></iframe>
                </div>
              </div>
            )}

            {/* 크루즈 가이드 지니 연동 정보 표시 */}
            {user?.linkedGenieUser ? (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                <p className="font-semibold mb-2">✅ 크루즈닷AI 연동됨</p>
                <ul className="space-y-1">
                  <li>
                    <span className="font-medium">크루즈닷 사용자 이름:</span> {user.linkedGenieUser.name || '-'}
                  </li>
                  <li>
                    <span className="font-medium">크루즈닷 사용자 연락처:</span> {user.linkedGenieUser.phone || '-'}
                  </li>
                  <li>
                    <span className="font-medium">연동 상태:</span> {user.linkedGenieUser.genieStatus === 'active' ? '활성' : '만료'}
                  </li>
                  {user.linkedGenieUser.genieLinkedAt && (
                    <li>
                      <span className="font-medium">연동 일시:</span> {new Date(user.linkedGenieUser.genieLinkedAt).toLocaleString('ko-KR')}
                    </li>
                  )}
                </ul>
                {user.linkedGenieUser.isLocked && (
                  <p className="mt-3 text-xs text-orange-700 font-medium">
                    ⚠️ 크루즈닷 계정이 잠금 상태입니다. 관리자에게 문의하세요.
                  </p>
                )}
              </div>
            ) : genieStatus === 'active' ? (
              // genieStatus가 active인데 linkedGenieUser가 없는 경우 (데이터 불일치)
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                <p className="font-semibold mb-1">⚠️ 크루즈닷AI 연동 정보 확인 필요</p>
                <p className="text-xs text-yellow-700 mt-2">
                  크루즈닷AI가 활성 상태로 표시되지만 연동 정보를 찾을 수 없습니다. 관리자에게 문의하세요.
                </p>
              </div>
            ) : (
              <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                <p className="font-semibold mb-1">크루즈닷AI 연동 해제됨</p>
                <p className="text-xs text-gray-600 mt-2">
                  현재 크루즈닷AI와 연동되어 있지 않습니다. 아래 이름과 연락처를 입력하여 연동하세요.
                </p>
              </div>
            )}

            {/* 크루즈몰 연동 정보 표시 */}
            {user?.linkedMallUser ? (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <p className="font-semibold mb-2">🔗 크루즈몰 연동됨</p>
                <ul className="space-y-1">
                  <li>
                    <span className="font-medium">크루즈몰 사용자 ID:</span> {user.linkedMallUser.id}
                  </li>
                  <li>
                    <span className="font-medium">크루즈몰 닉네임:</span> {user.linkedMallUser.nickname || user.linkedMallUser.name || '-'}
                  </li>
                  <li>
                    <span className="font-medium">크루즈몰 이름:</span> {user.linkedMallUser.name || '-'}
                  </li>
                  <li>
                    <span className="font-medium">크루즈몰 연락처:</span> {user.linkedMallUser.phone || '-'}
                  </li>
                  <li>
                    <span className="font-medium">크루즈몰 이메일:</span> {user.linkedMallUser.email || '-'}
                  </li>
                  {user.linkedMallUser.lastActiveAt && (
                    <li>
                      <span className="font-medium">최근 접속:</span> {new Date(user.linkedMallUser.lastActiveAt).toLocaleString('ko-KR')}
                    </li>
                  )}
                </ul>
              </div>
            ) : user?.mallUserId ? (
              // mallUserId가 있지만 linkedMallUser가 없는 경우 (데이터 불일치)
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                <p className="font-semibold mb-1">⚠️ 크루즈몰 연동 정보 확인 필요</p>
                <p className="text-xs text-yellow-700 mt-2">
                  크루즈몰 연동이 설정되어 있지만, 해당 사용자 정보를 찾을 수 없습니다. 관리자에게 문의하세요.
                </p>
              </div>
            ) : null}

            <form onSubmit={handleSubmit}>
              {/* 아이디 (수정 불가, 표시만) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  아이디 <span className="text-gray-400 text-xs">(수정 불가)</span>
                </label>
                <input
                  type="text"
                  value={user.loginId || user.phone || ''}
                  disabled
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  아이디는 변경할 수 없습니다.
                </p>
              </div>

              {/* 닉네임 (관리자만 수정 가능) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  닉네임 {isAdminAccount ? '' : <span className="text-gray-400 text-xs">(수정 불가)</span>}
                </label>
                {isAdminAccount ? (
                  <input
                    type="text"
                    name="nickname"
                    value={formData.nickname}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        nickname: e.target.value
                      });
                      setError('');
                      setSuccess('');
                    }}
                    placeholder="닉네임을 입력하세요"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                ) : (
                  <input
                    type="text"
                    value={user.name || ''}
                    disabled
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                )}
                {!isAdminAccount && (
                  <p className="text-xs text-gray-500 mt-1">
                    일반 사용자는 닉네임을 변경할 수 없습니다.
                  </p>
                )}
              </div>

              {/* 이름, 연락처 입력 (크루즈 가이드 지니 연동용) - 모든 사용자 가능 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  크루즈닷 로그인 이름 <span className="text-blue-600">(크루즈닷AI 연동용)</span>
                </label>
                <input
                  type="text"
                  name="genieName"
                  value={formData.genieName}
                  onChange={handleChange}
                  placeholder="크루즈닷 로그인에 사용하는 이름을 입력하세요"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  크루즈닷 로그인에 사용하는 이름과 연락처를 입력하면 자동으로 연동됩니다. (크루즈몰 아이디/닉네임과는 별개입니다)
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  크루즈닷 로그인 연락처 <span className="text-blue-600">(크루즈닷AI 연동용)</span>
                </label>
                <input
                  type="text"
                  name="geniePhone"
                  value={formData.geniePhone}
                  onChange={handleChange}
                  placeholder="크루즈닷 로그인에 사용하는 연락처를 입력하세요"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  ⚠️ 이 연락처는 크루즈닷 로그인에 사용하는 연락처입니다. 크루즈몰 아이디와는 별개입니다.
                </p>
              </div>

              {/* 비밀번호 변경 (관리자 계정은 불가) */}
              {!isAdminAccount && (
                <>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      새 비밀번호 <span className="text-gray-400 text-xs">(변경하지 않으려면 비워두세요)</span>
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="새 비밀번호를 입력하세요"
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      비밀번호 확인
                    </label>
                    <input
                      type="password"
                      name="passwordConfirm"
                      value={formData.passwordConfirm}
                      onChange={handleChange}
                      placeholder="비밀번호를 다시 입력하세요"
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </>
              )}

              {/* 버튼 */}
              <div className="flex items-center gap-4 mt-8">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[56px]"
                >
                  <FiSave size={20} />
                  {submitting ? '저장 중...' : '저장하기'}
                </button>
                <Link
                  href="/community/my-info"
                  className="px-6 py-4 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors min-h-[56px] flex items-center justify-center"
                >
                  취소
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
