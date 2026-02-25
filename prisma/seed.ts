import prisma from '../lib/prisma';
import * as crypto from 'crypto';

async function main() {
  const guest1ExternalId = crypto.randomUUID();
  await prisma.user.create({
    data: {
      externalId: guest1ExternalId,
      name: '모니카',
      email: `guest-${guest1ExternalId}@local`,
      phone: '01098765432',
      password: '3800', // 비밀번호 추가
      onboarded: true, // 온보딩 완료 상태로 시드
    },
  });

  const guest2ExternalId = crypto.randomUUID();
  await prisma.user.create({
    data: {
      externalId: guest2ExternalId,
      name: '전혜선',
      email: `guest-${guest2ExternalId}@local`,
      phone: '01012345678',
      password: '0313', // 비밀번호 추가
      onboarded: true, // 온보딩 완료 상태로 시드
    },
  });

  // 관리자 계정 하나만 ADMIN으로 고정 (기존 사용자 수정)
  await prisma.user.updateMany({
    where: { phone: '01024958013' },
    data: { role: 'admin' },
  });
}

main().finally(() => prisma.$disconnect());
