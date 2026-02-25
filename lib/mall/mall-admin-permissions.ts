// lib/mall-admin-permissions.ts
// 크루즈몰 관리자 권한 확인 헬퍼 함수

import prisma from '../prisma';

export interface MallAdminFeatureSettings {
  canDeletePosts: boolean;
  canDeleteComments: boolean;
  canEditProductText: boolean;
}

/**
 * 크루즈몰 관리자의 기능 설정을 가져옵니다.
 * @param userId 사용자 ID
 * @returns 기능 설정 객체 (기본값: 모든 기능 활성화)
 */
export async function getMallAdminFeatureSettings(userId: number): Promise<MallAdminFeatureSettings> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { adminMemo: true },
    });

    if (!user || !user.adminMemo) {
      // 기본값: 모든 기능 활성화
      return {
        canDeletePosts: true,
        canDeleteComments: true,
        canEditProductText: true,
      };
    }

    try {
      const parsed = JSON.parse(user.adminMemo);
      return {
        canDeletePosts: parsed.canDeletePosts !== false,
        canDeleteComments: parsed.canDeleteComments !== false,
        canEditProductText: parsed.canEditProductText !== false,
      };
    } catch {
      // JSON 파싱 실패 시 기본값 반환
      return {
        canDeletePosts: true,
        canDeleteComments: true,
        canEditProductText: true,
      };
    }
  } catch (error) {
    console.error('[Mall Admin Permissions] Error getting feature settings:', error);
    // 에러 발생 시 기본값 반환
    return {
      canDeletePosts: true,
      canDeleteComments: true,
      canEditProductText: true,
    };
  }
}

/**
 * 사용자가 크루즈몰 관리자(user1~user10)인지 확인합니다.
 * @param userId 사용자 ID
 * @returns 크루즈몰 관리자 여부
 */
export async function isMallAdmin(userId: number): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, phone: true },
    });

    return user?.role === 'admin' && user.phone !== null && /^user(1[0]|[1-9])$/.test(user.phone);
  } catch (error) {
    console.error('[Mall Admin Permissions] Error checking mall admin:', error);
    return false;
  }
}
