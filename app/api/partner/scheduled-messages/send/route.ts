export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * POST /api/partner/scheduled-messages/send
 * 대리점의 예약 메시지 자동 발송 처리
 *
 * 이 API는 크론잡으로 정기적으로 호출되거나 수동으로 트리거됩니다.
 *
 * 로직:
 * 1. 대리점의 활성화된 예약 메시지 조회
 * 2. 각 메시지의 대상 고객 조회
 * 3. 각 고객의 유입일 기준으로 발송해야 할 단계 계산
 * 4. 발송 조건 확인 (daysAfter, sendTime)
 * 5. 이미 발송된 로그가 있는지 확인
 * 6. 메시지 발송 및 로그 기록
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    // 판매원/대리점장 프로필 확인
    const affiliateProfile = await prisma.affiliateProfile.findFirst({
      where: { userId: user.id },
      select: { id: true, type: true },
    });

    if (!affiliateProfile) {
      return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
    }

    console.log('[Partner Scheduled Messages Send] 자동 발송 프로세스 시작:', { userId: user.id, profileId: affiliateProfile.id });

    // 현재 시간 (한국 시간 기준)
    const now = new Date();
    const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const currentHour = koreaTime.getHours();
    const currentMinute = koreaTime.getMinutes();
    const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

    console.log('[Partner Scheduled Messages Send] 현재 시각:', currentTimeStr);

    // 대리점의 활성화된 예약 메시지 조회
    const activeMessages = await prisma.scheduledMessage.findMany({
      where: {
        adminId: user.id, // 대리점장의 User ID
        isActive: true,
        OR: [
          { startDate: null },
          { startDate: { lte: koreaTime } },
        ],
      },
      include: {
        ScheduledMessageStage: {
          orderBy: { order: 'asc' },
        },
      },
    });

    console.log(`[Partner Scheduled Messages Send] 활성 메시지 ${activeMessages.length}개 발견`);

    let totalSent = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    // 각 메시지 처리
    for (const message of activeMessages) {
      console.log(`[Partner Scheduled Messages Send] 메시지 처리: ${message.title} (ID: ${message.id})`);

      // CustomerGroup 또는 PartnerCustomerGroup 확인
      let customers: Array<{ userId: number; addedAt: Date; name: string | null }> = [];

      // CustomerGroup인 경우 (affiliateProfileId로 연결)
      if (message.targetGroupId) {
        const customerGroup = await prisma.customerGroup.findFirst({
          where: {
            id: message.targetGroupId,
            affiliateProfileId: affiliateProfile.id,
          },
          include: {
            CustomerGroupMember: {
              where: {
                releasedAt: null,
              },
              include: {
                User_CustomerGroupMember_userIdToUser: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        });

        if (customerGroup) {
          customers = customerGroup.CustomerGroupMember.map(member => ({
            userId: member.User_CustomerGroupMember_userIdToUser.id,
            addedAt: member.addedAt,
            name: member.User_CustomerGroupMember_userIdToUser.name,
          }));
        }
      }

      // PartnerCustomerGroup인 경우 (metadata에 partnerGroupId)
      if (customers.length === 0 && message.metadata && typeof message.metadata === 'object') {
        const metadata = message.metadata as any;
        if (metadata.partnerGroupId) {
          const partnerGroup = await prisma.partnerCustomerGroup.findFirst({
            where: {
              id: metadata.partnerGroupId,
              profileId: affiliateProfile.id,
            },
          });

          if (partnerGroup) {
            // PartnerCustomerGroup의 AffiliateLead 조회
            const leads = await prisma.affiliateLead.findMany({
              where: {
                groupId: partnerGroup.id,
                OR: [
                  { managerId: affiliateProfile.id },
                  { agentId: affiliateProfile.id },
                ],
              },
            });

            // profile의 userId 조회
            const profiles = await prisma.affiliateProfile.findMany({
              where: {
                id: {
                  in: leads.flatMap(lead => [lead.managerId, lead.agentId].filter(Boolean) as number[]),
                },
              },
              select: { id: true, userId: true },
            });

            const profileIdToUserId = new Map(profiles.map(p => [p.id, p.userId!]));

            customers = leads
              .map(lead => {
                const userId = (lead.managerId && profileIdToUserId.get(lead.managerId)) ||
                              (lead.agentId && profileIdToUserId.get(lead.agentId));
                if (userId) {
                  return {
                    userId,
                    addedAt: lead.createdAt,
                    name: lead.customerName,
                  };
                }
                return null;
              })
              .filter(Boolean) as Array<{ userId: number; addedAt: Date; name: string | null }>;
          }
        }
      }

      if (customers.length === 0) {
        console.log(`[Partner Scheduled Messages Send] 고객이 없음, 스킵`);
        continue;
      }

      console.log(`[Partner Scheduled Messages Send] 대상 고객 ${customers.length}명`);

      // 각 고객별 처리
      for (const customer of customers) {
        const addedAt = new Date(customer.addedAt);
        const daysSinceAdded = Math.floor((koreaTime.getTime() - addedAt.getTime()) / (1000 * 60 * 60 * 24));

        // 각 단계별 발송 여부 확인
        for (const stage of message.ScheduledMessageStage) {
          // 발송 조건 확인
          if (daysSinceAdded < stage.daysAfter) {
            continue; // 아직 발송 시기가 아님
          }

          // 발송 시간 확인 (지정된 경우)
          if (stage.sendTime) {
            const [stageHour, stageMinute] = stage.sendTime.split(':').map(Number);
            const timeDiff = Math.abs(currentHour * 60 + currentMinute - (stageHour * 60 + stageMinute));
            if (timeDiff > 5) {
              continue; // 발송 시간이 아님
            }
          }

          // 이미 발송된 로그가 있는지 확인
          const existingLog = await prisma.scheduledMessageLog.findFirst({
            where: {
              scheduledMessageId: message.id,
              userId: customer.userId,
              stageNumber: stage.stageNumber,
              status: 'sent',
            },
          });

          if (existingLog) {
            totalSkipped++;
            continue; // 이미 발송됨
          }

          // 메시지 발송
          try {
            console.log(`[Partner Scheduled Messages Send] 발송: ${customer.name} (${customer.userId}) - ${stage.stageNumber}회차`);

            // NOTE: 실제 발송 로직 구현 필요 (See GitHub Issue #TBD)
            // - SMS: sendMethod === 'sms' -> SMS API 통합
            // - Email: sendMethod === 'email' -> SMTP 설정
            // - Kakao: sendMethod === 'kakao' -> 카카오톡 API 연동
            // - Cruise Guide: sendMethod === 'cruise-guide' -> 내부 메시지 시스템
            console.log(`[Partner Scheduled Message] Simulated send: ${stage.title} to user ${customer.userId}`);

            // 발송 로그 기록
            await prisma.scheduledMessageLog.create({
              data: {
                scheduledMessageId: message.id,
                userId: customer.userId,
                stageNumber: stage.stageNumber,
                sentAt: koreaTime,
                status: 'sent',
                metadata: {
                  sendMethod: message.sendMethod,
                  senderPhone: message.senderPhone,
                  senderEmail: message.senderEmail,
                  title: stage.title,
                  contentLength: stage.content.length,
                  affiliateProfileId: affiliateProfile.id,
                },
              },
            });

            totalSent++;
          } catch (error: any) {
            console.error(`[Partner Scheduled Messages Send] 발송 실패:`, error);

            // 실패 로그 기록
            await prisma.scheduledMessageLog.create({
              data: {
                scheduledMessageId: message.id,
                userId: customer.userId,
                stageNumber: stage.stageNumber,
                sentAt: koreaTime,
                status: 'failed',
                errorMessage: error?.message || '알 수 없는 오류',
              },
            });

            totalFailed++;
          }
        }
      }
    }

    console.log(`[Partner Scheduled Messages Send] 완료: 발송 ${totalSent}건, 스킵 ${totalSkipped}건, 실패 ${totalFailed}건`);

    return NextResponse.json({
      ok: true,
      summary: {
        sent: totalSent,
        skipped: totalSkipped,
        failed: totalFailed,
        processedAt: koreaTime.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Partner Scheduled Messages Send] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to send scheduled messages',
      },
      { status: 500 }
    );
  }
}
