export const dynamic = 'force-dynamic';

// app/api/partner/trial-invite-link/route.ts
// 3일 체험 초대 링크 생성/조회 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import { cookies } from 'next/headers';
import { promises as fs } from 'fs';
import path from 'path';

const SESSION_COOKIE = 'cg.sid.v2';
const SHORTLINKS_FILE = path.join(process.cwd(), 'data', 'shortlinks.json');

// 숏링크 파일 읽기
async function readShortLinks(): Promise<any> {
  try {
    const content = await fs.readFile(SHORTLINKS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { links: [] };
  }
}

// 숏링크 파일 쓰기
async function writeShortLinks(data: any): Promise<void> {
  const dir = path.dirname(SHORTLINKS_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(SHORTLINKS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// 숏링크 생성 및 저장
async function createOrGetShortLink(code: string, url: string): Promise<string> {
  const data = await readShortLinks();
  const links = data.links || [];
  
  // 기존 숏링크 확인
  const existingLink = links.find((link: any) => link.code === code);
  if (existingLink) {
    const shortlinkDomain = process.env.SHORTLINK_DOMAIN || process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') || 'https://www.cruisedot.co.kr';
    return `${shortlinkDomain}/p/${code}`;
  }
  
  // 새 숏링크 생성
  const newLink = {
    code,
    url,
    contractType: 'trial-invite',
    createdAt: new Date().toISOString(),
    clickCount: 0,
  };
  
  links.push(newLink);
  await writeShortLinks({ links });
  
  const shortlinkDomain = process.env.SHORTLINK_DOMAIN || process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') || 'https://www.cruisedot.co.kr';
  return `${shortlinkDomain}/p/${code}`;
}

// GET: 파트너의 3일 체험 초대 링크 조회
export async function GET(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext();
    if (!profile) {
      return NextResponse.json(
        { ok: false, message: '파트너 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 파트너의 3일 체험 초대 링크 찾기 (linkType이 'trial-invite'인 링크)
    const trialLink = await prisma.affiliateLink.findFirst({
      where: {
        OR: [
          { managerId: profile.id },
          { agentId: profile.id },
        ],
        metadata: {
          path: ['linkType'],
          equals: 'trial-invite',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!trialLink) {
      return NextResponse.json({
        ok: true,
        link: null,
        message: '3일 체험 초대 링크가 없습니다. 생성 버튼을 눌러 링크를 생성하세요.',
      });
    }

    // 링크 URL 생성
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cruisedot.co.kr';
    let managerCode = '';
    if (profile.type === 'SALES_AGENT' && profile.agentRelations && profile.agentRelations.length > 0) {
      const managerRelation = profile.agentRelations[0];
      if (managerRelation?.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile?.affiliateCode) {
        managerCode = `&manager=${managerRelation.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile.affiliateCode}`;
      }
    }
    const linkUrl = `${baseUrl}/login-test?trial=${trialLink.code}&affiliate=${profile.affiliateCode}${managerCode}`;

    // 숏링크 생성 또는 조회
    const shortUrl = await createOrGetShortLink(trialLink.code, linkUrl);

    return NextResponse.json({
      ok: true,
      link: {
        id: trialLink.id,
        code: trialLink.code,
        url: linkUrl,
        shortUrl,
        createdAt: trialLink.createdAt,
        status: trialLink.status,
      },
    });
  } catch (error: any) {
    console.error('[Trial Invite Link] GET error:', error);
    console.error('[Trial Invite Link] GET error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    // PartnerApiError인 경우 상태 코드 사용
    if (error?.status) {
      return NextResponse.json(
        { ok: false, message: error.message || '링크 조회 중 오류가 발생했습니다.' },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { 
        ok: false, 
        message: error?.message || '링크 조회 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// POST: 3일 체험 초대 링크 생성
export async function POST(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext();
    if (!profile) {
      return NextResponse.json(
        { ok: false, message: '파트너 권한이 필요합니다.' },
        { status: 403 }
      );
    }
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid) {
      return NextResponse.json(
        { ok: false, message: '세션이 없습니다.' },
        { status: 401 }
      );
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { User: true },
    });

    if (!session || !session.User) {
      return NextResponse.json(
        { ok: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 401 }
      );
    }

    // 기존 3일 체험 초대 링크 확인
    const existingLink = await prisma.affiliateLink.findFirst({
      where: {
        OR: [
          { managerId: profile.id },
          { agentId: profile.id },
        ],
        metadata: {
          path: ['linkType'],
          equals: 'trial-invite',
        },
      },
    });

    if (existingLink) {
      // 기존 링크가 있으면 반환
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cruisedot.co.kr';
      let managerCode = '';
      if (profile.type === 'SALES_AGENT' && profile.agentRelations && profile.agentRelations.length > 0) {
        const managerRelation = profile.agentRelations[0];
        if (managerRelation?.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile?.affiliateCode) {
          managerCode = `&manager=${managerRelation.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile.affiliateCode}`;
        }
      }
      const linkUrl = `${baseUrl}/login-test?trial=${existingLink.code}&affiliate=${profile.affiliateCode}${managerCode}`;

      // 숏링크 생성 또는 조회
      const shortUrl = await createOrGetShortLink(existingLink.code, linkUrl);

      return NextResponse.json({
        ok: true,
        link: {
          id: existingLink.id,
          code: existingLink.code,
          url: linkUrl,
          shortUrl,
          createdAt: existingLink.createdAt,
          status: existingLink.status,
        },
        message: '기존 링크를 반환했습니다.',
      });
    }

    // 새 링크 생성
    const linkCode = `trial-${profile.affiliateCode}-${Date.now()}`;
    
    const newLink = await prisma.affiliateLink.create({
      data: {
        code: linkCode,
        title: `${profile.displayName || profile.affiliateCode}님의 3일 체험 초대 링크`,
        managerId: profile.type === 'BRANCH_MANAGER' ? profile.id : null,
        agentId: profile.type === 'SALES_AGENT' ? profile.id : null,
        issuedById: session.User.id,
        status: 'ACTIVE',
        updatedAt: new Date(),
        metadata: {
          linkType: 'trial-invite',
          profileId: profile.id,
          profileType: profile.type,
        },
      },
    });

    // 링크 URL 생성
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cruisedot.co.kr';
    let managerCode = '';
    if (profile.type === 'SALES_AGENT' && profile.agentRelations && profile.agentRelations.length > 0) {
      const managerRelation = profile.agentRelations[0];
      if (managerRelation?.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile?.affiliateCode) {
        managerCode = `&manager=${managerRelation.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile.affiliateCode}`;
      }
    }
    const linkUrl = `${baseUrl}/login-test?trial=${newLink.code}&affiliate=${profile.affiliateCode}${managerCode}`;

    // 숏링크 생성 또는 조회
    const shortUrl = await createOrGetShortLink(newLink.code, linkUrl);

    return NextResponse.json({
      ok: true,
      link: {
        id: newLink.id,
        code: newLink.code,
        url: linkUrl,
        shortUrl,
        createdAt: newLink.createdAt,
        status: newLink.status,
      },
      message: '3일 체험 초대 링크가 생성되었습니다.',
    });
  } catch (error: any) {
    console.error('[Trial Invite Link] POST error:', error);
    console.error('[Trial Invite Link] POST error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    // PartnerApiError인 경우 상태 코드 사용
    if (error?.status) {
      return NextResponse.json(
        { ok: false, message: error.message || '링크 생성 중 오류가 발생했습니다.' },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { 
        ok: false, 
        message: error?.message || '링크 생성 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}
