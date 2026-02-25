// lib/scheduler/scheduledMessageSender.ts
// 예약 메시지 발송 스케줄러

import cron from 'node-cron';
import prisma from '@/lib/prisma';
import { sendNotificationToUser } from '@/lib/push/server';

/**
 * 예약 메시지 발송 처리
 * 매 5분마다 실행하여 발송 시간이 된 메시지를 처리
 */
async function processScheduledMessages() {
  try {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:mm 형식

    console.log('[Scheduled Message] 🔔 Processing scheduled messages...', { now: now.toISOString(), currentTime });

    // 활성화된 예약 메시지 조회
    const activeMessages = await prisma.scheduledMessage.findMany({
      where: {
        isActive: true,
      },
      include: {
        ScheduledMessageStage: {
          orderBy: { order: 'asc' },
        },
        CustomerGroup: {
          include: {
            CustomerGroupMember: {
              include: {
                User_CustomerGroupMember_userIdToUser: {
                  select: {
                    id: true,
                    name: true,
                    phone: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    console.log(`[Scheduled Message] Found ${activeMessages.length} active scheduled message(s)`);

    for (const message of activeMessages) {
      try {
        // 각 단계별로 발송 처리
        for (const stage of (message as any).ScheduledMessageStage) {
          // 발송 시간 확인
          const sendTime = stage.sendTime || message.startTime;
          if (!sendTime) {
            console.log(`[Scheduled Message] Stage ${stage.stageNumber} has no sendTime, skipping`);
            continue;
          }

          const [hours, minutes] = sendTime.split(':').map(Number);
          if (isNaN(hours) || isNaN(minutes)) {
            console.log(`[Scheduled Message] Invalid sendTime format: ${sendTime}, skipping`);
            continue;
          }

          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          const currentTimeInMinutes = currentHour * 60 + currentMinute;
          const sendTimeInMinutes = hours * 60 + minutes;

          // 현재 시간이 발송 시간과 일치하는지 확인 (5분 단위로 체크하므로 ±2분 허용)
          const timeDiff = Math.abs(currentTimeInMinutes - sendTimeInMinutes);
          if (timeDiff > 2) {
            console.log(`[Scheduled Message] Time mismatch: current=${currentHour}:${currentMinute.toString().padStart(2, '0')}, send=${sendTime}, diff=${timeDiff}min, skipping`);
            continue;
          }

          // 시작일 확인
          if (message.startDate) {
            const startDate = new Date(message.startDate);
            startDate.setHours(0, 0, 0, 0);
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);

            // 시작일로부터 며칠 후인지 계산
            const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

            if (daysDiff < stage.daysAfter) {
              continue; // 아직 발송 시간이 아님
            }

            // 최대 예약 일수 확인
            if (daysDiff > message.maxDays) {
              continue; // 최대 일수 초과
            }
          } else if (stage.daysAfter > 0) {
            continue; // 시작일이 없으면 daysAfter가 0인 경우만 발송
          }

          // 대상 고객 목록 결정
          let targetUsers: Array<{ id: number; name: string | null; phone: string | null; email: string | null }> = [];

          if (message.targetGroupId && (message as any).CustomerGroup) {
            // 그룹이 지정된 경우: 그룹 멤버만
            targetUsers = (message as any).CustomerGroup.CustomerGroupMember.map((member: any) => member.User_CustomerGroupMember_userIdToUser);
          } else {
            // 그룹이 지정되지 않은 경우: 전체 고객 (또는 특정 조건)
            // 여기서는 전체 활성 고객으로 가정 (필요에 따라 조건 추가)
            const allUsers = await prisma.user.findMany({
              where: {
                role: 'user',
                customerStatus: 'active',
              },
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            });
            targetUsers = allUsers;
          }

          console.log(`[Scheduled Message] Processing stage ${stage.stageNumber} of message ${message.id} for ${targetUsers.length} users`);

          // 각 고객에게 메시지 발송
          let sentCount = 0;
          let failedCount = 0;
          let skippedCount = 0;

          // eventKey 생성용 날짜 문자열 (한 번만 계산)
          const today = new Date(now);
          today.setHours(0, 0, 0, 0);
          const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

          // 성능 최적화: 배치 조회로 중복 발송 확인 (N+1 쿼리 문제 해결)
          const eventKeys = targetUsers.map(user => 
            `SCHEDULED_MESSAGE_${message.id}_${stage.stageNumber}_${user.id}_${dateStr}`
          );

          // 모든 eventKey를 한 번에 조회
          const existingLogs = await prisma.notificationLog.findMany({
            where: {
              eventKey: { in: eventKeys },
            },
            select: {
              eventKey: true,
            },
          });

          // 이미 발송된 eventKey를 Set으로 변환 (빠른 조회)
          const sentEventKeys = new Set(existingLogs.map(log => log.eventKey));

          for (const user of targetUsers) {
            try {
              // 발송 로그 확인 (중복 발송 방지)
              // eventKey 형식: SCHEDULED_MESSAGE_{messageId}_{stageNumber}_{userId}_{date}
              const eventKey = `SCHEDULED_MESSAGE_${message.id}_${stage.stageNumber}_${user.id}_${dateStr}`;

              if (sentEventKeys.has(eventKey)) {
                console.log(`[Scheduled Message] Already sent to user ${user.id} today (eventKey: ${eventKey}), skipping`);
                skippedCount++;
                continue;
              }

              // 메시지 내용 준비
              let messageContent = stage.content;

              // 광고성 메시지 처리
              if (message.isAdMessage) {
                if (message.autoAddAdTag) {
                  messageContent = `[광고] ${messageContent}`;
                }
                if (message.autoAddOptOut && message.optOutNumber) {
                  messageContent = `${messageContent}\n무료수신거부: ${message.optOutNumber}`;
                }
              }

              // 발송 방식에 따라 처리
              if (message.sendMethod === 'cruise-guide') {
                // 크루즈가이드 앱 내 알림
                await sendNotificationToUser(user.id, {
                  title: stage.title,
                  body: messageContent,
                });

                // 발송 로그 기록
                await prisma.notificationLog.create({
                  data: {
                    userId: user.id,
                    notificationType: 'SCHEDULED_MESSAGE',
                    eventKey,
                    title: stage.title,
                    body: messageContent,
                    sentAt: now,
                  },
                });

                sentCount++;
              } else if (message.sendMethod === 'sms' || message.sendMethod === 'kakao') {
                // SMS/카카오톡은 외부 API 연동 필요 (알리고 등)
                // 여기서는 로그만 기록
                console.log(`[Scheduled Message] SMS/Kakao send to ${user.phone}: ${messageContent.substring(0, 50)}...`);

                await prisma.notificationLog.create({
                  data: {
                    userId: user.id,
                    notificationType: 'SCHEDULED_MESSAGE',
                    eventKey,
                    title: stage.title,
                    body: messageContent,
                    sentAt: now,
                  },
                });

                sentCount++;
              } else if (message.sendMethod === 'email') {
                // 이메일 발송 (외부 API 연동 필요)
                console.log(`[Scheduled Message] Email send to ${user.email}: ${messageContent.substring(0, 50)}...`);

                await prisma.notificationLog.create({
                  data: {
                    userId: user.id,
                    notificationType: 'SCHEDULED_MESSAGE',
                    eventKey,
                    title: stage.title,
                    body: messageContent,
                    sentAt: now,
                  },
                });

                sentCount++;
              }
            } catch (userError: any) {
              console.error(`[Scheduled Message] Failed to send to user ${user.id}:`, userError);
              failedCount++;
            }
          }

          console.log(`[Scheduled Message] Stage ${stage.stageNumber} completed: ${sentCount} sent, ${skippedCount} skipped, ${failedCount} failed`);
        }
      } catch (messageError: any) {
        console.error(`[Scheduled Message] Error processing message ${message.id}:`, messageError);
      }
    }

    console.log('[Scheduled Message] ✅ Processing completed');
  } catch (error) {
    console.error('[Scheduled Message] ❌ Error processing scheduled messages:', error);
  }
}

/**
 * Scheduled Message Sender 시작
 */
export function startScheduledMessageSender() {
  console.log('[Scheduled Message] 🚀 Starting Scheduled Message Sender...');

  // 매 5분마다 실행 (cron: '*/5 * * * *')
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Scheduled Message] ⏰ Running scheduled message check...');
    await processScheduledMessages();
  });

  console.log('[Scheduled Message] ✅ Scheduler started');
  console.log('[Scheduled Message]    - Check interval: Every 5 minutes');

  // 서버 시작 시 한 번 실행
  processScheduledMessages();
}

/**
 * 수동 실행 함수 (테스트용)
 */
export async function manualProcessScheduledMessages() {
  return processScheduledMessages();
}

