import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 대리점장-판매원 관계 캐싱 유틸리티
 * 
 * 성능 최적화를 위해 관계 조회 결과를 캐싱합니다.
 * 관계가 변경될 때만 캐시를 무효화합니다.
 */

// 메모리 캐시 (서버 재시작 시 초기화됨)
const relationCache = new Map<number, {
  agentIds: number[];
  timestamp: number;
}>();

// 캐시 TTL (5분)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 대리점장이 관리하는 판매원 ID 목록 조회 (캐싱 적용)
 * 
 * @param managerId 대리점장 프로필 ID
 * @param forceRefresh 캐시 무시하고 강제 새로고침
 * @returns 판매원 프로필 ID 배열
 */
export async function getManagedAgentIds(
  managerId: number,
  forceRefresh: boolean = false
): Promise<number[]> {
  const cacheKey = managerId;
  const cached = relationCache.get(cacheKey);

  // 캐시가 유효하고 강제 새로고침이 아닌 경우 캐시 반환
  if (!forceRefresh && cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    logger.log(`[Relation Cache] Cache hit for manager ${managerId}`);
    return cached.agentIds;
  }

  // 캐시 미스 또는 만료된 경우 DB 조회
  logger.log(`[Relation Cache] Cache miss for manager ${managerId}, fetching from DB`);
  
  const relations = await prisma.affiliateRelation.findMany({
    where: {
      managerId,
      status: 'ACTIVE',
    },
    select: {
      agentId: true,
    },
  });

  const agentIds = relations.map(r => r.agentId);

  // 캐시 업데이트
  relationCache.set(cacheKey, {
    agentIds,
    timestamp: Date.now(),
  });

  return agentIds;
}

/**
 * 여러 대리점장의 판매원 ID 목록을 한 번에 조회 (배치 최적화)
 * 
 * @param managerIds 대리점장 프로필 ID 배열
 * @returns managerId를 키로 하는 Map<number, number[]>
 */
export async function getManagedAgentIdsBatch(
  managerIds: number[]
): Promise<Map<number, number[]>> {
  const result = new Map<number, number[]>();
  const uncachedManagerIds: number[] = [];

  // 캐시에서 먼저 확인
  for (const managerId of managerIds) {
    const cached = relationCache.get(managerId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      result.set(managerId, cached.agentIds);
    } else {
      uncachedManagerIds.push(managerId);
    }
  }

  // 캐시에 없는 것만 DB 조회
  if (uncachedManagerIds.length > 0) {
    const relations = await prisma.affiliateRelation.findMany({
      where: {
        managerId: { in: uncachedManagerIds },
        status: 'ACTIVE',
      },
      select: {
        managerId: true,
        agentId: true,
      },
    });

    // managerId별로 그룹화
    const relationsByManager = new Map<number, number[]>();
    for (const relation of relations) {
      if (!relationsByManager.has(relation.managerId)) {
        relationsByManager.set(relation.managerId, []);
      }
      relationsByManager.get(relation.managerId)!.push(relation.agentId);
    }

    // 결과에 추가하고 캐시 업데이트
    for (const managerId of uncachedManagerIds) {
      const agentIds = relationsByManager.get(managerId) || [];
      result.set(managerId, agentIds);
      
      // 캐시 업데이트
      relationCache.set(managerId, {
        agentIds,
        timestamp: Date.now(),
      });
    }
  }

  return result;
}

/**
 * 특정 대리점장의 관계 캐시 무효화
 * 
 * @param managerId 대리점장 프로필 ID
 */
export function invalidateManagerCache(managerId: number): void {
  relationCache.delete(managerId);
  logger.log(`[Relation Cache] Cache invalidated for manager ${managerId}`);
}

/**
 * 모든 관계 캐시 무효화
 */
export function clearAllCache(): void {
  relationCache.clear();
  logger.log('[Relation Cache] All cache cleared');
}

/**
 * 판매원이 속한 대리점장 ID 조회 (캐싱 적용)
 * 
 * @param agentId 판매원 프로필 ID
 * @param forceRefresh 캐시 무시하고 강제 새로고침
 * @returns 대리점장 프로필 ID (없으면 null)
 */
export async function getManagerIdForAgent(
  agentId: number,
  forceRefresh: boolean = false
): Promise<number | null> {
  // 판매원의 대리점장은 보통 1명이므로 간단한 캐시 사용
  // 캐시 키를 숫자로 변환 (agentId를 음수로 사용하여 구분)
  const cacheKey = -agentId;
  const cached = relationCache.get(cacheKey);

  if (!forceRefresh && cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.agentIds[0] || null; // agentIds를 재사용하여 managerId 저장
  }

  const relation = await prisma.affiliateRelation.findFirst({
    where: {
      agentId,
      status: 'ACTIVE',
    },
    select: {
      managerId: true,
    },
  });

  const managerId = relation?.managerId || null;

  // 캐시 업데이트 (agentIds 배열에 managerId 저장)
  relationCache.set(cacheKey, {
    agentIds: managerId ? [managerId] : [],
    timestamp: Date.now(),
  });

  return managerId;
}

