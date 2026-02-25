'use client';
import { useEffect, useState } from 'react';

type ToastProps = {
  message: string;
  duration?: number; // milliseconds
  onClose: () => void;
};

export default function Toast({ message, duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 p-3 rounded-lg shadow-lg bg-gray-800 text-white text-[16px] md:text-[17px] font-semibold">
      {message}
    </div>
  );
}
