export const dynamic = 'force-dynamic';

export const runtime = 'nodejs'; // Edge Runtime 금지 (xlsx 라이브러리 사용)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import * as XLSX from 'xlsx';
import { buildScopedGroupWhere, getTeamAgentIds } from '@/app/api/partner/customer-groups/utils';
import { schedulePartnerFunnelMessages } from '@/lib/funnel-scheduler';

/**
 * GET /api/partner/customer-groups/excel-upload
 * 엑셀 양식 파일 다운로드
 */
export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 샘플 데이터로 엑셀 파일 생성
    const sampleData = [
      { 이름: '홍길동', 연락처: '010-1234-5678', 이메일: 'hong@example.com', 비고: '' },
      { 이름: '김철수', 연락처: '010-2345-6789', 이메일: 'kim@example.com', 비고: '' },
      { 이름: '이영희', 연락처: '010-3456-7890', 이메일: 'lee@example.com', 비고: '' },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '고객목록');

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename*=UTF-8\'\'%EA%B3%A0%EA%B0%9D_%EC%9D%BC%EA%B4%84%EB%93%B1%EB%A1%9D_%EC%96%91%EC%8B%9D.xlsx',
      },
    });
  } catch (error: any) {
    console.error('[Partner Customer Groups Excel Download] Error:', error);
    console.error('[Partner Customer Groups Excel Download] Error stack:', error.stack);
    return NextResponse.json(
      { ok: false, error: error.message || '양식 파일 다운로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/customer-groups/excel-upload
 * 엑셀 파일로 고객 일괄 등록 (PartnerCustomerGroup 사용 - AffiliateLead 기반)
 */
export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const affiliateProfile = await prisma.affiliateProfile.findFirst({
      where: { userId: sessionUser.id },
      select: { id: true, type: true },
    });

    if (!affiliateProfile) {
      return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const groupIdParam = formData.get('groupId') as string;

    if (!file) {
      return NextResponse.json({ ok: false, error: '파일이 필요합니다.' }, { status: 400 });
    }

    if (!groupIdParam) {
      return NextResponse.json({ ok: false, error: '그룹 ID가 필요합니다.' }, { status: 400 });
    }

    const groupId = Number(groupIdParam);
    if (!Number.isInteger(groupId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 그룹 ID입니다.' }, { status: 400 });
    }

    // 대리점장인 경우 팀 판매원 ID 목록 조회
    const teamAgentIds = await getTeamAgentIds(affiliateProfile.id, affiliateProfile.type || '');

    // 그룹 소유권 확인 (PartnerCustomerGroup) - 대리점장은 팀 판매원 그룹도 접근 가능
    const group = await prisma.partnerCustomerGroup.findFirst({
      where: buildScopedGroupWhere(groupId, affiliateProfile.id, teamAgentIds),
      select: { id: true },
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: '그룹을 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as any[];

    if (data.length === 0) {
      return NextResponse.json({ ok: false, error: '엑셀 파일에 데이터가 없습니다.' }, { status: 400 });
    }

    const normalizePhone = (phone: string | null | undefined): string | null => {
      if (!phone) return null;
      const digits = String(phone).replace(/\D/g, '');
      if (digits.length < 10) return null;
      return digits;
    };

    let addedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // 1단계: 모든 행의 전화번호 정규화 및 유효성 검사
    const validRows: Array<{
      rowIndex: number;
      name: string;
      phone: string;
      notes: string | null;
    }> = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const name = row['이름'] || row['name'] || row['Name'] || '';
      const phone =
        row['연락처'] ||
        row['전화번호'] ||
        row['휴대폰번호'] ||
        row['phone'] ||
        row['Phone'] ||
        '';
      const notes = row['비고'] || row['notes'] || row['Notes'] || null;

      if (!name || !phone) {
        errorCount++;
        errors.push(`행 ${i + 2}: 이름과 전화번호는 필수입니다.`);
        continue;
      }

      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone) {
        errorCount++;
        errors.push(`행 ${i + 2}: 유효하지 않은 전화번호입니다.`);
        continue;
      }

      validRows.push({
        rowIndex: i + 2,
        name: String(name).trim(),
        phone: normalizedPhone,
        notes: notes ? String(notes).trim() : null,
      });
    }

    // 2단계: 배치 처리로 기존 고객 조회 및 업데이트/생성 (N+1 쿼리 최적화)
    const batchSize = 500; // 배치 사이즈 증가
    for (let i = 0; i < validRows.length; i += batchSize) {
      const batch = validRows.slice(i, i + batchSize);
      const batchPhones = batch.map(r => r.phone);

      try {
        // 배치로 기존 고객 조회
        const existingLeads = await prisma.affiliateLead.findMany({
          where: {
            customerPhone: { in: batchPhones },
            OR: [
              { managerId: affiliateProfile.id },
              { agentId: affiliateProfile.id },
            ],
          },
          select: { id: true, customerPhone: true, groupId: true },
        });

        type LeadInfo = { id: number; customerPhone: string | null; groupId: number | null };
        const existingLeadsMap = new Map<string | null, LeadInfo>(existingLeads.map(l => [l.customerPhone, l]));

        // 기존 고객 중 그룹 업데이트가 필요한 고객들
        const leadsToUpdate = batch
          .filter(r => {
            const existing = existingLeadsMap.get(r.phone);
            return existing && existing.groupId !== groupId;
          })
          .map(r => existingLeadsMap.get(r.phone)!.id);

        // 새로 생성할 고객들
        const newLeads = batch.filter(r => !existingLeadsMap.has(r.phone));

        // 배치 업데이트: 기존 고객 그룹 변경
        if (leadsToUpdate.length > 0) {
          await prisma.affiliateLead.updateMany({
            where: { id: { in: leadsToUpdate } },
            data: {
              groupId: groupId,
              updatedAt: new Date(),
            },
          });
          addedCount += leadsToUpdate.length;
        }

        // 이미 같은 그룹에 있는 고객 수
        const alreadyInGroup = batch.filter(r => {
          const existing = existingLeadsMap.get(r.phone);
          return existing && existing.groupId === groupId;
        }).length;
        skippedCount += alreadyInGroup;

        // 배치 생성: 새 고객들
        if (newLeads.length > 0) {
          const now = new Date();
          const leadDataList = newLeads.map(r => {
            const leadData: any = {
              customerName: r.name,
              customerPhone: r.phone,
              groupId: groupId,
              source: 'excel-import',
              status: 'NEW',
              notes: r.notes,
              updatedAt: now,
            };

            if (affiliateProfile.type === 'BRANCH_MANAGER') {
              leadData.managerId = affiliateProfile.id;
            } else {
              leadData.agentId = affiliateProfile.id;
            }

            return leadData;
          });

          // 트랜잭션으로 배치 생성
          const createdLeads = await prisma.$transaction(
            leadDataList.map(data => prisma.affiliateLead.create({ data }))
          );
          addedCount += newLeads.length;

          // 퍼널 자동 발송: 새로 생성된 고객들에게 퍼널 메시지 예약
          for (const lead of createdLeads) {
            schedulePartnerFunnelMessages({
              leadId: lead.id,
              groupId: groupId,
              profileId: affiliateProfile.id,
              userId: sessionUser.id,
            }).catch(err => console.error('[Partner Excel Upload] Funnel schedule error:', err));
          }

          // Google 스프레드시트 백업 (비동기로 병렬 처리)
          const channel = affiliateProfile.type === 'BRANCH_MANAGER' ? '대리점장' : '판매원';
          import('@/lib/google-sheets').then(({ sendToGoogleSheet }) => {
            newLeads.forEach(lead => {
              sendToGoogleSheet({
                name: lead.name,
                phone: lead.phone,
                source: 'excel-import',
                productName: '',
                channel,
                manager: 'Excel Upload',
                notes: lead.notes || undefined,
              });
            });
          });
        }
      } catch (batchError: any) {
        // 배치 실패 시 개별 처리로 폴백
        console.error('[Partner Excel Upload] Batch error, falling back to individual processing:', batchError);
        for (const row of batch) {
          try {
            const existingLead = await prisma.affiliateLead.findFirst({
              where: {
                customerPhone: row.phone,
                OR: [
                  { managerId: affiliateProfile.id },
                  { agentId: affiliateProfile.id },
                ],
              },
            });

            if (existingLead) {
              if (existingLead.groupId !== groupId) {
                await prisma.affiliateLead.update({
                  where: { id: existingLead.id },
                  data: { groupId: groupId, updatedAt: new Date() },
                });
                addedCount++;
              } else {
                skippedCount++;
              }
            } else {
              const leadData: any = {
                customerName: row.name,
                customerPhone: row.phone,
                groupId: groupId,
                source: 'excel-import',
                status: 'NEW',
                notes: row.notes,
                updatedAt: new Date(),
              };

              if (affiliateProfile.type === 'BRANCH_MANAGER') {
                leadData.managerId = affiliateProfile.id;
              } else {
                leadData.agentId = affiliateProfile.id;
              }

              const createdLead = await prisma.affiliateLead.create({ data: leadData });
              addedCount++;

              // 퍼널 자동 발송
              schedulePartnerFunnelMessages({
                leadId: createdLead.id,
                groupId: groupId,
                profileId: affiliateProfile.id,
                userId: sessionUser.id,
              }).catch(err => console.error('[Partner Excel Upload] Funnel schedule error:', err));
            }
          } catch (rowError: any) {
            errorCount++;
            errors.push(`행 ${row.rowIndex}: ${rowError.message || '처리 실패'}`);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: '엑셀 파일 업로드가 완료되었습니다.',
      summary: {
        total: data.length,
        added: addedCount,
        skipped: skippedCount,
        errors: errorCount,
      },
      errors: errors.slice(0, 10),
    });
  } catch (error: any) {
    console.error('[Partner Customer Groups Excel Upload] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '엑셀 파일 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
