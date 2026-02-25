import { PrismaClient } from '@prisma/client';
// import { DefaultArgs } from '@prisma/client/runtime/library'; // DefaultArgs 임포트 제거

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  // namespace Prisma { // Prisma 네임스페이스 확장 제거
  //   interface PrismaClient extends DefaultArgs {
  //     session: import('@prisma/client').Prisma.SessionDelegate<DefaultArgs>;
  //   }
  // }
}

const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: ['error', 'warn'], // 필요하면 'query' 추가
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export default prisma as any; // 임시적으로 any로 캐스팅하여 session 속성 접근 허용
export { prisma }; // Named export for compatibility
