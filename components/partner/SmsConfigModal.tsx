'use client';

import { useState, useEffect } from 'react';
import { FiX, FiSave, FiSend, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { showSuccess, showError, showWarning } from '@/components/ui/Toast';

type SmsConfigData = {
    provider: string;
    apiKey: string;
    userId: string;
    senderPhone: string;
    ipAddress: string; // 알리고 API 허용 IP
    kakaoSenderKey: string;
    kakaoChannelId: string;
    isActive: boolean;
};

type SmsConfigModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
};

export default function SmsConfigModal({ isOpen, onClose, onSuccess }: SmsConfigModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [formData, setFormData] = useState<SmsConfigData>({
        provider: 'aligo',
        apiKey: '',
        userId: '',
        senderPhone: '',
        ipAddress: '',
        kakaoSenderKey: '',
        kakaoChannelId: '',
        isActive: true,
    });

    // 기존 설정 불러오기
    useEffect(() => {
        if (isOpen) {
            loadExistingConfig();
        }
    }, [isOpen]);

    const loadExistingConfig = async () => {
        try {
            const response = await fetch('/api/partner/settings/sms', {
                credentials: 'include',
            });
            const data = await response.json();
            if (data.ok && data.config) {
                setFormData({
                    provider: data.config.provider || 'aligo',
                    apiKey: data.config.apiKey || '',
                    userId: data.config.userId || '',
                    senderPhone: data.config.senderPhone || '',
                    ipAddress: data.config.ipAddress || '',
                    kakaoSenderKey: data.config.kakaoSenderKey || '',
                    kakaoChannelId: data.config.kakaoChannelId || '',
                    isActive: data.config.isActive !== undefined ? data.config.isActive : true,
                });
            }
        } catch (error) {
            console.error('Failed to load SMS config:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 필수 필드 검증
        if (!formData.apiKey.trim()) {
            showWarning('API Key를 입력해주세요.');
            return;
        }
        if (!formData.userId.trim()) {
            showWarning('User ID를 입력해주세요.');
            return;
        }
        if (!formData.senderPhone.trim()) {
            showWarning('발신번호를 입력해주세요.');
            return;
        }

        try {
            setIsLoading(true);
            const response = await fetch('/api/partner/settings/sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData),
            });

            const data = await response.json();
            if (data.ok) {
                showSuccess('SMS API 설정이 저장되었습니다! 🎉');
                if (onSuccess) {
                    onSuccess();
                }
                onClose();
            } else {
                showError(data.message || 'SMS API 설정 저장에 실패했습니다.');
            }
        } catch (error) {
            console.error('Failed to save SMS config:', error);
            showError('SMS API 설정 저장 중 네트워크 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleTestSms = async () => {
        if (!formData.apiKey.trim() || !formData.userId.trim() || !formData.senderPhone.trim()) {
            showWarning('API Key, User ID, 발신번호를 모두 입력해주세요.');
            return;
        }

        // 테스트 번호 입력받기
        const testPhone = prompt('테스트 SMS를 받을 전화번호를 입력해주세요 (예: 010-1234-5678)');
        if (!testPhone) return;

        try {
            setIsTesting(true);
            // 실제 테스트 SMS API 구현 필요
            showWarning('테스트 발송 기능은 준비 중입니다. 설정을 저장한 후 실제 발송으로 확인해주세요.');
        } catch (error) {
            console.error('Failed to test SMS:', error);
            showError('테스트 SMS 발송에 실패했습니다.');
        } finally {
            setIsTesting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto border-2 border-gray-200">
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-3xl font-extrabold text-gray-900 flex items-center gap-2">
                            <span className="text-4xl">📱</span>
                            SMS API 설정
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Aligo SMS 서비스 계정 정보를 입력하여 자동 발송 기능을 활성화하세요.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-3xl font-bold hover:scale-110 transition-transform"
                    >
                        ×
                    </button>
                </div>

                {/* 안내 메시지 */}
                <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                    <div className="flex items-start gap-3">
                        <FiAlertCircle className="text-blue-600 text-xl flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <p className="font-semibold mb-1">📌 Aligo SMS 계정 연동 방법</p>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                                <li>Aligo 홈페이지(<a href="https://smartsms.aligo.in" target="_blank" rel="noopener noreferrer" className="underline font-semibold">smartsms.aligo.in</a>)에 로그인하세요.</li>
                                <li>상단 메뉴 <strong>[전송/예약] &gt; [API 연동설정]</strong>에서 API Key와 User ID를 확인할 수 있습니다.</li>
                                <li>발신번호는 Aligo에 미리 등록된 번호만 사용할 수 있습니다.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* 폼 */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* 서비스 제공자 */}
                    <div>
                        <label className="block text-base font-semibold text-gray-700 mb-2">
                            SMS 서비스 제공자 <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={formData.provider}
                            onChange={(e) => setFormData((prev) => ({ ...prev, provider: e.target.value }))}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                        >
                            <option value="aligo">Aligo (알리고)</option>
                        </select>
                    </div>

                    {/* API Key */}
                    <div>
                        <label className="block text-base font-semibold text-gray-700 mb-2">
                            API Key <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.apiKey}
                            onChange={(e) => setFormData((prev) => ({ ...prev, apiKey: e.target.value }))}
                            placeholder="예: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                        />
                    </div>

                    {/* User ID */}
                    <div>
                        <label className="block text-base font-semibold text-gray-700 mb-2">
                            User ID <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.userId}
                            onChange={(e) => setFormData((prev) => ({ ...prev, userId: e.target.value }))}
                            placeholder="Aligo 아이디 입력"
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                        />
                    </div>

                    {/* 발신번호 */}
                    <div>
                        <label className="block text-base font-semibold text-gray-700 mb-2">
                            발신번호 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.senderPhone}
                            onChange={(e) => setFormData((prev) => ({ ...prev, senderPhone: e.target.value }))}
                            placeholder="숫자만 입력 (예: 01012345678)"
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            💡 Aligo에 등록된 발신번호와 정확히 일치해야 합니다.
                        </p>
                    </div>

                    {/* 허용 IP 주소 */}
                    <div>
                        <label className="block text-base font-semibold text-gray-700 mb-2">
                            허용 IP 주소 <span className="text-gray-500 text-sm">(선택사항)</span>
                        </label>
                        <input
                            type="text"
                            value={formData.ipAddress}
                            onChange={(e) => setFormData((prev) => ({ ...prev, ipAddress: e.target.value }))}
                            placeholder="예: 123.123.123.123 (서버 IP 주소)"
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            💡 Aligo에서 API 호출을 허용할 IP 주소입니다. 설정하지 않으면 시스템 기본값이 사용됩니다.
                        </p>
                    </div>

                    {/* 카카오 발신 키 (선택) */}
                    <div>
                        <label className="block text-base font-semibold text-gray-700 mb-2">
                            카카오 발신 키 <span className="text-gray-500 text-sm">(선택사항)</span>
                        </label>
                        <input
                            type="text"
                            value={formData.kakaoSenderKey}
                            onChange={(e) => setFormData((prev) => ({ ...prev, kakaoSenderKey: e.target.value }))}
                            placeholder="카카오톡 알림톡 발신 키"
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                        />
                    </div>

                    {/* 카카오 채널 ID (선택) */}
                    <div>
                        <label className="block text-base font-semibold text-gray-700 mb-2">
                            카카오 채널 ID <span className="text-gray-500 text-sm">(선택사항)</span>
                        </label>
                        <input
                            type="text"
                            value={formData.kakaoChannelId}
                            onChange={(e) => setFormData((prev) => ({ ...prev, kakaoChannelId: e.target.value }))}
                            placeholder="카카오톡 채널 ID"
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                        />
                    </div>

                    {/* 활성화 상태 */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="sms-active"
                            checked={formData.isActive}
                            onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                            className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <label htmlFor="sms-active" className="text-base font-semibold text-gray-700">
                            SMS API 활성화
                        </label>
                    </div>

                    {/* 버튼 */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-semibold"
                        >
                            취소
                        </button>
                        <button
                            type="button"
                            onClick={handleTestSms}
                            disabled={isTesting}
                            className="flex-1 px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isTesting ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                    테스트 중...
                                </>
                            ) : (
                                <>
                                    <FiSend />
                                    테스트 발송
                                </>
                            )}
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    저장 중...
                                </>
                            ) : (
                                <>
                                    <FiSave />
                                    저장
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
