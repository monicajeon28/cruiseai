'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiFolder, FiArrowLeft, FiX, FiImage, FiCheck } from 'react-icons/fi';
import { showError } from '@/components/ui/Toast';
import { getProxyImageUrl } from '@/lib/utils';

interface ImageItem {
    id: string;
    name: string;
    url: string;
    webpUrl: string | null;
    size: number;
    modified: Date;
}

interface FolderItem {
    id: string;
    name: string;
    path?: string;
}

interface ImageLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (imageUrl: string) => void;
}

export default function ImageLibraryModal({ isOpen, onClose, onSelect }: ImageLibraryModalProps) {
    const [activeTab, setActiveTab] = useState<'library' | 'cruise'>('library');

    // Common state
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Library state
    const [images, setImages] = useState<ImageItem[]>([]);
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [rootFolderId, setRootFolderId] = useState<string | null>(null);
    const [folderHistory, setFolderHistory] = useState<Array<{ id: string; name: string }>>([]);

    // Cruise Photos state
    const [cruiseImages, setCruiseImages] = useState<ImageItem[]>([]);
    const [cruiseFolders, setCruiseFolders] = useState<FolderItem[]>([]);
    const [cruiseCurrentPath, setCruiseCurrentPath] = useState('');

    const loadImages = useCallback(async () => {
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
                if (data.rootFolderId) setRootFolderId(data.rootFolderId);
            } else {
                showError(data.message || '이미지 목록을 불러오는데 실패했습니다.');
            }
        } catch (error) {
            console.error('Failed to load images:', error);
            showError('이미지 목록을 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [currentFolderId]);

    const loadCruisePhotos = useCallback(async () => {
        try {
            setIsLoading(true);
            // 폴더 변경 시 이전 이미지 즉시 초기화 (이미지가 따라다니는 버그 방지)
            setCruiseImages([]);

            const response = await fetch(`/api/admin/cruise-photos?folder=${encodeURIComponent(cruiseCurrentPath)}`);
            const data = await response.json();

            if (data.ok) {
                setCruiseImages(data.images || []);
                setCruiseFolders(data.folders || []);
            } else {
                showError(data.message || '크루즈 사진을 불러오는데 실패했습니다.');
            }
        } catch (error) {
            console.error('Failed to load cruise photos:', error);
            showError('크루즈 사진을 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [cruiseCurrentPath]);

    useEffect(() => {
        if (isOpen) {
            if (activeTab === 'library') {
                loadImages();
            } else {
                loadCruisePhotos();
            }
        }
    }, [isOpen, activeTab, loadImages, loadCruisePhotos]);

    // Navigation handlers
    const navigateToFolder = (folder: FolderItem) => {
        if (activeTab === 'library') {
            setFolderHistory(prev => [...prev, { id: currentFolderId || rootFolderId || '', name: '이전' }]);
            setCurrentFolderId(folder.id);
        } else {
            setCruiseCurrentPath(folder.path || '');
        }
    };

    const navigateBack = () => {
        if (activeTab === 'library') {
            if (folderHistory.length > 0) {
                const newHistory = [...folderHistory];
                const parent = newHistory.pop();
                setFolderHistory(newHistory);
                setCurrentFolderId(parent?.id === rootFolderId ? null : parent?.id || null);
            } else {
                setCurrentFolderId(null);
            }
        } else {
            const parts = cruiseCurrentPath.split('/');
            parts.pop();
            setCruiseCurrentPath(parts.join('/'));
        }
    };

    const currentImages = activeTab === 'library' ? images : cruiseImages;
    const currentFolders = activeTab === 'library' ? folders : cruiseFolders;

    const filteredImages = currentImages.filter(img =>
        img.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredFolders = currentFolders.filter(folder =>
        folder.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">이미지 라이브러리</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <FiX className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        onClick={() => { setActiveTab('library'); setSearchQuery(''); }}
                        className={`flex-1 py-3 font-medium text-sm transition-colors ${activeTab === 'library'
                            ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        기본 라이브러리
                    </button>
                    <button
                        onClick={() => {
                            // 크루즈 탭 전환 시 상태 초기화
                            setCruiseImages([]);
                            setCruiseFolders([]);
                            setCruiseCurrentPath('');
                            setActiveTab('cruise');
                            setSearchQuery('');
                        }}
                        className={`flex-1 py-3 font-medium text-sm transition-colors ${activeTab === 'cruise'
                            ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        크루즈 사진
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-4 border-b flex gap-4 items-center bg-gray-50">
                    {(currentFolderId || cruiseCurrentPath) && (
                        <button
                            onClick={navigateBack}
                            className="flex items-center gap-1 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                        >
                            <FiArrowLeft /> 뒤로
                        </button>
                    )}
                    <div className="flex-1 relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="이미지 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Folders */}
                            {filteredFolders.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">폴더</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                        {filteredFolders.map((folder) => (
                                            <button
                                                key={folder.id}
                                                onClick={() => navigateToFolder(folder)}
                                                className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-sm transition-all text-left group"
                                            >
                                                <div className="p-2 bg-yellow-50 rounded-lg group-hover:bg-yellow-100 transition-colors">
                                                    <FiFolder className="w-5 h-5 text-yellow-500" />
                                                </div>
                                                <span className="text-sm font-medium text-gray-700 truncate">{folder.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Images */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">
                                    이미지 ({filteredImages.length})
                                </h3>
                                {filteredImages.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {filteredImages.map((image) => (
                                            <button
                                                key={image.id}
                                                onClick={() => onSelect(image.webpUrl || image.url)}
                                                className="group relative aspect-square bg-gray-100 rounded-xl overflow-hidden border border-gray-200 hover:border-purple-500 transition-all"
                                            >
                                                <img
                                                    src={getProxyImageUrl(image.webpUrl || image.url)}
                                                    alt={image.name}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                    <div className="opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all bg-white text-purple-600 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                                                        선택하기
                                                    </div>
                                                </div>
                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                                                    <p className="text-white text-xs truncate">{image.name}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-gray-400">
                                        <FiImage className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        <p>이미지가 없습니다.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
