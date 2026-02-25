// lib/scheduler/proactiveEngine.ts
// Proactive Engine: 일정 기반 자동 알림 트리거 시스템

import cron from 'node-cron';
import prisma from '@/lib/prisma';
import { sendNotificationToUser, sendNotificationToUsers } from '@/lib/push/server';
import { parseTime } from '@/lib/utils';

/**
 * Proactive Engine: 여행 일정 기반 자동 알림 시스템
 */

interface TriggerContext {
  userId: number;
  userTripId: number;
  itinerary: any;
  userTrip: any;
}

/**
 * 알림 로그 중복 확인
 */
async function hasAlreadySent(
  userId: number,
  tripId: number | null,
  itineraryId: number | null,
  notificationType: string,
  eventKey: string
): Promise<boolean> {
  const existing = await prisma.notificationLog.findUnique({
    where: { eventKey },
  }).catch(() => null);

  return !!existing;
}

/**
 * 알림 발송 기록
 */
async function logNotification(
  userId: number,
  tripId: number | null,
  itineraryId: number | null,
  notificationType: string,
  eventKey: string,
  title: string,
  body: string
) {
  try {
    await prisma.notificationLog.create({
      data: {
        userId,
        tripId,
        itineraryId,
        notificationType,
        eventKey,
        title,
        body,
      },
    });
  } catch (error) {
    console.error('[Proactive] 알림 로그 기록 실패:', error);
  }
}

/**
 * Trigger 1: 여행 준비 (D-7, D-1)
 */
async function checkTravelPreparation() {
  try {
    const now = new Date();

    // D-7 체크 (7일 전)
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    sevenDaysLater.setHours(0, 0, 0, 0);
    const sevenDaysLaterEnd = new Date(sevenDaysLater.getTime() + 24 * 60 * 60 * 1000);

    const ddaySevenTrips = await prisma.userTrip.findMany({
      where: {
        status: 'Upcoming',
        startDate: {
          gte: sevenDaysLater,
          lt: sevenDaysLaterEnd,
        },
      },
      include: { User: true },
    });

    for (const userTrip of ddaySevenTrips) {
      const eventKey = `DDAY_SEVEN_${userTrip.id}`;
      const alreadySent = await hasAlreadySent(userTrip.userId, userTrip.id, null, 'DDAY', eventKey);

      if (!alreadySent) {
        const title = '🚢 여행 출발까지 7일 남았습니다!';
        const body = `${userTrip.cruiseName || '크루즈 여행'}을 위한 준비를 시작하세요. 필수 물품을 챙기고 여권을 확인해주세요!`;

        await sendNotificationToUser(userTrip.userId, { title, body });
        await logNotification(userTrip.userId, userTrip.id, null, 'DDAY', eventKey, title, body);
      }
    }

    // D-1 체크 (1일 전)
    const oneDayLater = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    oneDayLater.setHours(0, 0, 0, 0);
    const oneDayLaterEnd = new Date(oneDayLater.getTime() + 24 * 60 * 60 * 1000);

    const ddayOneTrips = await prisma.userTrip.findMany({
      where: {
        status: 'Upcoming',
        startDate: {
          gte: oneDayLater,
          lt: oneDayLaterEnd,
        },
      },
      include: { User: true },
    });

    for (const userTrip of ddayOneTrips) {
      const eventKey = `DDAY_ONE_${userTrip.id}`;
      const alreadySent = await hasAlreadySent(userTrip.userId, userTrip.id, null, 'DDAY', eventKey);

      if (!alreadySent) {
        const title = '🚢 내일 출발입니다!';
        const body = `${userTrip.cruiseName || '크루즈 여행'}이 내일 출발합니다. 최종 준비를 마쳐주세요!`;

        await sendNotificationToUser(userTrip.userId, { title, body });
        await logNotification(userTrip.userId, userTrip.id, null, 'DDAY', eventKey, title, body);
      }
    }

    console.log(`[Proactive] 여행 준비 알림 체크 완료 (${ddaySevenTrips.length + ddayOneTrips.length})`);
  } catch (error) {
    console.error('[Proactive] 여행 준비 트리거 오류:', error);
  }
}

/**
 * Trigger 2: 승선 안내 (승선 시간 3시간 전)
 */
async function checkEmbarkationWarning() {
  try {
    const now = new Date();
    const now3HoursLater = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    // Embarkation 일정 조회
    const embarkations = await prisma.itinerary.findMany({
      where: {
        type: 'Embarkation',
        date: {
          gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 어제부터
          lt: new Date(now.getTime() + 24 * 60 * 60 * 1000),  // 내일까지
        },
      },
      include: {
        UserTrip: { include: { User: true } },
      },
    });

    for (const itinerary of embarkations) {
      const eventKey = `EMBARKATION_${itinerary.id}`;
      const alreadySent = await hasAlreadySent(
        itinerary.UserTrip.userId,
        itinerary.userTripId,
        itinerary.id,
        'EMBARKATION',
        eventKey
      );

      if (alreadySent) continue;

      // 승선 시간 파싱
      const embarkationTime = itinerary.time || '14:00';
      const [hours, minutes] = parseTime(embarkationTime);
      const embarkationDateTime = new Date(itinerary.date);
      embarkationDateTime.setHours(hours, minutes, 0, 0);

      // 3시간 전인지 확인
      const threeHoursBefore = new Date(embarkationDateTime.getTime() - 3 * 60 * 60 * 1000);

      if (now >= threeHoursBefore && now < embarkationDateTime) {
        const title = '🚢 터미널로 향할 시간입니다!';
        const body = `${embarkationTime}에 승선합니다. 지금 바로 터미널로 이동해주세요! 여권을 꼭 챙기세요.`;

        await sendNotificationToUser(itinerary.UserTrip.userId, { title, body });
        await logNotification(
          itinerary.UserTrip.userId,
          itinerary.userTripId,
          itinerary.id,
          'EMBARKATION',
          eventKey,
          title,
          body
        );
      }
    }

    console.log('[Proactive] 승선 안내 체크 완료');
  } catch (error) {
    console.error('[Proactive] 승선 트리거 오류:', error);
  }
}

/**
 * Trigger 3: 하선 준비 (기항 도착 1시간 전)
 */
async function checkDisembarkationWarning() {
  try {
    const now = new Date();

    // PortVisit 일정 조회
    const portVisits = await prisma.itinerary.findMany({
      where: {
        type: 'PortVisit',
        date: {
          gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          lt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      include: {
        UserTrip: { include: { User: true } },
      },
    });

    for (const itinerary of portVisits) {
      const eventKey = `DISEMBARKATION_${itinerary.id}`;
      const alreadySent = await hasAlreadySent(
        itinerary.UserTrip.userId,
        itinerary.userTripId,
        itinerary.id,
        'DISEMBARKATION',
        eventKey
      );

      if (alreadySent) continue;

      // 도착 시간 파싱
      const arrivalTime = itinerary.arrival || '08:00';
      const [hours, minutes] = parseTime(arrivalTime);
      const arrivalDateTime = new Date(itinerary.date);
      arrivalDateTime.setHours(hours, minutes, 0, 0);

      // 1시간 전인지 확인
      const oneHourBefore = new Date(arrivalDateTime.getTime() - 60 * 60 * 1000);

      if (now >= oneHourBefore && now < arrivalDateTime) {
        const locationName = itinerary.location || '기항지';
        const title = `🏖️ ${locationName} 도착 1시간 전!`;
        const body = `${arrivalTime}에 ${locationName}에 도착합니다. 여권을 챙기고 준비해주세요!`;

        await sendNotificationToUser(itinerary.UserTrip.userId, { title, body });
        await logNotification(
          itinerary.UserTrip.userId,
          itinerary.userTripId,
          itinerary.id,
          'DISEMBARKATION',
          eventKey,
          title,
          body
        );
      }
    }

    console.log('[Proactive] 하선 준비 체크 완료');
  } catch (error) {
    console.error('[Proactive] 하선 트리거 오류:', error);
  }
}

/**
 * Trigger 4: 귀선 경고 ⭐️ (출항 1시간 전) - 가장 중요한 알림
 */
async function checkBoardingWarning() {
  try {
    const now = new Date();

    // PortVisit 일정 조회 (출항 시간 확인)
    const portVisits = await prisma.itinerary.findMany({
      where: {
        type: 'PortVisit',
        departure: { not: null }, // 출항 시간이 있는 경우만
        date: {
          gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          lt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      include: {
        UserTrip: { include: { User: true } },
      },
    });

    for (const itinerary of portVisits) {
      const eventKey = `BOARDING_WARNING_${itinerary.id}`;
      const alreadySent = await hasAlreadySent(
        itinerary.UserTrip.userId,
        itinerary.userTripId,
        itinerary.id,
        'BOARDING_WARNING',
        eventKey
      );

      if (alreadySent) continue;

      // 출항 시간 파싱
      const departureTime = itinerary.departure || '18:00';
      const [hours, minutes] = parseTime(departureTime);
      const departureDateTime = new Date(itinerary.date);
      departureDateTime.setHours(hours, minutes, 0, 0);

      // 1시간 전인지 확인
      const oneHourBefore = new Date(departureDateTime.getTime() - 60 * 60 * 1000);

      if (now >= oneHourBefore && now < departureDateTime) {
        const locationName = itinerary.location || '기항지';
        const title = '⚠️ 출항 1시간 전! 지금 바로 배로 돌아오세요!';
        const body = `${departureTime}에 ${locationName}에서 출항합니다. 늦으면 배를 놓칠 수 있습니다! 지금 바로 배로 돌아와주세요!`;

        await sendNotificationToUser(itinerary.UserTrip.userId, { title, body });
        await logNotification(
          itinerary.UserTrip.userId,
          itinerary.userTripId,
          itinerary.id,
          'BOARDING_WARNING',
          eventKey,
          title,
          body
        );
      }
    }

    console.log('[Proactive] 귀선 경고 체크 완료');
  } catch (error) {
    console.error('[Proactive] 귀선 경고 트리거 오류:', error);
  }
}

/**
 * Trigger 5: 여행 피드백 수집 (D+1) - 여행 종료 다음 날 정오
 */
async function checkFeedbackCollection() {
  try {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 어제 종료된 여행 조회 (D+1)
    const completedTrips = await prisma.userTrip.findMany({
      where: {
        status: 'Completed',
        endDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: { User: true },
    });

    for (const userTrip of completedTrips) {
      const eventKey = `FEEDBACK_COLLECTION_${userTrip.id}`;
      const alreadySent = await hasAlreadySent(
        userTrip.userId,
        userTrip.id,
        null,
        'FEEDBACK_COLLECTION',
        eventKey
      );

      if (alreadySent) continue;

      const userName = userTrip.User.name || '고객';
      const title = '✨ 여행은 즐거우셨나요?';
      const body = `${userName}님의 소중한 의견을 들려주세요. 여행 피드백을 5분 정도 기록해 주시면, 더 나은 크루즈 경험을 위해 활용하겠습니다!`;

      await sendNotificationToUser(userTrip.userId, { title, body });
      await logNotification(
        userTrip.userId,
        userTrip.id,
        null,
        'FEEDBACK_COLLECTION',
        eventKey,
        title,
        body
      );

      console.log(`[Proactive] 여행 ${userTrip.id} 피드백 수집 알림 발송 (사용자: ${userTrip.userId})`);
    }

    console.log('[Proactive] 피드백 수집 체크 완료');
  } catch (error) {
    console.error('[Proactive] 피드백 수집 트리거 오류:', error);
  }
}

/**
 * Trigger 6: 랜딩페이지 푸시 알림 (승선 시간, 하선 시간, 출항 경고)
 */
async function checkLandingPageNotifications() {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

    // 푸시 알림이 활성화된 랜딩페이지 조회
    // pushNotificationEnabled 필드가 없으므로 isActive와 isPublic만으로 필터링
    const landingPages = await prisma.landingPage.findMany({
      where: {
        isActive: true,
        isPublic: true,
      },
      include: {
        LandingPageView: {
          where: {
            userId: { not: null },
          },
          select: {
            userId: true,
          },
          distinct: ['userId'],
        },
      },
    });

    for (const landingPage of landingPages) {
      // 승선 시간 알림
      if (landingPage.boardingTime) {
        const [hours, minutes] = parseTime(landingPage.boardingTime);
        const eventKey = `LANDING_BOARDING_${landingPage.id}_${currentTime}`;

        // 현재 시간이 승선 시간과 일치하는지 확인 (10분 단위로 체크)
        if (currentHour === hours && Math.abs(currentMinute - minutes) <= 5) {
          const alreadySent = await hasAlreadySent(0, null, null, 'LANDING_BOARDING', eventKey);

          if (!alreadySent) {
            const title = `🚢 승선 시간 안내`;
            const body = `${landingPage.title || '크루즈 여행'}의 승선 시간(${landingPage.boardingTime})입니다. 지금 바로 터미널로 이동해주세요!`;

            // 랜딩페이지를 방문한 사용자들에게 알림 발송
            const userIds = landingPage.LandingPageView
              .map(view => view.userId)
              .filter((id): id is number => id !== null);

            if (userIds.length > 0) {
              await sendNotificationToUsers(userIds, { title, body });
              // 알림 로그 기록 (userId는 0으로 설정하여 랜딩페이지 알림임을 표시)
              await logNotification(0, null, null, 'LANDING_BOARDING', eventKey, title, body);
            }
          }
        }
      }

      // 하선 시간 알림
      if (landingPage.disembarkationTime) {
        const [hours, minutes] = parseTime(landingPage.disembarkationTime);
        const eventKey = `LANDING_DISEMBARKATION_${landingPage.id}_${currentTime}`;

        // 현재 시간이 하선 시간과 일치하는지 확인 (10분 단위로 체크)
        if (currentHour === hours && Math.abs(currentMinute - minutes) <= 5) {
          const alreadySent = await hasAlreadySent(0, null, null, 'LANDING_DISEMBARKATION', eventKey);

          if (!alreadySent) {
            const title = `🏖️ 하선 시간 안내`;
            const body = `${landingPage.title || '크루즈 여행'}의 하선 시간(${landingPage.disembarkationTime})입니다. 여권을 챙기고 준비해주세요!`;

            // 랜딩페이지를 방문한 사용자들에게 알림 발송
            const userIds = landingPage.LandingPageView
              .map(view => view.userId)
              .filter((id): id is number => id !== null);

            if (userIds.length > 0) {
              await sendNotificationToUsers(userIds, { title, body });
              // 알림 로그 기록
              await logNotification(0, null, null, 'LANDING_DISEMBARKATION', eventKey, title, body);
            }
          }
        }
      }

      // 출항 경고 알림 (출항 시간 1시간 전)
      if (landingPage.departureWarning && landingPage.boardingTime) {
        const [hours, minutes] = parseTime(landingPage.boardingTime);
        const eventKey = `LANDING_DEPARTURE_WARNING_${landingPage.id}_${currentTime}`;

        // 출항 시간 1시간 전인지 확인
        const departureTime = new Date();
        departureTime.setHours(hours, minutes, 0, 0);
        const oneHourBefore = new Date(departureTime.getTime() - 60 * 60 * 1000);

        if (now >= oneHourBefore && now < departureTime) {
          const alreadySent = await hasAlreadySent(0, null, null, 'LANDING_DEPARTURE_WARNING', eventKey);

          if (!alreadySent) {
            const title = `⚠️ 출항 1시간 전! 지금 바로 배로 돌아오세요!`;
            const body = `${landingPage.title || '크루즈 여행'}의 출항 시간(${landingPage.boardingTime})이 1시간 남았습니다. 늦으면 배를 놓칠 수 있습니다! 지금 바로 배로 돌아와주세요!`;

            // 랜딩페이지를 방문한 사용자들에게 알림 발송
            const userIds = landingPage.LandingPageView
              .map(view => view.userId)
              .filter((id): id is number => id !== null);

            if (userIds.length > 0) {
              await sendNotificationToUsers(userIds, { title, body });
              // 알림 로그 기록
              await logNotification(0, null, null, 'LANDING_DEPARTURE_WARNING', eventKey, title, body);
            }
          }
        }
      }
    }

    console.log('[Proactive] 랜딩페이지 푸시 알림 체크 완료');
  } catch (error) {
    console.error('[Proactive] 랜딩페이지 푸시 알림 체크 오류:', error);
  }
}

/**
 * 모든 트리거 실행
 */
async function runAllTriggers() {
  console.log('[Proactive] 엔진 실행 시작:', new Date().toISOString());

  try {
    await checkTravelPreparation();
    await checkEmbarkationWarning();
    await checkDisembarkationWarning();
    await checkBoardingWarning();
    await checkFeedbackCollection();
    await checkLandingPageNotifications();

    console.log('[Proactive] 엔진 실행 완료:', new Date().toISOString());
  } catch (error) {
    console.error('[Proactive] 엔진 실행 오류:', error);
  }
}

/**
 * Proactive Engine 시작 (매 10분마다 실행)
 */
export function startProactiveEngine() {
  // 매 10분마다 실행 (*/10 * * * *)
  const job = cron.schedule('*/10 * * * *', runAllTriggers, {
    // scheduled: false, // 자동 시작 안 함 - TaskOptions에 없음
  });

  job.start();
  console.log('[Proactive] Proactive Engine 시작됨 (매 10분)');

  return job;
}

/**
 * 테스트용: 즉시 실행
 */
export async function runProactiveEngineNow() {
  console.log('[Proactive] 즉시 실행 요청');
  await runAllTriggers();
}

// Alias for backwards compatibility
export const manualRunProactiveEngine = runProactiveEngineNow;

const proactiveEngine = { startProactiveEngine, runProactiveEngineNow, manualRunProactiveEngine };
export default proactiveEngine;

