// 상품 태그 상수 (mall 컴포넌트 공용)
export interface ProductTag {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

export const PRODUCT_TAGS: ProductTag[] = [
  { id: 'weekend', label: '주말크루즈', emoji: '🎉', color: 'bg-blue-500' },
  { id: 'discount100', label: '100만원할인', emoji: '💰', color: 'bg-red-500' },
  { id: 'discount50', label: '50만원할인', emoji: '💵', color: 'bg-orange-500' },
  { id: 'discount40', label: '40만원할인', emoji: '💴', color: 'bg-pink-500' },
  { id: 'discount30', label: '30만원할인', emoji: '💶', color: 'bg-purple-500' },
  { id: 'discount10', label: '10만원할인', emoji: '💷', color: 'bg-yellow-500' },
  { id: 'free', label: '자유크루즈', emoji: '🗽', color: 'bg-green-500' },
  { id: 'premium', label: '프리미엄패키지', emoji: '👑', color: 'bg-indigo-500' },
  { id: 'couple', label: '커플추천', emoji: '💑', color: 'bg-pink-500' },
  { id: 'family', label: '가족추천', emoji: '👨‍👩‍👧‍👦', color: 'bg-blue-500' },
  { id: 'senior', label: '시니어추천', emoji: '👴', color: 'bg-gray-500' },
  { id: 'friends', label: '우정크루즈', emoji: '👯', color: 'bg-purple-500' },
  { id: 'super', label: '초특가', emoji: '🔥', color: 'bg-red-600' },
  { id: 'ultra', label: '초초초특가', emoji: '⚡', color: 'bg-red-700' },
  { id: 'must', label: '이건가야대', emoji: '⭐', color: 'bg-yellow-500' },
  { id: 'exclusive', label: '크루즈닷단독', emoji: '🎯', color: 'bg-blue-600' },
  { id: 'genie', label: '크루즈닷패키지', emoji: '🤖', color: 'bg-indigo-600' },
];
