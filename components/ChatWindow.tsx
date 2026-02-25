'use client';
import { ChatMessage } from '@/lib/chat-types';
import { useRef, useEffect, useState } from 'react';
import type { ChatInputMode } from '@/lib/types'; // ChatInputMode import
import GoAnywhere from '@/app/chat/components/blocks/GoAnywhere';
import ShowMe from '@/app/chat/components/blocks/ShowMe';
import SuggestChips from '@/app/chat/components/suggestchips'; // SuggestChips import
import { ChatInputPayload } from '@/components/chat/types';
import Image from 'next/image';
import tts, { extractPlainText } from '@/lib/tts';
import { getGrayBlurDataURL } from '@/lib/image-utils';
import ImageZoomModal from './ImageZoomModal';
import { FiVolume2, FiVolumeX } from 'react-icons/fi'; // TTS 아이콘 import

type Props = { messages: ChatMessage[]; mode: ChatInputMode; onSend: (payload: ChatInputPayload) => void; }; // mode, onSend prop 추가

export default function ChatWindow({ messages, mode, onSend }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isTTSEnabled, setIsTTSEnabled] = useState(false); // 기본값 false (비활성화)
  const [selectedCategory, setSelectedCategory] = useState<{ messageId: string; categoryName: string; photos: any[] } | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ images: Array<{ url: string; title?: string }>; index: number } | null>(null);
  const [selectedSubfolder, setSelectedSubfolder] = useState<{ messageId: string; subfolderName: string; photos: any[] } | null>(null);

  useEffect(() => {
    // TTS 비활성화 (사용자 요청)
    // setIsTTSEnabled(tts.getEnabled());
    setIsTTSEnabled(false);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // TTS 재생 함수
  const handleSpeak = (text: string) => {
    const plainText = extractPlainText(text);
    tts.speak(plainText);
  };

  // TTS 중지 함수
  const handleStop = () => {
    tts.stop();
  };

  // 카테고리 버튼 클릭 핸들러
  const handleCategoryClick = async (messageId: string, categoryName: string) => {
    try {
      // API로 해당 카테고리의 사진들을 가져오기
      const response = await fetch(`/api/photos?q=${encodeURIComponent(categoryName)}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedCategory({
          messageId,
          categoryName,
          photos: data.items || [],
        });
      }
    } catch (error) {
      console.error('Failed to load category photos:', error);
    }
  };

  // 선택된 카테고리 닫기
  const handleCloseCategoryPhotos = () => {
    setSelectedCategory(null);
  };

  // 하위 폴더 버튼 클릭 핸들러
  const handleSubfolderClick = async (messageId: string, subfolderName: string, displayName: string) => {
    try {
      // 하위 폴더 전체 경로로 사진 검색
      // subfolderName은 전체 경로 (예: "크루즈정보사진/코스타세레나/코스타 객실")
      // 검색 쿼리로 사용
      const searchQuery = subfolderName.split('/').pop() || displayName; // 마지막 폴더명 사용
      const response = await fetch(`/api/photos?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        // 하위 폴더 경로에 속한 사진만 필터링
        const subfolderPathNorm = subfolderName.toLowerCase();
        const filteredPhotos = (data.items || []).filter((photo: any) => {
          if (photo.folder) {
            const photoFolderNorm = photo.folder.toLowerCase();
            // 하위 폴더 경로가 정확히 일치하거나 포함되는 경우
            return photoFolderNorm === subfolderPathNorm || photoFolderNorm.includes(subfolderPathNorm);
          }
          return false;
        });

        setSelectedSubfolder({
          messageId,
          subfolderName: displayName, // 표시명 저장
          photos: filteredPhotos.length > 0 ? filteredPhotos : data.items || [], // 필터링 결과 또는 전체 결과
        });
        // 카테고리가 열려있으면 닫기
        setSelectedCategory(null);
      }
    } catch (error) {
      console.error('Failed to load subfolder photos:', error);
    }
  };

  // 선택된 하위 폴더 닫기
  const handleCloseSubfolderPhotos = () => {
    setSelectedSubfolder(null);
  };

  return (
    <div className="mx-auto max-w-6xl px-3 py-2 flex-1 overflow-y-auto" ref={scrollRef} style={{ minHeight: '60vh' }}>
      {(messages.length === 0 || !messages.some(m => m.role === 'user')) && mode === 'go' && (
        <div className="mx-auto max-w-6xl w-full">
          <GoAnywhere onSend={onSend} />
        </div>
      )}

      {(messages.length === 0 || !messages.some(m => m.role === 'user')) && mode === 'show' && (
        <div className="mx-auto max-w-6xl w-full">
          <ShowMe onSend={onSend} />
        </div>
      )}

      {(messages.length === 0 || !messages.some(m => m.role === 'user')) && mode === 'general' && (
        <div className="mx-auto max-w-6xl w-full text-center py-12">
          <div className="text-7xl mb-4">💬</div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">무엇이든 물어보세요</h2>
          <p className="text-xl sm:text-2xl text-gray-600 mb-8">
            크루즈 여행에 대해<br />
            궁금한 것을 편하게 물어보세요
          </p>

          <div className="bg-gray-50 rounded-xl p-6 max-w-2xl mx-auto border-2 border-gray-200 mt-8">
            <div className="flex items-start gap-3 mb-4">
              <div className="text-3xl">💬</div>
              <div className="text-left flex-1">
                <p className="text-xl text-gray-800 font-semibold mb-3">
                  일반 채팅<br />
                  여행에 대해 무엇이든 물어보세요! 사용 예시:
                </p>
                <ul className="text-lg text-gray-700 space-y-2">
                  <li>• 코스타세레나 몇 톤이야?</li>
                  <li>• 크루즈 여행 준비물 알려줘</li>
                  <li>• 홍콩에서 꼭 먹어야 할 음식은?</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {messages.length === 0 && mode === 'info' && (
        <div className="mx-auto max-w-6xl w-full">
          <h1 className="font-bold text-3xl mb-4">크루즈닷 사용설명서</h1>
          <div className="text-gray-700 space-y-3 text-xl">
            <p>크루즈닷은 다음과 같은 질문에 답변할 수 있어요.</p>
            <ul className="list-disc list-inside pl-4 space-y-3">
              <li>크루즈 터미널 및 공항 길찾기 (예: &quot;인천공항에서 카이탁 크루즈 터미널까지&quot;)</li>
              <li>장소 정보 (예: &quot;홍콩 크루즈 터미널 위치&quot;)</li>
              <li>환율 계산 (예: &quot;100달러는 몇 원이야?&quot;)</li>
              <li>여행 준비물 체크리스트</li>
            </ul>
            <p>더 자세한 정보는 각 탭을 눌러 확인해주세요.</p>
          </div>
          <SuggestChips where="greet" onPick={(text) => onSend({ mode: 'general', text })} />
        </div>
      )}

      {/* 메시지 렌더링 */}
      {messages.map((message, index) => {
        // 고유 key 생성: id가 있으면 사용하고, 없으면 인덱스와 타입으로 구성
        const uniqueKey = message.id || `${message.type}-${message.role}-${index}`;

        // 메시지 타입에 따라 렌더링
        if (message.type === 'text') {
          return (
            <div key={uniqueKey} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
              <div className="flex flex-col">
                <div
                  className={`max-w-[80%] rounded-xl p-5 text-xl sm:text-2xl leading-relaxed ${message.role === 'user'
                      ? 'bg-gradient-to-r from-[#FDB931] to-[#E1A21E] text-[#051C2C] shadow-md font-semibold'
                      : 'bg-white text-gray-800 border border-[#051C2C]/10 shadow-sm'
                    }`}
                >
                  {message.text}
                </div>

              </div>
            </div>
          );
        }

        if (message.type === 'map-links') {
          return (
            <div key={uniqueKey} className="flex justify-start mb-4">
              <div className="max-w-[90%] bg-white rounded-xl p-5 shadow-sm border">
                {message.title && <h3 className="font-semibold text-gray-900 mb-4 text-2xl">{message.title}</h3>}
                <div className="space-y-3">
                  {message.links?.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-6 py-5 bg-[#051C2C] text-white rounded-lg hover:bg-[#0A2E46] transition-colors text-xl sm:text-2xl font-medium shadow-md hover:shadow-lg"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        if (message.type === 'photo-gallery') {
          return (
            <div key={uniqueKey} className="flex justify-start mb-4">
              <div className="max-w-[85%] bg-white rounded-xl p-5 shadow-sm border">
                {message.title && <h3 className="font-semibold text-gray-900 mb-4 text-2xl">{message.title}</h3>}
                <div className="grid grid-cols-2 gap-2">
                  {message.images?.slice(0, 4).map((image, idx) => (
                    <div key={idx} className="relative aspect-square bg-gray-100 rounded-lg">
                      <Image
                        src={image}
                        alt={`사진 ${idx + 1}`}
                        fill
                        className="object-cover rounded-lg"
                        sizes="(max-width: 768px) 50vw, 25vw"
                        quality={75}
                        loading="lazy"
                        placeholder="blur"
                        blurDataURL={getGrayBlurDataURL()}
                        onError={(e) => {
                          // 이미지 로드 실패 시 placeholder 표시
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent && !parent.querySelector('.error-placeholder')) {
                            parent.innerHTML = '<div class="error-placeholder flex items-center justify-center h-full text-gray-400"><svg class="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>';
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
                {message.images && message.images.length > 4 && (
                  <p className="text-base text-gray-500 mt-3">+{message.images.length - 4}개 더 보기</p>
                )}
              </div>
            </div>
          );
        }

        if (message.type === 'photos') {
          return (
            <div key={uniqueKey} className="flex justify-start mb-4">
              <div className="max-w-[85%] bg-white rounded-xl p-5 shadow-sm border">
                {message.title && <h3 className="font-semibold text-gray-900 mb-4 text-2xl">{message.title}</h3>}
                <div className="grid grid-cols-2 gap-2">
                  {message.photos?.slice(0, 4).map((photo, idx) => (
                    <div key={idx} className="relative aspect-square bg-gray-100 rounded-lg">
                      <Image
                        src={photo.url}
                        alt={photo.alt || `사진 ${idx + 1}`}
                        fill
                        className="object-cover rounded-lg"
                        sizes="(max-width: 768px) 50vw, 25vw"
                        quality={75}
                        loading="lazy"
                        placeholder="blur"
                        blurDataURL={getGrayBlurDataURL()}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent && !parent.querySelector('.error-placeholder')) {
                            parent.innerHTML = '<div class="error-placeholder flex items-center justify-center h-full text-gray-400"><svg class="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>';
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        if (message.type === 'show-me') {
          const isExpanded = selectedCategory?.messageId === message.id;
          const googleImagesOnly = (message as any).googleImagesOnly || false;

          return (
            <div key={uniqueKey} className="flex justify-start mb-4">
              <div className="max-w-[95%] bg-white rounded-xl p-5 shadow-lg border-2 border-blue-200">
                {/* 제목 */}
                {message.text && (
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">{message.text}</h3>
                )}

                {/* 구글 이미지만 표시하는 경우 */}
                {googleImagesOnly && (
                  <div className="text-center py-6">
                    <div className="text-6xl mb-4">🖼️</div>
                    <p className="text-xl text-gray-700 mb-6">
                      구글 이미지 검색에서<br />
                      다양한 사진을 확인해보세요!
                    </p>
                  </div>
                )}

                {/* 구글 이미지 검색 버튼 (크게! 50대+ 친화적) */}
                <a
                  href={message.googleImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`
                    flex items-center justify-center gap-3
                    px-6 py-6
                    bg-gradient-to-r from-red-600 to-red-500
                    text-white
                    rounded-xl
                    shadow-lg
                    hover:shadow-xl
                    font-bold
                    active:scale-95
                    transition-all
                    mb-4
                    ${googleImagesOnly ? 'text-2xl min-h-[150px]' : 'text-xl min-h-[120px]'}
                  `}
                >
                  <span className={googleImagesOnly ? 'text-5xl' : 'text-4xl'}>🔍</span>
                  <div className="flex flex-col items-start">
                    <span>구글에서 {googleImagesOnly ? '' : '더 많은 '}사진 보기</span>
                    <span className={`opacity-90 ${googleImagesOnly ? 'text-lg' : 'text-sm'}`}>Google 이미지 검색</span>
                  </div>
                </a>

                {/* 하위 폴더 버튼들 (50대+ 친화적 - 크루즈닷 전용 폴더 탐색!) */}
                {!googleImagesOnly && message.subfolders && message.subfolders.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 text-xl font-bold mb-3">
                      <span>📂</span>
                      <span>더 많은 사진 보기</span>
                      <span className="text-base font-normal text-gray-600">({message.subfolders.length}개 폴더)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {message.subfolders.map((folder, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSubfolderClick(message.id, folder.name, folder.displayName)}
                          className="
                            flex items-center justify-center gap-2
                            px-5 py-5
                            bg-gradient-to-r from-[#051C2C] to-[#0A2E46]
                            text-white
                            rounded-xl
                            shadow-md
                            hover:shadow-lg
                            text-lg font-bold
                            min-h-[100px]
                            active:scale-95
                            transition-all
                          "
                        >
                          <span className="text-3xl">{folder.icon || '📂'}</span>
                          <div className="flex flex-col items-start">
                            <span className="text-left leading-tight">{folder.displayName}</span>
                            <span className="text-xs opacity-90">{folder.photoCount}장</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 크루즈닷 카테고리 버튼들 (50대+ 친화적 - 큰 버튼!) */}
                {!googleImagesOnly && message.categories && message.categories.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 text-xl font-bold mb-3">
                      <span>📷</span>
                      <span>크루즈닷 사진 모음</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {message.categories.map((category, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleCategoryClick(message.id, category.name)}
                          className="
                            flex items-center justify-center gap-2
                            px-5 py-5
                            bg-gradient-to-r from-[#FDB931] to-[#E1A21E]
                            text-[#051C2C]
                            rounded-xl
                            shadow-md
                            hover:shadow-lg
                            text-lg font-bold
                            min-h-[100px]
                            active:scale-95
                            transition-all
                          "
                        >
                          <span className="text-3xl">{category.icon || '📷'}</span>
                          <span className="text-left leading-tight">{category.displayName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 선택된 카테고리의 사진들 표시 */}
                {isExpanded && selectedCategory && (
                  <div className="mt-4 border-t-2 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-xl font-bold">
                        <span>📸</span>
                        <span>{selectedCategory.categoryName} ({selectedCategory.photos.length}장)</span>
                      </div>
                      <button
                        onClick={handleCloseCategoryPhotos}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-base font-medium"
                      >
                        닫기
                      </button>
                    </div>
                    {selectedCategory.photos.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto">
                        {selectedCategory.photos.map((photo, idx) => (
                          <div
                            key={idx}
                            className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform select-none"
                            onClick={() => {
                              setSelectedImage({
                                images: selectedCategory.photos.map((p: any) => ({ url: p.url, title: p.title })),
                                index: idx,
                              });
                            }}
                            onContextMenu={(e) => e.preventDefault()}
                            onDragStart={(e) => e.preventDefault()}
                          >
                            <Image
                              src={photo.url}
                              alt={photo.title || `사진 ${idx + 1}`}
                              fill
                              className="object-cover pointer-events-none"
                              sizes="(max-width: 768px) 50vw, 33vw"
                              quality={75}
                              loading="lazy"
                              placeholder="blur"
                              blurDataURL={getGrayBlurDataURL()}
                              draggable={false}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8 text-lg">이 카테고리에는 사진이 없습니다.</p>
                    )}
                  </div>
                )}

                {/* 크루즈닷 미리보기 사진 (검색 결과가 있을 때만) */}
                {!isExpanded && message.cruisePhotos && message.cruisePhotos.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 text-xl font-bold mb-3">
                      <span>🖼️</span>
                      <span>검색 결과 미리보기</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {message.cruisePhotos.slice(0, 6).map((photo, idx) => (
                        <div
                          key={idx}
                          className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform select-none"
                          onClick={() => {
                            setSelectedImage({
                              images: message.cruisePhotos!.map((p: any) => ({ url: p.url, title: p.title })),
                              index: idx,
                            });
                          }}
                          onContextMenu={(e) => e.preventDefault()}
                          onDragStart={(e) => e.preventDefault()}
                        >
                          <Image
                            src={photo.url}
                            alt={photo.title || `사진 ${idx + 1}`}
                            fill
                            className="object-cover pointer-events-none"
                            sizes="(max-width: 768px) 50vw, 33vw"
                            quality={75}
                            loading="lazy"
                            placeholder="blur"
                            blurDataURL={getGrayBlurDataURL()}
                            draggable={false}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}


                {/* 선택된 하위 폴더의 사진들 표시 */}
                {selectedSubfolder && selectedSubfolder.messageId === message.id && (
                  <div className="mt-4 border-t-2 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-xl font-bold">
                        <span>📂</span>
                        <span>{selectedSubfolder.subfolderName} ({selectedSubfolder.photos.length}장)</span>
                      </div>
                      <button
                        onClick={handleCloseSubfolderPhotos}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-base font-medium"
                      >
                        닫기
                      </button>
                    </div>
                    {selectedSubfolder.photos.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto">
                        {selectedSubfolder.photos.map((photo, idx) => (
                          <div
                            key={idx}
                            className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform select-none"
                            onClick={() => {
                              setSelectedImage({
                                images: selectedSubfolder.photos.map((p: any) => ({ url: p.url, title: p.title })),
                                index: idx,
                              });
                            }}
                            onContextMenu={(e) => e.preventDefault()}
                            onDragStart={(e) => e.preventDefault()}
                          >
                            <Image
                              src={photo.url}
                              alt={photo.title || `사진 ${idx + 1}`}
                              fill
                              className="object-cover pointer-events-none"
                              sizes="(max-width: 768px) 50vw, 33vw"
                              quality={75}
                              loading="lazy"
                              placeholder="blur"
                              blurDataURL={getGrayBlurDataURL()}
                              draggable={false}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8 text-lg">이 폴더에는 사진이 없습니다.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        }

        // 기본 텍스트 렌더링 (fallback)
        return (
          <div key={uniqueKey} className="flex justify-start mb-4">
            <div className="max-w-[70%] rounded-xl p-5 text-xl bg-gray-100 text-gray-800">
              알 수 없는 메시지 형식입니다.
            </div>
          </div>
        );
      })}

      {/* 이미지 줌 모달 */}
      {selectedImage && (
        <ImageZoomModal
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          images={selectedImage.images}
          initialIndex={selectedImage.index}
        />
      )}
    </div>
  );
}
