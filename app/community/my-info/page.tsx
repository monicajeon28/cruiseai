// app/community/my-info/page.tsx
// 내 정보 페이지 (크루즈몰 전용) - 완전히 새로 작성

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiEdit2, FiSave, FiX, FiEye, FiEyeOff } from 'react-icons/fi';
import PWAInstallButtonMall from '@/components/PWAInstallButtonMall';

interface UserInfo {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  mallNickname: string | null;
  mallUserId: string | null;
  genieStatus?: string | null;
  linkedGenieUser?: {
    id: number;
    name: string | null;
    phone: string | null;
    genieStatus: string | null;
  } | null;
}

export default function MyInfoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [error, setError] = useState('');
  
  // 편집 모드
  const [isEditing, setIsEditing] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  
  // 비밀번호 변경
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMyInfo();
  }, []);

  const fetchMyInfo = async () => {
    try {
      const response = await fetch('/api/community/my-info', {
        credentials: 'include'
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        if (response.status === 401) {
          router.push('/community/login?next=/community/my-info');
          return;
        }
        setError(data.error || '정보를 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
        return;
      }

      setUser(data.user);
      setEditNickname(data.user.mallNickname || data.user.name || '');
      setEditName(data.user.name || '');
      setEditPhone(data.user.phone || '');
      setEditEmail(data.user.email || '');
    } catch (err) {
      setError('정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editName.trim() || !editPhone.trim()) {
      alert('이름과 연락처를 모두 입력해주세요.');
      return;
    }

    // 이메일 형식 검증 (입력된 경우에만)
    if (editEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
      alert('올바른 이메일 형식을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/community/my-info/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: editName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim() || null,
          mallNickname: editNickname.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        alert(data.error || '정보 저장에 실패했습니다.');
        return;
      }

      alert('정보가 저장되었습니다.');
      setIsEditing(false);
      fetchMyInfo();
    } catch (err) {
      alert('정보 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('모든 비밀번호 필드를 입력해주세요.');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (newPassword.length < 4) {
      alert('비밀번호는 최소 4자 이상이어야 합니다.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/community/my-info/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          password: newPassword,
          currentPassword: currentPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        alert(data.error || '비밀번호 변경에 실패했습니다.');
        return;
      }

      alert('비밀번호가 변경되었습니다.');
      setShowPasswordChange(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      alert('비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 서비스 이용 상태 확인
  // genieStatus가 'active'이면 이용중, 그 외(null 포함)는 미이용
  const isGenieActive = user && (user.genieStatus === 'active' || user.linkedGenieUser?.genieStatus === 'active');
  const isTrialUser = user && user.genieStatus === 'trial';
  const isGenieUser = isGenieActive || isTrialUser;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          {/* 이전으로 가기 */}
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
            >
              <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" size={20} />
              <span className="font-medium">이전으로 가기</span>
            </Link>
          </div>

          {/* 헤더 */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">
              내 정보
            </h1>
          </div>

          {/* 사용자 정보 섹션 */}
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border-2 border-blue-200 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
                <span className="text-4xl">👤</span>
                사용자 정보
              </h2>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FiEdit2 size={18} />
                  수정
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditNickname(user?.mallNickname || user?.name || '');
                      setEditName(user?.name || '');
                      setEditPhone(user?.phone || '');
                      setEditEmail(user?.email || '');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <FiX size={18} />
                    취소
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <FiSave size={18} />
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">이름 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="이름을 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">연락처 <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="연락처를 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">닉네임</label>
                  <input
                    type="text"
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="닉네임을 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="이메일을 입력하세요 (선택사항)"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <span className="text-gray-600 font-semibold text-base md:text-lg min-w-[100px]">이름:</span>
                  <span className="font-bold text-gray-900 text-base md:text-lg">{user?.name || '정보 없음'}</span>
                </div>
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <span className="text-gray-600 font-semibold text-base md:text-lg min-w-[100px]">연락처:</span>
                  <span className="font-bold text-gray-900 text-base md:text-lg break-all">{user?.phone || '정보 없음'}</span>
                </div>
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <span className="text-gray-600 font-semibold text-base md:text-lg min-w-[100px]">닉네임:</span>
                  <span className="font-bold text-gray-900 text-base md:text-lg">{user?.mallNickname || user?.name || '정보 없음'}</span>
                </div>
                {user?.email && (
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <span className="text-gray-600 font-semibold text-base md:text-lg min-w-[100px]">이메일:</span>
                    <span className="font-bold text-gray-900 text-base md:text-lg break-all">{user.email}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 이름과 연락처 입력 권유 메시지 */}
          {(!user?.name || !user?.phone) && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 md:p-6 mb-6">
              <p className="text-red-700 font-bold text-base md:text-lg text-center">
                ⚠️ 이름과 연락처를 입력하시면 비밀번호 찾을때 쉬워요!
              </p>
            </div>
          )}

          {/* 비밀번호 변경 섹션 */}
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border-2 border-purple-200 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
                <span className="text-4xl">🔒</span>
                비밀번호 변경
              </h2>
              {!showPasswordChange && (
                <button
                  onClick={() => setShowPasswordChange(true)}
                  className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
                >
                  변경하기
                </button>
              )}
            </div>

            {showPasswordChange && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">현재 비밀번호</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                      placeholder="현재 비밀번호를 입력하세요"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showCurrentPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">새 비밀번호</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                      placeholder="새 비밀번호를 입력하세요 (최소 4자)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showNewPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">새 비밀번호 확인</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                      placeholder="새 비밀번호를 다시 입력하세요"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showConfirmPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePasswordChange}
                    disabled={saving}
                    className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? '변경 중...' : '비밀번호 변경'}
                  </button>
                  <button
                    onClick={() => {
                      setShowPasswordChange(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    className="px-6 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 서비스 이용 상태 섹션 */}
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border-2 border-indigo-200 mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <span className="text-4xl">🎯</span>
              서비스 이용 상태
            </h2>
            <div className="space-y-4">
              {/* 크루즈몰 이용 상태 */}
              <div className="p-5 bg-blue-50 border-2 border-blue-300 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🛒</span>
                    <div>
                      <p className="font-bold text-lg text-gray-900">크루즈몰</p>
                      <p className="text-sm text-gray-600">크루즈 상품 구매 및 커뮤니티 이용</p>
                    </div>
                  </div>
                  <span className="px-4 py-2 bg-green-500 text-white font-bold rounded-lg">이용 중</span>
                </div>
              </div>

              {/* 크루즈닷AI 상태 */}
              {isGenieUser ? (
                <div className="p-5 bg-gradient-to-br from-yellow-400 via-yellow-300 to-orange-400 border-2 border-yellow-500 rounded-xl relative overflow-hidden shadow-lg">
                  {/* 블링블링 효과 - 그라데이션 애니메이션 */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-200/50 via-transparent to-orange-200/50"></div>
                  <div className="relative flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <span className="text-4xl animate-bounce drop-shadow-lg">✨</span>
                        <span className="absolute -top-1 -right-1 text-2xl animate-ping">⭐</span>
                      </div>
                      <div>
                        <p className="font-bold text-lg text-gray-900 flex items-center gap-2 drop-shadow-sm">
                          크루즈닷AI (유료)
                          <span className="text-xs px-2 py-1 bg-yellow-500 text-white rounded-full font-bold animate-pulse shadow-md">PRO</span>
                        </p>
                        <p className="text-sm text-gray-800 font-medium">AI 여행 가이드 서비스</p>
                      </div>
                    </div>
                    <span className="px-4 py-2 bg-gradient-to-r from-yellow-600 to-orange-600 text-white font-bold rounded-lg shadow-lg animate-pulse">이용 중</span>
                  </div>
                </div>
              ) : isTrialUser ? (
                <div className="p-5 bg-gradient-to-br from-purple-400 via-pink-400 to-purple-500 border-2 border-purple-500 rounded-xl relative overflow-hidden shadow-lg">
                  {/* 블링블링 효과 - 그라데이션 애니메이션 */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-200/50 via-transparent to-pink-200/50"></div>
                  <div className="relative flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <span className="text-4xl animate-bounce drop-shadow-lg">🎁</span>
                        <span className="absolute -top-1 -right-1 text-2xl animate-ping">💎</span>
                      </div>
                      <div>
                        <p className="font-bold text-lg text-gray-900 flex items-center gap-2 drop-shadow-sm">
                          크루즈닷AI 3일 체험
                          <span className="text-xs px-2 py-1 bg-purple-500 text-white rounded-full font-bold animate-pulse shadow-md">TRIAL</span>
                        </p>
                        <p className="text-sm text-gray-800 font-medium">3일 무료 체험 중</p>
                      </div>
                    </div>
                    <span className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg shadow-lg animate-pulse">체험 중</span>
                  </div>
                </div>
              ) : (
                <div className="p-5 bg-gray-50 border-2 border-gray-300 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">🤖</span>
                      <div>
                        <p className="font-bold text-lg text-gray-900">크루즈닷AI</p>
                        <p className="text-sm text-gray-600">AI 여행 가이드 서비스</p>
                      </div>
                    </div>
                    <span className="px-4 py-2 bg-gray-400 text-white font-bold rounded-lg">미이용</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 크루즈 3일 무료체험 홍보 배너 */}
          {!isGenieUser && !isTrialUser && (
            <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-2xl shadow-2xl p-6 md:p-8 mb-6 relative overflow-hidden">
              {/* 블링블링 효과 - 그라데이션 애니메이션 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-300/30 via-transparent to-orange-300/30"></div>
              <div className="absolute top-4 right-4 text-4xl animate-bounce drop-shadow-lg">✨</div>
              <div className="absolute bottom-4 left-4 text-3xl animate-ping drop-shadow-lg">⭐</div>
              <div className="absolute top-1/2 right-1/4 text-2xl animate-pulse drop-shadow-lg">💎</div>
              <div className="relative z-10 text-center text-white">
                <h3 className="text-3xl md:text-4xl font-black mb-4 flex items-center justify-center gap-3 drop-shadow-lg">
                  <span className="text-5xl animate-bounce">🎁</span>
                  크루즈닷AI 3일 무료체험
                </h3>
                <p className="text-lg md:text-xl mb-6 font-semibold drop-shadow-md">
                  지금 바로 AI 여행 가이드를 무료로 체험해보세요!
                </p>
                <Link
                  href="/login-test"
                  className="inline-block px-8 py-4 bg-white text-purple-600 font-black text-lg rounded-xl hover:bg-gray-100 transition-all shadow-2xl transform hover:scale-105 hover:shadow-3xl"
                >
                  무료체험 시작하기 →
                </Link>
              </div>
            </div>
          )}

          {/* 바탕화면 추가 섹션 */}
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border-2 border-green-200 mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-4xl">📲</span>
              바탕화면에 추가하기
            </h2>
            <p className="text-base text-gray-700 mb-5 leading-relaxed">
              크루즈몰을 바탕화면에 추가하면 더 빠르게 접근할 수 있습니다. 로그인 상태가 유지됩니다.
            </p>
            <PWAInstallButtonMall />
          </div>
        </div>
      </div>

    </div>
  );
}
