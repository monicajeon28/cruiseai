'use client';

import { useEffect, useState } from 'react';
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from 'react-icons/fi';
import { hapticSuccess, hapticError, hapticWarning } from '@/lib/haptic';

/**
 * 토스트 알림 시스템
 * 작업자 C (UX/기능 전문가) - API 에러 처리
 * 50대 이상 고객을 위한 크고 명확한 알림
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

function Toast({ toast, onClose }: ToastProps) {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // 햅틱 피드백
    if (toast.type === 'success') hapticSuccess();
    if (toast.type === 'error') hapticError();
    if (toast.type === 'warning') hapticWarning();

    // 자동 닫기
    const duration = toast.duration || 4000;
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => onClose(toast.id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const icons = {
    success: <FiCheckCircle className="w-6 h-6" />,
    error: <FiAlertCircle className="w-6 h-6" />,
    warning: <FiAlertCircle className="w-6 h-6" />,
    info: <FiInfo className="w-6 h-6" />,
  };

  const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const iconColors = {
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600',
  };

  return (
    <div
      className={`
        max-w-md w-full bg-white rounded-xl shadow-lg border-2 p-4
        transition-all duration-300 ease-out
        ${colors[toast.type]}
        ${isLeaving ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${iconColors[toast.type]}`}>
          {icons[toast.type]}
        </div>
        
        <div className="flex-1 min-w-0">
          {toast.title && (
            <h3 className="font-bold text-lg mb-1">{toast.title}</h3>
          )}
          <p className="text-base leading-relaxed">{toast.message}</p>
        </div>

        <button
          onClick={() => {
            setIsLeaving(true);
            setTimeout(() => onClose(toast.id), 300);
          }}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="닫기"
        >
          <FiX size={20} />
        </button>
      </div>
    </div>
  );
}

// 토스트 컨테이너
interface ToastContainerProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-3 pointer-events-none">
      <div className="pointer-events-auto space-y-3">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={onClose} />
        ))}
      </div>
    </div>
  );
}

// 전역 토스트 관리를 위한 간단한 상태 관리
let toastListeners: ((toasts: ToastMessage[]) => void)[] = [];
let toastList: ToastMessage[] = [];

export function addToast(toast: Omit<ToastMessage, 'id'>) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const newToast: ToastMessage = { ...toast, id };
  
  toastList = [...toastList, newToast];
  toastListeners.forEach((listener) => listener(toastList));
  
  return id;
}

export function removeToast(id: string) {
  toastList = toastList.filter((t) => t.id !== id);
  toastListeners.forEach((listener) => listener(toastList));
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (newToasts: ToastMessage[]) => setToasts(newToasts);
    toastListeners.push(listener);
    
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  return {
    toasts,
    showToast: addToast,
    removeToast,
  };
}

// 편의 함수들
export function showSuccess(message: string, title?: string) {
  return addToast({ type: 'success', message, title });
}

export function showError(message: string, title?: string) {
  return addToast({ type: 'error', message, title });
}

export function showWarning(message: string, title?: string) {
  return addToast({ type: 'warning', message, title });
}

export function showInfo(message: string, title?: string) {
  return addToast({ type: 'info', message, title });
}

