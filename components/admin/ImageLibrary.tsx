'use client';

import { useRouter } from 'next/navigation';

import { useState, useEffect, useRef } from 'react';
import { FiUpload, FiCopy, FiCheck, FiFolder, FiFolderPlus, FiTrash2, FiSearch, FiImage, FiCode, FiX, FiArrowLeft, FiDownload, FiEdit2 } from 'react-icons/fi';
import { showSuccess, showError, showWarning } from '@/components/ui/Toast';
import Image from 'next/image';

interface ImageItem {
    id: string;
    name: string;
    url: string;
    webpUrl: string | null;
    size: number;
    modified: Date;
    code: {
        url: string;
        imageTag: string;
        htmlTag: string;
    };
}

interface FolderItem {
    id: string;
    name: string;
}

interface CruisePhotoItem {
    id: string;
    name: string;
    url: string;
    webpUrl: string;
    size: number;
    modified: Date;
    code: {
        url: string;
        imageTag: string;
        htmlTag: string;
    };
}

interface CruiseFolder {
    name: string;
    path: string;
}

interface ImageLibraryProps {
    initialFolderId?: string;
    canDelete?: boolean;
    canManageFolders?: boolean;
    backUrl?: string;
}

export default function ImageLibrary({
    initialFolderId,
    canDelete = true,
    canManageFolders = true,
    backUrl
}: ImageLibraryProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'library' | 'cruise'>('library');

    // 이미지 라이브러리 상태
    const [images, setImages] = useState<ImageItem[]>([]);
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const [rootFolderId, setRootFolderId] = useState<string | null>(null);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [folderHistory, setFolderHistory] = useState<Array<{ id: string; name: string }>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [newFolderName, setNewFolderName] = useState('');
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [imageToMove, setImageToMove] = useState<ImageItem | null>(null);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [isMovingFile, setIsMovingFile] = useState(false);
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedImages, setSelectedImages] = useState<ImageItem[]>([]);
    const [allFolders, setAllFolders] = useState<Array<{ id: string; name: string; path: string }>>([]);
    const [editingFolder, setEditingFolder] = useState<FolderItem | null>(null);
    const [editFolderName, setEditFolderName] = useState('');
    const [isRenamingFolder, setIsRenamingFolder] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 크루즈정보사진 상태
    const [cruiseImages, setCruiseImages] = useState<CruisePhotoItem[]>([]);
    const [cruiseFolders, setCruiseFolders] = useState<CruiseFolder[]>([]);
    const [cruiseCurrentPath, setCruiseCurrentPath] = useState('');
    const [cruiseIsLoading, setCruiseIsLoading] = useState(false);
    const [cruiseSearchQuery, setCruiseSearchQuery] = useState('');
    const [selectedCruiseImage, setSelectedCruiseImage] = useState<CruisePhotoItem | null>(null);
    const [cruiseFolderSearch, setCruiseFolderSearch] = useState('');

    // Hydration 에러 방지를 위한 마운트 상태
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (activeTab === 'library') {
            loadImages();
        } else if (activeTab === 'cruise') {
            loadCruisePhotos();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentFolderId, activeTab, cruiseCurrentPath]);

    const loadImages = async () => {
        try {
            setIsLoading(true);
            const url = currentFolderId
                ? `/api/admin/images?folderId=${encodeURIComponent(currentFolderId)}`
                : '/api/admin/images';
            const response = await fetch(url);
            const data = await response.json();

            if (data.ok) {
                setImages(data.images || []);
                setFolders(data.folders || []);
                if (data.rootFolderId) {
                    setRootFolderId(data.rootFolderId);
                }
                if (!currentFolderId && data.currentFolderId) {
                    setCurrentFolderId(data.currentFolderId);
                }
            } else {
                showError(data.message || '이미지 목록을 불러오는데 실패했습니다.');
            }
        } catch (error) {
            console.error('이미지 목록 로드 에러:', error);
            showError('이미지 목록을 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    // 폴더로 이동
    const navigateToFolder = (folder: FolderItem) => {
        setFolderHistory(prev => [...prev, { id: currentFolderId || rootFolderId || '', name: '루트' }]);
        setCurrentFolderId(folder.id);
    };

    // 상위 폴더로 이동
    const navigateBack = () => {
        if (folderHistory.length > 0) {
            const newHistory = [...folderHistory];
            const parent = newHistory.pop();
            setFolderHistory(newHistory);
            setCurrentFolderId(parent?.id === rootFolderId ? null : parent?.id || null);
        } else {
            setCurrentFolderId(null);
        }
    };

    // 루트 폴더로 이동
    const navigateToRoot = () => {
        setFolderHistory([]);
        setCurrentFolderId(null);
    };

    // 폴더 생성
    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) {
            showError('폴더 이름을 입력해주세요.');
            return;
        }

        setIsCreatingFolder(true);
        try {
            const response = await fetch('/api/admin/images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'createFolder',
                    folderName: newFolderName.trim(),
                    parentFolderId: currentFolderId,
                }),
            });

            const data = await response.json();
            if (data.ok) {
                showSuccess('폴더가 생성되었습니다.');
                setNewFolderName('');
                setShowNewFolderInput(false);
                loadImages(); // 목록 새로고침
            } else {
                showError(data.message || '폴더 생성에 실패했습니다.');
            }
        } catch (error) {
            console.error('폴더 생성 에러:', error);
            showError('폴더 생성에 실패했습니다.');
        } finally {
            setIsCreatingFolder(false);
        }
    };

    // 폴더 이름 수정
    const handleRenameFolder = async () => {
        if (!editingFolder || !editFolderName.trim()) {
            showError('폴더 이름을 입력해주세요.');
            return;
        }

        if (editFolderName.trim() === editingFolder.name) {
            setEditingFolder(null);
            setEditFolderName('');
            return;
        }

        setIsRenamingFolder(true);
        try {
            const response = await fetch('/api/admin/images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'renameFolder',
                    folderId: editingFolder.id,
                    newName: editFolderName.trim(),
                }),
            });

            const data = await response.json();
            if (data.ok) {
                showSuccess('폴더 이름이 수정되었습니다.');
                setEditingFolder(null);
                setEditFolderName('');
                loadImages(); // 목록 새로고침
            } else {
                showError(data.message || '폴더 이름 수정에 실패했습니다.');
            }
        } catch (error) {
            console.error('폴더 이름 수정 에러:', error);
            showError('폴더 이름 수정에 실패했습니다.');
        } finally {
            setIsRenamingFolder(false);
        }
    };

    // 폴더 이름 수정 시작
    const startEditFolder = (folder: FolderItem, e: React.MouseEvent) => {
        e.stopPropagation(); // 폴더 클릭 이벤트 방지
        setEditingFolder(folder);
        setEditFolderName(folder.name);
    };

    // 폴더 이름 수정 취소
    const cancelEditFolder = () => {
        setEditingFolder(null);
        setEditFolderName('');
    };

    // 파일 이동 (단일)
    const handleMoveFile = async (targetFolderId: string) => {
        if (!imageToMove) return;

        setIsMovingFile(true);
        try {
            const response = await fetch('/api/admin/images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'moveFile',
                    fileId: imageToMove.id,
                    targetFolderId,
                    currentFolderId,
                }),
            });

            const data = await response.json();
            if (data.ok) {
                showSuccess('파일이 이동되었습니다.');
                setShowMoveModal(false);
                setImageToMove(null);
                loadImages(); // 목록 새로고침
            } else {
                showError(data.message || '파일 이동에 실패했습니다.');
            }
        } catch (error) {
            console.error('파일 이동 에러:', error);
            showError('파일 이동에 실패했습니다.');
        } finally {
            setIsMovingFile(false);
        }
    };

    // 파일 이동 (다중)
    const handleMoveMultipleFiles = async (targetFolderId: string) => {
        if (selectedImages.length === 0) return;

        setIsMovingFile(true);
        let successCount = 0;
        let failCount = 0;

        for (const image of selectedImages) {
            try {
                const response = await fetch('/api/admin/images', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'moveFile',
                        fileId: image.id,
                        targetFolderId,
                        currentFolderId,
                    }),
                });

                const data = await response.json();
                if (data.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                failCount++;
            }
        }

        if (successCount > 0) {
            showSuccess(`${successCount}개 파일이 이동되었습니다.${failCount > 0 ? ` (${failCount}개 실패)` : ''}`);
        } else {
            showError('파일 이동에 실패했습니다.');
        }

        setShowMoveModal(false);
        setSelectedImages([]);
        setIsSelectMode(false);
        setIsMovingFile(false);
        loadImages();
    };

    // 이미지 선택 토글
    const toggleImageSelection = (image: ImageItem) => {
        setSelectedImages(prev => {
            const isSelected = prev.some(img => img.id === image.id);
            if (isSelected) {
                return prev.filter(img => img.id !== image.id);
            } else {
                return [...prev, image];
            }
        });
    };

    // 전체 선택/해제
    const toggleSelectAll = () => {
        if (selectedImages.length === filteredImages.length) {
            setSelectedImages([]);
        } else {
            setSelectedImages([...filteredImages]);
        }
    };

    // 선택 모드 종료
    const exitSelectMode = () => {
        setIsSelectMode(false);
        setSelectedImages([]);
    };

    // 이미지 삭제 (단일) - 낙관적 업데이트 적용
    const handleDeleteImage = async (image: ImageItem) => {
        if (!confirm(`"${image.name}" 이미지를 삭제하시겠습니까?`)) return;

        // 낙관적 업데이트: 즉시 UI에서 제거
        const previousImages = [...images];
        setImages(prev => prev.filter(img => img.id !== image.id));
        setSelectedImage(null);

        try {
            const urlParams = new URLSearchParams();
            urlParams.append('url', image.url);
            if (currentFolderId) {
                urlParams.append('folderId', currentFolderId);
            }
            const response = await fetch(
                `/api/admin/images?${urlParams.toString()}`,
                {
                    method: 'DELETE',
                    credentials: 'include',
                }
            );

            const data = await response.json();
            if (data.ok) {
                showSuccess('이미지가 삭제되었습니다.');
            } else {
                // 실패 시 롤백
                setImages(previousImages);
                showError(data.message || '이미지 삭제에 실패했습니다.');
            }
        } catch (error) {
            // 에러 시 롤백
            setImages(previousImages);
            console.error('이미지 삭제 에러:', error);
            showError('이미지 삭제에 실패했습니다.');
        }
    };

    // 선택된 이미지 삭제 - 낙관적 업데이트 적용
    const handleDeleteSelected = async () => {
        if (selectedImages.length === 0) return;

        const confirmMsg = selectedImages.length === 1
            ? `"${selectedImages[0].name}" 이미지를 삭제하시겠습니까?`
            : `선택된 ${selectedImages.length}개의 이미지를 삭제하시겠습니까?`;

        if (!confirm(confirmMsg)) return;

        // 낙관적 업데이트: 즉시 UI에서 제거
        const previousImages = [...images];
        const selectedIds = new Set(selectedImages.map(img => img.id));
        setImages(prev => prev.filter(img => !selectedIds.has(img.id)));
        const imagesToDelete = [...selectedImages];
        setSelectedImages([]);
        setIsSelectMode(false);

        let successCount = 0;
        let failCount = 0;

        for (const image of imagesToDelete) {
            try {
                const urlParams = new URLSearchParams();
                urlParams.append('url', image.url);
                if (currentFolderId) {
                    urlParams.append('folderId', currentFolderId);
                }
                const response = await fetch(
                    `/api/admin/images?${urlParams.toString()}`,
                    {
                        method: 'DELETE',
                        credentials: 'include',
                    }
                );

                const data = await response.json();
                if (data.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                failCount++;
            }
        }

        if (successCount > 0) {
            showSuccess(`${successCount}개 이미지가 삭제되었습니다.${failCount > 0 ? ` (${failCount}개 실패)` : ''}`);
        } else {
            // 전체 실패 시 롤백
            setImages(previousImages);
            showError('이미지 삭제에 실패했습니다.');
        }

        // 일부 실패 시 서버 상태와 동기화
        if (failCount > 0 && successCount > 0) {
            loadImages();
        }
    };

    // 이동 모달 열기
    const openMoveModal = () => {
        if (selectedImages.length > 0 || imageToMove) {
            // 현재 폴더의 하위 폴더와 루트 폴더 구조 생성
            const folderList: Array<{ id: string; name: string; path: string }> = [];

            // 루트 폴더 추가
            if (rootFolderId && currentFolderId !== rootFolderId) {
                folderList.push({
                    id: rootFolderId,
                    name: '루트 폴더',
                    path: '/',
                });
            }

            // 현재 폴더의 하위 폴더들 추가
            folders.forEach(folder => {
                folderList.push({
                    id: folder.id,
                    name: folder.name,
                    path: `/${folder.name}`,
                });
            });

            setAllFolders(folderList);
            setShowMoveModal(true);
        }
    };

    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        setIsUploading(true);
        const uploadPromises = Array.from(files).map(async (file) => {
            const formData = new FormData();
            formData.append('file', file);
            if (currentFolderId) {
                formData.append('folderId', currentFolderId);
            }

            try {
                const response = await fetch('/api/admin/images/upload', {
                    method: 'POST',
                    body: formData,
                });

                const data = await response.json();
                if (data.ok) {
                    showSuccess(`이미지 업로드 완료: ${file.name}`);
                    return data;
                } else {
                    showError(`업로드 실패: ${file.name} - ${data.message}`);
                    return null;
                }
            } catch (error) {
                console.error('업로드 에러:', error);
                showError(`업로드 실패: ${file.name}`);
                return null;
            }
        });

        const results = await Promise.allSettled(uploadPromises);
        const successCount = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
        const failCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === null)).length;

        setIsUploading(false);
        loadImages(); // 목록 새로고침

        if (successCount > 0 && failCount === 0) {
            showSuccess(`${successCount}개 파일 업로드 완료!`);
        } else if (successCount > 0 && failCount > 0) {
            showWarning(`업로드 완료: ${successCount}개 성공, ${failCount}개 실패`);
        }
    };

    const copyToClipboard = async (text: string, type: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedCode(type);
            showSuccess('코드가 클립보드에 복사되었습니다!');
            setTimeout(() => setCopiedCode(null), 2000);
        } catch (error) {
            console.error('복사 에러:', error);
            showError('복사에 실패했습니다.');
        }
    };

    // 중복 제거 (URL 기준)
    const uniqueImages = Array.from(
        new Map(images.map((img) => [img.url, img])).values()
    );

    const filteredImages = uniqueImages.filter(img =>
        img.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const loadCruisePhotos = async () => {
        try {
            setCruiseIsLoading(true);
            // 폴더 변경 시 이전 이미지 즉시 초기화 (이미지가 따라다니는 버그 방지)
            setCruiseImages([]);

            const response = await fetch(`/api/admin/cruise-photos?folder=${encodeURIComponent(cruiseCurrentPath)}`, {
                credentials: 'include'
            });
            const data = await response.json();

            if (data.ok) {
                setCruiseImages(data.images || []);
                setCruiseFolders(data.folders || []);
            } else {
                console.error('[Cruise Photos] API Error:', JSON.stringify(data, null, 2));
                console.error('[Cruise Photos] Error details:', {
                    message: data.message,
                    error: data.error,
                    status: response.status,
                });
                showError(data.message || data.error || '크루즈정보사진 목록을 불러오는데 실패했습니다.');
            }
        } catch (error: any) {
            console.error('[Cruise Photos] Fetch error:', error);
            console.error('[Cruise Photos] Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
            });
            showError(`크루즈정보사진 목록을 불러오는데 실패했습니다: ${error.message || '알 수 없는 오류'}`);
        } finally {
            setCruiseIsLoading(false);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const filteredCruiseImages = cruiseImages.filter(img =>
        img.name.toLowerCase().includes(cruiseSearchQuery.toLowerCase())
    );

    const filteredCruiseFolders = cruiseFolders.filter(folder =>
        folder.name.toLowerCase().includes(cruiseFolderSearch.toLowerCase())
    );

    // 클라이언트 마운트 전에는 로딩 상태 표시 (Hydration 에러 방지)
    if (!isMounted) {
        return (
            <div className="min-h-screen bg-gray-50 p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">이미지 라이브러리</h1>
                        <p className="text-gray-600">로딩 중...</p>
                    </div>
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">이미지 목록을 불러오는 중...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* 헤더 */}
                <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            {backUrl && (
                                <button
                                    onClick={() => router.push(backUrl)}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                    title="이전으로 돌아가기"
                                >
                                    <FiArrowLeft className="w-6 h-6 text-gray-600" />
                                </button>
                            )}
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800 mb-2">이미지 라이브러리</h1>
                                <p className="text-gray-600">
                                    {activeTab === 'library'
                                        ? '이미지를 업로드하고 관리하세요. 자동으로 WebP 변환됩니다.'
                                        : '크루즈정보사진에서 이미지를 선택하고 HTML 소스 코드를 생성하세요.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {activeTab === 'library' && (
                                <>
                                    {isSelectMode ? (
                                        <>
                                            <button
                                                onClick={toggleSelectAll}
                                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                            >
                                                {selectedImages.length === filteredImages.length ? '전체 해제' : '전체 선택'}
                                            </button>
                                            {selectedImages.length > 0 && (
                                                <>
                                                    <button
                                                        onClick={openMoveModal}
                                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                                                    >
                                                        <FiFolder className="w-5 h-5" />
                                                        {selectedImages.length}개 이동
                                                    </button>
                                                    {/* 삭제 버튼은 관리자/대리점장만 표시 */}
                                                    {canManageFolders && (
                                                        <button
                                                            onClick={handleDeleteSelected}
                                                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
                                                        >
                                                            <FiTrash2 className="w-5 h-5" />
                                                            {selectedImages.length}개 삭제
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                            <button
                                                onClick={exitSelectMode}
                                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                            >
                                                취소
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => setIsSelectMode(true)}
                                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                            >
                                                <FiFolder className="w-5 h-5" />
                                                선택 모드
                                            </button>
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isUploading}
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                                            >
                                                <FiUpload className="w-5 h-5" />
                                                {isUploading ? '업로드 중...' : '이미지 업로드'}
                                            </button>
                                        </>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={(e) => handleUpload(e.target.files)}
                                        className="hidden"
                                    />
                                </>
                            )}
                        </div>
                    </div>

                    {/* 탭 */}
                    <div className="flex gap-2 border-b border-gray-200 mb-4">
                        <button
                            onClick={() => setActiveTab('library')}
                            className={`px-4 py-2 font-medium transition-colors ${activeTab === 'library'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-800'
                                }`}
                        >
                            이미지 라이브러리
                        </button>
                        <button
                            onClick={() => {
                                // 크루즈 탭 전환 시 상태 초기화
                                setCruiseImages([]);
                                setCruiseFolders([]);
                                setCruiseCurrentPath('');
                                setActiveTab('cruise');
                            }}
                            className={`px-4 py-2 font-medium transition-colors ${activeTab === 'cruise'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-800'
                                }`}
                        >
                            크루즈정보사진
                        </button>
                    </div>

                    {/* 검색 및 폴더 */}
                    {activeTab === 'library' ? (
                        <div className="space-y-4">
                            {/* 폴더 네비게이션 */}
                            <div className="flex items-center gap-2 text-sm">
                                <button
                                    onClick={navigateToRoot}
                                    className={`px-3 py-1 rounded ${!currentFolderId || currentFolderId === rootFolderId ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                                >
                                    루트
                                </button>
                                {folderHistory.length > 0 && (
                                    <>
                                        <span className="text-gray-400">/</span>
                                        <button
                                            onClick={navigateBack}
                                            className="flex items-center gap-1 px-3 py-1 rounded hover:bg-gray-100"
                                        >
                                            <FiArrowLeft className="w-4 h-4" />
                                            뒤로
                                        </button>
                                    </>
                                )}
                            </div>

                            {/* 검색 및 새 폴더 버튼 */}
                            <div className="flex items-center gap-4">
                                <div className="flex-1 relative">
                                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        placeholder="이미지 검색..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <button
                                    onClick={() => setShowNewFolderInput(!showNewFolderInput)}
                                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                    title="새 폴더"
                                >
                                    <FiFolderPlus className="w-5 h-5" />
                                    새 폴더
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
                            <div className="flex-1 relative">
                                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="이미지 검색..."
                                    value={cruiseSearchQuery}
                                    onChange={(e) => setCruiseSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            {cruiseCurrentPath && (
                                <button
                                    onClick={() => {
                                        const pathParts = cruiseCurrentPath.split('/');
                                        pathParts.pop();
                                        setCruiseCurrentPath(pathParts.join('/'));
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                    <FiArrowLeft className="w-5 h-5" />
                                    상위 폴더
                                </button>
                            )}
                        </div>
                    )}

                    {/* 새 폴더 입력 */}
                    {showNewFolderInput && (
                        <div className="mt-4 flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="새 폴더 이름"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && newFolderName.trim()) {
                                        handleCreateFolder();
                                    }
                                }}
                            />
                            <button
                                onClick={handleCreateFolder}
                                disabled={isCreatingFolder || !newFolderName.trim()}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
                            >
                                {isCreatingFolder ? '생성 중...' : '폴더 생성'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowNewFolderInput(false);
                                    setNewFolderName('');
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                취소
                            </button>
                        </div>
                    )}
                </div>

                {/* 이미지 그리드 */}
                {activeTab === 'library' ? (
                    <>
                        {isLoading ? (
                            <div className="text-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                <p className="text-gray-600">이미지 목록을 불러오는 중...</p>
                            </div>
                        ) : (
                            <>
                                {/* 폴더 목록 */}
                                {folders.length > 0 && (
                                    <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
                                        <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                                            <FiFolder className="w-4 h-4" />
                                            폴더 ({folders.length}개)
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                            {folders.map((folder) => (
                                                <div key={folder.id} className="relative group">
                                                    {editingFolder?.id === folder.id ? (
                                                        // 폴더 이름 수정 모드
                                                        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-300">
                                                            <FiFolder className="w-8 h-8 text-yellow-500 flex-shrink-0" />
                                                            <input
                                                                type="text"
                                                                value={editFolderName}
                                                                onChange={(e) => setEditFolderName(e.target.value)}
                                                                onKeyPress={(e) => {
                                                                    if (e.key === 'Enter') handleRenameFolder();
                                                                }}
                                                                className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                autoFocus
                                                            />
                                                            <button
                                                                onClick={handleRenameFolder}
                                                                disabled={isRenamingFolder}
                                                                className="p-1 text-green-600 hover:bg-green-100 rounded"
                                                                title="저장"
                                                            >
                                                                <FiCheck className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={cancelEditFolder}
                                                                className="p-1 text-red-600 hover:bg-red-100 rounded"
                                                                title="취소"
                                                            >
                                                                <FiX className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        // 일반 폴더 표시 모드
                                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border hover:bg-blue-50 hover:border-blue-300 transition-all text-left w-full">
                                                            <button
                                                                onClick={() => navigateToFolder(folder)}
                                                                className="flex items-center gap-3 flex-1"
                                                            >
                                                                <FiFolder className="w-8 h-8 text-yellow-500 flex-shrink-0" />
                                                                <span className="text-sm font-medium text-gray-700 break-words flex-1">
                                                                    {folder.name}
                                                                </span>
                                                            </button>
                                                            {/* 수정 버튼 - 관리자/대리점장만 호버 시 표시 */}
                                                            {canManageFolders && (
                                                                <button
                                                                    onClick={(e) => startEditFolder(folder, e)}
                                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    title="폴더 이름 수정"
                                                                >
                                                                    <FiEdit2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 이미지 목록 */}
                                {filteredImages.length === 0 && folders.length === 0 ? (
                                    <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
                                        <FiImage className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                        <p className="text-gray-600 text-lg">이미지가 없습니다.</p>
                                        <p className="text-gray-400 text-sm mt-2">위의 &quot;이미지 업로드&quot; 버튼을 클릭하여 이미지를 업로드하세요.</p>
                                    </div>
                                ) : filteredImages.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        검색 결과가 없습니다.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                        {filteredImages.map((image) => {
                                            const isSelected = selectedImages.some(img => img.id === image.id);
                                            return (
                                                <div
                                                    key={image.url}
                                                    className={`bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow cursor-pointer relative group ${isSelectMode && isSelected ? 'ring-2 ring-blue-500' : ''}`}
                                                    onClick={() => {
                                                        if (isSelectMode) {
                                                            toggleImageSelection(image);
                                                        } else {
                                                            setSelectedImage(image);
                                                        }
                                                    }}
                                                >
                                                    <div className="aspect-square relative bg-gray-100">
                                                        <Image
                                                            src={image.webpUrl || image.url}
                                                            alt={image.name}
                                                            fill
                                                            className="object-cover"
                                                            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                                            draggable={false}
                                                        />
                                                        {image.webpUrl && !isSelectMode && (
                                                            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded z-10">
                                                                WebP
                                                            </div>
                                                        )}
                                                        {/* 선택 모드일 때 체크박스 표시 */}
                                                        {isSelectMode && (
                                                            <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-400'}`}>
                                                                {isSelected && (
                                                                    <FiCheck className="w-4 h-4 text-white" />
                                                                )}
                                                            </div>
                                                        )}
                                                        {/* 삭제 버튼 - 선택 모드가 아니고 관리자/대리점장만 표시 */}
                                                        {!isSelectMode && canManageFolders && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteImage(image);
                                                                }}
                                                                className="absolute top-2 left-2 p-2 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-colors z-10 flex items-center justify-center"
                                                                title="삭제"
                                                            >
                                                                <FiTrash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="p-3">
                                                        <p className="text-sm font-medium text-gray-800 truncate" title={image.name}>
                                                            {image.name}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-1">{formatFileSize(image.size)}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                ) : (
                    <>
                        {cruiseIsLoading ? (
                            <div className="text-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                <p className="text-gray-600">크루즈정보사진 목록을 불러오는 중...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-300px)] min-h-[500px]">
                                {/* 왼쪽 사이드바: 폴더 목록 */}
                                <div className="w-full md:w-64 flex-shrink-0 flex flex-col border-r pr-4">
                                    <div className="flex flex-col gap-2 mb-4">
                                        {canManageFolders && (
                                            <button
                                                onClick={() => setShowNewFolderInput(true)}
                                                className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 w-full"
                                            >
                                                <FiFolderPlus className="text-lg" />
                                                <span>새 폴더</span>
                                            </button>
                                        )}
                                        <div className="relative">
                                            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                            <input
                                                type="text"
                                                placeholder="폴더 검색..."
                                                value={cruiseFolderSearch}
                                                onChange={(e) => setCruiseFolderSearch(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto space-y-1">
                                        {filteredCruiseFolders.length === 0 ? (
                                            <p className="text-sm text-gray-500 text-center py-4">폴더가 없습니다.</p>
                                        ) : (
                                            filteredCruiseFolders.map((folder) => (
                                                <button
                                                    key={folder.path}
                                                    onClick={() => setCruiseCurrentPath(folder.path)}
                                                    className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-2 transition-colors ${cruiseCurrentPath === folder.path
                                                            ? 'bg-blue-50 text-blue-700 font-medium'
                                                            : 'hover:bg-gray-100 text-gray-700'
                                                        }`}
                                                >
                                                    <FiFolder className={`w-4 h-4 ${cruiseCurrentPath === folder.path ? 'text-blue-500' : 'text-gray-400'}`} />
                                                    <span className="truncate">{folder.name}</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* 오른쪽 메인: 이미지 그리드 */}
                                <div className="flex-1 flex flex-col overflow-hidden">
                                    <div className="flex-1 overflow-y-auto p-1">
                                        {filteredCruiseImages.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 rounded-lg">
                                                <FiImage className="w-12 h-12 text-gray-300 mb-3" />
                                                <p className="text-gray-500 font-medium">이미지가 없습니다.</p>
                                                <p className="text-gray-400 text-sm mt-1">좌측에서 폴더를 선택해주세요.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                                {filteredCruiseImages.map((image) => (
                                                    <div
                                                        key={image.url}
                                                        className="bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                                                        onClick={() => setSelectedCruiseImage(image)}
                                                    >
                                                        <div className="aspect-square relative bg-gray-100">
                                                            <Image
                                                                src={image.url}
                                                                alt={image.name}
                                                                fill
                                                                className="object-cover transition-transform group-hover:scale-105"
                                                                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                                            />
                                                        </div>
                                                        <div className="p-3">
                                                            <p className="text-sm font-medium text-gray-800 truncate" title={image.name}>
                                                                {image.name}
                                                            </p>
                                                            <p className="text-xs text-gray-500 mt-1">{formatFileSize(image.size)}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}


                        {/* 크루즈정보사진 상세 모달 */}
                        {
                            isMounted && selectedCruiseImage && activeTab === 'cruise' && (
                                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                                        <div className="p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h2 className="text-2xl font-bold text-gray-800">{selectedCruiseImage.name}</h2>
                                                <button
                                                    onClick={() => setSelectedCruiseImage(null)}
                                                    className="text-gray-500 hover:text-gray-700"
                                                >
                                                    <FiX className="w-6 h-6" />
                                                </button>
                                            </div>

                                            <div className="mb-6">
                                                <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4">
                                                    <Image
                                                        src={selectedCruiseImage.webpUrl || selectedCruiseImage.url}
                                                        alt={selectedCruiseImage.name}
                                                        fill
                                                        className="object-contain"
                                                    />
                                                    {selectedCruiseImage.webpUrl && (
                                                        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded z-10">
                                                            WebP
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <p className="text-gray-600">파일 크기</p>
                                                        <p className="font-medium">{formatFileSize(selectedCruiseImage.size)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-600">경로</p>
                                                        <p className="font-medium text-xs break-all">{selectedCruiseImage.url}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 코드 복사 섹션 */}
                                            <div className="space-y-4">
                                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                                    <FiCode className="w-5 h-5" />
                                                    소스코드 복사
                                                </h3>

                                                {/* Next.js Image 태그 */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="text-sm font-medium text-gray-700">Next.js Image 태그</label>
                                                        <button
                                                            onClick={() => copyToClipboard(selectedCruiseImage.code.imageTag, 'cruiseImageTag')}
                                                            className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                                                        >
                                                            {copiedCode === 'cruiseImageTag' ? (
                                                                <>
                                                                    <FiCheck className="w-4 h-4" />
                                                                    복사됨
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <FiCopy className="w-4 h-4" />
                                                                    복사
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                    <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                                                        {selectedCruiseImage.code.imageTag}
                                                    </pre>
                                                </div>

                                                {/* HTML img 태그 */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="text-sm font-medium text-gray-700">HTML img 태그</label>
                                                        <button
                                                            onClick={() => copyToClipboard(selectedCruiseImage.code.htmlTag, 'cruiseHtmlTag')}
                                                            className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                                                        >
                                                            {copiedCode === 'cruiseHtmlTag' ? (
                                                                <>
                                                                    <FiCheck className="w-4 h-4" />
                                                                    복사됨
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <FiCopy className="w-4 h-4" />
                                                                    복사
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                    <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                                                        {selectedCruiseImage.code.htmlTag}
                                                    </pre>
                                                </div>

                                                {/* URL만 */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="text-sm font-medium text-gray-700">이미지 URL</label>
                                                        <button
                                                            onClick={() => copyToClipboard(selectedCruiseImage.code.url, 'cruiseUrl')}
                                                            className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                                                        >
                                                            {copiedCode === 'cruiseUrl' ? (
                                                                <>
                                                                    <FiCheck className="w-4 h-4" />
                                                                    복사됨
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <FiCopy className="w-4 h-4" />
                                                                    복사
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                    <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                                                        {selectedCruiseImage.code.url}
                                                    </pre>
                                                </div>

                                                {/* PNG 다운로드 버튼 */}
                                                <div className="mt-4 pt-4 border-t border-gray-200">
                                                    <button
                                                        onClick={() => {
                                                            if (!selectedCruiseImage) return;
                                                            const downloadUrl = `/api/admin/cruise-photos/image?id=${selectedCruiseImage.id}&download=true&watermark=true`;
                                                            const link = document.createElement('a');
                                                            link.href = downloadUrl;
                                                            link.download = selectedCruiseImage.name.replace(/\.[^/.]+$/, '') + '.png';
                                                            document.body.appendChild(link);
                                                            link.click();
                                                            document.body.removeChild(link);
                                                            showSuccess('PNG 다운로드가 시작되었습니다.');
                                                        }}
                                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                                                    >
                                                        <FiDownload className="w-5 h-5" />
                                                        PNG 다운로드 (워터마크 포함)
                                                    </button>
                                                    <p className="text-xs text-gray-500 mt-2 text-center">
                                                        크루즈닷 로고가 워터마크로 추가됩니다.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        }</>)}

                {/* 이미지 라이브러리 상세 모달 */}
                {
                    isMounted && selectedImage && activeTab === 'library' && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-2xl font-bold text-gray-800">{selectedImage.name}</h2>
                                        <div className="flex items-center gap-2">
                                            {canManageFolders && (
                                                <button
                                                    onClick={() => {
                                                        setImageToMove(selectedImage);
                                                        setShowMoveModal(true);
                                                    }}
                                                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                                    title="이동"
                                                >
                                                    <FiFolder className="text-xl" />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    onClick={() => handleDeleteImage(selectedImage)}
                                                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                                    title="삭제"
                                                >
                                                    <FiTrash2 className="text-xl" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setSelectedImage(null)}
                                                className="text-gray-500 hover:text-gray-700"
                                            >
                                                <FiX className="w-6 h-6" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4">
                                            <Image
                                                src={selectedImage.webpUrl || selectedImage.url}
                                                alt={selectedImage.name}
                                                fill
                                                className="object-contain"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <p className="text-gray-600">파일 크기</p>
                                                <p className="font-medium">{formatFileSize(selectedImage.size)}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600">형식</p>
                                                <p className="font-medium">
                                                    {selectedImage.webpUrl ? 'WebP (최적화됨)' : '원본'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 코드 복사 섹션 */}
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                            <FiCode className="w-5 h-5" />
                                            소스코드 복사
                                        </h3>

                                        {/* Next.js Image 태그 */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-medium text-gray-700">Next.js Image 태그</label>
                                                <button
                                                    onClick={() => copyToClipboard(selectedImage.code.imageTag, 'imageTag')}
                                                    className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                                                >
                                                    {copiedCode === 'imageTag' ? (
                                                        <>
                                                            <FiCheck className="w-4 h-4" />
                                                            복사됨
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FiCopy className="w-4 h-4" />
                                                            복사
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                            <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                                                {selectedImage.code.imageTag}
                                            </pre>
                                        </div>

                                        {/* HTML img 태그 */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-medium text-gray-700">HTML img 태그</label>
                                                <button
                                                    onClick={() => copyToClipboard(selectedImage.code.htmlTag, 'htmlTag')}
                                                    className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                                                >
                                                    {copiedCode === 'htmlTag' ? (
                                                        <>
                                                            <FiCheck className="w-4 h-4" />
                                                            복사됨
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FiCopy className="w-4 h-4" />
                                                            복사
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                            <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                                                {selectedImage.code.htmlTag}
                                            </pre>
                                        </div>

                                        {/* URL만 */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-medium text-gray-700">이미지 URL</label>
                                                <button
                                                    onClick={() => copyToClipboard(selectedImage.code.url, 'url')}
                                                    className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                                                >
                                                    {copiedCode === 'url' ? (
                                                        <>
                                                            <FiCheck className="w-4 h-4" />
                                                            복사됨
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FiCopy className="w-4 h-4" />
                                                            복사
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                            <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                                                {selectedImage.code.url}
                                            </pre>
                                        </div>

                                        {/* PNG 다운로드 버튼 */}
                                        <div className="mt-4 pt-4 border-t border-gray-200">
                                            <button
                                                onClick={() => {
                                                    if (!selectedImage) return;
                                                    // URL에서 파일 ID 추출
                                                    const urlMatch = selectedImage.url.match(/id=([a-zA-Z0-9_-]+)/);
                                                    if (!urlMatch) {
                                                        showError('파일 ID를 찾을 수 없습니다.');
                                                        return;
                                                    }
                                                    const fileId = urlMatch[1];
                                                    const downloadUrl = `/api/admin/images/proxy?id=${fileId}&download=true&watermark=true`;
                                                    const link = document.createElement('a');
                                                    link.href = downloadUrl;
                                                    link.download = selectedImage.name.replace(/\.[^/.]+$/, '') + '.png';
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                    showSuccess('PNG 다운로드가 시작되었습니다.');
                                                }}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                                            >
                                                <FiDownload className="w-5 h-5" />
                                                PNG 다운로드 (워터마크 포함)
                                            </button>
                                            <p className="text-xs text-gray-500 mt-2 text-center">
                                                크루즈닷 로고가 워터마크로 추가됩니다.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>)}


                {/* 폴더 이동 모달 */}
                {
                    isMounted && showMoveModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden">
                                <div className="p-6 border-b">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-xl font-bold text-gray-800">
                                            {selectedImages.length > 0 ? `${selectedImages.length}개 파일 이동` : '파일 이동'}
                                        </h2>
                                        <button
                                            onClick={() => {
                                                setShowMoveModal(false);
                                                setImageToMove(null);
                                            }}
                                            className="text-gray-500 hover:text-gray-700"
                                        >
                                            <FiX className="w-6 h-6" />
                                        </button>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-2">이동할 폴더를 선택하세요</p>
                                </div>

                                <div className="p-4 max-h-[50vh] overflow-y-auto">
                                    {/* 현재 위치 표시 */}
                                    <div className="mb-4 p-3 bg-gray-100 rounded-lg">
                                        <p className="text-xs text-gray-500">현재 위치</p>
                                        <p className="text-sm font-medium text-gray-700">
                                            {currentFolderId === rootFolderId || !currentFolderId ? '루트 폴더' : '현재 폴더'}
                                        </p>
                                    </div>

                                    {/* 폴더 목록 */}
                                    <div className="space-y-2">
                                        {/* 루트 폴더로 이동 옵션 */}
                                        {currentFolderId && currentFolderId !== rootFolderId && rootFolderId && (
                                            <button
                                                onClick={() => {
                                                    if (selectedImages.length > 0) {
                                                        handleMoveMultipleFiles(rootFolderId);
                                                    } else if (imageToMove) {
                                                        handleMoveFile(rootFolderId);
                                                    }
                                                }}
                                                disabled={isMovingFile}
                                                className="w-full text-left p-3 rounded-lg border hover:bg-blue-50 hover:border-blue-300 transition-colors flex items-center gap-3 disabled:opacity-50"
                                            >
                                                <FiArrowLeft className="w-5 h-5 text-gray-400" />
                                                <div>
                                                    <p className="font-medium text-gray-700">루트 폴더로 이동</p>
                                                    <p className="text-xs text-gray-500">상위 폴더로 이동합니다</p>
                                                </div>
                                            </button>
                                        )}

                                        {/* 하위 폴더 목록 */}
                                        {folders.length > 0 ? (
                                            folders.map((folder) => (
                                                <button
                                                    key={folder.id}
                                                    onClick={() => {
                                                        if (selectedImages.length > 0) {
                                                            handleMoveMultipleFiles(folder.id);
                                                        } else if (imageToMove) {
                                                            handleMoveFile(folder.id);
                                                        }
                                                    }}
                                                    disabled={isMovingFile}
                                                    className="w-full text-left p-3 rounded-lg border hover:bg-blue-50 hover:border-blue-300 transition-colors flex items-center gap-3 disabled:opacity-50"
                                                >
                                                    <FiFolder className="w-5 h-5 text-yellow-500" />
                                                    <div>
                                                        <p className="font-medium text-gray-700">{folder.name}</p>
                                                        <p className="text-xs text-gray-500">하위 폴더</p>
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="text-center py-8 text-gray-500">
                                                <FiFolder className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                                <p>이동할 수 있는 폴더가 없습니다.</p>
                                                <p className="text-sm mt-1">새 폴더를 생성해주세요.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 border-t bg-gray-50">
                                    {isMovingFile ? (
                                        <div className="flex items-center justify-center gap-2 text-gray-600">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                            <span>이동 중...</span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setShowMoveModal(false);
                                                setImageToMove(null);
                                            }}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                                        >
                                            취소
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }
            </div>
        </div >
    );
}
