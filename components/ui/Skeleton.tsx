'use client';

/**
 * 로딩 스켈레톤 UI 컴포넌트
 * 작업자 C (UX/기능 전문가) - 50대 이상 고객 친화적 디자인
 */

// 기본 스켈레톤
export function Skeleton({ className = '', width, height }: { 
  className?: string; 
  width?: string; 
  height?: string;
}) {
  const style = {
    ...(width && { width }),
    ...(height && { height }),
  };

  return (
    <div 
      className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] rounded-lg ${className}`}
      style={style}
    />
  );
}

// 채팅 메시지 스켈레톤
export function ChatMessageSkeleton() {
  return (
    <div className="space-y-4 px-4">
      {/* AI 메시지 (왼쪽) */}
      <div className="flex justify-start">
        <div className="max-w-[70%] space-y-2">
          <Skeleton height="60px" className="rounded-xl" />
        </div>
      </div>

      {/* 사용자 메시지 (오른쪽) */}
      <div className="flex justify-end">
        <div className="max-w-[70%]">
          <Skeleton height="40px" className="rounded-xl" />
        </div>
      </div>

      {/* AI 메시지 */}
      <div className="flex justify-start">
        <div className="max-w-[70%] space-y-2">
          <Skeleton height="80px" className="rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// 사진 갤러리 스켈레톤
export function PhotoGallerySkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-square">
          <Skeleton className="w-full h-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// 프로필 페이지 스켈레톤
export function ProfileSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* 프로필 헤더 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton height="28px" width="150px" />
            <Skeleton height="20px" width="200px" />
          </div>
        </div>
      </div>

      {/* 여행 정보 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-3">
        <Skeleton height="24px" width="120px" />
        <Skeleton height="20px" width="100%" />
        <Skeleton height="20px" width="80%" />
        <Skeleton height="20px" width="90%" />
      </div>

      {/* D-Day */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <Skeleton height="24px" width="100px" className="mb-3" />
        <Skeleton height="60px" width="100%" />
      </div>
    </div>
  );
}

// 브리핑 카드 스켈레톤
export function BriefingSkeleton() {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 mb-4 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton height="24px" width="150px" />
          <Skeleton height="16px" width="200px" />
        </div>
      </div>
      
      <div className="space-y-3">
        <Skeleton height="80px" className="rounded-xl" />
        <Skeleton height="60px" className="rounded-xl" />
      </div>
    </div>
  );
}

// 리스트 아이템 스켈레톤
export function ListItemSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton height="20px" width="70%" />
              <Skeleton height="16px" width="50%" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// 통계 카드 스켈레톤
export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <Skeleton height="20px" width="100px" className="mb-3" />
      <Skeleton height="48px" width="120px" className="mb-2" />
      <Skeleton height="16px" width="150px" />
    </div>
  );
}

// 가계부 스켈레톤
export function WalletSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {/* 총계 카드 */}
      <div className="bg-white rounded-2xl p-6 shadow-md">
        <Skeleton height="24px" width="120px" className="mb-4" />
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Skeleton height="20px" width="60px" className="mb-2" />
            <Skeleton height="32px" width="100px" />
          </div>
          <div>
            <Skeleton height="20px" width="60px" className="mb-2" />
            <Skeleton height="32px" width="100px" />
          </div>
          <div>
            <Skeleton height="20px" width="60px" className="mb-2" />
            <Skeleton height="32px" width="100px" />
          </div>
        </div>
      </div>

      {/* 지출 목록 */}
      <ListItemSkeleton count={8} />
    </div>
  );
}

