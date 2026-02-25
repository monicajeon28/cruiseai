export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

// GET: 프로필 정보 조회
export async function GET(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext();

    // 프론트엔드 형식에 맞게 변환
    const formattedProfile = {
      ...profile,
      user: profile.User,
    };

    return NextResponse.json({
      ok: true,
      profile: formattedProfile,
    });
  } catch (error: any) {
    console.error('[GET /api/partner/profile] error:', error);

    // PartnerApiError인 경우 상태 코드와 메시지 그대로 반환
    if (error.name === 'PartnerApiError') {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status || 403 }
      );
    }

    return NextResponse.json(
      { ok: false, message: error.message || '프로필 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext();
    const body = await req.json();

    console.log('[PUT /api/partner/profile] Updating profile:', profile.id, body);

    const {
      displayName,
      contactPhone,
      contactEmail,
      profileTitle,
      landingAnnouncement,
      welcomeMessage,
      bio,
      profileImage,
      kakaoLink,
      instagramHandle,
      youtubeChannel,
      blogLink,
      threadLink,
      customLinks,
      galleryImages,
      featuredImages,
      youtubeVideoUrl,
      schedules,
    } = body;

    // AffiliateProfile 업데이트
    const updatedProfile = await prisma.affiliateProfile.update({
      where: { id: profile.id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(contactPhone !== undefined && { contactPhone }),
        ...(contactEmail !== undefined && { contactEmail }),
        ...(profileTitle !== undefined && { profileTitle }),
        ...(landingAnnouncement !== undefined && { landingAnnouncement }),
        ...(welcomeMessage !== undefined && { welcomeMessage }),
        ...(bio !== undefined && { bio }),
        ...(profileImage !== undefined && { profileImage }),
        ...(kakaoLink !== undefined && { kakaoLink }),
        ...(instagramHandle !== undefined && { instagramHandle }),
        ...(youtubeChannel !== undefined && { youtubeChannel }),
        ...(blogLink !== undefined && { blogLink }),
        ...(threadLink !== undefined && { threadLink }),
        ...(customLinks !== undefined && { customLinks: customLinks ? JSON.stringify(customLinks) : null }),
        ...(galleryImages !== undefined && { galleryImages: galleryImages ? JSON.stringify(galleryImages) : null }),
        ...(featuredImages !== undefined && { featuredImages: featuredImages ? JSON.stringify(featuredImages) : null }),
        ...(youtubeVideoUrl !== undefined && { youtubeVideoUrl }),
        ...(schedules !== undefined && { schedules: schedules ? JSON.stringify(schedules) : null }),
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            mallUserId: true,
            mallNickname: true,
          },
        },
      },
    });

    // 프론트엔드 형식에 맞게 변환
    const formattedProfile = {
      ...updatedProfile,
      user: updatedProfile.User,
    };

    return NextResponse.json({
      ok: true,
      profile: formattedProfile,
      message: '프로필이 성공적으로 업데이트되었습니다.',
    });
  } catch (error: any) {
    console.error('[PUT /api/partner/profile] error:', error);

    // PartnerApiError인 경우 상태 코드와 메시지 그대로 반환
    if (error.name === 'PartnerApiError') {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status || 403 }
      );
    }

    return NextResponse.json(
      { ok: false, message: error.message || '프로필 업데이트에 실패했습니다.' },
      { status: 500 }
    );
  }
}
