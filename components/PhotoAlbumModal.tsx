'use client';
import Image from 'next/image';

interface PhotoAlbumModalProps {
  open: boolean; // isOpen을 open으로 변경
  onClose: () => void;
  images: string[]; // photos를 images로 변경
  onImageClick?: (images: string[], clickedIndex: number) => void; // onImageClick prop 추가
}

export default function PhotoAlbumModal({ open, onClose, images, onImageClick }: PhotoAlbumModalProps) {
  if (!open) return null;

  // images가 undefined이거나 빈 배열인 경우 처리
  if (!images || images.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">사진 앨범</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
          <p className="text-gray-500 text-center">표시할 사진이 없습니다.</p>
        </div>
      </div>
    );
  }

  const handleImageClick = (photo: string, index: number) => {
    if (onImageClick) {
      onImageClick(images, index);
    }
  };

  // const displayedPhotos = photos.slice(0, 9); // 처음 9개 이미지만 미리보기
  // const hasMorePhotos = photos.length > 9;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="relative bg-white rounded-lg p-6 w-11/12 max-w-6xl overflow-y-auto" style={{ maxHeight: '90vh' }}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-700 hover:text-gray-900 text-3xl font-bold z-10"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">사진 앨범 ({images.length}장)</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
          {images.map((url, index) => {
            const isVideo = (url: string) => url.toLowerCase().endsWith('.mp4');
            return (
              <div 
                key={index} 
                className="aspect-video bg-gray-200 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity transform hover:scale-105 shadow-md"
                onClick={() => handleImageClick(url, index)} // 이미지 클릭 시 handleImageClick 호출
              >
                {isVideo(url) ? (
                  <video key={url} src={url} controls playsInline className="rounded-lg w-full h-full object-cover" />
                ) : (
                  <Image
                    src={url}
                    alt={`갤러리 이미지 ${index + 1}`}
                    width={600}
                    height={400}
                    objectFit="cover"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    quality={75}
                    sizes="(max-width: 768px) 100vw, 33vw"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder-image.png';
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* {hasMorePhotos && (
          <div className="text-center mt-6">
            <button
              onClick={() => onImageClick && onImageClick(images, 0)} // 전체 사진을 ImageViewerModal로 전달
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md"
            >
              {images.length}장의 사진 모두 보기
            </button>
          </div>
        )} */}

      </div>
    </div>
  );
}




