export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 대리점장이 자신의 팀 전체 DB 백업
 */
export async function GET(req: Request) {
  try {
    const { profile } = await requirePartnerContext();

    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, message: '대리점장만 DB 백업이 가능합니다.' }, { status: 403 });
    }

    // 대리점장 소유의 모든 판매원 조회
    const agents = await prisma.affiliateRelation.findMany({
      where: {
        managerId: profile.id,
        status: 'ACTIVE',
      },
      include: {
        AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile: {
          include: {
            user: true,
          },
        },
      },
    });

    const agentProfileIds = agents.map((a) => a.agentId);
    const allProfileIds = [profile.id, ...agentProfileIds];

    // 모든 고객(리드) 데이터 백업
    const leads = await prisma.affiliateLead.findMany({
      where: {
        OR: [
          { managerId: profile.id },
          { agentId: { in: agentProfileIds } },
        ],
      },
      include: {
        AffiliateSale: true,
      },
    });

    // 모든 판매 데이터 백업
    const sales = await prisma.affiliateSale.findMany({
      where: {
        OR: [
          { managerId: profile.id },
          { agentId: { in: agentProfileIds } },
        ],
      },
      include: {
        Reservation: true,
        CommissionLedger: true,
      },
    });

    // 모든 링크 데이터 백업
    const links = await prisma.affiliateLink.findMany({
      where: {
        OR: [
          { managerId: profile.id },
          { agentId: { in: agentProfileIds } },
        ],
      },
    });

    const backupData = {
      manager: {
        id: profile.id,
        displayName: profile.displayName,
        affiliateCode: profile.affiliateCode,
        branchLabel: profile.branchLabel,
      },
      agents: agents.map((agent) => ({
        profileId: agent.agentId,
        displayName: agent.AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile?.displayName,
        affiliateCode: agent.AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile?.affiliateCode,
        user: agent.AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile?.user,
      })),
      leads: leads.map((lead) => ({
        id: lead.id,
        customerName: lead.customerName,
        customerPhone: lead.customerPhone,
        status: lead.status,
        agentId: lead.agentId,
        managerId: lead.managerId,
        createdAt: lead.createdAt,
        saleCount: lead.AffiliateSale.length,
      })),
      sales: sales.map((sale) => ({
        id: sale.id,
        productCode: sale.productCode,
        saleAmount: sale.saleAmount,
        status: sale.status,
        saleDate: sale.saleDate,
        agentId: sale.agentId,
        managerId: sale.managerId,
        createdAt: sale.createdAt,
        reservationCount: sale.Reservation.length,
        commissionCount: sale.CommissionLedger.length,
      })),
      links: links.map((link) => ({
        id: link.id,
        productCode: link.productCode,
        status: link.status,
        agentId: link.agentId,
        managerId: link.managerId,
        createdAt: link.createdAt,
      })),
      backupDate: new Date().toISOString(),
      backupBy: profile.id,
      backupType: 'manual_partner', // 대리점장 수동 백업 표시
      summary: {
        totalAgents: agents.length,
        totalLeads: leads.length,
        totalSales: sales.length,
        totalLinks: links.length,
      },
    };

    // Google Drive에 대리점장 팀 백업 파일 저장 (자동 백업 시스템과 연동)
    const BACKUP_FOLDER_ID = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID || '1HSV-t7Z7t8byMDJMY5srrpJ3ziGqz9xK';
    let driveBackupUrl: string | null = null;
    
    try {
      const { uploadFileToDrive } = await import('@/lib/google-drive');
      
      // 백업 데이터를 JSON 문자열로 변환
      const backupJson = JSON.stringify(backupData, null, 2);
      const backupBuffer = Buffer.from(backupJson, 'utf-8');
      
      // 파일명: team_{affiliateCode}_manual_backup_{날짜}_{시간}.json
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = `team_${profile.affiliateCode}_manual_backup_${dateStr}.json`;
      
      const uploadResult = await uploadFileToDrive({
        folderId: BACKUP_FOLDER_ID,
        fileName,
        mimeType: 'application/json',
        buffer: backupBuffer,
        makePublic: false,
      });
      
      if (uploadResult.ok && uploadResult.url) {
        driveBackupUrl = uploadResult.url;
        logger.log('[Partner Subscription Backup DB] Google Drive 업로드 성공:', {
          profileId: profile.id,
          affiliateCode: profile.affiliateCode,
          fileName,
          url: driveBackupUrl,
        });
      } else {
        logger.warn('[Partner Subscription Backup DB] Google Drive 업로드 실패:', uploadResult.error);
      }
    } catch (driveError: any) {
      logger.error('[Partner Subscription Backup DB] Google Drive 업로드 오류:', driveError);
      // Google Drive 업로드 실패해도 로컬 다운로드는 계속 진행
    }

    const filename = `team_backup_${profile.affiliateCode}_${new Date().toISOString().split('T')[0]}.json`;

    return NextResponse.json({
      ok: true,
      message: driveBackupUrl 
        ? '팀 전체 DB 백업이 완료되었습니다. (Google Drive에도 저장되었습니다)'
        : '팀 전체 DB 백업이 완료되었습니다. (Google Drive 저장 실패, 로컬 다운로드만 가능)',
      data: backupData,
      filename,
      driveBackupUrl, // Google Drive URL 추가
    });
  } catch (error: any) {
    logger.error('[Partner Subscription Backup DB API] Error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'DB 백업에 실패했습니다.' },
      { status: 500 }
    );
  }
}

