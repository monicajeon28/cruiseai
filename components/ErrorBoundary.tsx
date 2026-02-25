'use client';

import React, { Component, ReactNode } from 'react';
import { FiAlertTriangle, FiRefreshCw, FiHome } from 'react-icons/fi';

/**
 * 전역 에러 바운더리
 * 작업자 C (UX/기능 전문가) - 에러 핸들링 강화
 * 50대 이상 고객을 위한 명확하고 친절한 에러 메시지
 */

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // 에러 로깅 서비스에 전송 (선택사항)
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    this.handleReset();
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // 커스텀 fallback이 있으면 사용
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 기본 에러 화면 (50대 친화적)
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
            {/* 아이콘 */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                <FiAlertTriangle className="w-10 h-10 text-red-600" />
              </div>
            </div>

            {/* 제목 */}
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-3">
              앗! 문제가 발생했어요
            </h1>

            {/* 설명 */}
            <p className="text-gray-600 text-center mb-6 text-lg leading-relaxed">
              일시적인 오류가 발생했습니다.<br />
              불편을 드려 죄송합니다.
            </p>

            {/* 에러 상세 (개발 모드에만 표시) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 p-4 bg-gray-100 rounded-lg">
                <summary className="cursor-pointer text-sm font-semibold text-gray-700 mb-2">
                  개발자 정보 (클릭하여 펼치기)
                </summary>
                <pre className="text-xs text-gray-600 overflow-auto">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            {/* 액션 버튼 */}
            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors shadow-md"
              >
                <FiRefreshCw size={22} />
                다시 시도하기
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-6 py-4 rounded-xl font-semibold text-lg hover:bg-gray-200 transition-colors"
              >
                <FiHome size={22} />
                홈으로 돌아가기
              </button>
            </div>

            {/* 지원 안내 */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                문제가 계속되면 고객 센터로 문의해주세요
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

