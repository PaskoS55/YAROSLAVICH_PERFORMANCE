import { PrismaClient } from '@prisma/client';
import { initializeDemoDatabase, resetDemoDatabase } from './demo-data';

async function main() {
  const prisma = new PrismaClient();
  try { await (process.env.PASKO_DEMO_RESET === '1' ? resetDemoDatabase(prisma) : initializeDemoDatabase(prisma)); }
  finally { await prisma.$disconnect(); }
}
void main().then(() => process.exit(0), () => process.exit(1));
