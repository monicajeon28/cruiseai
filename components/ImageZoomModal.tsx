'use client';

import { useState, useEffect, useRef } from 'react';
import { FiX, FiChevronLeft, FiChevronRight, FiZoomIn, FiZoomOut, FiMaximize2 } from 'react-icons/fi';
import Image from 'next/image';

type ImageZoomModalProps = {
  isOpen: boolean;
  onClose: () => void;
  images: Array<{ url: string; title?: string }>;
  initialIndex: number;
};

export default function ImageZoomModal({ isOpen, onClose, images, initialIndex }: ImageZoomModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [initialIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((prev) => Math.max(0.5, Math.min(3, prev + delta)));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-[100]"
      onClick={onClose}
      onMouseUp={handleMouseUp}
    >
      {/* 닫기 버튼 - 큰 버튼 (50대+ 친화적) */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-10 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-4 transition-all"
        aria-label="닫기"
      >
        <FiX size={32} className="text-white" />
      </button>

      {/* 이전 이미지 버튼 */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToPrevious();
          }}
          className="absolute left-6 top-1/2 -translate-y-1/2 z-10 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-5 transition-all"
          aria-label="이전 이미지"
        >
          <FiChevronLeft size={36} className="text-white" />
        </button>
      )}

      {/* 다음 이미지 버튼 */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          className="absolute right-6 top-1/2 -translate-y-1/2 z-10 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-5 transition-all"
          aria-label="다음 이미지"
        >
          <FiChevronRight size={36} className="text-white" />
        </button>
      )}

      {/* 이미지 컨테이너 */}
      <div
        ref={containerRef}
        className="relative w-full h-full flex items-center justify-center p-8"
        onWheel={handleWheel}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={imageRef}
          className="relative max-w-[90vw] max-h-[90vh] cursor-move select-none"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        >
          <Image
            src={currentImage.url}
            alt={currentImage.title || `크루즈 여행 이미지 ${currentIndex + 1}`}
            width={1200}
            height={800}
            className="object-contain rounded-lg shadow-2xl pointer-events-none"
            quality={90}
            priority
            draggable={false}
          />
        </div>
      </div>

      {/* 하단 컨트롤 바 */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 p-6 flex items-center justify-center gap-4 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 줌 아웃 버튼 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleZoomOut();
          }}
          disabled={scale <= 0.5}
          className="bg-white bg-opacity-20 hover:bg-opacity-30 disabled:opacity-30 disabled:cursor-not-allowed rounded-full p-4 transition-all"
          aria-label="축소"
        >
          <FiZoomOut size={28} className="text-white" />
        </button>

        {/* 줌 리셋 버튼 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleResetZoom();
          }}
          className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-4 transition-all"
          aria-label="원래 크기"
        >
          <FiMaximize2 size={28} className="text-white" />
        </button>

        {/* 줌 인 버튼 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleZoomIn();
          }}
          disabled={scale >= 3}
          className="bg-white bg-opacity-20 hover:bg-opacity-30 disabled:opacity-30 disabled:cursor-not-allowed rounded-full p-4 transition-all"
          aria-label="확대"
        >
          <FiZoomIn size={28} className="text-white" />
        </button>

        {/* 이미지 인덱스 표시 */}
        {images.length > 1 && (
          <div className="absolute right-6 text-white text-lg font-semibold bg-black bg-opacity-50 px-4 py-2 rounded-full">
            {currentIndex + 1} / {images.length}
          </div>
        )}

        {/* 이미지 제목 */}
        {currentImage.title && (
          <div className="absolute left-6 text-white text-base font-medium bg-black bg-opacity-50 px-4 py-2 rounded-full max-w-md truncate">
            {currentImage.title}
          </div>
        )}
      </div>

      {/* 키보드 단축키 안내 (모바일 제외) */}
      {typeof window !== 'undefined' && window.innerWidth > 768 && (
        <div className="absolute top-6 left-6 text-white text-sm bg-black bg-opacity-50 px-4 py-2 rounded-lg z-10">
          <p className="text-xs opacity-80">
            ← → 화살표: 이전/다음 이미지 | 마우스 휠: 확대/축소 | ESC: 닫기
          </p>
        </div>
      )}
    </div>
  );
}

