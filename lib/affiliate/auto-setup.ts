import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';

/**
 * 어필리에이트 프로필 생성 시 자동으로 기본 리소스 생성
 * 
 * 생성되는 리소스:
 * 1. 기본 어필리에이트 링크 (판매용)
 * 2. 고객 그룹 ("나의 고객")
 * 3. 공유 랜딩 페이지 (SNS 프로필용)
 * 4. 결제 페이지 (기본)
 */

export async function autoSetupAffiliateProfile(profileId: number) {
  console.log(`[Auto Setup] Starting auto-setup for profile ${profileId}`);

  try {
    // 프로필 정보 가져오기
    const profile = await prisma.affiliateProfile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        userId: true,
        type: true,
        displayName: true,
        nickname: true,
        landingSlug: true,
        affiliateCode: true,
      },
    });

    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    const displayName = profile.displayName || profile.nickname || '파트너';

    // 1. 기본 어필리에이트 링크 생성
    await createDefaultAffiliateLink(profile);

    // 2. 고객 그룹 생성 ("나의 고객")
    await createDefaultCustomerGroup(profile);

    // 3. 공유 랜딩 페이지 생성 (SNS 프로필용)
    await createDefaultLandingPage(profile);

    console.log(`[Auto Setup] Completed auto-setup for profile ${profileId}`);

    return {
      ok: true,
      message: '프로필 자동 설정이 완료되었습니다.',
    };
  } catch (error: any) {
    console.error(`[Auto Setup] Error for profile ${profileId}:`, error);
    return {
      ok: false,
      error: error.message || '자동 설정 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 기본 어필리에이트 링크 생성
 */
async function createDefaultAffiliateLink(profile: {
  id: number;
  userId: number;
  type: string;
  displayName: string | null;
  nickname: string | null;
  landingSlug: string | null;
  affiliateCode: string;
}) {
  const displayName = profile.displayName || profile.nickname || '파트너';

  // 이미 기본 링크가 있는지 확인
  const existingLink = await prisma.affiliateLink.findFirst({
    where: {
      OR: [
        { managerId: profile.type === 'BRANCH_MANAGER' ? profile.id : undefined },
        { agentId: profile.type === 'SALES_AGENT' ? profile.id : undefined },
      ],
    },
    take: 1,
  });

  if (existingLink) {
    console.log(`[Auto Setup] Link already exists for profile ${profile.id}`);
    return existingLink;
  }

  // 고유한 링크 코드 생성
  const linkCode = `${profile.affiliateCode}-${randomBytes(3).toString('hex')}`.toUpperCase();

  const linkData: any = {
    code: linkCode,
    title: `${displayName}의 기본 링크`,
    targetUrl: profile.landingSlug ? `https://yourdomain.com/l/${profile.landingSlug}` : 'https://yourdomain.com',
    isActive: true,
    User: { connect: { id: profile.userId } },
  };

  // 프로필 타입에 따라 연결
  if (profile.type === 'BRANCH_MANAGER') {
    linkData.manager = { connect: { id: profile.id } };
  } else if (profile.type === 'SALES_AGENT') {
    linkData.agent = { connect: { id: profile.id } };
  }

  const link = await prisma.affiliateLink.create({
    data: linkData,
  });

  console.log(`[Auto Setup] Created default link ${link.code} for profile ${profile.id}`);
  return link;
}

/**
 * 기본 고객 그룹 생성 ("나의 고객")
 */
async function createDefaultCustomerGroup(profile: {
  id: number;
  userId: number;
  displayName: string | null;
  nickname: string | null;
}) {
  const displayName = profile.displayName || profile.nickname || '파트너';

  // 이미 고객 그룹이 있는지 확인
  const existingGroup = await prisma.customerGroup.findFirst({
    where: {
      ownerId: profile.userId,
      affiliateProfileId: profile.id,
    },
    take: 1,
  });

  if (existingGroup) {
    console.log(`[Auto Setup] Customer group already exists for profile ${profile.id}`);
    return existingGroup;
  }

  const group = await prisma.customerGroup.create({
    data: {
      name: `${displayName}의 고객`,
      description: '자동 생성된 기본 고객 그룹',
      ownerId: profile.userId,
      affiliateProfileId: profile.id,
      isActive: true,
    },
  });

  console.log(`[Auto Setup] Created customer group ${group.id} for profile ${profile.id}`);
  return group;
}

/**
 * 기본 공유 랜딩 페이지 생성 (SNS 프로필용)
 */
async function createDefaultLandingPage(profile: {
  id: number;
  userId: number;
  type: string;
  displayName: string | null;
  nickname: string | null;
  landingSlug: string | null;
}) {
  const displayName = profile.displayName || profile.nickname || '파트너';

  // 이미 랜딩 페이지가 있는지 확인
  const existingPage = await prisma.sharedLandingPage.findFirst({
    where: {
      affiliateProfileId: profile.id,
    },
    take: 1,
  });

  if (existingPage) {
    console.log(`[Auto Setup] Landing page already exists for profile ${profile.id}`);
    return existingPage;
  }

  // slug 생성
  const slug = profile.landingSlug || `partner-${profile.id}`;

  const page = await prisma.sharedLandingPage.create({
    data: {
      title: `${displayName}의 프로필`,
      slug,
      description: `${displayName}와 함께하는 크루즈 여행`,
      content: JSON.stringify({
        hero: {
          title: `안녕하세요, ${displayName}입니다!`,
          subtitle: '크루즈 여행의 모든 것을 함께 합니다.',
        },
        about: {
          title: '소개',
          content: `${displayName}와 함께 최고의 크루즈 여행을 경험하세요.`,
        },
        contact: {
          title: '연락하기',
          message: '언제든지 문의주세요!',
        },
      }),
      theme: {
        primaryColor: '#3B82F6',
        secondaryColor: '#10B981',
        fontFamily: 'Pretendard, sans-serif',
      },
      isPublished: true,
      affiliateProfileId: profile.id,
      createdById: profile.userId,
    },
  });

  console.log(`[Auto Setup] Created landing page ${page.slug} for profile ${profile.id}`);
  return page;
}



















