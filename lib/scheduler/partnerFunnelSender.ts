// lib/scheduler/partnerFunnelSender.ts
// 퍼널 메시지 자동 발송 스케줄러
// AdminMessage 테이블의 예약 메시지를 파트너/관리자별 알리고 설정으로 자동 발송
// - partner_funnel: 파트너(대리점장/판매원) SMS 설정 사용
// - admin_funnel: 관리자 SMS 설정 사용

import cron from 'node-cron';
import prisma from '@/lib/prisma';

const ALIGO_BASE_URL = 'https://apis.aligo.in';

interface SmsConfig {
  apiKey: string;
  userId: string;
  senderPhone: string;
  provider: string;
  kakaoSenderKey?: string | null;
  kakaoChannelId?: string | null;
}

/**
 * 파트너의 SMS 설정 조회
 * BRANCH_MANAGER는 PartnerSmsConfig, AGENT는 AffiliateSmsConfig 사용
 */
async function getPartnerSmsConfig(profileId: number): Promise<SmsConfig | null> {
  try {
    // 먼저 프로필 타입 확인
    const profile = await prisma.affiliateProfile.findUnique({
      where: { id: profileId },
      select: { type: true },
    });

    if (!profile) {
      console.log(`[Funnel Sender] Profile ${profileId} not found`);
      return null;
    }

    const isManager = profile.type === 'BRANCH_MANAGER';

    if (isManager) {
      const config = await prisma.partnerSmsConfig.findUnique({
        where: { profileId },
      });
      if (!config || !config.isActive) {
        console.log(`[Funnel Sender] PartnerSmsConfig not found or inactive for profile ${profileId}`);
        return null;
      }
      return {
        apiKey: config.apiKey,
        userId: config.userId,
        senderPhone: config.senderPhone,
        provider: config.provider || 'aligo',
        kakaoSenderKey: config.kakaoSenderKey,
        kakaoChannelId: config.kakaoChannelId,
      };
    } else {
      const config = await prisma.affiliateSmsConfig.findUnique({
        where: { profileId },
      });
      if (!config || !config.isActive) {
        console.log(`[Funnel Sender] AffiliateSmsConfig not found or inactive for profile ${profileId}`);
        return null;
      }
      return {
        apiKey: config.apiKey,
        userId: config.userId,
        senderPhone: config.senderPhone,
        provider: config.provider || 'aligo',
        kakaoSenderKey: config.kakaoSenderKey,
        kakaoChannelId: config.kakaoChannelId,
      };
    }
  } catch (error) {
    console.error(`[Funnel Sender] Error getting SMS config for profile ${profileId}:`, error);
    return null;
  }
}

/**
 * 관리자의 SMS 설정 조회
 */
async function getAdminSmsConfig(adminId: number): Promise<SmsConfig | null> {
  try {
    const config = await prisma.adminSmsConfig.findUnique({
      where: { adminId },
    });

    if (!config || !config.isActive) {
      console.log(`[Funnel Sender] AdminSmsConfig not found or inactive for admin ${adminId}`);
      return null;
    }

    return {
      apiKey: config.apiKey,
      userId: config.userId,
      senderPhone: config.senderPhone,
      provider: config.provider || 'aligo',
      kakaoSenderKey: config.kakaoSenderKey,
      kakaoChannelId: config.kakaoChannelId,
    };
  } catch (error) {
    console.error(`[Funnel Sender] Error getting SMS config for admin ${adminId}:`, error);
    return null;
  }
}

/**
 * User 테이블에서 전화번호 조회
 */
async function getUserPhone(userId: number): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    return user?.phone || null;
  } catch (error) {
    console.error(`[Funnel Sender] Error getting phone for user ${userId}:`, error);
    return null;
  }
}

/**
 * 알리고 API로 SMS 발송
 */
async function sendSmsViaAligo(
  config: SmsConfig,
  phone: string,
  message: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const messageByteLength = new Blob([message]).size;
    const msgType = messageByteLength > 90 ? 'LMS' : 'SMS';

    const formData = new URLSearchParams();
    formData.append('key', config.apiKey);
    formData.append('user_id', config.userId);
    formData.append('sender', config.senderPhone);
    formData.append('receiver', phone.replace(/[^0-9]/g, ''));
    formData.append('msg', message);
    formData.append('msg_type', msgType);

    const response = await fetch(`${ALIGO_BASE_URL}/send/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `알리고 API 요청 실패 (${response.status}): ${text}` };
    }

    const result = await response.json();

    if (result.result_code !== '1') {
      return { success: false, error: result.message || `알리고 오류 (코드: ${result.result_code})`, result };
    }

    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * 퍼널 메시지 발송 처리
 * AdminMessage 테이블에서 발송 시간이 된 퍼널 메시지(partner_funnel, admin_funnel)를 처리
 */
async function processFunnelMessages() {
  try {
    const now = new Date();
    console.log('[Funnel Sender] 🔔 Processing funnel messages...', { now: now.toISOString() });

    // 발송 대기 중인 메시지 조회
    // sendAt <= now, isActive = true
    const pendingMessages = await prisma.adminMessage.findMany({
      where: {
        isActive: true,
        sendAt: {
          lte: now,
        },
      },
    });

    // 퍼널 메시지만 필터링 (partner_funnel 또는 admin_funnel)
    const funnelMessages = pendingMessages.filter((msg) => {
      const metadata = msg.metadata as any;
      const source = metadata?.source;
      if (source === 'partner_funnel') {
        return metadata?.leadPhone && metadata?.profileId;
      }
      if (source === 'admin_funnel') {
        return msg.userId; // admin_funnel은 userId가 필수
      }
      return false;
    });

    console.log(`[Funnel Sender] Found ${funnelMessages.length} pending funnel message(s)`);

    if (funnelMessages.length === 0) {
      return;
    }

    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // SMS 설정 캐싱 (프로필별, 관리자별)
    const partnerSmsConfigCache: Map<number, SmsConfig | null> = new Map();
    const adminSmsConfigCache: Map<number, SmsConfig | null> = new Map();
    // User 전화번호 캐싱
    const userPhoneCache: Map<number, string | null> = new Map();

    for (const message of funnelMessages) {
      try {
        const metadata = message.metadata as any;
        const source = metadata.source as string;

        let smsConfig: SmsConfig | null = null;
        let targetPhone: string | null = null;
        let logAction: string;
        let logDetails: any;

        if (source === 'partner_funnel') {
          // 파트너 퍼널: profileId로 SMS 설정, leadPhone 사용
          const profileId = metadata.profileId as number;
          targetPhone = metadata.leadPhone as string;
          const leadId = metadata.leadId as number;

          if (!partnerSmsConfigCache.has(profileId)) {
            partnerSmsConfigCache.set(profileId, await getPartnerSmsConfig(profileId));
          }
          smsConfig = partnerSmsConfigCache.get(profileId) || null;

          logAction = 'partner_funnel.sms.sent';
          logDetails = {
            messageId: message.id,
            leadId,
            profileId,
            phone: targetPhone,
            messageLength: message.content.length,
            funnelMessageId: metadata.funnelMessageId,
            stageNumber: metadata.stageNumber,
          };
        } else if (source === 'admin_funnel') {
          // 관리자 퍼널: adminId로 SMS 설정, User 테이블에서 전화번호 조회
          const adminId = message.adminId;
          const userId = message.userId as number;

          if (!adminSmsConfigCache.has(adminId)) {
            adminSmsConfigCache.set(adminId, await getAdminSmsConfig(adminId));
          }
          smsConfig = adminSmsConfigCache.get(adminId) || null;

          // User 전화번호 조회
          if (!userPhoneCache.has(userId)) {
            userPhoneCache.set(userId, await getUserPhone(userId));
          }
          targetPhone = userPhoneCache.get(userId) || null;

          logAction = 'admin_funnel.sms.sent';
          logDetails = {
            messageId: message.id,
            userId,
            adminId,
            phone: targetPhone,
            messageLength: message.content.length,
            funnelMessageId: metadata.funnelMessageId,
            stageNumber: metadata.stageNumber,
            groupId: metadata.groupId,
          };
        } else {
          continue;
        }

        // SMS 설정 확인
        if (!smsConfig) {
          console.log(`[Funnel Sender] No SMS config for message ${message.id} (source: ${source}), skipping`);
          await prisma.adminMessage.update({
            where: { id: message.id },
            data: {
              isActive: false,
              metadata: {
                ...metadata,
                sendError: 'SMS API 설정이 없거나 비활성화됨',
                sendAttemptedAt: now.toISOString(),
              },
            },
          });
          skippedCount++;
          continue;
        }

        // 전화번호 확인
        if (!targetPhone) {
          console.log(`[Funnel Sender] No phone number for message ${message.id} (source: ${source}), skipping`);
          await prisma.adminMessage.update({
            where: { id: message.id },
            data: {
              isActive: false,
              metadata: {
                ...metadata,
                sendError: '수신자 전화번호 없음',
                sendAttemptedAt: now.toISOString(),
              },
            },
          });
          skippedCount++;
          continue;
        }

        // SMS 발송
        console.log(`[Funnel Sender] Sending SMS to ${targetPhone} for message ${message.id} (${source})`);
        const sendResult = await sendSmsViaAligo(smsConfig, targetPhone, message.content);

        if (sendResult.success) {
          // 발송 성공
          await prisma.adminMessage.update({
            where: { id: message.id },
            data: {
              isActive: false,
              totalSent: { increment: 1 },
              metadata: {
                ...metadata,
                sentAt: now.toISOString(),
                aligoResult: sendResult.result,
              },
            },
          });

          // 발송 로그 기록
          await prisma.adminActionLog.create({
            data: {
              adminId: message.adminId,
              targetUserId: source === 'admin_funnel' ? message.userId : null,
              action: logAction,
              details: {
                ...logDetails,
                aligoResult: sendResult.result,
              },
            },
          });

          sentCount++;
          console.log(`[Funnel Sender] ✅ SMS sent successfully to ${targetPhone}`);
        } else {
          // 발송 실패
          console.error(`[Funnel Sender] ❌ SMS failed to ${targetPhone}:`, sendResult.error);

          const newAttemptCount = (metadata.sendAttemptCount || 0) + 1;

          await prisma.adminMessage.update({
            where: { id: message.id },
            data: {
              isActive: newAttemptCount < 3, // 3회 미만이면 활성 유지
              metadata: {
                ...metadata,
                lastSendError: sendResult.error,
                lastSendAttemptAt: now.toISOString(),
                sendAttemptCount: newAttemptCount,
                ...(newAttemptCount >= 3 ? { finalError: '3회 발송 실패로 비활성화됨' } : {}),
              },
            },
          });

          if (newAttemptCount >= 3) {
            console.log(`[Funnel Sender] Message ${message.id} deactivated after 3 failed attempts`);
          }

          failedCount++;
        }
      } catch (msgError: any) {
        console.error(`[Funnel Sender] Error processing message ${message.id}:`, msgError);
        failedCount++;
      }
    }

    console.log(`[Funnel Sender] ✅ Processing completed: ${sentCount} sent, ${failedCount} failed, ${skippedCount} skipped`);
  } catch (error) {
    console.error('[Funnel Sender] ❌ Error processing funnel messages:', error);
  }
}

/**
 * Funnel Sender 시작 (Partner + Admin)
 */
export function startPartnerFunnelSender() {
  console.log('[Funnel Sender] 🚀 Starting Funnel Sender...');

  // 매 5분마다 실행 (cron: '*/5 * * * *')
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Funnel Sender] ⏰ Running funnel message check...');
    await processFunnelMessages();
  });

  console.log('[Funnel Sender] ✅ Scheduler started');
  console.log('[Funnel Sender]    - Check interval: Every 5 minutes');
  console.log('[Funnel Sender]    - Handles: partner_funnel, admin_funnel');

  // 서버 시작 시 한 번 실행
  processFunnelMessages();
}

/**
 * 수동 실행 함수 (테스트용)
 */
export async function manualProcessFunnelMessages() {
  return processFunnelMessages();
}
