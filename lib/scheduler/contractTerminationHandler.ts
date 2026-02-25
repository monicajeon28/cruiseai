// lib/scheduler/contractTerminationHandler.ts
// 계약 해지 후 DB 회수 처리
// - 판매원: 재계약 거부 통보 후 1일 후 대리점장으로 회수
// - 대리점장: 재계약 거부 시 즉시 본사로 회수

import prisma from '@/lib/prisma';
import { logDbRecoveryAudit } from '@/lib/affiliate/audit-log';
import { notifyDbRecoveryFailed } from '@/lib/affiliate/admin-notifications';

/**
 * 배열을 배치로 나누기
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * 계약 해지 후 DB 회수 처리
 * 매일 새벽 3시 실행
 */
export async function recoverDbFromTerminatedContracts() {
  try {
    console.log('[ContractTermination] 🔄 Starting DB recovery check...');

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1일 전

    // 해지된 계약서 중 아직 DB가 회수되지 않은 것들 조회
    const terminatedContracts = await prisma.affiliateContract.findMany({
      where: {
        status: 'terminated',
        metadata: {
          path: ['terminatedAt'],
          not: null,
        },
      },
      include: {
        User_AffiliateContract_userIdToUser: {
          select: {
            id: true,
          },
        },
        AffiliateProfile: {
          select: {
            id: true,
            type: true,
            userId: true,
          },
        },
      },
    });

    console.log(`[ContractTermination] Found ${terminatedContracts.length} terminated contract(s)`);

    let recoveredCount = 0;

    for (const contract of terminatedContracts) {
      const metadata = contract.metadata as any;
      const terminatedAt = metadata?.terminatedAt ? new Date(metadata.terminatedAt) : null;
      const dbRecovered = metadata?.dbRecovered || false;
      const retryCount = metadata?.retryCount || 0;
      const maxRetries = 3;
      const lastRetryAt = metadata?.lastRetryAt ? new Date(metadata.lastRetryAt) : null;

      // 이미 회수된 경우 스킵
      if (dbRecovered) continue;
      if (!terminatedAt) continue;

      if (!contract.AffiliateProfile) {
        console.log(`[ContractTermination] Skipping contract ${contract.id} - no profile`);
        continue;
      }

      // 최대 재시도 횟수 초과 시 스킵 (관리자 수동 재시도 필요)
      if (retryCount >= maxRetries) {
        console.log(`[ContractTermination] Contract ${contract.id} - max retries exceeded (${retryCount}), skipping`);
        // 관리자 알림은 이미 기록되었을 것이므로 스킵
        continue;
      }

      // Exponential backoff: 재시도 간격 확인
      if (retryCount > 0 && lastRetryAt) {
        const backoffMinutes = Math.pow(2, retryCount - 1); // 1분, 2분, 4분
        const nextRetryTime = new Date(lastRetryAt.getTime() + backoffMinutes * 60 * 1000);
        
        if (now < nextRetryTime) {
          const minutesUntilRetry = Math.ceil((nextRetryTime.getTime() - now.getTime()) / (1000 * 60));
          console.log(`[ContractTermination] Contract ${contract.id} - waiting for backoff (${minutesUntilRetry} minutes remaining)`);
          continue;
        }
      }

      try {
        // 대리점장인 경우: 즉시 본사로 회수 (이미 회수되었으면 스킵)
        if (contract.AffiliateProfile.type === 'BRANCH_MANAGER') {
          // 재계약 거부 시 즉시 회수되므로, 스케줄러에서는 이미 회수된 경우만 처리
          if (!dbRecovered) {
            await recoverBranchManagerDb(contract, now);
            // 성공 시 재시도 카운터 리셋
            if (retryCount > 0) {
              await prisma.affiliateContract.update({
                where: { id: contract.id },
                data: {
                  metadata: {
                    ...metadata,
                    retryCount: 0,
                    lastRetryAt: null,
                    retryErrors: [],
                  },
                },
              });
            }
            recoveredCount++;
          }
          continue;
        }

        // 판매원인 경우: 1일 후 대리점장으로 회수
        if (contract.AffiliateProfile.type === 'SALES_AGENT') {
          // 해지일이 1일 이상 지났는지 확인
          if (terminatedAt > oneDayAgo) {
            console.log(`[ContractTermination] Contract ${contract.id} - waiting for 1 day (agent)`);
            continue;
          }
          
          await recoverSalesAgentDb(contract, now);
          // 성공 시 재시도 카운터 리셋
          if (retryCount > 0) {
            await prisma.affiliateContract.update({
              where: { id: contract.id },
              data: {
                metadata: {
                  ...metadata,
                  retryCount: 0,
                  lastRetryAt: null,
                  retryErrors: [],
                },
              },
            });
          }
          recoveredCount++;
          continue;
        }
      } catch (error: any) {
        // 에러 발생 시 재시도 로직
        const newRetryCount = retryCount + 1;
        const errorMessage = error.message || String(error);
        
        console.error(`[ContractTermination] ❌ DB recovery failed for contract ${contract.id} (attempt ${newRetryCount}/${maxRetries}):`, errorMessage);

        // 에러 정보 업데이트
        await prisma.affiliateContract.update({
          where: { id: contract.id },
          data: {
            metadata: {
              ...metadata,
              retryCount: newRetryCount,
              lastRetryAt: now.toISOString(),
              retryErrors: [
                ...(metadata?.retryErrors || []),
                {
                  attempt: newRetryCount,
                  error: errorMessage,
                  timestamp: now.toISOString(),
                },
              ],
            },
          },
        });

        // 최대 재시도 횟수 초과 시 관리자 알림
        if (newRetryCount >= maxRetries) {
          console.error(`[ContractTermination] ⚠️ Max retries exceeded for contract ${contract.id}, notifying admin`);
          
          // 관리자 계정 찾기
          const adminUser = await prisma.user.findFirst({
            where: { role: 'admin' },
            select: { id: true },
          });

          if (adminUser) {
            // 관리자 알림 기록
            await prisma.adminActionLog.create({
              data: {
                adminId: adminUser.id,
                targetUserId: contract.userId || null,
                action: 'affiliate.contract.recovery_failed',
                details: {
                  contractId: contract.id,
                  contractType: contract.AffiliateProfile?.type,
                  terminatedAt: terminatedAt?.toISOString(),
                  retryCount: newRetryCount,
                  errors: [
                    ...(metadata?.retryErrors || []),
                    {
                      attempt: newRetryCount,
                      error: errorMessage,
                      timestamp: now.toISOString(),
                    },
                  ],
                  message: `계약 해지 후 DB 회수 실패 (재시도 ${newRetryCount}회 실패)`,
                },
              },
            }).catch((logError) => {
              console.error('[ContractTermination] Failed to create admin log:', logError);
            });
          }
          
          // 즉시 알림 전송
          await notifyDbRecoveryFailed(
            contract.id,
            contract.AffiliateProfile?.type || 'UNKNOWN',
            errorMessage,
            newRetryCount
          );
        }
      }
    }

    console.log(`[ContractTermination] ✅ DB recovery check completed: ${recoveredCount} contract(s) processed`);
    return { recoveredCount };
  } catch (error) {
    console.error('[ContractTermination] ❌ DB recovery check failed:', error);
    throw error;
  }
}

/**
 * 판매원 DB 회수: 대리점장으로 이전
 */
export async function recoverSalesAgentDb(contract: any, now: Date) {
  const metadata = contract.metadata as any;
  const agentProfileId = contract.AffiliateProfile.id;

  // 트랜잭션으로 원자적 처리
  await prisma.$transaction(async (tx) => {
    // 이미 회수되었는지 다시 확인 (동시성 방지)
    const currentContract = await tx.affiliateContract.findUnique({
      where: { id: contract.id },
      select: { metadata: true },
    });
    
    const currentMetadata = currentContract?.metadata as any;
    if (currentMetadata?.dbRecovered) {
      console.log(`[ContractTermination] Contract ${contract.id} already recovered, skipping`);
      return;
    }

    // 판매원의 대리점장 찾기
    const relation = await tx.affiliateRelation.findFirst({
      where: {
        agentId: agentProfileId,
        status: 'ACTIVE',
      },
      include: {
        AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!relation?.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile) {
      console.log(`[ContractTermination] No manager found for agent ${agentProfileId}`);
      // DB 회수 상태만 업데이트
      await tx.affiliateContract.update({
        where: { id: contract.id },
        data: {
          metadata: {
            ...metadata,
            dbRecovered: true,
            dbRecoveredAt: now.toISOString(),
          },
        },
      });
      return;
    }

    const managerProfileId = relation.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile.id;

    // 판매원의 고객 DB를 대리점장으로 이전 (배치 처리)
    const BATCH_SIZE = 100;

    // 1. AffiliateLead의 agentId를 managerId로 변경
    const leads = await tx.affiliateLead.findMany({
      where: {
        agentId: agentProfileId,
      },
      select: {
        id: true,
        metadata: true,
      },
    });

    const leadBatches = chunkArray(leads, BATCH_SIZE);
    for (const batch of leadBatches) {
      await Promise.all(
        batch.map(async (lead: { id: number; metadata: any }) => {
          const leadMetadata = (lead.metadata as any) || {};
          await tx.affiliateLead.update({
            where: { id: lead.id },
            data: {
              agentId: null,
              managerId: managerProfileId,
              metadata: {
                ...leadMetadata,
                recoveredFromAgent: agentProfileId,
                recoveredAt: now.toISOString(),
              },
            },
          });
        })
      );
    }

    // 2. AffiliateSale의 agentId를 null로, managerId를 managerProfileId로 변경
    const sales = await tx.affiliateSale.findMany({
      where: {
        agentId: agentProfileId,
      },
      select: {
        id: true,
        metadata: true,
      },
    });

    const saleBatches = chunkArray(sales, BATCH_SIZE);
    for (const batch of saleBatches) {
      await Promise.all(
        batch.map(async (sale: { id: number; metadata: any }) => {
          const saleMetadata = (sale.metadata as any) || {};
          await tx.affiliateSale.update({
            where: { id: sale.id },
            data: {
              agentId: null,
              managerId: managerProfileId,
              salesCommission: null, // 판매원 수당 제거
              metadata: {
                ...saleMetadata,
                recoveredFromAgent: agentProfileId,
                recoveredAt: now.toISOString(),
              },
            },
          });
        })
      );
    }

    // 3. AffiliateLink의 agentId를 null로, managerId를 managerProfileId로 변경
    const links = await tx.affiliateLink.findMany({
      where: {
        agentId: agentProfileId,
      },
      select: {
        id: true,
        metadata: true,
      },
    });

    const linkBatches = chunkArray(links, BATCH_SIZE);
    for (const batch of linkBatches) {
      await Promise.all(
        batch.map(async (link: { id: number; metadata: any }) => {
          const linkMetadata = (link.metadata as any) || {};
          await tx.affiliateLink.update({
            where: { id: link.id },
            data: {
              agentId: null,
              managerId: managerProfileId,
              metadata: {
                ...linkMetadata,
                recoveredFromAgent: agentProfileId,
                recoveredAt: now.toISOString(),
              },
            },
          });
        })
      );
    }

    // 4. 계약서 metadata에 DB 회수 완료 표시
    await tx.affiliateContract.update({
      where: { id: contract.id },
      data: {
        metadata: {
          ...metadata,
          dbRecovered: true,
          dbRecoveredAt: now.toISOString(),
          recoveredToManager: managerProfileId,
          recoveredLeadsCount: leads.length,
          recoveredSalesCount: sales.length,
          recoveredLinksCount: links.length,
        },
      },
    });

    // DB 회수 감사 로그
    await logDbRecoveryAudit(
      'RECOVERED',
      {
        contractId: contract.id,
        profileId: agentProfileId,
        userId: contract.userId || null,
        performedBySystem: true,
        details: {
          recoveryType: 'SALES_AGENT_TO_MANAGER',
          recoveredToManager: managerProfileId,
          recoveredLeadsCount: leads.length,
          recoveredSalesCount: sales.length,
          recoveredLinksCount: links.length,
          recoveredAt: now.toISOString(),
        },
      },
      tx
    );

    console.log(`[ContractTermination] ✅ Agent DB recovered: contract ${contract.id} (agent ${agentProfileId} -> manager ${managerProfileId}, leads: ${leads.length}, sales: ${sales.length}, links: ${links.length})`);
  }, {
    timeout: 30000, // 30초 타임아웃
  });
}

/**
 * 대리점장 DB 회수: 본사로 이전 + 판매원들도 본사 소속으로 변경
 */
export async function recoverBranchManagerDb(contract: any, now: Date) {
  const metadata = contract.metadata as any;
  const managerProfileId = contract.AffiliateProfile.id;

  // 트랜잭션으로 원자적 처리
  await prisma.$transaction(async (tx) => {
    // 이미 회수되었는지 다시 확인 (동시성 방지)
    const currentContract = await tx.affiliateContract.findUnique({
      where: { id: contract.id },
      select: { metadata: true },
    });
    
    const currentMetadata = currentContract?.metadata as any;
    if (currentMetadata?.dbRecovered) {
      console.log(`[ContractTermination] Contract ${contract.id} already recovered, skipping`);
      return;
    }

    // 본사(HQ) 프로필 찾기 또는 자동 생성
    let hqProfile = await tx.affiliateProfile.findFirst({
      where: {
        type: 'HQ',
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!hqProfile) {
      console.log(`[ContractTermination] HQ profile not found, creating automatically...`);
      
      // 관리자 계정 찾기 (role='admin'인 첫 번째 사용자)
      let adminUser = await tx.user.findFirst({
        where: {
          role: 'admin',
        },
        select: {
          id: true,
        },
      });

      // 관리자 계정이 없으면 생성
      if (!adminUser) {
        console.log(`[ContractTermination] Admin user not found, creating...`);
        adminUser = await tx.user.create({
          data: {
            name: '본사 관리자',
            email: 'hq@cruiseguide.kr',
            phone: '00000000000',
            password: 'admin', // 기본 비밀번호 (변경 권장)
            role: 'admin',
            onboarded: true,
          },
          select: {
            id: true,
          },
        });
        console.log(`[ContractTermination] Admin user created: ${adminUser.id}`);
      }

      // HQ 프로필 생성
      hqProfile = await tx.affiliateProfile.create({
        data: {
          userId: adminUser.id,
          affiliateCode: 'HQ',
          type: 'HQ',
          status: 'ACTIVE',
          displayName: '본사',
          published: true,
          metadata: {
            autoCreated: true,
            createdAt: now.toISOString(),
            createdFor: 'contract_termination_recovery',
          },
        },
        select: {
          id: true,
          userId: true,
        },
      });
      console.log(`[ContractTermination] HQ profile created: ${hqProfile.id}`);
    }

    const hqProfileId = hqProfile.id;
    const BATCH_SIZE = 100;

    // 1. 대리점장의 고객 DB를 본사로 이전 (배치 처리)
    const leads = await tx.affiliateLead.findMany({
      where: {
        managerId: managerProfileId,
      },
      select: {
        id: true,
        metadata: true,
      },
    });

    const leadBatches = chunkArray(leads, BATCH_SIZE);
    for (const batch of leadBatches) {
      await Promise.all(
        batch.map(async (lead: { id: number; metadata: any }) => {
          const leadMetadata = (lead.metadata as any) || {};
          await tx.affiliateLead.update({
            where: { id: lead.id },
            data: {
              managerId: hqProfileId,
              agentId: null, // 판매원 ID도 제거 (본사 소속)
              metadata: {
                ...leadMetadata,
                recoveredFromManager: managerProfileId,
                recoveredAt: now.toISOString(),
              },
            },
          });
        })
      );
    }

    // 2. 대리점장의 판매 기록을 본사로 이전 (배치 처리)
    const sales = await tx.affiliateSale.findMany({
      where: {
        managerId: managerProfileId,
      },
      select: {
        id: true,
        metadata: true,
      },
    });

    const saleBatches = chunkArray(sales, BATCH_SIZE);
    for (const batch of saleBatches) {
      await Promise.all(
        batch.map(async (sale: { id: number; metadata: any }) => {
          const saleMetadata = (sale.metadata as any) || {};
          await tx.affiliateSale.update({
            where: { id: sale.id },
            data: {
              managerId: hqProfileId,
              agentId: null, // 판매원 ID도 제거
              branchCommission: null, // 대리점장 수당 제거
              salesCommission: null, // 판매원 수당도 제거
              overrideCommission: saleMetadata?.overrideCommission || null, // 오버라이딩 수당은 유지
              metadata: {
                ...saleMetadata,
                recoveredFromManager: managerProfileId,
                recoveredAt: now.toISOString(),
              },
            },
          });
        })
      );
    }

    // 3. 대리점장의 AffiliateLink를 본사로 이전 (배치 처리)
    const managerLinks = await tx.affiliateLink.findMany({
      where: {
        managerId: managerProfileId,
      },
      select: {
        id: true,
        metadata: true,
      },
    });

    const managerLinkBatches = chunkArray(managerLinks, BATCH_SIZE);
    for (const batch of managerLinkBatches) {
      await Promise.all(
        batch.map(async (link: { id: number; metadata: any }) => {
          const linkMetadata = (link.metadata as any) || {};
          await tx.affiliateLink.update({
            where: { id: link.id },
            data: {
              managerId: hqProfileId,
              agentId: null, // 판매원 ID도 제거
              metadata: {
                ...linkMetadata,
                recoveredFromManager: managerProfileId,
                recoveredAt: now.toISOString(),
              },
            },
          });
        })
      );
    }

    // 4. 대리점장에 연결된 판매원들을 본사 소속으로 변경
    // 옵션 B: 판매원 계약은 유지하고, 소속만 본사로 변경
    const relations: Array<{ id: number; agentId: number }> = await tx.affiliateRelation.findMany({
      where: {
        managerId: managerProfileId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        agentId: true,
      },
    });

    let totalAgentLeads = 0;
    let totalAgentSales = 0;
    let totalAgentLinks = 0;

    // 판매원들의 데이터를 배치로 수집
    const allAgentLeads: Array<{ id: number; metadata: any }> = [];
    const allAgentSales: Array<{ id: number; metadata: any }> = [];
    const allAgentLinks: Array<{ id: number; metadata: any }> = [];

    // 판매원들의 소속을 본사로 변경 (배치 처리)
    const relationBatches: Array<Array<{ id: number; agentId: number }>> = chunkArray(relations, BATCH_SIZE);
    for (const batch of relationBatches) {
      await Promise.all(
        batch.map(async (relation: { id: number; agentId: number }) => {
          // 판매원의 소속을 본사로 변경
          await tx.affiliateRelation.update({
            where: { id: relation.id },
            data: {
              managerId: hqProfileId,
              metadata: {
                recoveredFromManager: managerProfileId,
                recoveredAt: now.toISOString(),
              },
            },
          });

          // 판매원의 고객 DB 수집
          const agentLeads = await tx.affiliateLead.findMany({
            where: {
              agentId: relation.agentId,
            },
            select: {
              id: true,
              metadata: true,
            },
          });
          allAgentLeads.push(...agentLeads);
          totalAgentLeads += agentLeads.length;

          // 판매원의 판매 기록 수집
          const agentSales = await tx.affiliateSale.findMany({
            where: {
              agentId: relation.agentId,
            },
            select: {
              id: true,
              metadata: true,
            },
          });
          allAgentSales.push(...agentSales);
          totalAgentSales += agentSales.length;

          // 판매원의 AffiliateLink 수집
          const agentLinks = await tx.affiliateLink.findMany({
            where: {
              agentId: relation.agentId,
            },
            select: {
              id: true,
              metadata: true,
            },
          });
          allAgentLinks.push(...agentLinks);
          totalAgentLinks += agentLinks.length;
        })
      );
    }

    // 판매원들의 고객 DB를 본사 소속으로 변경 (배치 처리)
    const agentLeadBatches = chunkArray(allAgentLeads, BATCH_SIZE);
    for (const batch of agentLeadBatches) {
      await Promise.all(
        batch.map(async (lead: { id: number; metadata: any }) => {
          const leadMetadata = (lead.metadata as any) || {};
          await tx.affiliateLead.update({
            where: { id: lead.id },
            data: {
              managerId: hqProfileId,
              metadata: {
                ...leadMetadata,
                recoveredFromManager: managerProfileId,
                recoveredAt: now.toISOString(),
              },
            },
          });
        })
      );
    }

    // 판매원들의 판매 기록을 본사 소속으로 변경 (판매원 수당은 유지, 대리점장 수당만 제거) (배치 처리)
    const agentSaleBatches = chunkArray(allAgentSales, BATCH_SIZE);
    for (const batch of agentSaleBatches) {
      await Promise.all(
        batch.map(async (sale: { id: number; metadata: any }) => {
          const saleMetadata = (sale.metadata as any) || {};
          await tx.affiliateSale.update({
            where: { id: sale.id },
            data: {
              managerId: hqProfileId,
              branchCommission: null, // 대리점장 수당 제거
              // salesCommission은 유지 (판매원 수당)
              metadata: {
                ...saleMetadata,
                recoveredFromManager: managerProfileId,
                recoveredAt: now.toISOString(),
              },
            },
          });
        })
      );
    }

    // 판매원들의 AffiliateLink를 본사로 이전 (배치 처리)
    const agentLinkBatches = chunkArray(allAgentLinks, BATCH_SIZE);
    for (const batch of agentLinkBatches) {
      await Promise.all(
        batch.map(async (link: { id: number; metadata: any }) => {
          const linkMetadata = (link.metadata as any) || {};
          await tx.affiliateLink.update({
            where: { id: link.id },
            data: {
              managerId: hqProfileId,
              metadata: {
                ...linkMetadata,
                recoveredFromManager: managerProfileId,
                recoveredAt: now.toISOString(),
              },
            },
          });
        })
      );
    }

    // 5. 계약서 metadata에 DB 회수 완료 표시
    await tx.affiliateContract.update({
      where: { id: contract.id },
      data: {
        metadata: {
          ...metadata,
          dbRecovered: true,
          dbRecoveredAt: now.toISOString(),
          recoveredToHQ: hqProfileId,
          recoveredAgentsCount: relations.length,
          recoveredLeadsCount: leads.length + totalAgentLeads,
          recoveredSalesCount: sales.length + totalAgentSales,
          recoveredLinksCount: managerLinks.length + totalAgentLinks,
        },
      },
    });

    // DB 회수 감사 로그
    await logDbRecoveryAudit(
      'RECOVERED',
      {
        contractId: contract.id,
        profileId: managerProfileId,
        userId: contract.userId || null,
        performedBySystem: true,
        details: {
          recoveryType: 'BRANCH_MANAGER_TO_HQ',
          recoveredToHQ: hqProfileId,
          recoveredAgentsCount: relations.length,
          recoveredLeadsCount: leads.length + totalAgentLeads,
          recoveredSalesCount: sales.length + totalAgentSales,
          recoveredLinksCount: managerLinks.length + totalAgentLinks,
          recoveredAt: now.toISOString(),
        },
      },
      tx
    );

    console.log(`[ContractTermination] ✅ Manager DB recovered: contract ${contract.id} (manager ${managerProfileId} -> HQ ${hqProfileId}, ${relations.length} agents transferred to HQ with contracts maintained, leads: ${leads.length + totalAgentLeads}, sales: ${sales.length + totalAgentSales}, links: ${managerLinks.length + totalAgentLinks})`);
  }, {
    timeout: 60000, // 60초 타임아웃 (대리점장은 데이터가 많을 수 있음)
  });
}

