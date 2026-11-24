import prisma from './prisma.js';

export function checkDatabase() {
  return prisma.$queryRaw`SELECT 1`;
}
