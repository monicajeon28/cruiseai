// components/mall/YoutubeVideosSlider.tsx
// 일반 YouTube 영상 슬라이더 (Shorts 제외)

'use client';

import { useEffect, useState, useRef } from 'react';
import { FiChevronLeft, FiChevronRight, FiPlay } from 'react-icons/fi';
import VideoModal from './VideoModal';

interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string | null;
  url: string;
}

export default function YoutubeVideosSlider() {
  const formatPublishedAt = (value: string | null) => {
    if (!value) {
      return '최근 업로드';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString('ko-KR');
  };

  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 페이지를 먼저 표시하고 백그라운드에서 로드
    setIsLoading(false);
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 15000); // 15초 타임아웃

      const response = await fetch('/api/public/youtube/videos?maxResults=10', {
        signal: abortController.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.ok) {
        setVideos(data.videos);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error loading videos:', error);
      }
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 400;
      const newScrollLeft = scrollContainerRef.current.scrollLeft +
        (direction === 'left' ? -scrollAmount : scrollAmount);

      scrollContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
  };

  const handleVideoClick = (video: Video) => {
    setSelectedVideo(video);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedVideo(null);
  };

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
        <p className="text-xl md:text-2xl text-gray-700 font-semibold">영상을 불러오는 중...</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed">
        <p className="text-xl md:text-2xl text-gray-600 font-semibold">현재 영상이 없습니다</p>
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        {/* 좌측 화살표 */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/95 hover:bg-white shadow-2xl rounded-full p-4 transition-all min-w-[56px] min-h-[56px] flex items-center justify-center"
          aria-label="이전"
        >
          <FiChevronLeft size={28} className="text-gray-900" />
        </button>

        {/* 영상 슬라이더 */}
        <div
          ref={scrollContainerRef}
          className="flex gap-5 md:gap-6 overflow-x-auto scroll-smooth hide-scrollbar px-16"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {videos.map((video) => (
            <div
              key={video.id}
              onClick={() => handleVideoClick(video)}
              className="flex-none w-[360px] md:w-[400px] bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all overflow-hidden group cursor-pointer border-2 border-gray-200"
            >
              {/* 가로형 썸네일 (16:9 비율) */}
              <div className="relative aspect-video overflow-hidden bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {/* Play 오버레이 */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center">
                  <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-2xl">
                    <FiPlay className="w-10 h-10 text-white ml-1" />
                  </div>
                </div>
              </div>

              {/* 영상 정보 */}
              <div className="p-5 md:p-6">
                <h3 className="text-base md:text-lg font-black text-gray-900 line-clamp-2 mb-3 group-hover:text-red-600 transition-colors leading-relaxed">
                  {video.title}
                </h3>
                <p className="text-sm md:text-base text-gray-600 font-semibold">
                  {formatPublishedAt(video.publishedAt)}
                </p>
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
      </div>

      {/* 비디오 모달 */}
      {selectedVideo && (
        <VideoModal
          videoId={selectedVideo.id}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}





