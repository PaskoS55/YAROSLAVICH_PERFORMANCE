import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.test.updateMany({ where: { code: 'MOB_OHS' }, data: { alertBelow: 4 } });
  await prisma.test.updateMany({ where: { code: 'MOB_SL' }, data: { alertBelow: 4 } });
  console.log('OK: alert thresholds set');
}
main().finally(() => prisma.$disconnect());