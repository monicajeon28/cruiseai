// prisma/seed-cms-templates.ts
// CMS 알림 템플릿 시드 데이터 생성

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📝 Creating CMS Notification Templates...');

  // D-Day 템플릿
  await prisma.cmsNotificationTemplate.upsert({
    where: { triggerCode: 'D_MINUS_7' },
    update: {},
    create: {
      triggerCode: 'D_MINUS_7',
      title: 'D-7: 전자기기 충전 및 확인',
      message: '[고객명]님, D-7일 남았습니다!\n카메라/보조배터리 충전하고 메모리 카드 확인!',
      isActive: true,
      updatedAt: new Date(),
    },
  });

  await prisma.cmsNotificationTemplate.upsert({
    where: { triggerCode: 'D_MINUS_1' },
    update: {},
    create: {
      triggerCode: 'D_MINUS_1',
      title: 'D-1: 드디어 내일!',
      message: '[크루즈명] [목적지] 여행 출발!\n여권/집합시간 최종 확인하세요.',
      isActive: true,
      updatedAt: new Date(),
    },
  });

  await prisma.cmsNotificationTemplate.upsert({
    where: { triggerCode: 'D_DAY' },
    update: {},
    create: {
      triggerCode: 'D_DAY',
      title: 'D-DAY: 오늘 출발!',
      message: '즐거운 항해 되세요! 🛳️',
      isActive: true,
      updatedAt: new Date(),
    },
  });

  // 승선/하선 템플릿
  await prisma.cmsNotificationTemplate.upsert({
    where: { triggerCode: 'PRE_EMBARKATION_3H' },
    update: {},
    create: {
      triggerCode: 'PRE_EMBARKATION_3H',
      title: '🚢 승선 안내',
      message: '[시간]에 [터미널] 터미널로 이동하실 시간입니다! 여권과 승선권을 확인하세요.',
      isActive: true,
      updatedAt: new Date(),
    },
  });

  await prisma.cmsNotificationTemplate.upsert({
    where: { triggerCode: 'PRE_DISEMBARKATION_1H' },
    update: {},
    create: {
      triggerCode: 'PRE_DISEMBARKATION_1H',
      title: '🏠 하선 준비 안내',
      message: '[하선시간]에 [위치]에서 하선합니다. 여권 회수 및 짐을 챙기세요!',
      isActive: true,
      updatedAt: new Date(),
    },
  });

  // 기항지 템플릿
  await prisma.cmsNotificationTemplate.upsert({
    where: { triggerCode: 'PORT_ARRIVAL_1H' },
    update: {},
    create: {
      triggerCode: 'PORT_ARRIVAL_1H',
      title: '📍 [기항지명] 도착 안내',
      message: '[도착시간]에 [기항지명]에 도착합니다! 여권과 소지품을 챙기세요.',
      isActive: true,
      updatedAt: new Date(),
    },
  });

  await prisma.cmsNotificationTemplate.upsert({
    where: { triggerCode: 'BOARDING_WARNING_1H' },
    update: {},
    create: {
      triggerCode: 'BOARDING_WARNING_1H',
      title: '⚠️ 긴급! 출항 1시간 전',
      message: '[출항시간]에 [기항지명]에서 출항합니다! 지금 바로 배로 돌아오셔야 합니다!',
      isActive: true,
      updatedAt: new Date(),
    },
  });

  // 피드백 요청
  await prisma.cmsNotificationTemplate.upsert({
    where: { triggerCode: 'FEEDBACK_REQUEST' },
    update: {},
    create: {
      triggerCode: 'FEEDBACK_REQUEST',
      title: '여행은 어떠셨나요?',
      message: '[고객명]님의 소중한 의견을 들려주세요. 더 나은 서비스로 보답하겠습니다! 💙',
      isActive: true,
      updatedAt: new Date(),
    },
  });

  // 재활성화 알림
  await prisma.cmsNotificationTemplate.upsert({
    where: { triggerCode: 'REACTIVATION_90D' },
    update: {},
    create: {
      triggerCode: 'REACTIVATION_90D',
      title: '다시 만나서 반가워요!',
      message: '[고객명]님, 지니가 보고 싶었어요! 새로운 크루즈 여행을 준비해볼까요? 🚢',
      isActive: true,
      updatedAt: new Date(),
    },
  });

  console.log('✅ Created CMS Notification Templates:');
  console.log('  - D_MINUS_7, D_MINUS_1, D_DAY');
  console.log('  - PRE_EMBARKATION_3H, PRE_DISEMBARKATION_1H');
  console.log('  - PORT_ARRIVAL_1H, BOARDING_WARNING_1H');
  console.log('  - FEEDBACK_REQUEST, REACTIVATION_90D');
  console.log('\n📊 Total: 9 templates created');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

