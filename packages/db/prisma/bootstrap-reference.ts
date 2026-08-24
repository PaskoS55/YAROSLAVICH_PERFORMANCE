import { PrismaClient } from '@prisma/client';
import { seedReferenceData } from './reference-data';

async function main() {
  const prisma = new PrismaClient();
  try { await prisma.$transaction((tx) => seedReferenceData(tx)); }
  finally { await prisma.$disconnect(); }
}

void main().then(() => process.exit(0), () => process.exit(1));
