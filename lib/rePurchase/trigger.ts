// lib/rePurchase/trigger.ts
// 재구매 트리거 생성 및 관리 로직

import prisma from '@/lib/prisma';

/**
 * 여행 종료 시 트리거 생성
 */
export async function createTripEndTrigger(userId: number, tripEndDate: Date) {
  console.log('[RePurchase Trigger] Creating trip end trigger:', { userId, tripEndDate });
  
  try {
    // 사용자 존재 확인
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // 이미 트리거가 있으면 생성하지 않음
    const existing = await prisma.rePurchaseTrigger.findFirst({
      where: {
        userId,
        lastTripEndDate: tripEndDate,
        triggerType: 'grace_period_end',
      },
    });

    if (existing) {
      console.log('[RePurchase Trigger] Trigger already exists:', existing.id);
      return existing;
    }

    const trigger = await prisma.rePurchaseTrigger.create({
      data: {
        userId,
        lastTripEndDate: tripEndDate,
        triggerType: 'grace_period_end',
        messageSent: false,
        converted: false,
        updatedAt: new Date(),
      },
    });

    console.log('[RePurchase Trigger] Trigger created:', trigger.id);
    return trigger;
  } catch (error) {
    console.error('[RePurchase Trigger] Error creating trip end trigger:', error);
    throw error;
  }
}

/**
 * 유예 기간 종료 시 트리거 생성
 */
export async function createGracePeriodEndTrigger(userId: number, tripEndDate: Date) {
  const existing = await prisma.rePurchaseTrigger.findFirst({
    where: {
      userId,
      lastTripEndDate: tripEndDate,
      triggerType: 'grace_period_end',
    },
  });

  if (existing) {
    return existing;
  }

  return await prisma.rePurchaseTrigger.create({
    data: {
      userId,
      lastTripEndDate: tripEndDate,
      triggerType: 'grace_period_end',
      messageSent: false,
      converted: false,
      updatedAt: new Date(),
    },
  });
}

/**
 * 재방문 유도 트리거 생성
 */
export async function createRevisitPromptTrigger(userId: number, tripEndDate: Date) {
  return await prisma.rePurchaseTrigger.create({
    data: {
      userId,
      lastTripEndDate: tripEndDate,
      triggerType: 'revisit_prompt',
      messageSent: false,
      converted: false,
      updatedAt: new Date(),
    },
  });
}

/**
 * 상품 추천 트리거 생성
 */
export async function createProductRecommendationTrigger(userId: number, tripEndDate: Date) {
  return await prisma.rePurchaseTrigger.create({
    data: {
      userId,
      lastTripEndDate: tripEndDate,
      triggerType: 'product_recommendation',
      messageSent: false,
      converted: false,
      updatedAt: new Date(),
    },
  });
}

/**
 * 전환 처리
 */
export async function markAsConverted(triggerId: number) {
  return await prisma.rePurchaseTrigger.update({
    where: { id: triggerId },
    data: {
      converted: true,
      convertedAt: new Date(),
    },
  });
}

/**
 * 메시지 발송 표시
 */
export async function markMessageSent(triggerId: number) {
  return await prisma.rePurchaseTrigger.update({
    where: { id: triggerId },
    data: {
      messageSent: true,
    },
  });
}

/**
 * 전환율 계산
 */
export async function calculateConversionRate(timeRange: '7d' | '30d' | '90d' | 'all' = 'all') {
  const now = new Date();
  let startDate: Date | undefined;

  switch (timeRange) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
  }

  const where: any = {};
  if (startDate) {
    where.createdAt = { gte: startDate };
  }

  const total = await prisma.rePurchaseTrigger.count({ where });
  const converted = await prisma.rePurchaseTrigger.count({
    where: {
      ...where,
      converted: true,
    },
  });

  const conversionRate = total > 0 ? (converted / total) * 100 : 0;

  // 타입별 통계
  const byType = await Promise.all(
    ['grace_period_end', 'revisit_prompt', 'product_recommendation'].map(async (type) => {
      const typeWhere = { ...where, triggerType: type };
      const typeTotal = await prisma.rePurchaseTrigger.count({ where: typeWhere });
      const typeConverted = await prisma.rePurchaseTrigger.count({
        where: { ...typeWhere, converted: true },
      });
      return {
        type,
        total: typeTotal,
        converted: typeConverted,
        conversionRate: typeTotal > 0 ? (typeConverted / typeTotal) * 100 : 0,
      };
    })
  );

  return {
    total,
    converted,
    conversionRate: Math.round(conversionRate * 100) / 100,
    byType,
  };
}
