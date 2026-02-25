'use client';
import React, { useEffect, useState } from 'react';
import Image from 'next/image';

interface Props {
  open: boolean;
  images: string[];
  index?: number;
  onClose: () => void;
}

export default function ImageViewerModal({ open, images = [], index = 0, onClose }: Props) {
  // 모든 훅은 컴포넌트 최상단에 고정적으로 선언 (절대 조건부로 호출하지 않음)
  const [i, setI] = useState<number>(index ?? 0);
  const [mounted, setMounted] = useState(false);

  // index/open이 바뀌면 내부 인덱스 동기화 (항상 호출)
  useEffect(() => {
    setI(index ?? 0);
  }, [index, open]);

  // 키보드 이벤트는 항상 등록/해제 (의도적으로 open 체크는 핸들러 내부에서 함)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return; // open이 아닐 때는 무시
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setI((prev) => (prev - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') setI((prev) => (prev + 1) % images.length);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, images.length, onClose]);

  // mounted 플래그: modal show 애니/렌더 안정성용 (선택)
  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

  // 안전: images가 비어있거나 open이 false면 시각적으로 숨김(그러나 훅 호출은 일정)
  if (!open || !images?.length) {
    // 렌더는 하지만 화면에는 표시하지 않음 — 훅 호출 수가 항상 동일하게 유지됨
    return null;
  }

  const url = images[i] ?? '';
  const isVideo = typeof url === 'string' && url.toLowerCase().endsWith('.mp4');

  const prev = () => setI((prevI) => (prevI - 1 + images.length) % images.length);
  const next = () => setI((prevI) => (prevI + 1) % images.length);

  return (
    <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center">
      <button
        onClick={onClose}
        className="absolute top-4 right-6 text-white text-3xl font-bold"
        aria-label="닫기"
      >
        ×
      </button>

      <button
        onClick={prev}
        className="absolute left-4 md:left-8 text-white/90 hover:text-white text-4xl"
        aria-label="이전"
      >
        ‹
      </button>

      <div className="max-w-[92vw] max-h-[86vh] flex items-center justify-center relative">
        {isVideo ? (
          <video src={url} controls autoPlay className="max-w-[92vw] max-h-[86vh] rounded-md shadow-xl" />
        ) : (
          <Image
            src={url}
            alt={`크루즈 여행 이미지 ${i + 1}`}
            fill
            className="object-contain rounded-md shadow-xl"
            quality={75}
            sizes="92vw"
            priority={i === index}
          />
        )}
      </div>

      <button
        onClick={next}
        className="absolute right-4 md:right-8 text-white/90 hover:text-white text-4xl"
        aria-label="다음"
      >
        ›
      </button>
    </div>
  );
}
