'use client';

import { useEffect, useState, useRef } from 'react';
import { FiChevronLeft, FiChevronRight, FiPlay } from 'react-icons/fi';
import VideoModal from './VideoModal';

interface Short {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string | null;
  url: string;
}

export default function YoutubeShortsSlider() {
  const [shorts, setShorts] = useState<Short[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Short | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 페이지를 먼저 표시하고 백그라운드에서 로드
    setIsLoading(false);
    loadShorts();
  }, []);

  const loadShorts = async () => {
    try {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 15000); // 15초 타임아웃

      const response = await fetch('/api/public/youtube/shorts?maxResults=10', {
        signal: abortController.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.ok) {
        setShorts(data.shorts);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error loading Shorts:', error);
      }
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      const newScrollLeft = scrollContainerRef.current.scrollLeft +
        (direction === 'left' ? -scrollAmount : scrollAmount);

      scrollContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
  };

  const handleVideoClick = (short: Short) => {
    setSelectedVideo(short);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedVideo(null);
  };

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto mb-4"></div>
        <p className="text-xl md:text-2xl text-gray-700 font-semibold">Shorts를 불러오는 중...</p>
      </div>
    );
  }

  if (shorts.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed">
        <p className="text-xl md:text-2xl text-gray-600 font-semibold">현재 Shorts 영상이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 좌측 화살표 */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/95 hover:bg-white shadow-2xl rounded-full p-4 transition-all min-w-[56px] min-h-[56px] flex items-center justify-center"
        aria-label="이전"
      >
        <FiChevronLeft size={28} className="text-gray-900" />
      </button>

      {/* Shorts 슬라이더 */}
      <div
        ref={scrollContainerRef}
        className="flex gap-5 md:gap-6 overflow-x-auto scroll-smooth hide-scrollbar px-16"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {shorts.map((short) => (
          <div
            key={short.id}
            onClick={() => handleVideoClick(short)}
            className="flex-none w-[240px] md:w-[280px] bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all overflow-hidden group cursor-pointer border-2 border-gray-200"
          >
            {/* 세로형 썸네일 (9:16 비율) */}
            <div className="relative aspect-[9/16] overflow-hidden bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={short.thumbnail}
                alt={short.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {/* Shorts 아이콘 오버레이 */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
              {/* Play 버튼 */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center shadow-2xl">
                  <FiPlay className="w-10 h-10 text-white ml-1" />
                </div>
              </div>
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-red-600 rounded-sm flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                      <path d="M10 14.65v-5.3L15 12l-5 2.65zm7.77-4.33c-.77-.32-1.2-.5-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.24-2.53-5.07-1.56L6 6.94c-1.29.68-2.07 2.04-2 3.49.07 1.42.93 2.67 2.22 3.25.03.01 1.2.5 1.2.5L6 14.93c-1.83.97-2.53 3.24-1.56 5.07.97 1.83 3.24 2.53 5.07 1.56l8.5-4.5c1.29-.68 2.06-2.04 1.99-3.49-.07-1.42-.94-2.68-2.23-3.25z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-white text-base md:text-lg font-bold line-clamp-2 drop-shadow-lg">
                  {short.title}
                </h3>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 우측 화살표 */}
      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/95 hover:bg-white shadow-2xl rounded-full p-4 transition-all min-w-[56px] min-h-[56px] flex items-center justify-center"
        aria-label="다음"
      >
        <FiChevronRight size={28} className="text-gray-900" />
      </button>

      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* 비디오 모달 */}
      {selectedVideo && (
        <VideoModal
          videoId={selectedVideo.id}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
