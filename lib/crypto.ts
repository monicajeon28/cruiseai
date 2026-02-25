import bcrypt from 'bcryptjs';

const ROUNDS = 10;

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hashed: string) {
  if (!hashed) return false;
  return bcrypt.compare(plain, hashed);
}

// 고정 텍스트에 대한 헬퍼(운영 편의)
export const hash3800 = () => hashPassword('3800');
export const hash0083 = () => hashPassword('0083');
