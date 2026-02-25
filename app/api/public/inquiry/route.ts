export const dynamic = 'force-dynamic';

// app/api/public/inquiry/route.ts
// 구매 문의 API (로그인 불필요)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { normalizePhone, isValidPhone } from '@/lib/phone-utils';

/**
 * POST: 구매 문의 제출
 * 로그인 없이 접근 가능
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productCode, name, phone, passportNumber, message, isPhoneConsultation, actualName, actualPhone } = body;
    
    // 전화상담 신청인 경우 helpuser/helpphone으로 구분
    const isPhoneConsult = isPhoneConsultation === true || (name === 'helpuser' && phone === 'helpphone');
    const customerName = isPhoneConsult ? (actualName || name) : name;
    const customerPhone = isPhoneConsult ? (actualPhone || phone) : phone;

    // 필수 필드 검증 (passportNumber는 선택사항)
    if (!productCode || !customerName || !customerPhone) {
      return NextResponse.json(
        { ok: false, error: '필수 정보를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    // 전화번호 정규화 및 검증
    const normalizedPhone = normalizePhone(customerPhone);
    if (!normalizedPhone || !isValidPhone(normalizedPhone)) {
      return NextResponse.json(
        { ok: false, error: '올바른 전화번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 중복 체크 없이 모든 문의 누적 기록 (백업 목적)
    // 동일 고객이 여러 번 문의해도 모두 기록됨

    // 상품 존재 확인
    const product = await prisma.cruiseProduct.findUnique({
      where: { productCode },
      select: { id: true, packageName: true },
    });

    if (!product) {
      return NextResponse.json(
        { ok: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 로그인된 사용자 ID 확인 (선택적)
    let userId: number | null = null;
    try {
      const { getSession } = await import('@/lib/session');
      const session = await getSession();
      if (session?.userId) {
        userId = parseInt(session.userId);
      }
    } catch (e) {
      // 세션 확인 실패해도 계속 진행 (비회원 문의 가능)
    }

    // 어필리에이트 코드 추적 (요청 본문 또는 쿠키에서 읽기)
    const cookies = req.cookies;
    const affiliateCode = cookies.get('affiliate_code')?.value || null;
    // partnerId는 요청 본문에서 직접 받거나, 쿠키에서 읽기
    const affiliateMallUserId = body.partnerId || cookies.get('affiliate_mall_user_id')?.value || null;

    console.log('[Public Inquiry API] 파트너 추적:', { affiliateCode, affiliateMallUserId, bodyPartnerId: body.partnerId });

    // 어필리에이트 프로필 찾기
    let managerId: number | null = null;
    let agentId: number | null = null;

    if (affiliateCode || affiliateMallUserId) {
      const profileWhere: any = {};
      if (affiliateCode) {
        profileWhere.affiliateCode = affiliateCode;
      } else if (affiliateMallUserId) {
        profileWhere.User = { mallUserId: affiliateMallUserId }; // User 대문자
      }

      console.log('[Public Inquiry API] 프로필 검색 조건:', profileWhere);

      const affiliateProfile = await prisma.affiliateProfile.findFirst({
        where: {
          ...profileWhere,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          type: true,
          displayName: true,
          AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile: {
            where: { status: 'ACTIVE' },
            select: { managerId: true },
            take: 1,
          },
        },
      });

      console.log('[Public Inquiry API] 찾은 프로필:', affiliateProfile);

      if (affiliateProfile) {
        if (affiliateProfile.type === 'BRANCH_MANAGER') {
          managerId = affiliateProfile.id;
          console.log('[Public Inquiry API] 대리점장 설정:', managerId);
        } else if (affiliateProfile.type === 'SALES_AGENT') {
          agentId = affiliateProfile.id;
          // 판매원인 경우 대리점장 ID도 설정
          const agentRelations = affiliateProfile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile;
          if (agentRelations && agentRelations.length > 0) {
            managerId = agentRelations[0].managerId;
          }
          console.log('[Public Inquiry API] 판매원 설정:', { agentId, managerId });
        }
      }
    }

    // ProductInquiry 테이블에 저장 (정규화된 전화번호 사용)
    const inquiry = await prisma.productInquiry.create({
      data: {
        productCode,
        userId,
        name: customerName,
        phone: normalizedPhone, // 정규화된 전화번호 저장
        passportNumber: passportNumber || null,
        message: message || null,
        status: 'pending',
        updatedAt: new Date(), // 필수 필드 추가
      }
    });

    // 전화번호로 User 찾기 (CustomerNoteModal을 위해 필요)
    let userForLead: { id: number } | null = null;
    if (normalizedPhone) {
      userForLead = await prisma.user.findFirst({
        where: { phone: normalizedPhone },
        select: { id: true },
      });
      
      // User가 없으면 생성 (고객 기록을 위해 필요)
      // 절대법칙: 크루즈몰 전화상담 버튼으로 이름과 연락처를 입력한 고객은 잠재고객(prospect)으로 저장
      if (!userForLead) {
        try {
          const newUser = await prisma.user.create({
            data: {
              name: customerName || null,
              phone: normalizedPhone,
              email: null,
              password: '1101', // 기본 비밀번호
              role: 'user',
              customerSource: isPhoneConsult ? 'phone-consultation' : 'product-inquiry', // 전화상담 신청은 phone-consultation으로 구분
              customerStatus: 'active',
              updatedAt: new Date(), // 필수 필드
              // 절대법칙: customerType을 prospect로 설정 (전화상담고객은 잠재고객)
              // customerType은 DB 스키마에 직접 필드가 없을 수 있으므로, customerSource로 구분
            },
            select: { id: true },
          });
          userForLead = newUser;
          console.log('[Public Inquiry API] User 생성 완료 (잠재고객):', newUser.id, isPhoneConsult ? '(전화상담)' : '(전화상담)');
        } catch (userError) {
          console.error('[Public Inquiry API] User 생성 실패:', userError);
          // User 생성 실패해도 계속 진행
        }
      } else {
        // 기존 User가 있는 경우에도 customerSource 업데이트 (전화상담으로 유입된 것으로 기록)
        try {
          await prisma.user.update({
            where: { id: userForLead.id },
            data: {
              customerSource: isPhoneConsult ? 'phone-consultation' : 'product-inquiry',
            },
          });
          console.log('[Public Inquiry API] 기존 User customerSource 업데이트 완료:', userForLead.id, isPhoneConsult ? '(전화상담)' : '(전화상담)');
        } catch (updateError) {
          console.error('[Public Inquiry API] User 업데이트 실패:', updateError);
          // 업데이트 실패해도 계속 진행
        }
      }
    }

    // AffiliateLead 생성 (모든 전화상담 문의 누적 기록 - 본사/대리점장/판매원 모두)
    // 중복 상관없이 항상 새로 생성하여 백업
    try {
      // 자동 생성된 AffiliateLink 찾기 (통계 추적용)
      let linkId: number | null = null;
      if (affiliateCode && productCode) {
        const autoLinkCode = `AUTO-${productCode}-${affiliateCode}`;
        const affiliateLink = await prisma.affiliateLink.findUnique({
          where: { code: autoLinkCode },
          select: { id: true },
        });
        if (affiliateLink) {
          linkId = affiliateLink.id;
          console.log('[Public Inquiry API] 자동 생성 링크 연결:', { autoLinkCode, linkId });
        }
      }

      const leadData = {
        linkId: linkId, // 자동 생성 링크와 연결 (통계 추적용)
        managerId: managerId || null,
        agentId: agentId || null,
        customerName: customerName,
        customerPhone: normalizedPhone, // 정규화된 전화번호 저장
        status: 'NEW',
        source: isPhoneConsult ? 'phone-consultation' : (affiliateMallUserId ? `mall-${affiliateMallUserId}` : 'product-inquiry'),
        metadata: {
          productCode,
          productName: product?.packageName || productCode,
          inquiryId: inquiry.id,
          affiliateCode,
          affiliateMallUserId,
          mallUserId: affiliateMallUserId, // 개인몰 ID 저장
          userId: userForLead?.id || null, // User ID 저장 (고객 기록용)
          isPhoneConsultation: isPhoneConsult, // 전화상담 신청 플래그
          actualName: customerName, // 실제 이름 저장
          actualPhone: customerPhone, // 실제 연락처 저장
          channel: managerId || agentId ? '파트너' : '본사', // 채널 정보
          linkCode: linkId ? `AUTO-${productCode}-${affiliateCode}` : null, // 링크 코드 기록
        },
        updatedAt: new Date(), // 필수 필드
      };

      await prisma.affiliateLead.create({ data: leadData });
      console.log('[Public Inquiry API] AffiliateLead 생성 완료 (누적 기록):', {
        managerId,
        agentId,
        customerName,
        userId: userForLead?.id,
        isPhoneConsult,
        channel: managerId || agentId ? '파트너' : '본사'
      });
    } catch (leadError) {
      console.error('[Public Inquiry API] AffiliateLead 생성 실패:', leadError);
      // AffiliateLead 생성 실패해도 문의는 정상 처리
    }

    // NOTE: 관리자 알림 시스템 구현 필요 (See GitHub Issue #TBD)
    // 임시: 로그에만 기록
    console.log('[Public Inquiry] New inquiry received:', {
      inquiryId: inquiry.id,
      customerName,
      productCode,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      ok: true,
      message: '문의가 접수되었습니다. 곧 연락드리겠습니다.',
      inquiryId: inquiry.id,
    });
  } catch (error) {
    console.error('[Public Inquiry API] POST error:', error);
    return NextResponse.json(
      { ok: false, error: '문의 접수 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
