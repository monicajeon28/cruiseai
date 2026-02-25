export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/partner/payments
 * 파트너가 유치한 고객의 결제 완료된 주문 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    // 파트너 권한 확인
    console.log('[Partner Payments] getSessionUser 결과:', { userId: user.id, name: user.name, phone: user.phone });
    
    const userWithProfile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        mallUserId: true,
        name: true,
        AffiliateProfile: {
          select: {
            id: true,
            affiliateCode: true,
            type: true,
          },
        },
      },
    });

    console.log('[Partner Payments] userWithProfile 조회 결과:', {
      found: !!userWithProfile,
      mallUserId: userWithProfile?.mallUserId,
      hasAffiliateProfile: !!userWithProfile?.AffiliateProfile,
      affiliateProfileId: userWithProfile?.AffiliateProfile?.id,
      affiliateCode: userWithProfile?.AffiliateProfile?.affiliateCode,
    });

    // mallUserId가 없어도 AffiliateProfile이 있으면 계속 진행
    if (!userWithProfile?.mallUserId && !userWithProfile?.AffiliateProfile) {
      console.warn('[Partner Payments] ⚠️ mallUserId와 AffiliateProfile이 모두 없습니다! userWithProfile:', userWithProfile);
      return NextResponse.json({ ok: false, message: 'Partner access required' }, { status: 403 });
    }
    
    // mallUserId가 없으면 phone이나 다른 식별자 사용 시도
    if (!userWithProfile?.mallUserId) {
      console.warn('[Partner Payments] ⚠️ mallUserId가 없지만 AffiliateProfile이 있으므로 계속 진행합니다.');
    }

    // AffiliateProfile 확인 (1:1 관계이므로 배열이 아닌 단일 객체)
    let affiliateProfile = userWithProfile.AffiliateProfile;
    
    if (!affiliateProfile && userWithProfile.mallUserId) {
      try {
        // AffiliateProfile이 없으면 자동 생성
        affiliateProfile = await prisma.affiliateProfile.create({
          data: {
            userId: user.id,
            affiliateCode: `AFF-${userWithProfile.mallUserId.toUpperCase()}-${Date.now().toString().slice(-4)}`,
            type: 'BRANCH_MANAGER',
            status: 'ACTIVE',
            displayName: userWithProfile.name || userWithProfile.mallUserId,
            nickname: userWithProfile.mallUserId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        console.log(`[Partner Payments] AffiliateProfile 자동 생성: ID=${affiliateProfile.id}, affiliateCode=${affiliateProfile.affiliateCode}`);
      } catch (createError: any) {
        console.error('[Partner Payments] AffiliateProfile 생성 실패:', createError);
        // 생성 실패해도 계속 진행 (affiliateCode는 null)
      }
    }
    
    const affiliateCode = affiliateProfile?.affiliateCode;
    const partnerId = userWithProfile.mallUserId;

    // 디버깅 로그
    console.log('[Partner Payments] 디버깅 정보:', {
      userId: user.id,
      partnerId,
      affiliateCode,
      affiliateProfileId: affiliateProfile?.id,
    });

    // 이 파트너가 유치한 결제 완료된 주문 조회
    // 방법 1: Payment의 affiliateCode 또는 affiliateMallUserId로 필터링
    // 방법 2: AffiliateSale의 managerId 또는 agentId로 필터링 (더 확실한 방법)
    
    const affiliateProfileId = affiliateProfile?.id;
    
    // 방법 1: Payment 직접 조회
    const paymentWhereConditions: any = {
      status: 'completed',
    };

    const paymentOrConditions: any[] = [];
    if (partnerId) {
      paymentOrConditions.push({ affiliateMallUserId: partnerId });
      console.log('[Partner Payments] partnerId 조건 추가:', partnerId);
    }
    if (affiliateCode) {
      paymentOrConditions.push({ affiliateCode });
      console.log('[Partner Payments] affiliateCode 조건 추가:', affiliateCode);
    }
    
    // AffiliateProfile이 있으면 managerId로 AffiliateSale 조회도 시도
    // (이미 아래에서 하고 있지만, 조건이 비어있을 때를 대비)

    console.log('[Partner Payments] paymentOrConditions:', paymentOrConditions);
    console.log('[Partner Payments] paymentOrConditions.length:', paymentOrConditions.length);

    if (paymentOrConditions.length > 0) {
      paymentWhereConditions.OR = paymentOrConditions;
    } else {
      console.warn('[Partner Payments] ⚠️ paymentOrConditions가 비어있습니다! partnerId와 affiliateCode가 모두 없습니다.');
    }

    // 방법 2: AffiliateSale을 통해 조회 (managerId 또는 agentId로)
    let paymentsFromSales: any[] = [];
    if (affiliateProfileId) {
      try {
        const sales = await prisma.affiliateSale.findMany({
          where: {
            OR: [
              { managerId: affiliateProfileId },
              { agentId: affiliateProfileId },
            ],
          },
          include: {
            Payment: {
              where: {
                status: 'completed', // Payment에서 직접 필터링
              },
            },
          },
        });

        console.log('[Partner Payments] AffiliateSale 조회 결과:', {
          salesCount: sales.length,
          salesWithPayment: sales.filter(s => s.Payment !== null).length,
        });

        // Payment가 있고 status가 'completed'인 AffiliateSale만 필터링
        paymentsFromSales = sales
          .filter((sale) => sale.Payment !== null)
          .map((sale) => ({
            ...sale.Payment!,
            AffiliateSale: {
              id: sale.id,
              productCode: sale.productCode,
              cabinType: sale.cabinType,
              fareCategory: sale.fareCategory,
              headcount: sale.headcount,
              status: sale.status,
            },
          }));
      } catch (salesError: any) {
        console.error('[Partner Payments] AffiliateSale 조회 오류:', salesError);
      }
    }

    console.log('[Partner Payments] 필터링 조건:', {
      paymentWhereConditions,
      affiliateProfileId,
      paymentsFromSalesCount: paymentsFromSales.length,
    });

    // 두 방법 모두 사용하여 결제 내역 조회
    let payments: any[] = [];
    
    // 방법 1: Payment 직접 조회
    if (paymentOrConditions.length > 0) {
      try {
        console.log('[Partner Payments] Payment 직접 조회 시작, 조건:', JSON.stringify(paymentWhereConditions, null, 2));
        const directPayments = await prisma.payment.findMany({
          where: paymentWhereConditions,
          include: {
            AffiliateSale: {
              select: {
                id: true,
                productCode: true,
                cabinType: true,
                fareCategory: true,
                headcount: true,
                status: true,
              },
            },
          },
          orderBy: {
            paidAt: 'desc',
          },
          take: 50,
        });
        console.log('[Partner Payments] Payment 직접 조회 결과:', directPayments.length, '개');
        if (directPayments.length > 0) {
          console.log('[Partner Payments] 첫 번째 Payment:', {
            orderId: directPayments[0].orderId,
            affiliateMallUserId: directPayments[0].affiliateMallUserId,
            affiliateCode: directPayments[0].affiliateCode,
            status: directPayments[0].status,
          });
        }
        payments = directPayments;
      } catch (queryError: any) {
        console.error('[Partner Payments] Payment 직접 조회 오류:', queryError);
        console.error('[Partner Payments] Payment 직접 조회 오류 스택:', queryError.stack);
      }
    } else {
      console.warn('[Partner Payments] ⚠️ paymentOrConditions가 비어있어서 Payment 직접 조회를 건너뜁니다.');
    }

    // 방법 2: AffiliateSale을 통해 조회한 Payment 추가 (중복 제거)
    if (paymentsFromSales.length > 0) {
      const existingOrderIds = new Set(payments.map((p) => p.orderId));
      for (const paymentFromSale of paymentsFromSales) {
        if (!existingOrderIds.has(paymentFromSale.orderId)) {
          payments.push(paymentFromSale);
        }
      }
    }

    // 최신순 정렬 및 중복 제거
    payments = payments
      .filter((p, index, self) => 
        index === self.findIndex((p2) => p2.orderId === p.orderId)
      )
      .sort((a, b) => {
        const dateA = a.paidAt ? new Date(a.paidAt).getTime() : 0;
        const dateB = b.paidAt ? new Date(b.paidAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 50);

    console.log('[Partner Payments] 조회된 결제 내역 개수:', payments.length);
    if (payments.length > 0) {
      console.log('[Partner Payments] 첫 번째 결제 내역:', {
        orderId: payments[0].orderId,
        affiliateCode: payments[0].affiliateCode,
        affiliateMallUserId: payments[0].affiliateMallUserId,
      });
      console.log('[Partner Payments] 모든 결제 내역 orderId:', payments.map(p => p.orderId));
    } else {
      console.warn('[Partner Payments] ⚠️ 조회된 결제 내역이 없습니다!');
      console.log('[Partner Payments] 디버깅 정보:', {
        paymentWhereConditions: JSON.stringify(paymentWhereConditions, null, 2),
        paymentOrConditions: JSON.stringify(paymentOrConditions, null, 2),
        affiliateProfileId,
        paymentsFromSalesCount: paymentsFromSales.length,
        directPaymentsCount: paymentOrConditions.length > 0 ? '조회됨' : '조건 없음',
        partnerId,
        affiliateCode,
      });
      
      // 추가 디버깅: 실제 DB에 있는 Payment 확인
      try {
        const allPayments = await prisma.payment.findMany({
          where: { status: 'completed' },
          take: 10,
          select: {
            orderId: true,
            affiliateMallUserId: true,
            affiliateCode: true,
            status: true,
          }
        });
        console.log('[Partner Payments] DB의 모든 completed Payment (최대 10개):', allPayments);
      } catch (debugError) {
        console.error('[Partner Payments] 디버깅 쿼리 오류:', debugError);
      }
    }

    // 포맷팅 (AffiliateSale 정보 포함)
    const formattedPayments = payments.map((payment) => ({
      id: payment.id,
      orderId: payment.orderId,
      productCode: payment.productCode,
      productName: payment.productName,
      amount: payment.amount,
      currency: payment.currency,
      buyerName: payment.buyerName,
      buyerEmail: payment.buyerEmail,
      buyerTel: payment.buyerTel,
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
      metadata: payment.metadata,
      sale: payment.AffiliateSale ? {
        id: payment.AffiliateSale.id,
        productCode: payment.AffiliateSale.productCode,
        cabinType: payment.AffiliateSale.cabinType,
        fareCategory: payment.AffiliateSale.fareCategory,
        headcount: payment.AffiliateSale.headcount,
        status: payment.AffiliateSale.status,
      } : null,
    }));

    // 개발 환경에서만 디버깅 정보 포함
    const response: any = { ok: true, payments: formattedPayments };
    if (process.env.NODE_ENV === 'development' && formattedPayments.length === 0) {
      response.debug = {
        userId: user.id,
        partnerId,
        affiliateCode,
        affiliateProfileId,
        paymentOrConditionsCount: paymentOrConditions.length,
        paymentsFromSalesCount: paymentsFromSales.length,
      };
    }
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('GET /api/partner/payments error:', error);
    console.error('GET /api/partner/payments error stack:', error.stack);
    // 에러 발생 시 빈 배열 반환 (500 에러 방지)
    return NextResponse.json({ 
      ok: true, 
      payments: [],
      error: error.message || '결제 내역 조회 중 오류가 발생했습니다.' 
    });
  }
}
