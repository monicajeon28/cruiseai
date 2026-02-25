'use client';

import { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';

interface VideoModalProps {
  videoId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function VideoModal({ videoId, isOpen, onClose }: VideoModalProps) {
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // YouTube embed URL 생성 (youtube-nocookie.com 사용으로 차단 방지)
  // youtube-nocookie.com은 쿠키를 사용하지 않아 더 안전하고 차단 가능성이 낮음
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&cc_load_policy=0&iv_load_policy=3&fs=1&origin=${encodeURIComponent(origin || 'http://localhost:3030')}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl aspect-video bg-black rounded-lg overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
          aria-label="닫기"
        >
          <FiX size={24} />
        </button>

        {/* YouTube iframe */}
        <iframe
          src={embedUrl}
          title="YouTube video player"
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          frameBorder="0"
          referrerPolicy="origin-when-cross-origin"
          loading="eager"
        ></iframe>
      </div>
    </div>
  );
}
