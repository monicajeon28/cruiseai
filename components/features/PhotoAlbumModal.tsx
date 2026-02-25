import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface PhotoAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
}

const PhotoAlbumModal: React.FC<PhotoAlbumModalProps> = ({ isOpen, onClose, images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? images.length - 1 : prevIndex - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex === images.length - 1 ? 0 : prevIndex + 1));
  }, [images.length]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      handlePrev();
    } else if (event.key === 'ArrowRight') {
      handleNext();
    } else if (event.key === 'Escape') {
      onClose();
    }
  }, [handlePrev, handleNext, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  // 모달이 열릴 때마다 첫 번째 이미지로 리셋
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
    }
  }, [isOpen]);

  if (!isOpen || images.length === 0) {
    return null;
  }

  const currentMedia = images[currentIndex];
  const isVideo = currentMedia.match(/\.(mp4|avi|mov|wmv|flv)$/i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-4xl font-bold z-50 hover:text-gray-300 transition-colors bg-black bg-opacity-50 rounded-full w-12 h-12 flex items-center justify-center"
        aria-label="Close photo album"
      >
        &times;
      </button>

      {/* Navigation Buttons */}
      {images.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-4 text-white text-5xl z-50 p-2 rounded-full bg-black bg-opacity-50 hover:bg-opacity-75 transition-opacity"
            aria-label="Previous image"
          >
            &lt;
          </button>
          <button
            onClick={handleNext}
            className="absolute right-4 text-white text-5xl z-50 p-2 rounded-full bg-black bg-opacity-50 hover:bg-opacity-75 transition-opacity"
            aria-label="Next image"
          >
            &gt;
          </button>
        </>
      )}

      {/* Main Media Display */}
      <div className="relative flex items-center justify-center w-full h-full max-w-screen-lg max-h-screen-lg">
        {isVideo ? (
          <video
            src={currentMedia}
            controls
            autoPlay
            loop
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            onError={(e) => {
              console.error('Video load error:', e);
            }}
          >
            <source src={currentMedia} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          <Image
            src={currentMedia}
            alt={`크루즈 여행 앨범 이미지 ${currentIndex + 1}`}
            width={800}
            height={600}
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            quality={75}
            sizes="(max-width: 768px) 100vw, 800px"
            priority={currentIndex === 0}
            onError={(e) => {
              console.error('Image load error:', e);
            }}
          />
        )}
        
        {/* Media Counter */}
        <div className="absolute bottom-4 text-white text-lg bg-black bg-opacity-50 px-4 py-2 rounded-full">
          {currentIndex + 1} / {images.length}
        </div>
      </div>

      {/* Thumbnails (최대 10개 표시) */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-50 max-w-full overflow-x-auto">
          {images.slice(0, 10).map((image, index) => {
            const isVideoThumb = image.match(/\.(mp4|avi|mov|wmv|flv)$/i);
            return (
              <div
                key={index}
                className={`w-16 h-16 relative cursor-pointer border-2 ${
                  index === currentIndex ? 'border-blue-500' : 'border-transparent'
                } rounded-md overflow-hidden flex-shrink-0`}
                onClick={() => setCurrentIndex(index)}
              >
                {isVideoThumb ? (
                  <video 
                    src={image} 
                    className="w-full h-full object-cover"
                    muted
                    onError={(e) => {
                      // 비디오 썸네일 로드 실패 시 기본 아이콘 표시
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <Image
                    src={image}
                    alt={`크루즈 여행 썸네일 이미지 ${index + 1}`}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                    quality={60}
                    loading="lazy"
                    sizes="64px"
                    onError={(e) => {
                      // 이미지 로드 실패 시 기본 아이콘 표시
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                {/* 비디오 아이콘 표시 */}
                {isVideoThumb && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-6 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                      <div className="w-0 h-0 border-l-4 border-l-white border-y-2 border-y-transparent ml-1"></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {images.length > 10 && (
            <div className="w-16 h-16 flex items-center justify-center bg-gray-700 text-white rounded-md text-sm flex-shrink-0">
              +{images.length - 10}
            </div>
          )}
        </div>
      )}

      {/* Loading Indicator */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-lg bg-black bg-opacity-50 px-4 py-2 rounded-full">
        {isVideo ? '비디오 로딩 중...' : '이미지 로딩 중...'}
      </div>
    </div>
  );
};

export default PhotoAlbumModal;
