// components/admin/ProductDetailEditor.tsx
// 상품 상세페이지 에디터 (이미지/동영상/텍스트 블록)

'use client';

import { useState, useEffect } from 'react';
import { FiImage, FiVideo, FiFileText, FiX, FiChevronUp, FiChevronDown, FiTrash2, FiPlus, FiFolder, FiSearch } from 'react-icons/fi';
import imageCompression from 'browser-image-compression';

export type ContentBlock =
  | { type: 'image'; id: string; url: string; alt?: string }
  | { type: 'video'; id: string; url: string; title?: string }
  | { type: 'text'; id: string; content: string };

interface ProductDetailEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  productCode?: string; // 상품 코드 (구글 드라이브 상품 폴더에 저장하기 위해)
}

export default function ProductDetailEditor({ blocks, onChange, productCode }: ProductDetailEditorProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showCruisePhotoModal, setShowCruisePhotoModal] = useState(false);
  const [cruiseFolders, setCruiseFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [cruiseImages, setCruiseImages] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectingForIndex, setSelectingForIndex] = useState<number | null>(null);
  const [hoveredImageIndex, setHoveredImageIndex] = useState<number | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // 복수 선택 모드 상태
  const [multiSelectMode, setMultiSelectMode] = useState<boolean>(false);
  const [selectedCruiseImages, setSelectedCruiseImages] = useState<string[]>([]);
  const [selectedGoogleDriveImageUrls, setSelectedGoogleDriveImageUrls] = useState<string[]>([]);

  // 구글 드라이브 상품 폴더 모달 상태
  const [showGoogleDriveModal, setShowGoogleDriveModal] = useState(false);
  const [googleDriveFolders, setGoogleDriveFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGoogleDriveFolder, setSelectedGoogleDriveFolder] = useState<string>('');
  const [googleDriveImages, setGoogleDriveImages] = useState<Array<{ id: string; name: string; url: string; thumbnail?: string }>>([]);
  const [googleDriveSearchTerm, setGoogleDriveSearchTerm] = useState('');

  // 업로드 진행 상태
  const [uploadedCount, setUploadedCount] = useState(0);
  const [totalUploadCount, setTotalUploadCount] = useState(0);

  // 이미지 압축 (WebP 변환, 원본 해상도 유지 — 세로 10000px 이상 허용)
  const validateAndCompressImage = async (file: File): Promise<File | null> => {
    // 깨진 이미지 파일 검증
    const ok = await new Promise<boolean>((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(url); resolve(true); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
      img.src = url;
    });
    if (!ok) return null;
    // 20MB 초과 시 안내 (자동 압축 후 진행)
    if (file.size > 20 * 1024 * 1024) {
      alert(`"${file.name}" 파일 크기가 ${(file.size / 1024 / 1024).toFixed(1)}MB입니다.\n자동 압축되어 업로드됩니다.`);
    }
    try {
      const blob = await imageCompression(file, {
        maxSizeMB: 3,            // 2→3MB (세로 긴 이미지 화질 보존)
        maxWidthOrHeight: 99999, // 리사이즈 비활성화 — 원본 해상도 유지
        useWebWorker: true,
        fileType: 'image/webp',  // WebP 변환 (PNG 대비 80~85% 용량 절감)
        initialQuality: 0.90,    // 0.85→0.90 (과다 압축 방지)
      });
      return new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
        type: 'image/webp',
        lastModified: file.lastModified,
      });
    } catch {
      return file;
    }
  };

  const addBlock = (type: 'image' | 'video' | 'text') => {
    const newBlock: ContentBlock =
      type === 'image'
        ? { type: 'image', id: `block-${Date.now()}`, url: '', alt: '' }
        : type === 'video'
          ? { type: 'video', id: `block-${Date.now()}`, url: '', title: '' }
          : { type: 'text', id: `block-${Date.now()}`, content: '' };

    onChange([...blocks, newBlock]);
  };

  const updateBlock = (index: number, updates: Partial<ContentBlock>) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], ...updates } as ContentBlock;
    onChange(newBlocks);
  };

  const deleteBlock = (index: number) => {
    if (!confirm('이 블록을 삭제하시겠습니까?')) return;
    const newBlocks = blocks.filter((_, i) => i !== index);
    onChange(newBlocks);
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === blocks.length - 1) return;

    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    onChange(newBlocks);
  };

  // 드래그 앤 드롭 핸들러
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newBlocks = [...blocks];
    const draggedBlock = newBlocks[draggedIndex];
    newBlocks.splice(draggedIndex, 1);
    newBlocks.splice(dropIndex, 0, draggedBlock);
    onChange(newBlocks);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // 크루즈정보사진 폴더 목록 로드
  useEffect(() => {
    if (showCruisePhotoModal) {
      loadCruiseFolders();
    }
  }, [showCruisePhotoModal]);

  const loadCruiseFolders = async () => {
    try {
      const res = await fetch('/api/admin/mall/cruise-photos?listFolders=true', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.folders) {
          setCruiseFolders(data.folders);
        }
      }
    } catch (error) {
      console.error('Failed to load cruise folders:', error);
    }
  };

  const loadCruiseImages = async (folder: string) => {
    try {
      const res = await fetch(`/api/admin/mall/cruise-photos?folder=${encodeURIComponent(folder)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.images) {
          setCruiseImages(data.images);
        }
      }
    } catch (error) {
      console.error('Failed to load cruise images:', error);
    }
  };

  const handleSelectCruiseImage = (imageUrl: string) => {
    if (multiSelectMode) {
      // 복수 선택 모드: 선택된 이미지 토글
      setSelectedCruiseImages(prev =>
        prev.includes(imageUrl)
          ? prev.filter(url => url !== imageUrl)
          : [...prev, imageUrl]
      );
    } else if (selectingForIndex !== null) {
      // 단일 선택 모드: 기존 동작
      updateBlock(selectingForIndex, { url: imageUrl });
      setShowCruisePhotoModal(false);
      setSelectingForIndex(null);
      setSelectedFolder('');
      setCruiseImages([]);
      setSearchTerm('');
    }
  };

  // 크루즈사진 복수 선택 완료
  const handleConfirmCruiseMultiSelect = () => {
    if (selectedCruiseImages.length === 0) return;

    const newBlocks: ContentBlock[] = selectedCruiseImages.map((url, index) => ({
      type: 'image' as const,
      id: `block-${Date.now()}-${index}`,
      url,
      alt: ''
    }));

    onChange([...blocks, ...newBlocks]);
    alert(`${selectedCruiseImages.length}개의 이미지가 추가되었습니다.`);

    // 상태 초기화
    setShowCruisePhotoModal(false);
    setSelectingForIndex(null);
    setSelectedFolder('');
    setCruiseImages([]);
    setSearchTerm('');
    setMultiSelectMode(false);
    setSelectedCruiseImages([]);
  };

  const filteredFolders = cruiseFolders.filter(folder =>
    folder.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 구글 드라이브 상품 폴더 목록 로드
  useEffect(() => {
    if (showGoogleDriveModal) {
      loadGoogleDriveFolders();
    }
  }, [showGoogleDriveModal]);

  const loadGoogleDriveFolders = async () => {
    try {
      const res = await fetch('/api/admin/mall/google-drive-products?listFolders=true', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.folders) {
          setGoogleDriveFolders(data.folders);
        }
      }
    } catch (error) {
      console.error('Failed to load Google Drive folders:', error);
    }
  };

  const loadGoogleDriveImages = async (folderId?: string) => {
    try {
      const url = folderId
        ? `/api/admin/mall/google-drive-products?folderId=${encodeURIComponent(folderId)}`
        : '/api/admin/mall/google-drive-products';
      const res = await fetch(url, {
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('[Google Drive] Failed to load images:', errorData);
        alert(`이미지를 불러오는데 실패했습니다: ${errorData.error || '알 수 없는 오류'}`);
        return;
      }

      const data = await res.json();
      if (data.ok) {
        if (data.images && Array.isArray(data.images)) {
          setGoogleDriveImages(data.images);
        } else {
          setGoogleDriveImages([]);
        }
      } else {
        console.error('[Google Drive] API returned error:', data.error);
        alert(`이미지를 불러오는데 실패했습니다: ${data.error || '알 수 없는 오류'}`);
        setGoogleDriveImages([]);
      }
    } catch (error: any) {
      console.error('Failed to load Google Drive images:', error);
      alert(`이미지를 불러오는데 실패했습니다: ${error.message || '네트워크 오류'}`);
      setGoogleDriveImages([]);
    }
  };

  const handleSelectGoogleDriveImage = (imageUrl: string) => {
    if (multiSelectMode) {
      // 복수 선택 모드: 선택된 이미지 토글
      setSelectedGoogleDriveImageUrls(prev =>
        prev.includes(imageUrl)
          ? prev.filter(url => url !== imageUrl)
          : [...prev, imageUrl]
      );
    } else if (selectingForIndex !== null) {
      // 단일 선택 모드: 기존 동작
      updateBlock(selectingForIndex, { url: imageUrl });
      setShowGoogleDriveModal(false);
      setSelectingForIndex(null);
      setSelectedGoogleDriveFolder('');
      setGoogleDriveImages([]);
      setGoogleDriveSearchTerm('');
    }
  };

  // 구글드라이브 복수 선택 완료
  const handleConfirmGoogleDriveMultiSelect = () => {
    if (selectedGoogleDriveImageUrls.length === 0) return;

    const newBlocks: ContentBlock[] = selectedGoogleDriveImageUrls.map((url, index) => ({
      type: 'image' as const,
      id: `block-${Date.now()}-${index}`,
      url,
      alt: ''
    }));

    onChange([...blocks, ...newBlocks]);
    alert(`${selectedGoogleDriveImageUrls.length}개의 이미지가 추가되었습니다.`);

    // 상태 초기화
    setShowGoogleDriveModal(false);
    setSelectingForIndex(null);
    setSelectedGoogleDriveFolder('');
    setGoogleDriveImages([]);
    setGoogleDriveSearchTerm('');
    setMultiSelectMode(false);
    setSelectedGoogleDriveImageUrls([]);
  };

  const filteredGoogleDriveFolders = googleDriveFolders.filter(folder =>
    folder.name.toLowerCase().includes(googleDriveSearchTerm.toLowerCase())
  );

  const handleFileUpload = async (index: number, file: File, type: 'image' | 'video') => {
    if (type === 'image') {
      const processed = await validateAndCompressImage(file);
      if (!processed) return;
      const baseFilename = file.name.replace(/\.[^/.]+$/, '');
      await uploadFile(index, processed, type, '상품이미지', baseFilename);
    } else {
      await uploadFile(index, file, type);
    }
  };

  const uploadFile = async (index: number, file: File, type: 'image' | 'video', category?: string, filename?: string) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      if (category) {
        formData.append('category', category);
      }
      if (filename) {
        formData.append('filename', filename);
      }
      // 상품 코드가 있으면 전달 (구글 드라이브 상품 폴더에 저장하기 위해)
      if (productCode) {
        formData.append('productCode', productCode);
      }

      const res = await fetch('/api/admin/mall/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          updateBlock(index, { url: data.url });
        }
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('파일 업로드에 실패했습니다.');
    }
  };

  const handleMultipleImageUploadWithCategory = async (files: FileList, category: string, baseFilename: string) => {
    if (!files || files.length === 0) {
      alert('이미지를 선택해주세요.');
      return;
    }

    try {
      const newBlocks: ContentBlock[] = [];
      let successCount = 0;
      let failCount = 0;

      // 3개 병렬 업로드 (Google Drive API 안전 한도 내)
      const CONCURRENCY = 3;
      const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
      setTotalUploadCount(fileArray.length);
      setUploadedCount(0);

      const chunks: File[][] = [];
      for (let i = 0; i < fileArray.length; i += CONCURRENCY) {
        chunks.push(fileArray.slice(i, i + CONCURRENCY));
      }

      let chunkStartOffset = 0;
      for (const chunk of chunks) {
        const chunkOffset = chunkStartOffset;
        chunkStartOffset += chunk.length;

        const results = await Promise.all(chunk.map(async (file, chunkIdx) => {
          const fileIndex = chunkOffset + chunkIdx; // 전역 인덱스 (중복 파일명 방지)
          try {
            const processed = await validateAndCompressImage(file);
            if (!processed) return null;

            const formData = new FormData();
            formData.append('file', processed);
            formData.append('type', 'image');
            formData.append('category', category);
            const filename = fileArray.length > 1 ? `${baseFilename}_${fileIndex + 1}` : baseFilename;
            formData.append('filename', filename);
            if (productCode) formData.append('productCode', productCode);

            const res = await fetch('/api/admin/mall/upload', {
              method: 'POST',
              credentials: 'include',
              body: formData,
            });

            if (res.ok) {
              const data = await res.json();
              if (data.ok && data.url) {
                return {
                  type: 'image' as const,
                  id: `block-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                  url: data.url,
                  alt: '',
                } as ContentBlock;
              }
              console.error(`[Image Upload] Failed: ${file.name}`, data);
            } else {
              console.error(`[Image Upload] HTTP error for ${file.name}:`, res.status);
            }
          } catch (error) {
            console.error(`[Image Upload] Error uploading ${file.name}:`, error);
          } finally {
            setUploadedCount(prev => prev + 1); // 파일별 즉시 업데이트 (함수형 패턴)
          }
          return null;
        }));

        for (const block of results) {
          if (block) {
            newBlocks.push(block);
            successCount++;
          } else {
            failCount++;
          }
        }
      }

      if (newBlocks.length > 0) {
        onChange([...blocks, ...newBlocks]);
        const message = `${successCount}개의 이미지가 추가되었습니다.${failCount > 0 ? ` (${failCount}개 실패)` : ''}`;
        alert(message);
      } else {
        alert('이미지 업로드에 실패했습니다. 모든 파일이 이미지 형식인지 확인해주세요.');
      }
    } catch (error) {
      console.error('Failed to upload multiple images:', error);
      alert('이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      // 예외/취소 여부와 무관하게 progress 초기화
      setTotalUploadCount(0);
      setUploadedCount(0);
    }
  };

  return (
    <div className="space-y-4">
      {/* 블록 추가 버튼 */}
      <div className="flex gap-2 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex-wrap">
        <button
          onClick={() => addBlock('image')}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <FiImage size={18} />
          <span className="text-sm font-medium">이미지 추가</span>
        </button>
        <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white border border-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
          <FiImage size={18} />
          <span className="text-sm font-medium">이미지 모두 불러오기</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) {
                console.log(`[Image Upload] Selected ${files.length} files`);
                handleMultipleImageUploadWithCategory(files, '상품이미지', '이미지');
                // 같은 파일 다시 선택 가능하도록 리셋 (비동기로 처리)
                setTimeout(() => {
                  if (e.target) {
                    e.target.value = '';
                  }
                }, 100);
              }
            }}
            className="hidden"
          />
        </label>
        <button
          onClick={() => {
            setMultiSelectMode(true);
            setSelectedCruiseImages([]);
            setShowCruisePhotoModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white border border-green-600 rounded-lg hover:bg-green-700 transition-colors"
        >
          <FiFolder size={18} />
          <span className="text-sm font-medium">크루즈사진 복수 선택</span>
        </button>
        <button
          onClick={() => {
            setMultiSelectMode(true);
            setSelectedGoogleDriveImageUrls([]);
            setShowGoogleDriveModal(true);
            loadGoogleDriveImages();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white border border-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
        >
          <FiFolder size={18} />
          <span className="text-sm font-medium">구글드라이브 복수 선택</span>
        </button>
        <button
          onClick={() => addBlock('video')}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <FiVideo size={18} />
          <span className="text-sm font-medium">동영상 추가</span>
        </button>
        <button
          onClick={() => addBlock('text')}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <FiFileText size={18} />
          <span className="text-sm font-medium">텍스트 추가</span>
        </button>
      </div>

      {/* 업로드 진행률 표시 */}
      {totalUploadCount > 0 && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between text-sm text-blue-700 mb-1.5">
            <span>📤 이미지 업로드 중...</span>
            <span className="font-semibold">{uploadedCount}/{totalUploadCount}장</span>
          </div>
          <div className="w-full bg-blue-100 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: totalUploadCount > 0 ? `${(uploadedCount / totalUploadCount) * 100}%` : '0%' }}
            />
          </div>
          <p className="text-xs text-blue-500 mt-1">잠시만 기다려주세요 — 업로드 완료 후 자동 적용됩니다</p>
        </div>
      )}

      {/* 블록 목록 */}
      <div className="space-y-4">
        {blocks.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-500">블록을 추가하여 상세페이지를 구성하세요</p>
          </div>
        ) : (
          blocks.map((block, index) => (
            <div
              key={block.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              className={`bg-white border-2 rounded-lg p-4 transition-all cursor-move ${draggedIndex === index
                  ? 'opacity-50 border-blue-500'
                  : dragOverIndex === index
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
            >
              {/* 블록 헤더 */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b">
                <div className="flex items-center gap-2">
                  {block.type === 'image' && <FiImage className="text-blue-600" size={20} />}
                  {block.type === 'video' && <FiVideo className="text-purple-600" size={20} />}
                  {block.type === 'text' && <FiFileText className="text-green-600" size={20} />}
                  <span className="font-medium text-gray-700">
                    {block.type === 'image' ? '이미지' : block.type === 'video' ? '동영상' : '텍스트'} 블록
                  </span>
                  <span className="text-xs text-gray-500">#{index + 1}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveBlock(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="위로 이동"
                  >
                    <FiChevronUp size={18} />
                  </button>
                  <button
                    onClick={() => moveBlock(index, 'down')}
                    disabled={index === blocks.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="아래로 이동"
                  >
                    <FiChevronDown size={18} />
                  </button>
                  <button
                    onClick={() => deleteBlock(index)}
                    className="p-1 text-red-400 hover:text-red-600"
                    title="삭제"
                  >
                    <FiTrash2 size={18} />
                  </button>
                </div>
              </div>

              {/* 블록 내용 */}
              {block.type === 'image' && (
                <div className="space-y-3">
                  {block.url ? (
                    <div
                      className="relative group"
                      onMouseEnter={() => {
                        setHoveredImageIndex(index);
                        setImagePreviewUrl(block.url);
                      }}
                      onMouseLeave={() => {
                        setHoveredImageIndex(null);
                        setImagePreviewUrl(null);
                      }}
                    >
                      <img
                        src={block.url}
                        alt={block.alt || '이미지'}
                        className="w-full h-64 object-cover rounded-lg border border-gray-300"
                      />
                      <button
                        onClick={() => updateBlock(index, { url: '' })}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 z-10"
                      >
                        <FiX size={16} />
                      </button>
                      {/* 호버 시 전체 이미지 미리보기 */}
                      {hoveredImageIndex === index && imagePreviewUrl && (
                        <div className="absolute top-full left-0 mt-2 z-50 bg-white border-2 border-blue-500 rounded-lg shadow-2xl p-2 max-w-2xl">
                          <img
                            src={imagePreviewUrl}
                            alt={block.alt || '이미지 미리보기'}
                            className="max-h-96 w-auto object-contain rounded"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                        <FiImage size={24} className="text-gray-400" />
                        <span className="text-sm font-medium text-gray-600">이미지 업로드</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(index, file, 'image');
                          }}
                          className="hidden"
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectingForIndex(index);
                            setShowCruisePhotoModal(true);
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <FiFolder size={18} />
                          <span className="text-sm font-medium">크루즈정보사진에서 선택</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectingForIndex(index);
                            setShowGoogleDriveModal(true);
                            loadGoogleDriveImages(); // 루트 폴더 이미지 로드
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <FiFolder size={18} />
                          <span className="text-sm font-medium">구글드라이브 상품에서 선택</span>
                        </button>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      이미지 설명 (alt 텍스트)
                    </label>
                    <input
                      type="text"
                      value={block.alt || ''}
                      onChange={(e) => updateBlock(index, { alt: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="이미지 설명을 입력하세요"
                    />
                  </div>
                </div>
              )}

              {block.type === 'video' && (
                <div className="space-y-3">
                  {block.url ? (
                    <div className="relative">
                      <video
                        src={block.url}
                        controls
                        className="w-full h-64 rounded-lg border border-gray-300"
                      />
                      <button
                        onClick={() => updateBlock(index, { url: '' })}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                      >
                        <FiX size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                      <FiVideo size={24} className="text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">동영상 업로드</span>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(index, file, 'video');
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      동영상 제목
                    </label>
                    <input
                      type="text"
                      value={block.title || ''}
                      onChange={(e) => updateBlock(index, { title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="동영상 제목을 입력하세요"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      또는 YouTube URL
                    </label>
                    <input
                      type="url"
                      value={block.url || ''}
                      onChange={(e) => updateBlock(index, { url: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                  </div>
                </div>
              )}

              {block.type === 'text' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    텍스트 내용
                  </label>
                  <textarea
                    value={block.content}
                    onChange={(e) => updateBlock(index, { content: e.target.value })}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="텍스트 내용을 입력하세요..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    HTML 태그 사용 가능 (예: &lt;strong&gt;, &lt;em&gt;, &lt;br&gt; 등)
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 크루즈정보사진 선택 모달 */}
      {showCruisePhotoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  크루즈정보사진에서 선택
                  {multiSelectMode && <span className="ml-2 text-sm font-normal text-green-600">(복수 선택 모드)</span>}
                </h3>
                {multiSelectMode && selectedCruiseImages.length > 0 && (
                  <p className="text-sm text-blue-600 mt-1">{selectedCruiseImages.length}개 선택됨</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {multiSelectMode && selectedCruiseImages.length > 0 && (
                  <button
                    onClick={handleConfirmCruiseMultiSelect}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                  >
                    선택 완료 ({selectedCruiseImages.length}개)
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowCruisePhotoModal(false);
                    setSelectingForIndex(null);
                    setSelectedFolder('');
                    setCruiseImages([]);
                    setSearchTerm('');
                    setMultiSelectMode(false);
                    setSelectedCruiseImages([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX size={24} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex">
              {/* 폴더 목록 */}
              <div className="w-1/3 border-r overflow-y-auto p-4">
                <div className="mb-4">
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="폴더 검색..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  {filteredFolders.map((folder) => (
                    <button
                      key={folder}
                      onClick={() => {
                        setSelectedFolder(folder);
                        loadCruiseImages(folder);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFolder === folder
                          ? 'bg-blue-100 text-blue-700 font-semibold'
                          : 'hover:bg-gray-100 text-gray-700'
                        }`}
                    >
                      {folder}
                    </button>
                  ))}
                </div>
              </div>

              {/* 이미지 그리드 */}
              <div className="flex-1 overflow-y-auto p-4">
                {selectedFolder ? (
                  cruiseImages.length > 0 ? (
                    <div className="grid grid-cols-3 gap-4">
                      {cruiseImages.map((imageUrl) => {
                        const isSelected = multiSelectMode && selectedCruiseImages.includes(imageUrl);
                        return (
                          <div
                            key={imageUrl}
                            onClick={() => handleSelectCruiseImage(imageUrl)}
                            className={`relative aspect-square cursor-pointer group ${isSelected ? 'ring-4 ring-green-500 rounded-lg' : ''}`}
                          >
                            <img
                              src={imageUrl}
                              alt={imageUrl}
                              className={`w-full h-full object-cover rounded-lg border-2 transition-colors ${isSelected ? 'border-green-500' : 'border-gray-200 group-hover:border-blue-500'}`}
                            />
                            {multiSelectMode && (
                              <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300'}`}>
                                {isSelected && <span className="text-xs font-bold">✓</span>}
                              </div>
                            )}
                            <div className={`absolute inset-0 transition-opacity rounded-lg flex items-center justify-center ${isSelected ? 'bg-green-500 bg-opacity-20' : 'bg-black bg-opacity-0 group-hover:bg-opacity-20'}`}>
                              <span className={`font-semibold ${isSelected ? 'text-green-700' : 'text-white opacity-0 group-hover:opacity-100'}`}>
                                {isSelected ? '선택됨' : '선택'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <p>이 폴더에 이미지가 없습니다.</p>
                    </div>
                  )
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <p>왼쪽에서 폴더를 선택하세요.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 구글 드라이브 상품 폴더 선택 모달 */}
      {showGoogleDriveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  구글 드라이브 상품 폴더에서 선택
                  {multiSelectMode && <span className="ml-2 text-sm font-normal text-purple-600">(복수 선택 모드)</span>}
                </h3>
                {multiSelectMode && selectedGoogleDriveImageUrls.length > 0 && (
                  <p className="text-sm text-blue-600 mt-1">{selectedGoogleDriveImageUrls.length}개 선택됨</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {multiSelectMode && selectedGoogleDriveImageUrls.length > 0 && (
                  <button
                    onClick={handleConfirmGoogleDriveMultiSelect}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
                  >
                    선택 완료 ({selectedGoogleDriveImageUrls.length}개)
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowGoogleDriveModal(false);
                    setSelectingForIndex(null);
                    setSelectedGoogleDriveFolder('');
                    setGoogleDriveImages([]);
                    setGoogleDriveSearchTerm('');
                    setMultiSelectMode(false);
                    setSelectedGoogleDriveImageUrls([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX size={24} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex">
              {/* 폴더 목록 */}
              <div className="w-1/3 border-r overflow-y-auto p-4">
                <div className="mb-4">
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={googleDriveSearchTerm}
                      onChange={(e) => setGoogleDriveSearchTerm(e.target.value)}
                      placeholder="폴더 검색..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setSelectedGoogleDriveFolder('');
                      loadGoogleDriveImages(); // 루트 폴더 이미지 로드
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedGoogleDriveFolder === ''
                        ? 'bg-blue-100 text-blue-700 font-semibold'
                        : 'hover:bg-gray-100 text-gray-700'
                      }`}
                  >
                    📁 루트 폴더
                  </button>
                  {filteredGoogleDriveFolders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => {
                        setSelectedGoogleDriveFolder(folder.id);
                        loadGoogleDriveImages(folder.id);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedGoogleDriveFolder === folder.id
                          ? 'bg-blue-100 text-blue-700 font-semibold'
                          : 'hover:bg-gray-100 text-gray-700'
                        }`}
                    >
                      {folder.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 이미지 그리드 */}
              <div className="flex-1 overflow-y-auto p-4">
                {googleDriveImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-4">
                    {googleDriveImages.map((image) => {
                      const isSelected = multiSelectMode && selectedGoogleDriveImageUrls.includes(image.url);
                      return (
                        <div
                          key={image.id}
                          onClick={() => handleSelectGoogleDriveImage(image.url)}
                          className={`relative aspect-square cursor-pointer group ${isSelected ? 'ring-4 ring-purple-500 rounded-lg' : ''}`}
                        >
                          <img
                            src={image.thumbnail || image.url}
                            alt={image.name}
                            className={`w-full h-full object-cover rounded-lg border-2 transition-colors ${isSelected ? 'border-purple-500' : 'border-gray-200 group-hover:border-blue-500'}`}
                            onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              const currentSrc = img.src;
                              console.error('[Google Drive Image] Load error:', {
                                currentSrc,
                                url: image.url,
                                thumbnail: image.thumbnail,
                                directUrl: (image as any).directUrl,
                                proxyUrl: (image as any).proxyUrl,
                              });

                              // 로드 실패 시 다른 URL 시도
                              if ((image as any).proxyUrl && currentSrc !== (image as any).proxyUrl) {
                                img.src = (image as any).proxyUrl;
                              } else if ((image as any).directUrl && currentSrc !== (image as any).directUrl) {
                                img.src = (image as any).directUrl;
                              } else if (image.url && currentSrc !== image.url) {
                                img.src = image.url;
                              } else {
                                console.error('[Google Drive Image] All URLs failed for:', image.name);
                              }
                            }}
                            onLoad={(e) => {
                              console.log('[Google Drive Image] Loaded successfully:', {
                                src: (e.target as HTMLImageElement).src,
                                name: image.name,
                              });
                            }}
                          />
                          {multiSelectMode && (
                            <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-purple-500 border-purple-500 text-white' : 'bg-white border-gray-300'}`}>
                              {isSelected && <span className="text-xs font-bold">✓</span>}
                            </div>
                          )}
                          <div className={`absolute inset-0 transition-opacity rounded-lg flex items-center justify-center ${isSelected ? 'bg-purple-500 bg-opacity-20' : 'bg-black bg-opacity-0 group-hover:bg-opacity-20'}`}>
                            <span className={`font-semibold ${isSelected ? 'text-purple-700' : 'text-white opacity-0 group-hover:opacity-100'}`}>
                              {isSelected ? '선택됨' : '선택'}
                            </span>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                            {image.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <div className="space-y-4">
                      <p className="text-lg font-semibold">이 폴더에 이미지가 없습니다.</p>
                      <div className="text-sm space-y-2">
                        <p>💡 이미지를 추가하려면:</p>
                        <ol className="list-decimal list-inside space-y-1 text-left max-w-md mx-auto">
                          <li>Google Drive에서 설정한 &quot;상품&quot; 폴더로 이동</li>
                          <li>이미지 파일을 업로드</li>
                          <li>이 페이지를 새로고침하거나 다시 선택</li>
                        </ol>
                        <p className="text-xs text-gray-400 mt-4">
                          또는 상품을 저장하면 로컬 이미지가 자동으로 이 폴더에 백업됩니다.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

