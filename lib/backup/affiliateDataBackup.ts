// lib/backup/affiliateDataBackup.ts
// 어필리에이트 링크 정리 전 본사 데이터 백업

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// 백업 디렉토리 (프로젝트 루트 기준)
const BACKUP_DIR = path.join(process.cwd(), 'backups', 'affiliate');

interface BackupData {
  linkId: number;
  linkCode: string;
  linkTitle?: string | null;
  managerId?: number | null;
  agentId?: number | null;
  profileId?: number | null;
  profileCode?: string | null;
  backupDate: string;
  leads: any[];
  sales: any[];
  passportSubmissions: any[];
  contracts: any[];
  interactions: any[];
  media: any[];
}

/**
 * 백업 디렉토리 생성
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * 링크 관련 데이터 백업
 */
export async function backupLinkData(linkIds: number[]): Promise<{
  success: boolean;
  backedUp: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let backedUp = 0;

  try {
    ensureBackupDir();

    for (const linkId of linkIds) {
      try {
        // 링크 정보 조회
        const link = await prisma.affiliateLink.findUnique({
          where: { id: linkId },
          include: {
            AffiliateProfile_AffiliateLink_managerIdToAffiliateProfile: {
              select: {
                id: true,
                affiliateCode: true,
                displayName: true,
                userId: true,
              },
            },
            AffiliateProfile_AffiliateLink_agentIdToAffiliateProfile: {
              select: {
                id: true,
                affiliateCode: true,
                displayName: true,
                userId: true,
              },
            },
          },
        });

        if (!link) {
          errors.push(`Link ${linkId}: 링크를 찾을 수 없습니다.`);
          continue;
        }

        // 관련 리드 조회
        const leads = await prisma.affiliateLead.findMany({
          where: { linkId },
          include: {
            AffiliateInteraction: {
              include: {
                AffiliateMedia: true,
              },
            },
            AffiliateSale: true,
          },
        });

        // 관련 판매 조회
        const sales = await prisma.affiliateSale.findMany({
          where: { linkId },
          include: {
            CommissionLedger: true,
          },
        });

        // 관련 프로필의 사용자 ID 조회
        const profileIds = [
          link.managerId,
          link.agentId,
        ].filter((id): id is number => id !== null);

        const userIds: number[] = [];
        if (profileIds.length > 0) {
          const profiles = await prisma.affiliateProfile.findMany({
            where: {
              id: {
                in: profileIds,
              },
            },
            select: {
              userId: true,
            },
          });
          userIds.push(...profiles.map((p) => p.userId));
        }

        // 관련 리드의 고객 전화번호로 여권 제출 조회
        const leadPhones = leads
          .map((lead) => lead.customerPhone)
          .filter((phone): phone is string => phone !== null);

        const passportSubmissions =
          userIds.length > 0 || leadPhones.length > 0
            ? await prisma.passportSubmission.findMany({
              where: {
                OR: [
                  ...(userIds.length > 0
                    ? [
                      {
                        userId: {
                          in: userIds,
                        },
                      },
                    ]
                    : []),
                  ...(leadPhones.length > 0
                    ? [
                      {
                        guests: {
                          some: {
                            phone: {
                              in: leadPhones,
                            },
                          },
                        },
                      },
                    ]
                    : []),
                ] as any,
              },
              include: {
                PassportSubmissionGuest: true,
              },
            })
            : [];

        // 관련 계약서 조회 (프로필 ID로 초대한 계약서)
        const contracts = profileIds.length > 0
          ? await prisma.affiliateContract.findMany({
            where: {
              invitedByProfileId: {
                in: profileIds,
              },
            },
            include: {
              AffiliateDocument: {
                include: {
                  AffiliateMedia: true,
                },
              },
            },
          })
          : [];

        // 상호작용 조회
        const interactionIds = leads.flatMap((lead) =>
          lead.AffiliateInteraction.map((i) => i.id)
        );
        const interactions =
          interactionIds.length > 0
            ? await prisma.affiliateInteraction.findMany({
              where: {
                id: {
                  in: interactionIds,
                },
              },
              include: {
                AffiliateMedia: true,
              },
            })
            : [];

        // 미디어 조회
        const mediaIds = [
          ...interactions.flatMap((i) => i.AffiliateMedia.map((m) => m.id)),
          ...contracts.flatMap((c) =>
            c.AffiliateDocument.flatMap((d) => d.AffiliateMedia.map((m) => m.id))
          ),
        ];
        const media =
          mediaIds.length > 0
            ? await prisma.affiliateMedia.findMany({
              where: {
                id: {
                  in: mediaIds,
                },
              },
            })
            : [];

        // 백업 데이터 구성
        const backupData: BackupData = {
          linkId: link.id,
          linkCode: link.code,
          linkTitle: link.title,
          managerId: link.managerId,
          agentId: link.agentId,
          profileId: link.managerId || link.agentId || null,
          profileCode:
            link.AffiliateProfile_AffiliateLink_managerIdToAffiliateProfile?.affiliateCode || link.AffiliateProfile_AffiliateLink_agentIdToAffiliateProfile?.affiliateCode || null,
          backupDate: new Date().toISOString(),
          leads: leads.map((lead: any) => ({
            id: lead.id,
            customerName: lead.customerName,
            customerPhone: lead.customerPhone,
            status: lead.status,
            source: lead.source,
            passportRequestedAt: lead.passportRequestedAt,
            passportCompletedAt: lead.passportCompletedAt,
            notes: lead.notes,
            metadata: lead.metadata,
            createdAt: lead.createdAt,
            updatedAt: lead.updatedAt,
          })),
          sales: sales.map((sale: any) => ({
            id: sale.id,
            externalOrderCode: sale.externalOrderCode,
            productCode: sale.productCode,
            saleAmount: sale.saleAmount,
            costAmount: sale.costAmount,
            netRevenue: sale.netRevenue,
            branchCommission: sale.branchCommission,
            salesCommission: sale.salesCommission,
            status: sale.status,
            saleDate: sale.saleDate,
            confirmedAt: sale.confirmedAt,
            metadata: sale.metadata,
            createdAt: sale.createdAt,
            updatedAt: sale.updatedAt,
          })),
          passportSubmissions: passportSubmissions.map((sub: any) => ({
            id: sub.id,
            userId: sub.userId,
            tripId: sub.tripId,
            token: sub.token,
            isSubmitted: sub.isSubmitted,
            submittedAt: sub.submittedAt,
            driveFolderUrl: sub.driveFolderUrl,
            guests: sub.PassportSubmissionGuest.map((g) => ({
              name: g.name,
              phone: g.phone,
              passportNumber: g.passportNumber,
              nationality: g.nationality,
              dateOfBirth: g.dateOfBirth,
              passportExpiryDate: g.passportExpiryDate,
            })),
            createdAt: sub.createdAt,
            updatedAt: sub.updatedAt,
          })),
          contracts: contracts.map((contract: any) => ({
            id: contract.id,
            userId: contract.userId,
            name: contract.name,
            residentId: contract.residentId,
            phone: contract.phone,
            email: contract.email,
            address: contract.address,
            bankName: contract.bankName,
            bankAccount: contract.bankAccount,
            bankAccountHolder: contract.bankAccountHolder,
            status: contract.status,
            submittedAt: contract.submittedAt,
            reviewedAt: contract.reviewedAt,
            contractSignedAt: contract.contractSignedAt,
            documents: contract.AffiliateDocument.map((doc) => ({
              documentType: doc.documentType,
              status: doc.status,
              filePath: doc.filePath,
              fileName: doc.fileName,
              fileSize: doc.fileSize,
            })),
            createdAt: contract.createdAt,
            updatedAt: contract.updatedAt,
          })),
          interactions: interactions.map((interaction) => ({
            id: interaction.id,
            interactionType: interaction.interactionType,
            occurredAt: interaction.occurredAt,
            note: interaction.note,
            metadata: interaction.metadata,
          })),
          media: media.map((m) => ({
            id: m.id,
            storagePath: m.storagePath,
            fileName: m.fileName,
            fileSize: m.fileSize,
            mimeType: m.mimeType,
            createdAt: m.createdAt,
          })),
        };

        // 백업 파일 저장
        const backupFileName = `link-${link.id}-${link.code}-${Date.now()}.json`;
        const backupFilePath = path.join(BACKUP_DIR, backupFileName);
        fs.writeFileSync(
          backupFilePath,
          JSON.stringify(backupData, null, 2),
          'utf-8'
        );

        backedUp++;
        console.log(
          `[Backup] ✅ Link ${linkId} (${link.code}) backed up: ${backupFileName}`
        );
      } catch (error: any) {
        const errorMsg = `Link ${linkId}: ${error.message || 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`[Backup] ❌ ${errorMsg}`, error);
      }
    }

    return {
      success: errors.length === 0,
      backedUp,
      errors,
    };
  } catch (error: any) {
    console.error('[Backup] ❌ Fatal error during backup:', error);
    return {
      success: false,
      backedUp,
      errors: [error.message || 'Fatal backup error'],
    };
  }
}

/**
 * 백업 파일 목록 조회
 */
export function listBackups(): string[] {
  ensureBackupDir();
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .reverse();
}

/**
 * 백업 파일 읽기
 */
export function readBackup(filename: string): BackupData | null {
  try {
    const filePath = path.join(BACKUP_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as BackupData;
  } catch (error) {
    console.error(`[Backup] Failed to read backup file: ${filename}`, error);
    return null;
  }
}

