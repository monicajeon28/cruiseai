// lib/insights/generator.ts
// 마케팅 인사이트 생성 로직

import prisma from '@/lib/prisma';

/**
 * 목적지 선호도 분석
 */
export async function generateDestinationPreference(userId: number) {
  const trips = await prisma.trip.findMany({
    where: { userId },
    select: { destination: true },
  });

  if (trips.length === 0) {
    return null;
  }

  // 목적지 파싱 및 카운팅
  const destinationCounts: Record<string, number> = {};
  trips.forEach((trip) => {
    if (trip.destination) {
      const countries = trip.destination.split(',').map((s) => s.trim());
      countries.forEach((country) => {
        if (country) {
          destinationCounts[country] = (destinationCounts[country] || 0) + 1;
        }
      });
    }
  });

  // Top 5 목적지
  const topDestinations = Object.entries(destinationCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / trips.length) * 100),
    }));

  // 패턴 분석 (대륙별)
  const continentMap: Record<string, string[]> = {
    아시아: ['일본', '한국', '중국', '홍콩', '대만', '태국', '베트남', '싱가포르', '말레이시아', '인도네시아', '필리핀'],
    유럽: ['프랑스', '이탈리아', '스페인', '독일', '영국', '그리스', '터키'],
    지중해: ['그리스', '터키', '이탈리아', '스페인', '크로아티아'],
    북미: ['미국', '캐나다', '멕시코'],
  };

  let preferredPattern = '다양';
  let maxPatternCount = 0;

  Object.entries(continentMap).forEach(([continent, countries]) => {
    const count = topDestinations.filter((d) =>
      countries.some((c) => d.name.includes(c) || c.includes(d.name))
    ).length;
    if (count > maxPatternCount) {
      maxPatternCount = count;
      preferredPattern = continent;
    }
  });

  // 다음 목적지 예측 (가장 많이 방문한 패턴에서 아직 방문하지 않은 곳)
  const visitedCountries = new Set(topDestinations.map((d) => d.name));
  const predictedNext =
    continentMap[preferredPattern]?.find((c) => !Array.from(visitedCountries).some((v) => v.includes(c))) ||
    topDestinations[0]?.name ||
    '알 수 없음';

  // 신뢰도 계산 (여행 횟수 기반)
  const confidence = Math.min(trips.length / 10, 1);

  return {
    topDestinations,
    preferredPattern,
    predictedNext,
    confidence: Math.round(confidence * 100) / 100,
    totalTrips: trips.length,
  };
}

/**
 * 지출 패턴 분석
 */
export async function generateSpendingPattern(userId: number) {
  const expenses = await prisma.expense.findMany({
    where: { userId },
    select: { krwAmount: true, category: true, createdAt: true },
  });

  if (expenses.length < 5) {
    return null; // 최소 5개 지출 기록 필요
  }

  const total = expenses.reduce((sum, e) => sum + (e.krwAmount || 0), 0);
  const days = expenses.length > 0 ? Math.ceil((Date.now() - new Date(expenses[0].createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 1;
  const avgDaily = Math.round(total / Math.max(days, 1));

  // 카테고리별 비율
  const byCategory: Record<string, number> = {};
  expenses.forEach((e) => {
    const cat = e.category || '기타';
    byCategory[cat] = (byCategory[cat] || 0) + (e.krwAmount || 0);
  });

  const categoryRatios = Object.entries(byCategory)
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: Math.round((amount / total) * 100),
    }))
    .sort((a, b) => b.percentage - a.percentage);

  // 지출 패턴 분류
  let patternType = '균형형';
  if (avgDaily < 100000) {
    patternType = '절약형';
  } else if (avgDaily > 300000) {
    patternType = '소비형';
  }

  // 추천 사항
  const recommendations: string[] = [];
  if (patternType === '소비형') {
    recommendations.push('일일 지출을 평균 20% 줄이면 더 많은 예산을 다른 항목에 사용할 수 있습니다.');
  } else if (patternType === '절약형') {
    recommendations.push('현재 지출 패턴이 절약형입니다. 여유 예산이 있다면 현지 체험을 추가로 즐길 수 있습니다.');
  }
  if (categoryRatios[0]?.percentage > 50) {
    recommendations.push(`${categoryRatios[0].name} 카테고리가 전체 지출의 ${categoryRatios[0].percentage}%를 차지합니다.`);
  }

  return {
    avgDaily,
    total,
    categoryRatios,
    patternType,
    recommendations,
    totalExpenses: expenses.length,
  };
}

/**
 * 기능 사용 패턴 분석
 */
export async function generateFeatureUsage(userId: number) {
  const usages = await prisma.featureUsage.findMany({
    where: { 
      userId,
      feature: { not: 'page_view' } // page_view는 기능이 아니므로 제외
    },
    orderBy: { usageCount: 'desc' },
  });

  if (usages.length === 0) {
    return null;
  }

  const totalUsage = usages.reduce((sum, u) => sum + u.usageCount, 0);

  const features = usages.map((u) => ({
    feature: u.feature,
    usageCount: u.usageCount,
    percentage: Math.round((u.usageCount / totalUsage) * 100),
    lastUsed: u.lastUsedAt.toISOString(),
  }));

  // 가장 인기 있는 기능
  const topFeature = features[0];

  // 사용 빈도 분석
  const avgUsage = totalUsage / usages.length;
  let frequency = '보통';
  if (avgUsage > 50) {
    frequency = '높음';
  } else if (avgUsage < 10) {
    frequency = '낮음';
  }

  // 추천 사항
  const recommendations: string[] = [];
  const featureNames: Record<string, string> = {
    ai_chat: 'AI 채팅',
    checklist: '체크리스트',
    wallet: '가계부',
    map: '지도',
    translator: '번역기',
  };

  if (topFeature) {
    recommendations.push(`${featureNames[topFeature.feature] || topFeature.feature} 기능을 가장 많이 사용하셨습니다.`);
  }
  if (frequency === '낮음') {
    recommendations.push('다양한 기능을 더 많이 사용하시면 여행을 더욱 편리하게 즐길 수 있습니다.');
  }

  return {
    features,
    topFeature,
    frequency,
    recommendations,
    totalUsage,
  };
}

/**
 * 재구매 점수 계산
 */
export async function generateRePurchaseScore(userId: number) {
  try {
    // 사용자 정보 조회
  const user = await prisma.user.findUnique({
    where: { id: userId },
      select: {
        id: true,
        tripCount: true,
        rePurchaseTriggers: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    });

    // 사용자가 없으면 null 반환
    if (!user) {
      console.log(`[Insights Generator] User ${userId} not found for re_purchase_score`);
      return null;
    }

    // 최신 Trip 조회 (별도 쿼리)
    const latestTrip = await prisma.trip.findFirst({
      where: { userId },
      orderBy: { endDate: 'desc' },
      take: 1,
      select: {
        id: true,
        endDate: true,
    },
  });

    // Trip이 없어도 기본 점수 반환 (최소한의 인사이트 제공)
    if (!latestTrip) {
      console.log(`[Insights Generator] No trips for user ${userId}, returning default re_purchase_score`);
      
      // 기능 사용 정보 조회 (Trip이 없어도 기능 사용 정보는 표시)
      const featureUsages = await prisma.featureUsage.findMany({
        where: { userId },
      });
      const totalFeatureUsage = featureUsages.reduce((sum, u) => sum + u.usageCount, 0);
      
      const features = featureUsages.map((u) => ({
        feature: u.feature,
        usageCount: u.usageCount,
        percentage: totalFeatureUsage > 0 ? Math.round((u.usageCount / totalFeatureUsage) * 100) : 0,
        lastUsed: u.lastUsedAt.toISOString(),
      })).sort((a, b) => b.usageCount - a.usageCount);
      
      const topFeature = features.length > 0 ? features[0] : null;
      
    return {
      score: 0,
      reason: '여행 기록 없음',
      urgency: '낮음',
        factors: {
          tripCount: user.tripCount || 0,
          daysSinceTrip: null,
          featureUsage: 0,
          spendingLevel: 0,
          hasTrigger: user.rePurchaseTriggers.length > 0,
        },
        predictedTiming: '데이터 부족',
        strategies: ['첫 여행을 계획해보세요.'],
        lastTripEnd: null,
        daysSinceTrip: null,
        // 기능 사용 정보 추가
        features: features,
        topFeature: topFeature,
        totalUsage: totalFeatureUsage,
      };
    }

    const lastTripEnd = new Date(latestTrip.endDate);
  const daysSinceTrip = Math.floor((Date.now() - lastTripEnd.getTime()) / (1000 * 60 * 60 * 24));

  // 기능 사용 참여도 계산 (0-1)
  const featureUsages = await prisma.featureUsage.findMany({
    where: { userId },
  });
  const totalFeatureUsage = featureUsages.reduce((sum, u) => sum + u.usageCount, 0);
  const featureEngagement = Math.min(totalFeatureUsage / 100, 1); // 최대 100회 사용 시 1.0

    // 기능별 사용 정보 (차트용)
    const features = featureUsages.map((u) => ({
      feature: u.feature,
      usageCount: u.usageCount,
      percentage: totalFeatureUsage > 0 ? Math.round((u.usageCount / totalFeatureUsage) * 100) : 0,
      lastUsed: u.lastUsedAt.toISOString(),
    })).sort((a, b) => b.usageCount - a.usageCount);

    const topFeature = features.length > 0 ? features[0] : null;
    const totalUsage = totalFeatureUsage;

  // 지출 수준 계산 (0-1)
  const expenses = await prisma.expense.findMany({
    where: { userId },
    select: { krwAmount: true },
  });
  const totalSpending = expenses.reduce((sum, e) => sum + (e.krwAmount || 0), 0);
  const spendingLevel = Math.min(totalSpending / 10000000, 1); // 최대 1천만원 시 1.0

  // 점수 계산 요소
  const factors = {
    tripCount: user.tripCount || 0,
    daysSinceTrip,
    featureUsage: featureEngagement,
    spendingLevel,
    hasTrigger: user.rePurchaseTriggers.length > 0,
  };

  // 점수 계산 (0-100)
  let score = 0;
  score += Math.min(factors.tripCount * 10, 30); // 여행 횟수 (최대 30점)
  score += Math.min(Math.max(0, 30 - factors.daysSinceTrip / 10), 30); // 경과 일수 (최대 30점, 300일 이후 0점)
  score += factors.featureUsage * 20; // 기능 사용 (최대 20점)
  score += factors.spendingLevel * 10; // 지출 수준 (최대 10점)
  score += factors.hasTrigger ? 10 : 0; // 트리거 존재 (10점)

  score = Math.round(Math.max(0, Math.min(100, score)));

  // 재구매 시기 예측
  let predictedTiming = '1-3개월 후';
  if (daysSinceTrip < 30) {
    predictedTiming = '즉시 가능';
  } else if (daysSinceTrip < 90) {
    predictedTiming = '1개월 내';
  } else if (daysSinceTrip < 180) {
    predictedTiming = '3개월 내';
  } else {
    predictedTiming = '6개월 이상 후';
  }

  // 유도 전략
  const strategies: string[] = [];
  if (score >= 70) {
    strategies.push('높은 재구매 가능성입니다. 특별 할인 혜택을 제공하세요.');
    strategies.push('다음 여행 상품을 추천해 주세요.');
  } else if (score >= 40) {
    strategies.push('재구매 가능성이 보통입니다. 정기적인 여행 정보를 제공하세요.');
  } else {
    strategies.push('재구매 가능성이 낮습니다. 새로운 여행 경험을 소개해 주세요.');
  }

  return {
    score,
    factors,
    predictedTiming,
    strategies,
    urgency: score >= 70 ? '높음' : score >= 40 ? '보통' : '낮음',
    lastTripEnd: lastTripEnd.toISOString(),
    daysSinceTrip,
      // 기능 사용 정보 추가
      features: features,
      topFeature: topFeature,
      totalUsage: totalUsage,
    };
  } catch (error) {
    console.error(`[Insights Generator] Error in generateRePurchaseScore for user ${userId}:`, error);
    console.error(`[Insights Generator] Error details:`, error instanceof Error ? error.stack : String(error));
    // 에러가 발생해도 기본값 반환
    return {
      score: 0,
      reason: '오류 발생',
      urgency: '낮음',
      factors: {
        tripCount: 0,
        daysSinceTrip: null,
        featureUsage: 0,
        spendingLevel: 0,
        hasTrigger: false,
      },
      predictedTiming: '데이터 부족',
      strategies: ['데이터를 확인해주세요.'],
      lastTripEnd: null,
      daysSinceTrip: null,
      // 기능 사용 정보 추가 (에러 발생 시 빈 배열)
      features: [],
      topFeature: null,
      totalUsage: 0,
    };
  }
}

/**
 * 고객 참여도 점수 계산
 */
export async function generateEngagementScore(userId: number) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        lastActiveAt: true,
        loginCount: true,
        createdAt: true,
      },
    });

    if (!user) {
      return null;
    }

    // 로그인 빈도 계산
    const daysSinceJoin = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const loginFrequency = daysSinceJoin > 0 ? user.loginCount / daysSinceJoin : 0;

    // 최근 활동성 계산
    const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt) : null;
    const daysSinceLastActive = lastActive 
      ? Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // 기능 사용 빈도
    const featureUsages = await prisma.featureUsage.findMany({
      where: { userId },
    });
    const totalFeatureUsage = featureUsages.reduce((sum, u) => sum + (u.usageCount || 0), 0);

    // 채팅 빈도
    const chatHistories = await prisma.chatHistory.findMany({
      where: { userId },
    });
    const totalChats = chatHistories.length;

    // 참여도 점수 계산 (0-100)
    let score = 0;
    score += Math.min(loginFrequency * 20, 30); // 로그인 빈도 (최대 30점)
    score += Math.min(Math.max(0, 30 - daysSinceLastActive / 5), 30); // 최근 활동성 (최대 30점, 150일 이후 0점)
    score += Math.min(totalFeatureUsage / 10, 20); // 기능 사용 (최대 20점)
    score += Math.min(totalChats / 5, 20); // 채팅 빈도 (최대 20점)

    score = Math.round(Math.max(0, Math.min(100, score)));

    // 참여도 등급
    let level = '낮음';
    if (score >= 70) {
      level = '매우 높음';
    } else if (score >= 50) {
      level = '높음';
    } else if (score >= 30) {
      level = '보통';
    }

    // 소통 전략
    const strategies: string[] = [];
    if (score >= 70) {
      strategies.push('매우 활발한 고객입니다. VIP 혜택을 제공하세요.');
      strategies.push('신규 상품을 우선적으로 알려주세요.');
    } else if (score >= 50) {
      strategies.push('활발한 고객입니다. 정기적인 소통을 유지하세요.');
    } else if (score >= 30) {
      strategies.push('참여도가 보통입니다. 관심 있는 콘텐츠를 제공하세요.');
    } else {
      strategies.push('참여도가 낮습니다. 재활성화 캠페인을 고려하세요.');
    }

    return {
      score,
      level,
      loginFrequency: Math.round(loginFrequency * 100) / 100,
      daysSinceLastActive,
      totalFeatureUsage,
      totalChats,
      strategies,
    };
  } catch (error) {
    console.error(`[Insights Generator] Error in generateEngagementScore for user ${userId}:`, error);
    return null;
  }
}

/**
 * 고객 만족도 점수 계산
 */
export async function generateSatisfactionScore(userId: number) {
  try {
    // TripFeedback 조회
    const feedbacks = await prisma.tripFeedback.findMany({
      where: { userId },
      select: {
        satisfactionScore: true,
        improvementComments: true,
        createdAt: true,
      },
    });

    if (feedbacks.length === 0) {
      return null;
    }

    // 평균 만족도 계산
    const avgSatisfaction = feedbacks.reduce((sum, f) => sum + (f.satisfactionScore || 0), 0) / feedbacks.length;
    
    // 만족도 등급
    let level = '보통';
    if (avgSatisfaction >= 4.5) {
      level = '매우 만족';
    } else if (avgSatisfaction >= 4.0) {
      level = '만족';
    } else if (avgSatisfaction >= 3.0) {
      level = '보통';
    } else {
      level = '불만족';
    }

    // 개선 의견 분석
    const hasImprovementComments = feedbacks.some(f => f.improvementComments && f.improvementComments.trim().length > 0);
    const improvementCommentCount = feedbacks.filter(f => f.improvementComments && f.improvementComments.trim().length > 0).length;

    // 소통 전략
    const strategies: string[] = [];
    if (avgSatisfaction >= 4.5) {
      strategies.push('매우 만족한 고객입니다. 추천 프로그램에 참여시키세요.');
      strategies.push('후기 작성을 요청하세요.');
    } else if (avgSatisfaction >= 4.0) {
      strategies.push('만족한 고객입니다. 추가 서비스를 제공하세요.');
    } else if (avgSatisfaction >= 3.0) {
      strategies.push('보통 만족도입니다. 개선 사항을 확인하세요.');
    } else {
      strategies.push('불만족 고객입니다. 즉시 개선 조치를 취하세요.');
      strategies.push('개인 맞춤 상담을 제공하세요.');
    }

    if (hasImprovementComments) {
      strategies.push(`${improvementCommentCount}개의 개선 의견이 있습니다. 검토가 필요합니다.`);
    }

    return {
      score: Math.round(avgSatisfaction * 10) / 10,
      level,
      feedbackCount: feedbacks.length,
      hasImprovementComments,
      improvementCommentCount,
      strategies,
      latestFeedback: feedbacks[feedbacks.length - 1]?.satisfactionScore || null,
    };
  } catch (error) {
    console.error(`[Insights Generator] Error in generateSatisfactionScore for user ${userId}:`, error);
    return null;
  }
}

/**
 * 고객 라이프사이클 단계 분석
 */
export async function generateLifecycleStage(userId: number) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
        lastActiveAt: true,
        tripCount: true,
        isHibernated: true,
        isLocked: true,
      },
    });

    if (!user) {
      return null;
    }

    const daysSinceJoin = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt) : null;
    const daysSinceLastActive = lastActive 
      ? Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // 최신 여행 조회
    const latestTrip = await prisma.trip.findFirst({
      where: { userId },
      orderBy: { endDate: 'desc' },
      select: { endDate: true },
    });

    const daysSinceTrip = latestTrip 
      ? Math.floor((Date.now() - new Date(latestTrip.endDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // 라이프사이클 단계 결정
    let stage = '신규';
    let description = '';

    if (user.isLocked) {
      stage = '잠금';
      description = '계정이 잠금 처리되었습니다.';
    } else if (user.isHibernated) {
      stage = '동면';
      description = '장기간 미활동으로 동면 상태입니다.';
    } else if (daysSinceJoin < 30 && user.tripCount === 0) {
      stage = '신규';
      description = '최근 가입한 신규 고객입니다.';
    } else if (user.tripCount === 0) {
      stage = '이탈 위험';
      description = '가입 후 여행을 등록하지 않았습니다.';
    } else if (daysSinceLastActive > 90) {
      stage = '이탈 위험';
      description = '90일 이상 활동이 없습니다.';
    } else if (daysSinceTrip && daysSinceTrip > 180) {
      stage = '재활성화 필요';
      description = '마지막 여행 종료 후 6개월 이상 경과했습니다.';
    } else if (user.tripCount >= 2) {
      stage = '충성 고객';
      description = '2회 이상 여행한 충성 고객입니다.';
    } else if (daysSinceLastActive < 30) {
      stage = '활성';
      description = '최근 30일 내 활동이 있는 활성 고객입니다.';
    } else {
      stage = '일반';
      description = '일반 고객입니다.';
    }

    // 단계별 소통 전략
    const strategies: string[] = [];
    switch (stage) {
      case '신규':
        strategies.push('온보딩 프로세스를 안내하세요.');
        strategies.push('첫 여행 계획을 도와주세요.');
        break;
      case '활성':
        strategies.push('정기적인 여행 정보를 제공하세요.');
        strategies.push('추가 서비스를 소개하세요.');
        break;
      case '충성 고객':
        strategies.push('VIP 혜택을 제공하세요.');
        strategies.push('추천 프로그램에 참여시키세요.');
        break;
      case '재활성화 필요':
        strategies.push('특별 할인 혜택을 제공하세요.');
        strategies.push('새로운 여행 상품을 추천하세요.');
        break;
      case '이탈 위험':
        strategies.push('즉시 재활성화 캠페인을 진행하세요.');
        strategies.push('개인 맞춤 상담을 제공하세요.');
        break;
      case '동면':
        strategies.push('장기 미활동 고객입니다. 재활성화 전략이 필요합니다.');
        break;
    }

    return {
      stage,
      description,
      daysSinceJoin,
      daysSinceLastActive,
      daysSinceTrip,
      tripCount: user.tripCount,
      strategies,
    };
  } catch (error) {
    console.error(`[Insights Generator] Error in generateLifecycleStage for user ${userId}:`, error);
    return null;
  }
}

/**
 * 선호 크루즈 분석
 */
export async function generateCruisePreference(userId: number) {
  try {
    const trips = await prisma.trip.findMany({
      where: { userId },
      select: {
        cruiseName: true,
        productId: true,
      },
    });

    if (trips.length === 0) {
      return null;
    }

    // 크루즈 라인 추출
    const cruiseLines: Record<string, number> = {};
    const cruiseNames: Record<string, number> = {};

    trips.forEach(trip => {
      if (trip.cruiseName) {
        // 크루즈명에서 크루즈 라인 추출 (예: "MSC Bellissima" -> "MSC")
        const parts = trip.cruiseName.split(' ');
        if (parts.length > 0) {
          const cruiseLine = parts[0];
          cruiseLines[cruiseLine] = (cruiseLines[cruiseLine] || 0) + 1;
        }
        cruiseNames[trip.cruiseName] = (cruiseNames[trip.cruiseName] || 0) + 1;
      }
    });

    // 선호 크루즈 라인
    const preferredCruiseLine = Object.entries(cruiseLines)
      .sort(([, a], [, b]) => b - a)[0];

    // 선호 크루즈명
    const preferredCruiseName = Object.entries(cruiseNames)
      .sort(([, a], [, b]) => b - a)[0];

    // 상품 정보 조회 (선택적)
    let preferredProductInfo = null;
    if (preferredCruiseName && trips[0]?.productId) {
      try {
        const product = await prisma.cruiseProduct.findUnique({
          where: { id: trips[0].productId },
          select: {
            cruiseLine: true,
            shipName: true,
            packageName: true,
          },
        });
        if (product) {
          preferredProductInfo = product;
        }
      } catch (e) {
        // 상품 정보 조회 실패는 무시
      }
    }

    // 추천 전략
    const strategies: string[] = [];
    if (preferredCruiseLine) {
      strategies.push(`${preferredCruiseLine[0]} 크루즈 라인을 선호합니다.`);
      strategies.push(`같은 크루즈 라인의 새로운 선박을 추천하세요.`);
    }
    if (preferredCruiseName) {
      strategies.push(`${preferredCruiseName[0]} 크루즈를 다시 이용할 가능성이 높습니다.`);
    }

    return {
      preferredCruiseLine: preferredCruiseLine ? {
        name: preferredCruiseLine[0],
        count: preferredCruiseLine[1],
        percentage: Math.round((preferredCruiseLine[1] / trips.length) * 100),
      } : null,
      preferredCruiseName: preferredCruiseName ? {
        name: preferredCruiseName[0],
        count: preferredCruiseName[1],
        percentage: Math.round((preferredCruiseName[1] / trips.length) * 100),
      } : null,
      totalTrips: trips.length,
      productInfo: preferredProductInfo,
      strategies,
    };
  } catch (error) {
    console.error(`[Insights Generator] Error in generateCruisePreference for user ${userId}:`, error);
    return null;
  }
}

/**
 * 소통 선호도 분석
 */
export async function generateCommunicationPreference(userId: number) {
  try {
    // 채팅 히스토리 분석
    const chatHistories = await prisma.chatHistory.findMany({
      where: { userId },
      select: {
        messages: true,
        createdAt: true,
      },
    });

    const totalChats = chatHistories.length;
    let totalMessages = 0;
    const chatTimes: number[] = [];

    chatHistories.forEach(history => {
      if (Array.isArray(history.messages)) {
        totalMessages += history.messages.length;
      }
      chatTimes.push(new Date(history.createdAt).getHours());
    });

    // 평균 채팅 시간대 분석
    const avgChatHour = chatTimes.length > 0
      ? Math.round(chatTimes.reduce((sum, h) => sum + h, 0) / chatTimes.length)
      : null;

    // 선호 채팅 시간대
    let preferredTimeSlot = '알 수 없음';
    if (avgChatHour !== null) {
      if (avgChatHour >= 6 && avgChatHour < 12) {
        preferredTimeSlot = '오전 (6시-12시)';
      } else if (avgChatHour >= 12 && avgChatHour < 18) {
        preferredTimeSlot = '오후 (12시-18시)';
      } else if (avgChatHour >= 18 && avgChatHour < 22) {
        preferredTimeSlot = '저녁 (18시-22시)';
      } else {
        preferredTimeSlot = '심야 (22시-6시)';
      }
    }

    // 메시지 응답률 (AdminMessage 읽음 여부)
    const adminMessages = await prisma.adminMessage.findMany({
      where: { userId },
      include: {
        UserMessageRead: {
          where: { userId },
        },
      },
    });

    const totalAdminMessages = adminMessages.length;
    const readMessages = adminMessages.filter(m => m.UserMessageRead.length > 0).length;
    const responseRate = totalAdminMessages > 0
      ? Math.round((readMessages / totalAdminMessages) * 100)
      : 0;

    // 소통 선호도 등급
    let communicationLevel = '보통';
    if (totalChats >= 20 && responseRate >= 70) {
      communicationLevel = '매우 높음';
    } else if (totalChats >= 10 && responseRate >= 50) {
      communicationLevel = '높음';
    } else if (totalChats >= 5) {
      communicationLevel = '보통';
    } else {
      communicationLevel = '낮음';
    }

    // 소통 전략
    const strategies: string[] = [];
    if (communicationLevel === '매우 높음') {
      strategies.push('매우 활발한 소통을 하는 고객입니다. 정기적인 업데이트를 제공하세요.');
    } else if (communicationLevel === '높음') {
      strategies.push('활발한 소통을 하는 고객입니다. 중요한 정보를 우선 전달하세요.');
    } else if (communicationLevel === '보통') {
      strategies.push('보통 수준의 소통을 하는 고객입니다. 필요한 정보만 선별하여 전달하세요.');
    } else {
      strategies.push('소통이 적은 고객입니다. 간결하고 명확한 메시지를 보내세요.');
    }

    if (preferredTimeSlot !== '알 수 없음') {
      strategies.push(`선호 소통 시간대: ${preferredTimeSlot}`);
    }

    if (responseRate < 50 && totalAdminMessages > 0) {
      strategies.push(`메시지 응답률이 낮습니다 (${responseRate}%). 더 매력적인 콘텐츠를 제공하세요.`);
    }

    return {
      totalChats,
      totalMessages,
      avgMessagesPerChat: totalChats > 0 ? Math.round(totalMessages / totalChats) : 0,
      preferredTimeSlot,
      responseRate,
      communicationLevel,
      strategies,
    };
  } catch (error) {
    console.error(`[Insights Generator] Error in generateCommunicationPreference for user ${userId}:`, error);
    return null;
  }
}

/**
 * 모든 인사이트 생성
 */
export async function generateAllInsights(userId: number) {
  console.log(`[Insights Generator] Starting insight generation for user ${userId}`);
  
  // 사용자 데이터 확인
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, phone: true },
  });
  
  if (!user) {
    console.error(`[Insights Generator] User ${userId} not found`);
    return [];
  }
  
  console.log(`[Insights Generator] User found: ${user.name || user.phone || userId}`);
  
  // 각 데이터 존재 여부 확인
  const tripCount = await prisma.trip.count({ where: { userId } });
  const expenseCount = await prisma.expense.count({ where: { userId } });
  const featureUsageCount = await prisma.featureUsage.count({ where: { userId } });
  
  console.log(`[Insights Generator] Data counts for user ${userId}:`, {
    trips: tripCount,
    expenses: expenseCount,
    featureUsages: featureUsageCount,
  });
  
  const insights = await Promise.allSettled([
    generateDestinationPreference(userId).then((data) => {
      console.log(`[Insights Generator] destination_preference for user ${userId}:`, data ? 'generated' : 'null');
      return {
      type: 'destination_preference',
      data,
      };
    }),
    generateSpendingPattern(userId).then((data) => {
      console.log(`[Insights Generator] spending_pattern for user ${userId}:`, data ? 'generated' : 'null');
      return {
      type: 'spending_pattern',
      data,
      };
    }),
    generateFeatureUsage(userId).then((data) => {
      console.log(`[Insights Generator] feature_usage for user ${userId}:`, data ? 'generated' : 'null');
      return {
      type: 'feature_usage',
      data,
      };
    }),
    generateRePurchaseScore(userId).then((data) => {
      console.log(`[Insights Generator] re_purchase_score for user ${userId}:`, data ? 'generated' : 'null');
      return {
      type: 're_purchase_score',
      data,
      };
    }),
    // 새로운 인사이트 추가
    generateEngagementScore(userId).then((data) => {
      console.log(`[Insights Generator] engagement_score for user ${userId}:`, data ? 'generated' : 'null');
      return {
        type: 'engagement_score',
        data,
      };
    }),
    generateSatisfactionScore(userId).then((data) => {
      console.log(`[Insights Generator] satisfaction_score for user ${userId}:`, data ? 'generated' : 'null');
      return {
        type: 'satisfaction_score',
        data,
      };
    }),
    generateLifecycleStage(userId).then((data) => {
      console.log(`[Insights Generator] lifecycle_stage for user ${userId}:`, data ? 'generated' : 'null');
      return {
        type: 'lifecycle_stage',
        data,
      };
    }),
    generateCruisePreference(userId).then((data) => {
      console.log(`[Insights Generator] cruise_preference for user ${userId}:`, data ? 'generated' : 'null');
      return {
        type: 'cruise_preference',
        data,
      };
    }),
    generateCommunicationPreference(userId).then((data) => {
      console.log(`[Insights Generator] communication_preference for user ${userId}:`, data ? 'generated' : 'null');
      return {
        type: 'communication_preference',
        data,
      };
    }),
  ]);

  const results: Array<{ type: string; data: any }> = [];

  insights.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value.data !== null) {
        console.log(`[Insights Generator] Adding insight ${result.value.type} for user ${userId}`);
      results.push(result.value);
      } else {
        console.log(`[Insights Generator] Skipping insight ${result.value.type} for user ${userId} (data is null)`);
      }
    } else if (result.status === 'rejected') {
      console.error(`[Insights Generator] Failed to generate insight ${index} for user ${userId}:`, result.reason);
    }
  });

  console.log(`[Insights Generator] Generated ${results.length} insights for user ${userId}`);
  return results;
}
