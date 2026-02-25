// lib/affiliate/auto-link-generator.ts
// 어필리에이트 링크 자동 생성 유틸리티

import prisma from '@/lib/prisma';

/**
 * 고유한 링크 코드 생성
 */
async function generateLinkCode(index?: number): Promise<string> {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const suffix = index !== undefined ? `-${index}` : '';
  let code = `LINK-${timestamp}-${random}${suffix}`.toUpperCase();

  // 중복 확인
  let exists = await prisma.affiliateLink.findUnique({
    where: { code },
  });

  let attempts = 0;
  while (exists && attempts < 10) {
    const random2 = Math.random().toString(36).substring(2, 8);
    code = `LINK-${timestamp}-${random2}${suffix}`.toUpperCase();
    exists = await prisma.affiliateLink.findUnique({
      where: { code },
    });
    attempts++;
  }

  if (exists) {
    throw new Error('링크 코드 생성에 실패했습니다.');
  }

  return code;
}

/**
 * 특정 상품에 대해 모든 활성 파트너에게 개인 링크 자동 생성
 * @param productCode - 상품 코드
 * @param affiliateProductId - AffiliateProduct ID
 * @param issuedById - 발급자 ID (관리자)
 * @returns 생성된 링크 수
 */
export async function generateLinksForProduct(
  productCode: string,
  affiliateProductId: number,
  issuedById: number
): Promise<{ created: number; skipped: number; errors: string[] }> {
  const result = { created: 0, skipped: 0, errors: [] as string[] };

  try {
    // 모든 활성 파트너 조회 (BRANCH_MANAGER, SALES_AGENT)
    const activeProfiles = await prisma.affiliateProfile.findMany({
      where: {
        status: 'ACTIVE',
        type: { in: ['BRANCH_MANAGER', 'SALES_AGENT'] },
      },
      select: {
        id: true,
        type: true,
        displayName: true,
        affiliateCode: true,
      },
    });

    console.log(`[AutoLinkGenerator] Found ${activeProfiles.length} active profiles for product ${productCode}`);

    // 이미 존재하는 링크 확인
    const existingLinks = await prisma.affiliateLink.findMany({
      where: {
        productCode,
        OR: [
          { managerId: { not: null } },
          { agentId: { not: null } },
        ],
      },
      select: {
        managerId: true,
        agentId: true,
      },
    });

    // 이미 링크가 있는 프로필 ID 세트
    const existingManagerIds = new Set(existingLinks.filter(l => l.managerId).map(l => l.managerId));
    const existingAgentIds = new Set(existingLinks.filter(l => l.agentId).map(l => l.agentId));

    const now = new Date();
    let linkIndex = 0;

    for (const profile of activeProfiles) {
      try {
        // 이미 링크가 있는지 확인
        if (profile.type === 'BRANCH_MANAGER' && existingManagerIds.has(profile.id)) {
          result.skipped++;
          continue;
        }
        if (profile.type === 'SALES_AGENT' && existingAgentIds.has(profile.id)) {
          result.skipped++;
          continue;
        }

        const linkCode = await generateLinkCode(linkIndex++);

        await prisma.affiliateLink.create({
          data: {
            code: linkCode,
            title: `${profile.displayName} - 개인 링크`,
            productCode,
            affiliateProductId,
            managerId: profile.type === 'BRANCH_MANAGER' ? profile.id : null,
            agentId: profile.type === 'SALES_AGENT' ? profile.id : null,
            issuedById,
            status: 'ACTIVE',
            updatedAt: now,
          },
        });

        result.created++;
        console.log(`[AutoLinkGenerator] Created link for ${profile.displayName} (${profile.type}): ${linkCode}`);
      } catch (profileError: any) {
        result.errors.push(`${profile.displayName}: ${profileError.message}`);
        console.error(`[AutoLinkGenerator] Error creating link for profile ${profile.id}:`, profileError);
      }
    }

    console.log(`[AutoLinkGenerator] Product ${productCode}: Created ${result.created}, Skipped ${result.skipped}, Errors ${result.errors.length}`);
    return result;
  } catch (error: any) {
    console.error('[AutoLinkGenerator] generateLinksForProduct error:', error);
    result.errors.push(error.message);
    return result;
  }
}

/**
 * 새로 승인된 파트너에게 모든 활성 상품에 대한 개인 링크 자동 생성
 * @param profileId - 새로 승인된 AffiliateProfile ID
 * @param profileType - 파트너 타입 (BRANCH_MANAGER | SALES_AGENT)
 * @param issuedById - 발급자 ID (관리자)
 * @returns 생성된 링크 수
 */
export async function generateLinksForPartner(
  profileId: number,
  profileType: 'BRANCH_MANAGER' | 'SALES_AGENT',
  issuedById: number
): Promise<{ created: number; skipped: number; errors: string[] }> {
  const result = { created: 0, skipped: 0, errors: [] as string[] };

  try {
    // 프로필 정보 조회
    const profile = await prisma.affiliateProfile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        displayName: true,
        affiliateCode: true,
      },
    });

    if (!profile) {
      result.errors.push('프로필을 찾을 수 없습니다.');
      return result;
    }

    // 활성화된 모든 어필리에이트 상품 조회
    const activeProducts = await prisma.affiliateProduct.findMany({
      where: {
        status: 'active',
        isPublished: true,
      },
      select: {
        id: true,
        productCode: true,
        title: true,
      },
    });

    console.log(`[AutoLinkGenerator] Found ${activeProducts.length} active products for partner ${profile.displayName}`);

    // 이 파트너에게 이미 존재하는 링크 확인
    const existingLinks = await prisma.affiliateLink.findMany({
      where: profileType === 'BRANCH_MANAGER'
        ? { managerId: profileId }
        : { agentId: profileId },
      select: {
        productCode: true,
      },
    });

    const existingProductCodes = new Set(existingLinks.map(l => l.productCode).filter(Boolean));

    const now = new Date();
    let linkIndex = 0;

    for (const product of activeProducts) {
      try {
        // 이미 링크가 있는지 확인
        if (existingProductCodes.has(product.productCode)) {
          result.skipped++;
          continue;
        }

        const linkCode = await generateLinkCode(linkIndex++);

        await prisma.affiliateLink.create({
          data: {
            code: linkCode,
            title: `${profile.displayName} - ${product.title}`,
            productCode: product.productCode,
            affiliateProductId: product.id,
            managerId: profileType === 'BRANCH_MANAGER' ? profileId : null,
            agentId: profileType === 'SALES_AGENT' ? profileId : null,
            issuedById,
            status: 'ACTIVE',
            updatedAt: now,
          },
        });

        result.created++;
        console.log(`[AutoLinkGenerator] Created link for ${product.title}: ${linkCode}`);
      } catch (productError: any) {
        result.errors.push(`${product.title}: ${productError.message}`);
        console.error(`[AutoLinkGenerator] Error creating link for product ${product.productCode}:`, productError);
      }
    }

    console.log(`[AutoLinkGenerator] Partner ${profile.displayName}: Created ${result.created}, Skipped ${result.skipped}, Errors ${result.errors.length}`);
    return result;
  } catch (error: any) {
    console.error('[AutoLinkGenerator] generateLinksForPartner error:', error);
    result.errors.push(error.message);
    return result;
  }
}
