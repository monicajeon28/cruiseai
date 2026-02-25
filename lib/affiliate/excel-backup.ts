// lib/affiliate/excel-backup.ts
// 구글 드라이브 엑셀 자동 백업 유틸리티

import * as XLSX from 'xlsx';
import { uploadFileToDrive } from '@/lib/google-drive';
import { getDriveFolderId } from '@/lib/config/drive-config';
import prisma from '@/lib/prisma';

/**
 * 판매원별 수당 엑셀 데이터 생성 (cashflow)
 */
export async function generateCashflowExcel(period: string) {
  try {
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // 판매원별 수당 집계
    const sales = await prisma.affiliateSale.findMany({
      where: {
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
        status: 'CONFIRMED',
      },
      include: {
        AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            type: true,
            bankName: true,
            bankAccount: true,
            bankAccountHolder: true,
            User: {
              select: {
                mallUserId: true,
                name: true,
                phone: true,
              },
            },
          },
        },
        AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            type: true,
            bankName: true,
            bankAccount: true,
            bankAccountHolder: true,
            User: {
              select: {
                mallUserId: true,
                name: true,
                phone: true,
              },
            },
          },
        },
        AffiliateLead: {
          select: {
            customerName: true,
            customerPhone: true,
          },
        },
        AffiliateProduct: {
          select: {
            title: true,
          },
        },
      },
      orderBy: [
        { saleDate: 'desc' },
      ],
    });

    // 판매원별로 그룹화
    const agentMap = new Map<number, any>();

    for (const sale of sales) {
      const agent = sale.AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile;
      const manager = sale.AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile;

      // 판매원 수당 처리
      if (agent && sale.salesCommission && sale.salesCommission > 0) {
        if (!agentMap.has(agent.id)) {
          agentMap.set(agent.id, {
            profileId: agent.id,
            이름: agent.displayName || agent.User?.name || 'N/A',
            유형: '판매원',
            아이디: agent.User?.mallUserId || 'N/A',
            연락처: agent.User?.phone || 'N/A',
            은행명: agent.bankName || '',
            계좌번호: agent.bankAccount || '',
            예금주: agent.bankAccountHolder || '',
            판매건수: 0,
            총판매액: 0,
            총수당: 0,
            원천징수: 0,
            실수령액: 0,
            판매내역: [],
          });
        }

        const agentData = agentMap.get(agent.id);
        const withholdingAmount = Math.round(sale.salesCommission * 0.033);
        const netAmount = sale.salesCommission - withholdingAmount;

        agentData.판매건수 += 1;
        agentData.총판매액 += sale.saleAmount;
        agentData.총수당 += sale.salesCommission;
        agentData.원천징수 += withholdingAmount;
        agentData.실수령액 += netAmount;
        agentData.판매내역.push({
          판매일: sale.saleDate?.toLocaleDateString('ko-KR') || 'N/A',
          상품명: sale.AffiliateProduct?.title || sale.productCode,
          고객명: sale.AffiliateLead?.customerName || 'N/A',
          판매액: sale.saleAmount,
          수당: sale.salesCommission,
        });
      }

      // 대리점장 브랜치 수당 처리
      if (manager && sale.branchCommission && sale.branchCommission > 0) {
        if (!agentMap.has(manager.id)) {
          agentMap.set(manager.id, {
            profileId: manager.id,
            이름: manager.displayName || manager.User?.name || 'N/A',
            유형: '대리점장',
            아이디: manager.User?.mallUserId || 'N/A',
            연락처: manager.User?.phone || 'N/A',
            은행명: manager.bankName || '',
            계좌번호: manager.bankAccountNumber || '',
            예금주: manager.bankAccountHolder || '',
            판매건수: 0,
            총판매액: 0,
            총수당: 0,
            원천징수: 0,
            실수령액: 0,
            판매내역: [],
          });
        }

        const managerData = agentMap.get(manager.id);
        const totalCommission = (sale.branchCommission || 0) + (sale.overrideCommission || 0);
        const withholdingAmount = Math.round(totalCommission * 0.033);
        const netAmount = totalCommission - withholdingAmount;

        managerData.판매건수 += 1;
        managerData.총판매액 += sale.saleAmount;
        managerData.총수당 += totalCommission;
        managerData.원천징수 += withholdingAmount;
        managerData.실수령액 += netAmount;
        managerData.판매내역.push({
          판매일: sale.saleDate?.toLocaleDateString('ko-KR') || 'N/A',
          상품명: sale.AffiliateProduct?.title || sale.productCode,
          고객명: sale.AffiliateLead?.customerName || 'N/A',
          판매액: sale.saleAmount,
          수당: totalCommission,
        });
      }
    }

    // 엑셀 시트 데이터 생성
    const summaryData = Array.from(agentMap.values()).map((agent) => ({
      이름: agent.이름,
      유형: agent.유형,
      아이디: agent.아이디,
      연락처: agent.연락처,
      판매건수: agent.판매건수,
      총판매액: agent.총판매액,
      총수당: agent.총수당,
      원천징수: agent.원천징수,
      실수령액: agent.실수령액,
      은행명: agent.은행명,
      계좌번호: agent.계좌번호,
      예금주: agent.예금주,
    }));

    // 상세 내역 시트
    const detailData: any[] = [];
    for (const agent of agentMap.values()) {
      for (const sale of agent.판매내역) {
        detailData.push({
          이름: agent.이름,
          유형: agent.유형,
          판매일: sale.판매일,
          상품명: sale.상품명,
          고객명: sale.고객명,
          판매액: sale.판매액,
          수당: sale.수당,
        });
      }
    }

    // 엑셀 생성
    const wb = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    const detailSheet = XLSX.utils.json_to_sheet(detailData);

    XLSX.utils.book_append_sheet(wb, summarySheet, '판매원별 수당 요약');
    XLSX.utils.book_append_sheet(wb, detailSheet, '판매 상세내역');

    // Buffer 생성
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer,
      fileName: `판매원별수당_${period}.xlsx`,
      summary: {
        period,
        totalAgents: agentMap.size,
        totalSales: sales.length,
        totalCommission: Array.from(agentMap.values()).reduce((sum, a) => sum + a.총수당, 0),
      },
    };
  } catch (error) {
    console.error('[CashflowExcel] Generation error:', error);
    throw error;
  }
}

/**
 * 거래처용 월별 엑셀 데이터 생성 (totalcash)
 */
export async function generateTotalcashExcel(period: string) {
  try {
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // 대리점장별 집계
    const sales = await prisma.affiliateSale.findMany({
      where: {
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
        status: 'CONFIRMED',
      },
      include: {
        AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            type: true,
            User: {
              select: {
                mallUserId: true,
                name: true,
                phone: true,
                email: true,
              },
            },
          },
        },
        AffiliateLead: {
          select: {
            customerName: true,
            customerPhone: true,
          },
        },
        AffiliateProduct: {
          select: {
            title: true,
          },
        },
      },
      orderBy: [
        { saleDate: 'desc' },
      ],
    });

    // 대리점장별로 그룹화
    const managerMap = new Map<number, any>();
    let hqDirectSales = 0;
    let hqDirectRevenue = 0;

    for (const sale of sales) {
      const manager = sale.AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile;

      if (!manager) {
        // 본사 직판
        hqDirectSales += 1;
        hqDirectRevenue += sale.saleAmount;
        continue;
      }

      if (!managerMap.has(manager.id)) {
        managerMap.set(manager.id, {
          대리점장: manager.displayName || manager.User?.name || 'N/A',
          아이디: manager.User?.mallUserId || 'N/A',
          연락처: manager.User?.phone || 'N/A',
          이메일: manager.User?.email || 'N/A',
          판매건수: 0,
          총판매액: 0,
          브랜치수당: 0,
          오버라이드: 0,
          총지급액: 0,
          판매내역: [],
        });
      }

      const managerData = managerMap.get(manager.id);
      managerData.판매건수 += 1;
      managerData.총판매액 += sale.saleAmount;
      managerData.브랜치수당 += sale.branchCommission || 0;
      managerData.오버라이드 += sale.overrideCommission || 0;
      managerData.총지급액 += (sale.branchCommission || 0) + (sale.overrideCommission || 0);
      managerData.판매내역.push({
        판매일: sale.saleDate?.toLocaleDateString('ko-KR') || 'N/A',
        상품명: sale.AffiliateProduct?.title || sale.productCode,
        고객명: sale.AffiliateLead?.customerName || 'N/A',
        판매액: sale.saleAmount,
        브랜치수당: sale.branchCommission || 0,
        오버라이드: sale.overrideCommission || 0,
      });
    }

    // 엑셀 시트 데이터 생성
    const summaryData = Array.from(managerMap.values()).map((manager) => ({
      대리점장: manager.대리점장,
      아이디: manager.아이디,
      연락처: manager.연락처,
      이메일: manager.이메일,
      판매건수: manager.판매건수,
      총판매액: manager.총판매액,
      브랜치수당: manager.브랜치수당,
      오버라이드: manager.오버라이드,
      총지급액: manager.총지급액,
    }));

    // 본사 직판 추가
    if (hqDirectSales > 0) {
      summaryData.push({
        대리점장: '본사 직판',
        아이디: 'HQ',
        연락처: '-',
        이메일: '-',
        판매건수: hqDirectSales,
        총판매액: hqDirectRevenue,
        브랜치수당: 0,
        오버라이드: 0,
        총지급액: 0,
      });
    }

    // 상세 내역 시트
    const detailData: any[] = [];
    for (const manager of managerMap.values()) {
      for (const sale of manager.판매내역) {
        detailData.push({
          대리점장: manager.대리점장,
          판매일: sale.판매일,
          상품명: sale.상품명,
          고객명: sale.고객명,
          판매액: sale.판매액,
          브랜치수당: sale.브랜치수당,
          오버라이드: sale.오버라이드,
          총지급액: sale.브랜치수당 + sale.오버라이드,
        });
      }
    }

    // 엑셀 생성
    const wb = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    const detailSheet = XLSX.utils.json_to_sheet(detailData);

    XLSX.utils.book_append_sheet(wb, summarySheet, '거래처별 월별 집계');
    XLSX.utils.book_append_sheet(wb, detailSheet, '판매 상세내역');

    // Buffer 생성
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer,
      fileName: `거래처월별_${period}.xlsx`,
      summary: {
        period,
        totalManagers: managerMap.size,
        totalSales: sales.length,
        hqDirectSales,
        hqDirectRevenue,
      },
    };
  } catch (error) {
    console.error('[TotalcashExcel] Generation error:', error);
    throw error;
  }
}

/**
 * Cashflow 엑셀을 구글 드라이브에 업로드
 */
export async function uploadCashflowExcel(period: string) {
  try {
    const { buffer, fileName, summary } = await generateCashflowExcel(period);
    const folderId = await getDriveFolderId('CASHFLOW');

    console.log('[CashflowExcel] Uploading to folder:', folderId);
    console.log('[CashflowExcel] Folder URL: https://drive.google.com/drive/folders/' + folderId);

    const result = await uploadFileToDrive({
      folderId,
      fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(buffer),
      makePublic: false,
    });

    if (!result.ok) {
      throw new Error(result.error || '업로드 실패');
    }

    console.log('[CashflowExcel] ✅ Upload SUCCESS:', { fileName, fileId: result.fileId, folderId, summary });

    return {
      success: true,
      fileId: result.fileId,
      url: result.url,
      fileName,
      folderId,
      summary,
    };
  } catch (error) {
    console.error('[CashflowExcel] ❌ Upload error:', error);
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Totalcash 엑셀을 구글 드라이브에 업로드
 */
export async function uploadTotalcashExcel(period: string) {
  try {
    const { buffer, fileName, summary } = await generateTotalcashExcel(period);
    const folderId = await getDriveFolderId('TOTALCASH');

    console.log('[TotalcashExcel] Uploading to folder:', folderId);
    console.log('[TotalcashExcel] Folder URL: https://drive.google.com/drive/folders/' + folderId);

    const result = await uploadFileToDrive({
      folderId,
      fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(buffer),
      makePublic: false,
    });

    if (!result.ok) {
      throw new Error(result.error || '업로드 실패');
    }

    console.log('[TotalcashExcel] ✅ Upload SUCCESS:', { fileName, fileId: result.fileId, folderId, summary });

    return {
      success: true,
      fileId: result.fileId,
      url: result.url,
      fileName,
      folderId,
      summary,
    };
  } catch (error) {
    console.error('[TotalcashExcel] ❌ Upload error:', error);
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * 두 엑셀 모두 업로드
 */
export async function uploadAllExcels(period: string) {
  const results = await Promise.allSettled([
    uploadCashflowExcel(period),
    uploadTotalcashExcel(period),
  ]);

  return {
    cashflow: results[0].status === 'fulfilled' ? results[0].value : { success: false, error: 'Failed' },
    totalcash: results[1].status === 'fulfilled' ? results[1].value : { success: false, error: 'Failed' },
  };
}
